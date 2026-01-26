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
import diagnosticoRoutes from './routes/diagnostico';
import solucoesRoutes from './routes/solucoes';
import agendaRoutes from './routes/agenda';
import adminRoutes from './routes/admin';
import examesRoutes from './routes/exames';
import googleCalendarRoutes from './routes/google-calendar';
import consultasAdminRoutes from './routes/consultas-admin';
import emailRoutes from './routes/email';

// Rotas de Proxy
import proxyRoutes from './routes/proxy';

// Middlewares de segurança
import { corsMiddleware, getCorsOrigins } from './middleware/cors';
import { generalRateLimiter } from './middleware/rateLimit';
import { securityConfig } from './config';

const app = express();
const httpServer = createServer(app);

// Obter origens CORS configuradas
const allowedOrigins = getCorsOrigins();
console.log('🔧 [GATEWAY] CORS Origins:', allowedOrigins);

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

// Rotas migradas do Frontend (Monolito legado que ainda vive no Gateway por enquanto)
app.use('/dashboard', dashboardRoutes);
app.use('/consultations', consultationsRoutes);
app.use('/patients', patientsRoutes);
app.use('/cadastro-anamnese', cadastroAnamneseRoutes);
app.use('/sintese-analitica', sinteseAnaliticaRoutes);
app.use('/anamnese', anamneseRoutes);
app.use('/diagnostico', diagnosticoRoutes);
app.use('/', solucoesRoutes);
app.use('/agenda', agendaRoutes);
app.use('/admin', adminRoutes);
app.use('/exames', examesRoutes);
app.use('/processar-exames', examesRoutes);
app.use('/auth/google-calendar', googleCalendarRoutes);
app.use('/admin/consultations', consultasAdminRoutes);
app.use('/email', emailRoutes);

// Health check do Gateway
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

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 MedCall Gateway Server Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`twisted_rightwards_arrows Proxying /api requests to Microservices\n`);
});

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