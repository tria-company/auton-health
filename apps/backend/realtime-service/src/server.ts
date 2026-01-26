// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import express, { RequestHandler } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import transcriptionRoutes from './routes/transcription';
import sessionsRoutes from './routes/sessions';
import roomsRoutes, { setSocketIO } from './routes/rooms';
import recordingsRoutes from './routes/recordings';
import { PCMTranscriptionHandler } from './websocket/pcmTranscriptionHandler';
import { setupRoomsWebSocket, getOpenAIConnectionsStats } from './websocket/rooms';
import { setupPresencialWebSocket } from './websocket/presencial';

// Middlewares de segurança
import { corsMiddleware, getCorsOrigins } from './middleware/cors';
import { generalRateLimiter, aiRateLimiter } from './middleware/rateLimit';
import { securityConfig } from './config';

const app = express();
const httpServer = createServer(app);

// Obter origens CORS configuradas
const allowedOrigins = getCorsOrigins();
console.log('🔧 [REALTIME-SERVICE] CORS Origins:', allowedOrigins);

// Função para validar origem do Socket.IO (suporta wildcards e validação dinâmica)
const validateSocketOrigin = (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    // Permitir todas as origens se CORS_ALLOW_ALL estiver ativo
    if (process.env.CORS_ALLOW_ALL === 'true') {
        return callback(null, true);
    }

    // Permitir requisições sem origin (mobile apps, etc.)
    if (!origin) {
        return callback(null, true);
    }

    // Permitir Vercel
    if (origin.includes('vercel.app')) {
        return callback(null, true);
    }

    // Permitir autonhealth.com.br e subdomínios
    if (origin.includes('autonhealth.com.br')) {
        return callback(null, true);
    }

    // Verificar se está na lista de origens permitidas
    if (allowedOrigins.includes(origin)) {
        return callback(null, true);
    }

    // Verificar padrões com wildcard
    for (const allowed of allowedOrigins) {
        if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            const originWithoutProtocol = origin.replace(/^https?:\/\//, '');
            if (originWithoutProtocol.endsWith(domain) || originWithoutProtocol.endsWith('.' + domain)) {
                return callback(null, true);
            }
        }
    }

    // Bloquear origem não permitida
    console.warn(`🚫 [SOCKET.IO CORS] Origem bloqueada: ${origin}`);
    return callback(null, false);
};

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: validateSocketOrigin,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Session-ID", "X-User-ID"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Configurar handler de WebSocket PCM para transcrição
const pcmHandler = new PCMTranscriptionHandler();

// Configurar handlers de salas WebRTC
setupRoomsWebSocket(io);

// Configurar handlers de consultas presenciais
setupPresencialWebSocket(io);

// Passar referência do Socket.IO para as rotas REST de rooms (para notificações admin)
setSocketIO(io);

// ===== MIDDLEWARES DE SEGURANÇA =====

// Helmet - Headers de segurança HTTP
if (securityConfig.helmetEnabled) {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                connectSrc: [
                    "'self'",
                    "wss:",
                    "https:",
                    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
                ],
                mediaSrc: ["'self'", "blob:", "data:"],
                workerSrc: ["'self'", "blob:"],
                frameSrc: ["'self'"],
                fontSrc: ["'self'", "data:", "https:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        dnsPrefetchControl: { allow: false },
        frameguard: { action: "sameorigin" },
        hidePoweredBy: true,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        ieNoOpen: true,
        noSniff: true,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xssFilter: true,
    }));
    console.log('🛡️ [HELMET] Proteção de headers HTTP ativada');
}

// CORS
app.use(corsMiddleware);

// Rate Limiting - Geral
app.use(generalRateLimiter as unknown as RequestHandler);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy
app.set('trust proxy', 1);

// ===== HEALTH CHECK (Cloud Run) =====
// Este endpoint DEVE vir antes de qualquer middleware que possa bloquear
app.get('/health', (req, res) => {
    res.status(200).json({
        service: 'realtime-service',
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// ===== ROTAS DA API =====

// Rotas de transcrição com rate limit específico
app.use('/api/transcription', aiRateLimiter as unknown as RequestHandler, transcriptionRoutes);

// Rotas gerais
app.use('/api/sessions', sessionsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/recordings', recordingsRoutes);

// Endpoint para estatísticas de WebSocket PCM
app.get('/api/pcm-transcription/stats', (req, res) => {
    res.json(pcmHandler.getStats());
});

// Health check detalhado para WebSocket PCM
app.get('/api/pcm-transcription/health', (req, res) => {
    const stats = pcmHandler.getStats();
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        websocket: {
            server_running: true,
            active_connections: stats.totalConnections,
            active_sessions: stats.activeSessions,
        },
        system: {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
        },
        environment: {
            node_env: process.env.NODE_ENV,
            openai_key: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
        }
    };

    res.json(health);
});

// Endpoint para monitorar conexões OpenAI ativas
app.get('/api/openai/connections', (req, res) => {
    const stats = getOpenAIConnectionsStats();
    res.json(stats);
});

// Health check geral
app.get('/api/health', (req, res) => {
    res.json({
        service: 'realtime-service',
        status: 'OK',
        timestamp: new Date().toISOString(),
        features: {
            transcription: 'running',
            webrtc: 'enabled',
            socketio: io ? 'initialized' : 'not initialized',
            pcm_websocket: 'enabled'
        },
        environment: {
            node_env: process.env.NODE_ENV,
            port: process.env.PORT || 3002,
        }
    });
});

// Middleware de tratamento de erros
app.use((err: any, req: any, res: any, next: any) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

const PORT = parseInt(process.env.PORT || '3002', 10);

// Configurar upgrade para WebSocket PCM
httpServer.on('upgrade', (request, socket, head) => {
    try {
        pcmHandler.handleUpgrade(request, socket, head);
    } catch (error) {
        console.error('❌ [WS-UPGRADE] Error in handler:', error);
        socket.destroy();
    }
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 MedCall Realtime Service Started');
    console.log(`📡 Listening on port ${PORT}`);
    console.log(`🎙️ WebSocket transcription ready`);
    console.log(`🔊 Socket.IO initialized\n`);
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM recebido, encerrando servidor...');
    pcmHandler.destroy();
    httpServer.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT recebido, encerrando servidor...');
    pcmHandler.destroy();
    httpServer.close(() => {
        console.log('✅ Servidor encerrado com sucesso');
        process.exit(0);
    });
});

export { app, io };
