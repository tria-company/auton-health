import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /consultations
 * Lista consultas do médico autenticado
 */
export async function getConsultations(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado no sistema'
      });
    }

    // Parâmetros de consulta
    const {
      search,
      status,
      type: consultationType,
      dateFilter,
      date,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let query = supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          profile_pic
        )
      `, { count: 'exact' })
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (search) {
      query = query.or(`patient_name.ilike.%${search}%,patient_context.ilike.%${search}%,notes.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (consultationType) {
      query = query.eq('consultation_type', consultationType);
    }

    // Aplicar filtro de data
    if (dateFilter && date) {
      const selectedDate = new Date(date as string);

      if (dateFilter === 'day') {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
      } else if (dateFilter === 'week') {
        const dayOfWeek = selectedDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() + diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfWeek.toISOString())
          .lte('created_at', endOfWeek.toISOString());
      } else if (dateFilter === 'month') {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        query = query.gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString());
      }
    }

    // Paginação
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    query = query.range(from, to);

    const { data: consultations, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar consultas:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar consultas'
      });
    }

    return res.json({
      success: true,
      consultations: consultations || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    });

  } catch (error) {
    console.error('Erro no endpoint GET /consultations:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /consultations/:id
 * Busca detalhes de uma consulta específica
 */
export async function getConsultationById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Buscar consulta
    const { data: consultation, error } = await supabase
      .from('consultations')
      .select(`
        *,
        patients:patient_id (
          id,
          name,
          email,
          phone,
          profile_pic
        )
      `)
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (error || !consultation) {
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    return res.json({
      success: true,
      ...consultation
    });

  } catch (error) {
    console.error('Erro ao buscar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * PATCH /consultations/:id
 * Atualiza uma consulta
 */
export async function updateConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    const doctorAuthId = req.user.id;

    console.log('📝 [UPDATE CONSULTATION] Iniciando atualização:', {
      consultationId: id,
      updateData,
      doctorAuthId
    });

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      console.error('❌ [UPDATE CONSULTATION] Médico não encontrado:', {
        doctorAuthId,
        error: medicoError
      });
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    console.log('✅ [UPDATE CONSULTATION] Médico encontrado:', medico.id);

    // Verificar se a consulta existe e pertence ao médico antes de atualizar
    const { data: existingConsultation, error: checkError } = await supabase
      .from('consultations')
      .select('id, doctor_id, status')
      .eq('id', id)
      .single();

    if (checkError || !existingConsultation) {
      console.error('Erro ao verificar consulta:', checkError);
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // Verificar se a consulta pertence ao médico
    if (existingConsultation.doctor_id !== medico.id) {
      console.error('Tentativa de atualizar consulta de outro médico:', {
        consultationDoctorId: existingConsultation.doctor_id,
        currentMedicoId: medico.id
      });
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para atualizar esta consulta'
      });
    }

    // Atualizar consulta
    const { data: consultation, error } = await supabase
      .from('consultations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar consulta no Supabase:', {
        error,
        consultationId: id,
        updateData,
        medicoId: medico.id
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar consulta'
      });
    }

    if (!consultation) {
      console.error('Consulta não retornada após atualização:', {
        consultationId: id,
        medicoId: medico.id
      });
      return res.status(500).json({
        success: false,
        error: 'Consulta não foi atualizada'
      });
    }

    return res.json({
      success: true,
      ...consultation
    });

  } catch (error) {
    console.error('Erro ao atualizar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * DELETE /consultations/:id
 * Deleta uma consulta
 */
import { deleteCalendarEventInternal } from './googleCalendarController';

/**
 * DELETE /consultations/:id
 * Deleta uma consulta
 */
export async function deleteConsultation(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const doctorAuthId = req.user.id;

    // Buscar médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // 🔍 Buscar consulta antes de deletar para verificar se tem evento no Google Calendar
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('id, google_event_id')
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (consultaError || !consulta) {
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // 📅 Se tiver evento no Google, tentar remover
    if (consulta.google_event_id && consulta.google_event_id.length > 5) {
      console.log(`🗑️ Removendo evento do Google Calendar: ${consulta.google_event_id}`);
      // Não aguardar o resultado bloquear a deleção, mas rodar em background seria melhor
      // Como é uma operação crítica, vamos aguardar (fast enough)
      const deleted = await deleteCalendarEventInternal(doctorAuthId, consulta.google_event_id);
      if (deleted) {
        console.log('✅ Evento removido do Google Calendar com sucesso');
      } else {
        console.warn('⚠️ Falha ao remover evento do Google Calendar (pode já ter sido removido ou erro de token)');
      }
    }

    // Deletar consulta do banco
    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('id', id)
      .eq('doctor_id', medico.id);

    if (error) {
      console.error('Erro ao deletar consulta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar consulta'
      });
    }

    return res.json({
      success: true,
      message: 'Consulta deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar consulta:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3002';

/**
 * POST /consultations/:id/finalize-remote
 * Finaliza a consulta remotamente (mesmo fluxo do botão "Finalizar" na sala):
 * busca room_id da call_sessions, chama o realtime para finalizar sala (salvar transcrições, webhook)
 * Usado pelo popup "Consulta em Andamento" quando o médico clica em Finalizar fora da sala.
 */
export async function finalizeConsultationRemote(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { id: consultationId } = req.params;
    const doctorAuthId = req.user.id;

    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', doctorAuthId)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({ success: false, error: 'Médico não encontrado' });
    }

    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .select('id')
      .eq('id', consultationId)
      .eq('doctor_id', medico.id)
      .single();

    if (consultationError || !consultation) {
      return res.status(404).json({ success: false, error: 'Consulta não encontrada' });
    }

    const { data: callSession, error: sessionError } = await supabase
      .from('call_sessions')
      .select('room_id')
      .eq('consultation_id', consultationId)
      .maybeSingle();

    if (sessionError || !callSession?.room_id) {
      return res.status(400).json({
        success: false,
        error: 'Sala não encontrada para esta consulta. A consulta pode já ter sido finalizada ou a sala não está ativa.'
      });
    }

    const roomId = callSession.room_id;
    const url = `${REALTIME_SERVICE_URL.replace(/\/$/, '')}/api/rooms/finalize/${roomId}`;

    console.log(`📤 [GATEWAY] Chamando realtime para finalizar sala ${roomId} (consulta ${consultationId})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(`⚠️ [GATEWAY] Realtime finalize retornou ${response.status}:`, data);
      return res.status(response.status).json({
        success: false,
        error: data?.error || 'Erro ao finalizar sala no serviço de tempo real'
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('Erro ao finalizar consulta remotamente:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    });
  }
}
