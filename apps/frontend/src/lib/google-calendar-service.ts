/**
 * Google Calendar Service
 * Serviço para sincronização de consultas com o Google Calendar
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Tipos
interface GoogleCalendarTokens {
  id: string;
  medico_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string | null;
  sync_enabled: boolean;
}

interface ConsultationData {
  id: string;
  patient_name: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  consulta_inicio?: string;
  created_at: string;
  duration?: number;
  notes?: string;
  doctor_name?: string; // Nome do médico
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
}

// Cores do Google Calendar (por tipo de consulta)
const CALENDAR_COLORS = {
  TELEMEDICINA: '9',  // Azul
  PRESENCIAL: '5',    // Amarelo/Banana
};

/**
 * Verifica se o médico tem Google Calendar conectado e retorna os tokens
 */
export async function getMedicoGoogleCalendarTokens(
  supabase: SupabaseClient,
  medicoId: string
): Promise<GoogleCalendarTokens | null> {
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('medico_id', medicoId)
    .eq('sync_enabled', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Renova o access_token se estiver expirado
 */
export async function refreshAccessTokenIfNeeded(
  supabase: SupabaseClient,
  tokens: GoogleCalendarTokens
): Promise<string | null> {
  const tokenExpiry = new Date(tokens.token_expiry);
  const now = new Date();

  // Se o token ainda é válido (com margem de 5 minutos), retorna o atual
  if (tokenExpiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokens.access_token;
  }

  // Token expirado ou prestes a expirar, renovar
  console.log('[GoogleCalendar] Renovando access_token...');

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[GoogleCalendar] Variáveis de ambiente não configuradas');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.success) {
      const errorData = await response.text();
      console.error('[GoogleCalendar] Erro ao renovar token:', errorData);
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    const newExpiry = new Date(Date.now() + expiresIn * 1000);

    // Atualizar token no banco
    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: newAccessToken,
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokens.id);

    console.log('[GoogleCalendar] Token renovado com sucesso');
    return newAccessToken;
  } catch (error) {
    console.error('[GoogleCalendar] Erro ao renovar token:', error);
    return null;
  }
}

/**
 * Formata data para DD/MM/YYYY
 */
