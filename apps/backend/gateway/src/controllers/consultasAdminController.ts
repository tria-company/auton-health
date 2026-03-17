import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /admin/consultations
 * Busca todas as call_sessions ativas (status = 'active')
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

    // Buscar call_sessions ativas (status = 'active')
    console.log('🔍 [ADMIN] Buscando call_sessions com status active...');

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('call_sessions')
      .select(`
        id,
        consultation_id,
        room_id,
        room_name,
        status,
        started_at,
        session_type,
        consultations!inner(
          id,
          doctor_id,
          patient_id,
          patient_name,
          status,
          consultation_type,
          consulta_inicio,
          created_at,
          from,
          medicos!inner(
            name,
            email
          ),
          patients!inner(
            name
          )
        )
      `)
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    if (sessionsError) {
      console.error('[ConsultasAdminController] Erro ao buscar call_sessions:', sessionsError);
      return res.status(500).json({
        error: 'Erro ao buscar sessões ativas',
        details: sessionsError.message
      });
    }

    console.log(`✅ [ADMIN] Encontradas ${sessionsData?.length || 0} sessões ativas`);

    // Mapear dados para o formato esperado pelo frontend
    const consultations = (sessionsData || []).map((s: any) => {
      const c = s.consultations;
      return {
        id: c.id,
        doctor_id: c.doctor_id,
        patient_id: c.patient_id,
        status: c.status,
        consulta_inicio: c.consulta_inicio,
        patient_name: c.patients?.name || c.patient_name || 'Paciente desconhecido',
        consultation_type: c.consultation_type,
        created_at: c.created_at,
        medico_email: c.medicos?.email || null,
        medico_name: c.medicos?.name || null,
        from: c.from || null,
        room_id: s.room_id || null,
        session_status: s.status || null,
      };
    });

    console.log(`📋 [ADMIN] Retornando ${consultations.length} sessões ativas ao frontend`);

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


    let roomId = consultaData.room_id;

    // Se não tiver room_id na consulta, tentar buscar da sessão
    if (!roomId) {
      const { data: sessionData } = await supabase
        .from('call_sessions')
        .select('room_id')
        .eq('consultation_id', consultationId)
        .eq('status', 'active') // ou check status != ENDED
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Usar maybeSingle para evitar erro se não encontrar

      if (sessionData?.room_id) {
        roomId = sessionData.room_id;
      }
    }

    // ✅ REQ 4: Ao finalizar a consulta salvar o array com as transcrições em consultation.transcricao
    let finalTranscription = null;
    try {
      // Buscar transcrição acumulada na tabela transcriptions
      const { data: transcriptionData, error: transError } = await supabase
        .from('transcriptions')
        .select('raw_text')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (transcriptionData && transcriptionData.raw_text) {
        finalTranscription = transcriptionData.raw_text;
      }
    } catch (e) {
      console.warn(`⚠️ [TERMINATE-CONSULTATION] Erro ao buscar transcrição final: ${e}`);
    }

    // Atualizar status da consulta para COMPLETED e marcar como finalizada
    const updateData: any = {
      status: 'COMPLETED',
      consulta_finalizada: true,
      consulta_fim: new Date().toISOString(),
    };

    if (finalTranscription) {
      updateData.transcricao = finalTranscription;
      console.log(`📝 [TERMINATE-CONSULTATION] Transcrição final salva para consulta ${consultationId}`);
    }

    const { error: updateError } = await supabase
      .from('consultations')
      .update(updateData)
      .eq('id', consultationId);

    if (updateError) {
      console.error('[ConsultasAdminController] Erro ao atualizar consulta:', updateError);
      return res.status(500).json({
        error: 'Erro ao encerrar consulta',
        details: updateError.message
      });
    }

    // Se houver room_id, atualizar call_session
    if (roomId) {
      const { error: sessionError } = await supabase
        .from('call_sessions')
        .update({
          status: 'ENDED',
          webrtc_active: false,
        })
        .eq('room_id', roomId);

      if (sessionError) {
        console.warn('[ConsultasAdminController] Erro ao atualizar call_session:', sessionError);
        // Não retornar erro, pois a consulta já foi encerrada
      }
    }

    return res.json({
      success: true,
      message: 'Consulta encerrada com sucesso',
      consultation_id: consultationId,
      room_id: roomId
    });

  } catch (error) {
    console.error('[ConsultasAdminController] Erro ao encerrar consulta:', error);
    return res.status(500).json({
      error: 'Erro ao encerrar consulta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};

/**
 * POST /admin/consultations/terminate-room/:roomId
 * Encerra uma sessão de chamada diretamente pelo room_id
 */
export const terminateSessionByRoom = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { roomId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID é obrigatório' });
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

    console.log(`🔴 [ADMIN] Encerrando sessão com room_id: ${roomId}`);

    // 1. Notificar clientes via realtime-service (Socket.IO)
    const realtimeServiceUrl = process.env.REALTIME_SERVICE_URL || 'http://localhost:3002';
    try {
      console.log(`📤 [ADMIN] Chamando realtime-service para notificar clientes...`);
      const notifyResponse = await fetch(`${realtimeServiceUrl}/api/rooms/admin/terminate/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Encerrado pelo administrador' }),
      });

      if (notifyResponse.ok) {
        console.log(`✅ [ADMIN] Clientes notificados via Socket.IO`);
      } else {
        console.warn(`⚠️ [ADMIN] Falha ao notificar clientes (sala pode não existir em memória):`, await notifyResponse.text());
      }
    } catch (notifyError) {
      console.warn(`⚠️ [ADMIN] Erro ao chamar realtime-service (continuando):`, notifyError);
    }

    // 2. Atualizar status da call_session diretamente pelo room_id
    const { data: updatedSession, error: sessionError } = await supabase
      .from('call_sessions')
      .update({
        status: 'ended',
        webrtc_active: false,
      })
      .eq('room_id', roomId)
      .select();

    if (sessionError) {
      console.error('[ConsultasAdminController] Erro ao atualizar call_session:', sessionError);
      return res.status(500).json({
        error: 'Erro ao encerrar sessão',
        details: sessionError.message
      });
    }

    if (!updatedSession || updatedSession.length === 0) {
      return res.status(404).json({
        error: 'Sessão não encontrada',
        details: `Nenhuma sessão encontrada com room_id: ${roomId}`
      });
    }

    console.log(`✅ [TERMINATE-SESSION] Sessão ${roomId} encerrada com sucesso`);

    return res.json({
      success: true,
      message: 'Sessão encerrada com sucesso',
      room_id: roomId,
      updated_sessions: updatedSession.length
    });

  } catch (error) {
    console.error('[ConsultasAdminController] Erro ao encerrar sessão:', error);
    return res.status(500).json({
      error: 'Erro ao encerrar sessão',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};
