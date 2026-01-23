import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Interface para adicionar user ao Request
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

/**
 * Middleware de autenticação
 * Verifica o token JWT no header Authorization
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Criar cliente Supabase temporário para validar o token
    // Usar ANON_KEY para validar tokens de usuário
    if (!config.SUPABASE_ANON_KEY) {
      console.error('[AUTH] SUPABASE_ANON_KEY não configurada');
      res.status(500).json({
        success: false,
        error: 'Configuração de autenticação inválida'
      });
      return;
    }

    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    // Verificar token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[AUTH] Erro ao validar token:', error);
      res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
      return;
    }

    // Adicionar usuário ao request
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH] Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar autenticação'
    });
  }
}
