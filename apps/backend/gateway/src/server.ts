// Log imediato para confirmar que o servidor está sendo executado
console.log('🚀 [SERVER] Iniciando servidor gateway...');
console.log('🚀 [SERVER] Node version:', process.version);
console.log('🚀 [SERVER] Process PID:', process.pid);

// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';

// Rotas locais
import twilioRoutes from './routes/index';
import auditRoutes from './routes/audit';
import clinicRoutes from './routes/clinic';
import dashboardRoutes from './routes/dashboard';
import consultationsRoutes from './routes/consultations';
import patientsRoutes from './routes/patients';
import cadastroAnamneseRoutes from './routes/cadastro-anamnese';
import sinteseAnaliticaRoutes from './routes/sintese-analitica';
import anamneseRoutes from './routes/anamnese';
import { getAnamneseInicial } from './controllers/anamneseController';
import { authenticateToken } from './middleware/auth';
import diagnosticoRoutes from './routes/diagnostico';
import solucoesRoutes from './routes/solucoes';
import agendaRoutes from './routes/agenda';
import adminRoutes from './routes/admin';
import examesRoutes from './routes/exames';
import googleCalendarRoutes from './routes/google-calendar';
import consultasAdminRoutes from './routes/consultas-admin';
import emailRoutes from './routes/email';
import whatsappRoutes from './routes/whatsapp';
import aiRoutes from './routes/ai';

// Rotas de Proxy
import proxyRoutes from './routes/proxy';
import webhookRoutes from './routes/webhook';

// Middlewares de segurança
import { corsMiddleware, getCorsOrigins } from './middleware/cors';
import { generalRateLimiter } from './middleware/rateLimit';
import { securityConfig } from './config';

const app = express();
const httpServer = createServer(app);

// Desabilitar redirect automático de trailing slash
// Isso evita que /dashboard seja redirecionado para /dashboard/
app.set('strict routing', false);

// Obter origens CORS configuradas
const allowedOrigins = getCorsOrigins();
console.log('🔧 [GATEWAY] CORS Origins:', allowedOrigins);

// ===== MIDDLEWARE CRÍTICO: Interceptar OPTIONS ANTES de tudo =====
// Este middleware DEVE ser o primeiro para evitar redirects que quebram CORS preflight
// Usar app.all() para interceptar antes do roteamento
app.all('*', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log('🔍 [OPTIONS HANDLER] Interceptando requisição OPTIONS:', req.url);
    // Aplicar CORS manualmente
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-User-ID, X-Audio-Format, X-Sample-Rate, X-Request-ID, Cache-Control, Pragma');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    console.log('✅ [OPTIONS HANDLER] Respondendo 200 para OPTIONS');
    return res.status(200).end();
  }
  next();
});

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
app.use(generalRateLimiter);

// ===== PROXY ROUTES (Antes do Body Parser) =====
// O proxy deve vir antes do body parser para streaming/upload funcionar corretamente (se necessário)
// Mas para rotas normais, é bom ter body parser antes? 
// http-proxy-middleware recomenda body-parser antes SE você precisar modificar o body, 
// caso contrário, o proxy lida com o stream.
// Vamos colocar o proxy /api aqui para redirecionar para microserviços

app.use('/api', proxyRoutes);

// ===== LOCAL ROUTES =====

// Body parsers (para rotas locais)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy
app.set('trust proxy', 1);

// Rotas locais (Audit, Clinic, Twilio, etc)
app.use('/api/audit', auditRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api', twilioRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/webhooks', webhookRoutes);

// Rotas migradas do Frontend (Monolito legado que ainda vive no Gateway por enquanto)
// Handler específico para OPTIONS /dashboard antes de registrar as rotas
app.options('/dashboard', corsMiddleware, (req, res) => {
  res.status(200).end();
});
app.options('/dashboard/', corsMiddleware, (req, res) => {
  res.status(200).end();
});

