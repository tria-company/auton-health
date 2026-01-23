// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import transcriptionRoutes from './routes/transcription';
import sessionsRoutes from './routes/sessions';
import roomsRoutes, { setSocketIO } from './routes/rooms';
import twilioRoutes from './routes/index';
import aiPricingRoutes from './routes/aiPricing';
import auditRoutes from './routes/audit';
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
console.log('🔧 [SERVER] CORS Origins:', allowedOrigins);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ALLOW_ALL === 'true' ? '*' : allowedOrigins,
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

// ✅ Configurar handlers de consultas presenciais
setupPresencialWebSocket(io);

// Passar referência do Socket.IO para as rotas REST de rooms (para notificações admin)
setSocketIO(io);

// ===== MIDDLEWARES DE SEGURANÇA =====

// Helmet - Headers de segurança HTTP
if (securityConfig.helmetEnabled) {
  app.use(helmet({
    // Configurações customizadas para WebRTC
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Necessário para alguns worklets
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "wss:", // WebSocket
          "https:", // APIs externas
          ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
        ],
        mediaSrc: ["'self'", "blob:", "data:"], // Para áudio/vídeo
        workerSrc: ["'self'", "blob:"], // Para Web Workers/Worklets
        frameSrc: ["'self'"],
        fontSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    // Cross-Origin policies para WebRTC
    crossOriginEmbedderPolicy: false, // Desabilitar para permitir recursos cross-origin
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Outras configs de segurança
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "sameorigin" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 ano
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

// CORS - Configurável via variáveis de ambiente
app.use(corsMiddleware);

// Rate Limiting - Geral
app.use(generalRateLimiter);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy (necessário para rate limit funcionar corretamente atrás de proxy/load balancer)
app.set('trust proxy', 1);



// ===== ROTAS DA API =====

// Rotas de transcrição/AI com rate limit específico
app.use('/api/transcription', aiRateLimiter, transcriptionRoutes);
app.use('/api/ai-pricing', aiRateLimiter, aiPricingRoutes);

// Rotas gerais (usam rate limit geral)
app.use('/api/sessions', sessionsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api', twilioRoutes);
import clinicRoutes from './routes/clinic';
app.use('/api/clinic', clinicRoutes);
import dashboardRoutes from './routes/dashboard';
app.use('/dashboard', dashboardRoutes);
import consultationsRoutes from './routes/consultations';
app.use('/consultations', consultationsRoutes);
import patientsRoutes from './routes/patients';
app.use('/patients', patientsRoutes);
import cadastroAnamneseRoutes from './routes/cadastro-anamnese';
app.use('/cadastro-anamnese', cadastroAnamneseRoutes);
import sinteseAnaliticaRoutes from './routes/sintese-analitica';
app.use('/sintese-analitica', sinteseAnaliticaRoutes);

// Novas rotas migradas do frontend
import anamneseRoutes from './routes/anamnese';
app.use('/anamnese', anamneseRoutes);
import diagnosticoRoutes from './routes/diagnostico';
app.use('/diagnostico', diagnosticoRoutes);
import solucoesRoutes from './routes/solucoes';
app.use('/', solucoesRoutes); // Registra múltiplas rotas de soluções
import agendaRoutes from './routes/agenda';
app.use('/agenda', agendaRoutes);
import adminRoutes from './routes/admin';
app.use('/admin', adminRoutes);
import examesRoutes from './routes/exames';
app.use('/exames', examesRoutes);
app.use('/processar-exames', examesRoutes);
import googleCalendarRoutes from './routes/google-calendar';
app.use('/auth/google-calendar', googleCalendarRoutes);
import consultasAdminRoutes from './routes/consultas-admin';
app.use('/admin/consultations', consultasAdminRoutes);

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

// 📊 Endpoint para monitorar conexões OpenAI ativas em tempo real
app.get('/api/openai/connections', (req, res) => {
  const stats = getOpenAIConnectionsStats();
  res.json(stats);
});

// 📊 Endpoint resumido para verificar custos em tempo real
app.get('/api/openai/costs', (req, res) => {
  const stats = getOpenAIConnectionsStats();
  res.json({
    activeConnections: stats.summary.totalConnections,
    totalMinutesConsumed: stats.summary.totalMinutes,
    estimatedCostUSD: stats.summary.totalEstimatedCost,
    maxConnectionTimeMinutes: stats.summary.maxConnectionTime,
    warning: stats.warning,
    details: stats.connections.map(c => ({
      user: c.userName,
      room: c.roomId,
      minutes: c.durationMinutes,
      cost: `$${c.estimatedCost.toFixed(2)}`,
      status: c.status
    }))
  });
});

// Suas outras rotas existentes podem ser adicionadas aqui
// app.use('/api/sessions', sessionRoutes);
// app.use('/api/consultations', consultationRoutes);

// Health check expandido
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      transcription: 'running',
      webrtc: 'native-integration',
      socketio: io ? 'initialized' : 'not initialized'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: process.env.PORT || 3001,
      frontend_url: process.env.FRONTEND_URL || 'not set'
    },
    security: {
      helmet: securityConfig.helmetEnabled ? 'enabled' : 'disabled',
      cors: process.env.CORS_ALLOW_ALL === 'true' ? 'allow-all (INSECURE)' : 'configured',
      cors_origins_count: getCorsOrigins().length,
      rate_limit: 'enabled',
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

const PORT = parseInt(process.env.PORT || '3001', 10);

// Configurar upgrade para WebSocket PCM com debug detalhado

httpServer.on('upgrade', (request, socket, head) => {
  /**
  console.log('🔄 [WS-UPGRADE] Request received:', {
    url: request.url,
    method: request.method,
    headers: {
      connection: request.headers.connection,
      upgrade: request.headers.upgrade,
      'sec-websocket-key': request.headers['sec-websocket-key'],
      'sec-websocket-version': request.headers['sec-websocket-version'],
      origin: request.headers.origin
    }
  });
  */
  try {
    pcmHandler.handleUpgrade(request, socket, head);
    // console.log('✅ [WS-UPGRADE] Handled by PCM handler');
  } catch (error) {
    console.error('❌ [WS-UPGRADE] Error in handler:', error);
    socket.destroy();
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 MedCall Gateway Server Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌐 Ready to accept connections from Cloud Run\n`);
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