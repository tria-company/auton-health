import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /auth/google-calendar/status
 * Verifica status da integração com Google Calendar
 */
export async function getGoogleCalendarStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // Buscar medico_id do usuário
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .maybeSingle();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Buscar token do Google Calendar para o médico
    const { data: token, error } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('medico_id', medico.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar token do Google Calendar:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar status'
      });
    }

    return res.json({
      success: true,
      connected: !!token,
      email: token?.calendar_name || null // Usando calendar_name pois não há campo email
    });

  } catch (error) {
    console.error('Erro ao verificar status do Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /auth/google-calendar/authorize
 * Inicia fluxo OAuth do Google Calendar
 */
export async function authorizeGoogleCalendar(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // TODO: Implementar fluxo OAuth com Google
    // Por enquanto, retorna URL de autorização mockada
    
    return res.json({
      success: true,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?...',
      message: 'Integração com Google Calendar não implementada ainda'
    });

  } catch (error) {
    console.error('Erro ao autorizar Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /auth/google-calendar/callback
 * Callback do OAuth do Google Calendar
 */
export async function handleGoogleCalendarCallback(req: AuthenticatedRequest, res: Response) {
  try {
    // TODO: Implementar callback OAuth
    return res.redirect('/agenda?calendar=connected');
  } catch (error) {
    console.error('Erro no callback do Google Calendar:', error);
    return res.redirect('/agenda?calendar=error');
  }
}

/**
 * POST /auth/google-calendar/disconnect
 * Desconecta integração com Google Calendar
 */
export async function disconnectGoogleCalendar(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // Buscar medico_id do usuário
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .maybeSingle();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Deletar token do médico
    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('medico_id', medico.id);

    if (error) {
      console.error('Erro ao desconectar Google Calendar:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao desconectar'
      });
    }

    return res.json({
      success: true,
      message: 'Google Calendar desconectado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao desconectar Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
