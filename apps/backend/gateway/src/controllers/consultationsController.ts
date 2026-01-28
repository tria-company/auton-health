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

    if (error || !consultation) {
      console.error('Erro ao atualizar consulta:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar consulta'
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

