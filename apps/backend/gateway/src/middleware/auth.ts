import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config, isDevelopment } from '../config';

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
    // Ignorar requisições OPTIONS (preflight CORS)
    // O CORS middleware já trata essas requisições
    if (req.method === 'OPTIONS') {
      return next();
    }

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
    // Usar SERVICE_ROLE_KEY para garantir permissão de validação e configurar cliente SERVER-SIDE (stateless)
    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    // 4. Tentar validar com Supabase (Método Preferencial)
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error) throw error;
      if (user) {
        req.user = user;
        return next();
      }
    } catch (supabaseError: any) {
      // Verificar se é erro de indisponibilidade do Supabase
      if (supabaseError.name === 'AuthSessionMissingError' || supabaseError.message?.includes('Auth session missing')) {
        console.error('[AUTH] Supabase Auth indisponível:', supabaseError.message);
        res.status(503).json({
          success: false,
          error: 'Serviço de autenticação temporariamente indisponível'
        });
        return;
      }

      // Token inválido ou expirado
      console.error('[AUTH] Erro ao validar token:', supabaseError);
      res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
        details: isDevelopment ? supabaseError.message : undefined
      });
      return;
    }
  } catch (error) {
    console.error('[AUTH] Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar autenticação'
    });
  }
}
