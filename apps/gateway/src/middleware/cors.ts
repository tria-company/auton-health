import cors from 'cors';
import { Request } from 'express';
import { isDevelopment, isProduction } from '../config';

/**
 * Obtém origens CORS permitidas a partir das variáveis de ambiente
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;
  const frontendUrl = process.env.FRONTEND_URL;
  
  // Origens padrão de desenvolvimento
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  
  // Origens de produção padrão
  const defaultProdOrigins = [
    'https://auton-health-frontend.vercel.app',
    'https://medcall-ai-frontend-v2.vercel.app',
    'https://medcall-ai-homolog.vercel.app',
    '*.vercel.app' // Permitir qualquer subdomínio Vercel
  ];
  
  const origins: string[] = [];
  
  // Adicionar origens do CORS_ORIGINS (separadas por vírgula)
  if (envOrigins) {
    const parsedOrigins = envOrigins
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
    origins.push(...parsedOrigins);
  }
  
  // Adicionar FRONTEND_URL se definido
  if (frontendUrl && !origins.includes(frontendUrl)) {
    origins.push(frontendUrl);
  }
  
  // Em desenvolvimento, adicionar origens padrão
  if (isDevelopment) {
    defaultDevOrigins.forEach(origin => {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    });
  }
  
  // Se nenhuma origem foi configurada, usar defaults de produção
  if (origins.length === 0) {
    return isProduction ? defaultProdOrigins : defaultDevOrigins;
  }
  
  return origins;
}

/**
 * Verifica se uma origem é permitida
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  // Permitir requests sem origin (mobile apps, Postman, curl, etc.)
  if (!origin) {
    return true;
  }
  
  // Verificar se origin está na lista permitida
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Verificar padrões com wildcard (ex: *.vercel.app)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2); // Remove '*.' → 'vercel.app'
      // Remover protocolo da origin para comparação
      const originWithoutProtocol = origin.replace(/^https?:\/\//, '');
      if (originWithoutProtocol.endsWith(domain) || originWithoutProtocol.endsWith('.' + domain)) {
        return true;
      }
    }
  }
  
  return false;
}

// Cache das origens permitidas
let cachedOrigins: string[] | null = null;

/**
 * Middleware CORS Configurável
 * 
 * Configurações via variáveis de ambiente:
 * - CORS_ORIGINS: Lista de origens separadas por vírgula
 * - FRONTEND_URL: URL do frontend (adicionado automaticamente)
 * - CORS_ALLOW_ALL: Se "true", permite todas as origens (NÃO recomendado em produção)
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Modo permissivo (apenas para debug/desenvolvimento temporário)
    if (process.env.CORS_ALLOW_ALL === 'true') {
      if (isProduction) {
        console.warn('⚠️ [CORS] CORS_ALLOW_ALL está ativo em PRODUÇÃO - isso é inseguro!');
      }
      return callback(null, true);
    }
    
    // Obter origens permitidas (com cache)
    if (!cachedOrigins) {
      cachedOrigins = getAllowedOrigins();
      console.log('🔧 [CORS] Origens permitidas:', cachedOrigins);
    }
    
    const allowed = isOriginAllowed(origin, cachedOrigins);
    
    if (allowed) {
      console.log(`✅ [CORS] Origem permitida: ${origin}`);
      return callback(null, true);
    }
    
    // Log de origem bloqueada
    console.warn(`🚫 [CORS] Origem bloqueada: ${origin}`);
    console.warn(`🚫 [CORS] Origens permitidas:`, cachedOrigins);
    
    // Em desenvolvimento, ser mais permissivo e apenas logar
    if (isDevelopment) {
      console.warn(`⚠️ [CORS] Permitindo origem não configurada em dev: ${origin}`);
      return callback(null, true);
    }
    
    // Em produção, bloquear
    callback(new Error(`CORS: Origem não permitida: ${origin}`));
  },
  
  // Permitir envio de cookies/credenciais
  credentials: true,
  
  // Headers permitidos nas requisições
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Session-ID',
    'X-User-ID',
    'X-Audio-Format',
    'X-Sample-Rate',
    'X-Request-ID',
    'Cache-Control',
    'Pragma',
  ],
  
  // Métodos HTTP permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  // Headers expostos para o cliente
  exposedHeaders: [
    'X-Total-Count',
    'X-Request-ID',
    // Headers de Rate Limit
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
    // Legacy headers
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],

  // Cache do preflight (24 horas)
  maxAge: 86400,
  
  // Responder com status 200 para preflight (alguns browsers antigos precisam)
  optionsSuccessStatus: 200,
});

/**
 * Função para recarregar as origens CORS em runtime
 * Útil se você precisar atualizar as origens sem reiniciar o servidor
 */
export function reloadCorsOrigins(): string[] {
  cachedOrigins = null;
  cachedOrigins = getAllowedOrigins();
  console.log('🔄 [CORS] Origens recarregadas:', cachedOrigins);
  return cachedOrigins;
}

/**
 * Retorna as origens CORS atuais (para debug/health check)
 */
export function getCorsOrigins(): string[] {
  if (!cachedOrigins) {
    cachedOrigins = getAllowedOrigins();
  }
  return [...cachedOrigins];
}

export default corsMiddleware;
