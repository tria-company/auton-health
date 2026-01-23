import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isDevelopment } from '../config';

// Interface para erros customizados
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

// Middleware de tratamento de erros
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erro interno do servidor';
  let code = error.code || 'INTERNAL_ERROR';

  // Log do erro (sempre registrar)
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    error: error.message,
    stack: isDevelopment ? error.stack : undefined,
    statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Tratar diferentes tipos de erro
  if (error instanceof ZodError) {
    // Erros de validação do Zod
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Dados inválidos';
    
    const response = {
      error: {
        code,
        message,
        details: isDevelopment ? error.errors : undefined,
      },
      timestamp: new Date().toISOString(),
      path: req.url,
    };
    
    res.status(statusCode).json(response);
    return;
  }

  // Erros específicos do OpenAI
  if (error.message.includes('OpenAI') || error.message.includes('API key')) {
    statusCode = 503;
    code = 'AI_SERVICE_ERROR';
    message = 'Serviço de IA temporariamente indisponível';
  }

  // Erros específicos do LiveKit
  if (error.message.includes('LiveKit') || error.message.includes('token')) {
    statusCode = 503;
    code = 'MEDIA_SERVICE_ERROR';
    message = 'Serviço de mídia temporariamente indisponível';
  }

  // Erros específicos do Supabase
  if (error.message.includes('Supabase') || error.message.includes('Database')) {
    statusCode = 503;
    code = 'DATABASE_ERROR';
    message = 'Banco de dados temporariamente indisponível';
  }

  // Erros de rate limiting
  if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = 'Muitas requisições. Tente novamente em alguns minutos.';
  }

  // Erros de autenticação
  if (error.message.includes('Unauthorized') || error.message.includes('Authentication')) {
    statusCode = 401;
    code = 'AUTHENTICATION_ERROR';
    message = 'Credenciais inválidas ou ausentes';
  }

  // Erros de autorização
  if (error.message.includes('Forbidden') || error.message.includes('Access denied')) {
    statusCode = 403;
    code = 'AUTHORIZATION_ERROR';
    message = 'Acesso negado para este recurso';
  }

  // Resposta padrão
  const response: any = {
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
    path: req.url,
  };

  // Incluir stack trace apenas em desenvolvimento
  if (isDevelopment) {
    response.error.stack = error.stack;
    response.error.details = error;
  }

  // Headers de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  res.status(statusCode).json(response);
};

// Middleware para capturar erros async
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Classe para erros customizados
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'APP_ERROR') {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Erros específicos pré-definidos
export class ValidationError extends AppError {
  constructor(message: string = 'Dados de entrada inválidos') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Credenciais inválidas') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflito de dados') {
    super(message, 409, 'CONFLICT');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = 'Serviço') {
    super(`${service} temporariamente indisponível`, 503, 'SERVICE_UNAVAILABLE');
  }
}