import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { google } from 'googleapis';

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
    console.log(`🔍 [STATUS] Verificando status para user_auth: ${req.user.id}`);

    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .maybeSingle();

    if (medicoError || !medico) {
      console.error('❌ [STATUS] Médico não encontrado para user_auth:', req.user.id, medicoError);
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    console.log(`🔍 [STATUS] Médico encontrado: ${medico.id}`);

    // Buscar token do Google Calendar para o médico
    const { data: tokens, error } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('medico_id', medico.id);

    if (error) {
      console.error('❌ [STATUS] Erro ao buscar token:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar status'
      });
    }

    // Pegar o primeiro token se existir
    const token = tokens && tokens.length > 0 ? tokens[0] : null;

    console.log(`🔍 [STATUS] Tokens encontrados: ${tokens?.length || 0}`);
    if (token) {
      console.log(`✅ [STATUS] Token válido encontrado: ${token.id} (Calendar: ${token.calendar_name})`);
    } else {
      console.warn(`⚠️ [STATUS] Nenhum token encontrado para medico_id: ${medico.id}`);
    }

    return res.json({
      success: true,
      connected: !!token,
      email: token?.calendar_name || null
    });

  } catch (error) {
    console.error('❌ [STATUS] Exceção ao verificar status:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

export async function authorizeGoogleCalendar(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('Google Calendar credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Configuração do Google Calendar incompleta'
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${req.user.id}`; // Passando ID do usuário no state para segurança/referência

    return res.json({
      success: true,
      authUrl
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
 * POST /auth/google-calendar/exchange
 * Troca código de autorização por tokens
 */
export async function exchangeGoogleCalendarToken(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorização não fornecido'
      });
    }

    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Google Calendar credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Configuração do Google Calendar incompleta'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Trocar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Tokens incompletos recebidos do Google:', tokens);
      // Nota: as vezes o refresh_token não vem se o usuário já tiver autorizado antes.
      // O ideal é forçar prompt=consent (já fizemos isso no authorize)
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

    // Salvar tokens no Supabase
    // A tabela google_calendar_tokens deve ter os campos: medico_id, access_token, refresh_token, expiry_date, etc.
    // Vamos verificar a estrutura da tabela depois se der erro, mas assumindo padrão.

    // Obter infos do perfil (email/nome da agenda) para salvar
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let calendarName = 'Google Calendar';
    try {
      const { data: calendarList } = await calendar.calendarList.list({ minAccessRole: 'owner' });
      if (calendarList.items && calendarList.items.length > 0) {
        const primary = calendarList.items.find(c => c.primary) || calendarList.items[0];
        calendarName = primary.summary || primary.id || 'Google Calendar';
      }
    } catch (e) {
      console.warn('Erro ao obter nome do calendário:', e);
    }

    const { error: upsertError } = await supabase
      .from('google_calendar_tokens')
      .upsert({
        medico_id: medico.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600 * 1000).toISOString(),
        calendar_name: calendarName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'medico_id' });

    if (upsertError) {
      console.error('Erro ao salvar tokens no banco:', upsertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar conexão'
      });
    }

    return res.json({
      success: true,
      message: 'Conectado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao trocar token do Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar conexão com Google'
    });
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

/**
 * POST /auth/google-calendar/events
 * Cria um evento no Google Calendar
 */
export async function createCalendarEvent(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { title, description, startTime, endTime, attendees } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos (title, startTime, endTime são obrigatórios)'
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

    // Buscar tokens
    const { data: tokensData, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('medico_id', medico.id)
      .maybeSingle();

    if (tokenError || !tokensData) {
      return res.status(400).json({
        success: false,
        error: 'Google Calendar não conectado'
      });
    }

    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Google Calendar credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Configuração do Google Calendar incompleta'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      expiry_date: new Date(tokensData.token_expiry).getTime()
    });

    // Configurar listener para atualizar reset de tokens se mudarem
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        // Atualizar no banco
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: tokens.access_token,
            token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
            updated_at: new Date().toISOString()
          })
          .eq('medico_id', medico.id);
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: title,
      description: description,
      start: {
        dateTime: startTime,
        timeZone: 'America/Sao_Paulo', // Ajuste conforme necessário ou receba do frontend
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/Sao_Paulo',
      },
      attendees: attendees ? attendees.map((email: string) => ({ email })) : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const { data: createdEvent } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return res.json({
      success: true,
      eventId: createdEvent.id,
      link: createdEvent.htmlLink
    });

  } catch (error: any) {
    console.error('Erro ao criar evento no Google Calendar:', error);

    // Tratamento específico para token inválido/expirado que não conseguiu refresh
    if (error.code === 401 || (error.response && error.response.status === 401)) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado ou inválido. Por favor, reconecte o Google Calendar.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao criar evento: ' + (error.message || 'Erro desconhecido')
    });
  }
}

/**
 * Deleta um evento do Google Calendar
 * @param doctorUserId ID do usuário do médico (auth.uid())
 * @param eventId ID do evento no Google Calendar
 */
export async function deleteCalendarEventInternal(doctorUserId: string, eventId: string): Promise<boolean> {
  try {
    // Buscar medico_id do usuário
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorUserId)
      .maybeSingle();

    if (medicoError || !medico) {
      console.error('Médico não encontrado para exclusão de evento');
      return false;
    }

    // Buscar tokens
    const { data: tokensData, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('medico_id', medico.id)
      .maybeSingle();

    if (tokenError || !tokensData) {
      console.warn('Google Calendar não conectado, ignorando exclusão de evento');
      return false;
    }

    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Credenciais do Google Calendar não configuradas');
      return false;
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      access_token: tokensData.access_token,
      refresh_token: tokensData.refresh_token,
      expiry_date: new Date(tokensData.token_expiry).getTime()
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    console.log(`✅ Evento ${eventId} removido do Google Calendar`);
    return true;

  } catch (error: any) {
    console.error('Erro ao deletar evento no Google Calendar:', error);
    return false;
  }
}

