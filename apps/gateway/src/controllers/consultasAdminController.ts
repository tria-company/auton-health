import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /admin/consultations
 * Busca todas as consultas abertas/em andamento (status RECORDING)
 */
export const getActiveConsultations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar se é admin
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', userId)
      .single();

    if (medicoError || !medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
    }

    // Buscar consultas com status RECORDING
    const { data: consultasData, error: consultasError } = await supabase
      .from('consultations')
      .select(`
        *,
        medicos!inner(
          name,
          email
        ),
        patients!inner(
          name
        ),
        call_sessions!left(
          status,
          webrtc_active
        )
      `)
      .eq('status', 'RECORDING')
      .order('created_at', { ascending: false });

    if (consultasError) {
      console.error('[ConsultasAdminController] Erro ao buscar consultas:', consultasError);
      return res.status(500).json({ 
        error: 'Erro ao buscar consultas',
        details: consultasError.message 
      });
    }

    // Mapear dados para o formato esperado pelo frontend
    const consultations = (consultasData || []).map((c: any) => ({
      id: c.id,
      doctor_id: c.doctor_id,
      patient_id: c.patient_id,
      status: c.status,
      consulta_inicio: c.consulta_inicio,
      patient_name: c.patients?.name || 'Paciente desconhecido',
      consultation_type: c.consultation_type,
      created_at: c.created_at,
      medico_email: c.medicos?.email || null,
      medico_name: c.medicos?.name || null,
      room_id: c.room_id,
      session_status: c.call_sessions?.[0]?.status || null,
      webrtc_active: c.call_sessions?.[0]?.webrtc_active || false,
    }));

    return res.json({
      success: true,
      consultations,
      total: consultations.length
    });

  } catch (error) {
    console.error('[ConsultasAdminController] Erro ao buscar consultas ativas:', error);
    return res.status(500).json({
      error: 'Erro ao buscar consultas ativas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};

/**
 * POST /admin/consultations/:id/terminate
 * Encerra uma consulta e sua sessão de chamada
 */
export const terminateConsultation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id: consultationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!consultationId) {
      return res.status(400).json({ error: 'ID da consulta é obrigatório' });
    }

    // Verificar se é admin
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', userId)
      .single();

    if (medicoError || !medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
    }

    // Buscar consulta para pegar room_id
    const { data: consultaData, error: consultaError } = await supabase
      .from('consultations')
      .select('id, room_id, status')
      .eq('id', consultationId)
      .single();

    if (consultaError || !consultaData) {
      return res.status(404).json({ 
        error: 'Consulta não encontrada',
        details: consultaError?.message 
      });
    }

    // Atualizar status da consulta para COMPLETED
    const { error: updateError } = await supabase
      .from('consultations')
      .update({
        status: 'COMPLETED',
        consulta_fim: new Date().toISOString(),
      })
      .eq('id', consultationId);

    if (updateError) {
      console.error('[ConsultasAdminController] Erro ao atualizar consulta:', updateError);
      return res.status(500).json({ 
        error: 'Erro ao encerrar consulta',
        details: updateError.message 
      });
    }

    // Se houver room_id, atualizar call_session
    if (consultaData.room_id) {
      const { error: sessionError } = await supabase
        .from('call_sessions')
        .update({
          status: 'ENDED',
          webrtc_active: false,
        })
        .eq('room_id', consultaData.room_id);

      if (sessionError) {
        console.warn('[ConsultasAdminController] Erro ao atualizar call_session:', sessionError);
        // Não retornar erro, pois a consulta já foi encerrada
      }
    }

    return res.json({
      success: true,
      message: 'Consulta encerrada com sucesso',
      consultation_id: consultationId,
      room_id: consultaData.room_id
    });

  } catch (error) {
    console.error('[ConsultasAdminController] Erro ao encerrar consulta:', error);
    return res.status(500).json({
      error: 'Erro ao encerrar consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};