app.use('/dashboard', dashboardRoutes);
// Também registrar explicitamente sem trailing slash para evitar redirects
app.use('/dashboard/', dashboardRoutes);
app.use('/consultations', consultationsRoutes);
app.use('/patients', patientsRoutes);
app.use('/cadastro-anamnese', cadastroAnamneseRoutes);
app.use('/sintese-analitica', sinteseAnaliticaRoutes);
// Rota direta GET /anamnese-inicial (compatibilidade com frontend que chama sem prefixo /anamnese)
app.get('/anamnese-inicial', authenticateToken, getAnamneseInicial);
app.use('/anamnese', anamneseRoutes);
app.use('/diagnostico', diagnosticoRoutes);
app.use('/', solucoesRoutes);
app.use('/api', solucoesRoutes);
app.use('/agenda', agendaRoutes);
app.use('/admin', adminRoutes);
app.use('/exames', examesRoutes);
app.use('/api/auth/google-calendar', googleCalendarRoutes);
app.use('/ai', aiRoutes);
app.use('/admin/consultations', consultasAdminRoutes);
app.use('/email', emailRoutes);
app.use('/whatsapp', whatsappRoutes);

// Health check do Gateway (para Cloud Run e Docker)
app.get('/health', (req, res) => {
  res.json({
    service: 'gateway',
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    service: 'gateway',
    status: 'OK',
    timestamp: new Date().toISOString(),
    proxies: {
      realtime: process.env.REALTIME_SERVICE_URL || 'http://localhost:3002',
    },
    environment: {
      node_env: process.env.NODE_ENV,
      port: process.env.PORT || 3001,
    }
  });
});

// Middleware de tratamento de erros
app.use((err: any, req: any, res: any, next: any) => {
  console.error('❌ [GATEWAY] Erro no servidor:', err);
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
    method: req.method,
    service: 'gateway'
  });
});

// Cloud Run define PORT=8080, mas aceita qualquer porta via env
const PORT = parseInt(process.env.PORT || '8080', 10);

console.log('🔧 [STARTUP] Iniciando servidor...');
console.log('🔧 [STARTUP] PORT (process.env.PORT):', process.env.PORT);
console.log('🔧 [STARTUP] PORT (usado):', PORT);
console.log('🔧 [STARTUP] NODE_ENV:', process.env.NODE_ENV);

// Tratamento de erros no servidor
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  console.error('❌ [SERVER] Erro no servidor HTTP:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ [SERVER] Porta ${PORT} já está em uso`);
  }
  process.exit(1);
});

// Iniciar servidor imediatamente - CRÍTICO para Cloud Run
console.log('🔧 [SERVER] Chamando httpServer.listen()...');
console.log('🔧 [SERVER] Porta:', PORT);
console.log('🔧 [SERVER] Host: 0.0.0.0');

try {
  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('✅ [SERVER] CALLBACK: Servidor iniciado com sucesso!');
    console.log('🚀 MedCall Gateway Server Started');
    console.log(`📡 Listening on port ${PORT} (0.0.0.0:${PORT})`);
    console.log(`✅ Health check disponível em: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ Health check disponível em: http://localhost:${PORT}/health`);
    console.log(`twisted_rightwards_arrows Proxying /api requests to Microservices\n`);

    // Verificar se realmente está escutando
    const address = server.address();
    console.log('🔧 [SERVER] Server address:', address);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('❌ [SERVER] Erro no servidor HTTP:', error);
    console.error('❌ [SERVER] Error code:', error.code);
    console.error('❌ [SERVER] Error message:', error.message);
    console.error('❌ [SERVER] Error stack:', error.stack);
    process.exit(1);
  });

  server.on('listening', () => {
    console.log('✅ [SERVER] Evento "listening" disparado');
    const address = server.address();
    console.log('✅ [SERVER] Servidor escutando em:', address);
  });

  console.log('✅ [SERVER] httpServer.listen() chamado (não bloqueante)');
} catch (error) {
  console.error('❌ [SERVER] Erro ao tentar iniciar servidor (catch):', error);
  console.error('❌ [SERVER] Error stack:', error instanceof Error ? error.stack : 'N/A');
  process.exit(1);
}

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM recebido, encerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT recebido, encerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

export { app };