function formatDateBR(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata hora para HH:MM
 */
function formatTimeBR(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Gera o link da consulta para o paciente
 */
function getConsultationLink(consultationId: string): string {
  // Usar variável de ambiente ou fallback para localhost
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/consulta/${consultationId}`;
}

/**
 * Cria um evento no Google Calendar
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  consultation: ConsultationData
): Promise<{ eventId: string } | null> {
  try {
    // Determinar data/hora do evento
    const startDateTime = consultation.consulta_inicio || consultation.created_at;
    const start = new Date(startDateTime);
    
    // Duração padrão: 1 hora (60 minutos)
    const durationMinutes = 60;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Formatar data e hora
    const formattedDate = formatDateBR(start);
    const formattedTime = formatTimeBR(start);
    
    // Gerar link da consulta
    const consultationLink = getConsultationLink(consultation.id);
    
    // Nome do médico (usar valor passado ou fallback)
    const doctorName = consultation.doctor_name || 'seu médico';

    // Montar descrição personalizada
    const description = `${consultation.patient_name}, você tem uma consulta agendada com ${doctorName} no dia ${formattedDate} às ${formattedTime}.

Link da consulta: ${consultationLink}

---
Tipo: ${consultation.consultation_type}`;

    // Criar evento
    const event: GoogleCalendarEvent = {
      summary: `Consulta - ${consultation.patient_name}`,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      colorId: CALENDAR_COLORS[consultation.consultation_type],
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.success) {
      const errorData = await response.text();
      console.error('[GoogleCalendar] Erro ao criar evento:', errorData);
      return null;
    }

    const createdEvent = await response.json();
    console.log('[GoogleCalendar] Evento criado:', createdEvent.id);
    
    return { eventId: createdEvent.id };
  } catch (error) {
    console.error('[GoogleCalendar] Erro ao criar evento:', error);
    return null;
  }
}

/**
 * Atualiza um evento no Google Calendar
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  consultation: ConsultationData
): Promise<boolean> {
  try {
    const startDateTime = consultation.consulta_inicio || consultation.created_at;
    const start = new Date(startDateTime);
    
    // Duração padrão: 1 hora (60 minutos)
    const durationMinutes = 60;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Formatar data e hora
    const formattedDate = formatDateBR(start);
    const formattedTime = formatTimeBR(start);
    
    // Gerar link da consulta
    const consultationLink = getConsultationLink(consultation.id);
    
    // Nome do médico (usar valor passado ou fallback)
    const doctorName = consultation.doctor_name || 'seu médico';

    // Montar descrição personalizada
    const description = `${consultation.patient_name}, você tem uma consulta agendada com ${doctorName} no dia ${formattedDate} às ${formattedTime}.

Link da consulta: ${consultationLink}

---
Tipo: ${consultation.consultation_type}`;

    const event: GoogleCalendarEvent = {
      summary: `Consulta - ${consultation.patient_name}`,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      colorId: CALENDAR_COLORS[consultation.consultation_type],
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.success) {
      const errorData = await response.text();
      console.error('[GoogleCalendar] Erro ao atualizar evento:', errorData);
      return false;
    }

    console.log('[GoogleCalendar] Evento atualizado:', eventId);
    return true;
  } catch (error) {
    console.error('[GoogleCalendar] Erro ao atualizar evento:', error);
    return false;
  }
}

/**
 * Deleta um evento do Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 = sucesso, 410 = já deletado
    if (response.status === 204 || response.status === 410) {
      console.log('[GoogleCalendar] Evento deletado:', eventId);
      return true;
    }

    const errorData = await response.text();
    console.error('[GoogleCalendar] Erro ao deletar evento:', errorData);
    return false;
  } catch (error) {
    console.error('[GoogleCalendar] Erro ao deletar evento:', error);
    return false;
  }
}

/**
 * Função principal: Sincroniza uma consulta com o Google Calendar
 * Cria ou atualiza o evento dependendo se já existe google_event_id
 */
export async function syncConsultationToGoogleCalendar(
  supabase: SupabaseClient,
  medicoId: string,
  consultation: ConsultationData & { google_event_id?: string | null; google_calendar_id?: string | null }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // 1. Verificar se o médico tem Google Calendar conectado
    const tokens = await getMedicoGoogleCalendarTokens(supabase, medicoId);
    
    if (!tokens) {
      // Médico não tem Google Calendar conectado, não é erro
      return { success: true };
    }

    // 2. Obter access_token válido (renova se necessário)
    const accessToken = await refreshAccessTokenIfNeeded(supabase, tokens);
    
    if (!accessToken) {
      return { success: false, error: 'Falha ao obter token de acesso' };
    }

    // 3. Determinar qual calendário usar (primary se não selecionou um específico)
    const calendarId = tokens.calendar_id || 'primary';

    // 4. Criar ou atualizar evento
    if (consultation.google_event_id) {
      // Atualizar evento existente
      const updated = await updateGoogleCalendarEvent(
        accessToken,
        consultation.google_calendar_id || calendarId,
        consultation.google_event_id,
        consultation
      );

      if (updated) {
        // Atualizar timestamp de sync
        await supabase
          .from('consultations')
          .update({
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', consultation.id);

        return { success: true, eventId: consultation.google_event_id };
      } else {
        return { success: false, error: 'Falha ao atualizar evento' };
      }
    } else {
      // Criar novo evento
      const result = await createGoogleCalendarEvent(accessToken, calendarId, consultation);

      if (result) {
        // Salvar google_event_id na consulta
        await supabase
          .from('consultations')
          .update({
            google_event_id: result.eventId,
            google_calendar_id: calendarId,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', consultation.id);

        return { success: true, eventId: result.eventId };
      } else {
        // Marcar como erro de sync
        await supabase
          .from('consultations')
          .update({
            sync_status: 'error',
          })
          .eq('id', consultation.id);

        return { success: false, error: 'Falha ao criar evento' };
      }
    }
  } catch (error) {
    console.error('[GoogleCalendar] Erro na sincronização:', error);
    return { success: false, error: 'Erro interno na sincronização' };
  }
}

/**
 * Remove evento do Google Calendar quando consulta é cancelada
 * @param skipDbUpdate - Se true, não atualiza o banco (útil quando vai deletar a consulta logo depois)
 */
export async function removeConsultationFromGoogleCalendar(
  supabase: SupabaseClient,
  medicoId: string,
  consultation: { id: string; google_event_id?: string | null; google_calendar_id?: string | null },
  skipDbUpdate: boolean = false
): Promise<boolean> {
  if (!consultation.google_event_id) {
    return true; // Não tinha evento, nada a fazer
  }

  try {
    const tokens = await getMedicoGoogleCalendarTokens(supabase, medicoId);
    if (!tokens) return true;

    const accessToken = await refreshAccessTokenIfNeeded(supabase, tokens);
    if (!accessToken) return false;

    const calendarId = consultation.google_calendar_id || tokens.calendar_id || 'primary';
    
    const deleted = await deleteGoogleCalendarEvent(
      accessToken,
      calendarId,
      consultation.google_event_id
    );

    // Só atualiza o banco se não for pular (ex: quando vai deletar a consulta logo depois)
    if (deleted && !skipDbUpdate) {
      await supabase
        .from('consultations')
        .update({
          google_event_id: null,
          google_calendar_id: null,
          sync_status: 'local_only',
          last_synced_at: null,
        })
        .eq('id', consultation.id);
    }

    return deleted;
  } catch (error) {
    console.error('[GoogleCalendar] Erro ao remover evento:', error);
    return false;
  }
}
