import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { rateLimitConfig, isDevelopment } from '../config';

/**
 * Rate Limiter Geral
 * Limita requisições por IP para todas as rotas
 */
export const generalRateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  message: {
    error: 'Too Many Requests',
    message: rateLimitConfig.message,
    retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
  },
  standardHeaders: rateLimitConfig.standardHeaders, // Retorna rate limit info nos headers `RateLimit-*`
  legacyHeaders: rateLimitConfig.legacyHeaders, // Desabilita headers `X-RateLimit-*`

  // Função para identificar o cliente (por IP)
  keyGenerator: (req: any): string => {
    // Prioriza X-Forwarded-For para proxies/load balancers
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip.trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },

  // Handler customizado quando rate limit é excedido
  handler: (req: any, res: any) => {
    console.warn(`⚠️ [RATE-LIMIT] Limite excedido para IP: ${req.ip} - ${req.method} ${req.path}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: rateLimitConfig.message,
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
    });
  },

  // Skip rate limiting em desenvolvimento (opcional)
  skip: (req: any): boolean => {
    // Pular health checks
    if (req.path === '/api/health' || req.path === '/health') {
      return true;
    }

    // ✅ Pular requisições do Socket.IO (polling faz muitas requisições)
    if (req.path.startsWith('/socket.io/') || req.path === '/socket.io') {
      return true;
    }

    return false;
  },
});

/**
 * Rate Limiter para Autenticação
 * Mais restritivo para endpoints de auth (prevenir brute force)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 tentativas de login por janela
  message: {
    error: 'Too Many Login Attempts',
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip.trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },

  handler: (req: any, res: any) => {
    console.warn(`🚨 [RATE-LIMIT-AUTH] Muitas tentativas de auth para IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Login Attempts',
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: 900,
    });
  },
});

/**
 * Rate Limiter para APIs de AI/Transcrição
 * Controla consumo de recursos de AI (mais caro)
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máx 30 requisições por minuto
  message: {
    error: 'AI Rate Limit Exceeded',
    message: 'Limite de requisições de AI atingido. Aguarde um momento.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any): string => {
    // Para AI, pode usar user ID se disponível (mais granular)
    const userId = req.headers['x-user-id'] as string;
    const forwarded = req.headers['x-forwarded-for'];

    if (userId) {
      return `user:${userId}`;
    }

    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip.trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },

  handler: (req: any, res: any) => {
    console.warn(`⚠️ [RATE-LIMIT-AI] Limite de AI excedido: ${req.ip} - ${req.path}`);
    res.status(429).json({
      error: 'AI Rate Limit Exceeded',
      message: 'Limite de requisições de AI atingido. Aguarde um momento.',
      retryAfter: 60,
    });
  },
});

/**
 * Rate Limiter para WebSocket/Streaming
 * Conexões de longa duração
 */
export const wsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máx 10 conexões por minuto
  message: {
    error: 'Connection Rate Limit',
    message: 'Muitas conexões. Aguarde antes de reconectar.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip.trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

// Export default para uso geral
export default generalRateLimiter;

