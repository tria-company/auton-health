import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { db } from '../config/database';
import { generateSimpleProtocol } from '../services/protocolService';
import auditService from '../services/auditService';

const router = Router();

// Schema de validação para criar sessão
const createSessionSchema = z.object({
  consultation_id: z.string().optional(),
  session_type: z.enum(['presencial', 'online']).default('online'),
  participants: z.object({
    doctor: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
    }),
    patient: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email().optional(),
    }),
  }),
  consent: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

// Criar nova sessão
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('📨 Recebida requisição para criar sessão:', req.body);

  // Validar dados de entrada
  const validationResult = createSessionSchema.safeParse(req.body);

  if (!validationResult.success) {
    console.error('❌ Validação falhou:', validationResult.error);
    throw new ValidationError(`Dados inválidos para criar sessão: ${validationResult.error.message}`);
  }

  const { consultation_id, session_type, participants, consent, metadata } = validationResult.data;

  // Verificar consentimento
  if (!consent) {
    throw new ValidationError('Consentimento é obrigatório para iniciar a sessão');
  }

  try {
    console.log('📝 Tentando criar sessão com dados:', {
      consultation_id,
      session_type,
      participants,
      consent,
      metadata,
      started_at: new Date().toISOString(),
    });

    // Criar sessão no banco
    const session = await db.createSession({
      consultation_id,
      session_type,
      participants,
      consent,
      metadata,
      started_at: new Date().toISOString(),
    });

    if (!session) {
      console.error('❌ Falha ao criar sessão - retornou null');
      throw new Error('Falha ao criar sessão no banco de dados');
    }

    console.log('✅ Sessão criada com sucesso:', session.id);

    // Registrar log de auditoria - Início de consulta
    const doctorId = participants.doctor.id;
    const patientId = participants.patient.id;

    // Buscar dados do médico para auditoria
    const medico = await db.getDoctorByAuth(doctorId);

    await auditService.log({
      user_id: doctorId,
      user_email: participants.doctor.email || medico?.email,
      user_name: participants.doctor.name || medico?.name,
      user_role: 'medico',
      action: 'CREATE',
      resource_type: 'call_sessions',
      resource_id: session.id,
      resource_description: `Sessão ${session_type} - ${participants.patient.name}`,
      related_patient_id: patientId,
      related_consultation_id: consultation_id,
      related_session_id: session.id,
      ip_address: auditService.getClientIp(req),
      user_agent: auditService.getUserAgent(req),
      endpoint: '/api/sessions',
      http_method: 'POST',
      data_category: 'sensivel',
      legal_basis: 'tutela_saude',
      purpose: 'Início de consulta médica',
      contains_sensitive_data: true,
      data_after: {
        session_id: session.id,
        session_type,
        consultation_id,
        consent: true
      },
      metadata: {
        room_name: `session-${session.id}`,
        participants: {
          doctor: participants.doctor.name,
          patient: participants.patient.name
        }
      }
    });

    const roomName = `session-${session.id}`;

    // Resposta unificada para ambos tipos de sessão (presencial e online)
    // Ambas usam WebRTC direto via WebSocket
    const websocketUrl = process.env.WEBSOCKET_URL || 'ws://localhost:3001';
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.status(201).json({
      session: {
        id: session.id,
        type: session_type,
        roomName,
        startedAt: session.started_at,
        participants: session.participants,
        consultation_id: session.consultation_id,
      },
      websocket: {
        url: websocketUrl,
      },
      urls: {
        doctor: `${baseUrl}/consulta/webrtc?roomId=${roomName}&role=host&userType=doctor&patientId=${participants.patient.id}&patientName=${encodeURIComponent(participants.patient.name)}`,
        patient: `${baseUrl}/consulta/webrtc?roomId=${roomName}&role=participant&userType=patient`,
      },
    });

  } catch (error) {
    console.error('❌ Erro ao criar sessão:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Falha ao criar sessão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}));

// Buscar sessão por ID
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada',
      },
    });
  }

  // Buscar utterances, conversas e suggestions da sessão
  const [utterances, conversations, suggestions] = await Promise.all([
    db.getSessionUtterances(sessionId),
    db.getSessionConversations(sessionId), // ✅ Array de conversas formatado
    db.getSessionSuggestions(sessionId),
  ]);

  res.json({
    session,
    transcription: utterances, // Formato original (linhas separadas)
    conversations: conversations, // ✅ Novo formato: array de conversas
    suggestions,
  });
}));

// Buscar conversas de uma sessão (formato array)
router.get('/:sessionId/conversations', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const conversations = await db.getSessionConversations(sessionId);

  res.json({
    sessionId,
    conversations: conversations, // Array de conversas formatado
    total: conversations.length
  });
}));

// Finalizar sessão
router.patch('/:sessionId/end', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Sessão não encontrada',
      },
    });
  }

  if (session.ended_at) {
    return res.status(409).json({
      error: {
        code: 'SESSION_ALREADY_ENDED',
        message: 'Sessão já foi finalizada',
      },
    });
  }

  // Finalizar sessão
  const updated = await db.updateSession(sessionId, {
    ended_at: new Date().toISOString(),
    status: 'ended',
  });

  if (!updated) {
    throw new Error('Falha ao finalizar sessão');
  }

  res.json({
    message: 'Sessão finalizada com sucesso',
    sessionId,
    endedAt: new Date().toISOString(),
  });
}));

// Finalizar sessão e consolidar dados
router.post('/:sessionId/complete', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params as { sessionId: string };

  if (!sessionId) {
    throw new ValidationError('ID da sessão é obrigatório');
  }

  const session = await db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: { code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada' },
    });
  }

  // Definir ended_at caso ainda não tenha sido setado
  const endedAt = session.ended_at || new Date().toISOString();
  if (!session.ended_at) {
    await db.updateSession(sessionId, { ended_at: endedAt, status: 'ended' });
  }

  // Buscar dados da sessão
  const [utterances, suggestions] = await Promise.all([
    db.getSessionUtterances(sessionId),
    db.getSessionSuggestions(sessionId),
  ]);

  // Consolidar transcrição
  const transcriptText = utterances
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(u => `${u.speaker === 'doctor' ? 'Médico' : u.speaker === 'patient' ? 'Paciente' : 'Sistema'}: ${u.text}`)
    .join('\n');

  const avgConfidence =
    utterances.length > 0
      ? (utterances.reduce((sum, u) => sum + (u.confidence || 0), 0) / utterances.length)
      : null;

  const startedAt = new Date(session.started_at).getTime();
  const finishedAt = new Date(endedAt).getTime();
  const durationSeconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));

  // Sugestões usadas
  const usedSuggestions = suggestions.filter(s => s.used);

  // Gerar protocolo simples
  const protocol = generateSimpleProtocol({
    transcriptText,
    utterances,
    suggestions: suggestions.map(s => ({ ...s, text: s.content })),
    usedSuggestions: usedSuggestions.map(s => ({ ...s, text: s.content })),
    participants: session.participants,
  });

  // Persistir dados agrupados
  // 1) Atualizar consulta, se existir
  if (session.consultation_id) {
    await db.updateConsultation(session.consultation_id, {
      status: 'COMPLETED',
      duration: durationSeconds,
      notes: protocol.summary,
    });

    // 2) Criar transcrição consolidada
    await db.createTranscription({
      consultation_id: session.consultation_id,
      raw_text: transcriptText,
      summary: protocol.summary,
      key_points: protocol.key_points,
      diagnosis: protocol.diagnosis || null,
      treatment: protocol.treatment || null,
      observations: protocol.observations || null,
      confidence: avgConfidence ?? undefined,
      language: 'pt-BR',
      model_used: 'live-realtime+fallback',
    });

    // 3) Criar documento de protocolo
    await db.createDocument({
      consultation_id: session.consultation_id,
      title: `Protocolo de Atendimento - ${new Date(endedAt).toLocaleString('pt-BR')}`,
      content: protocol.full_text,
      type: 'REPORT',
      format: 'text',
    });
  }

  // Responder com resumo
  return res.json({
    message: 'Sessão finalizada e consolidada com sucesso',
    sessionId,
    durationSeconds,
    suggestions: {
      total: suggestions.length,
      used: usedSuggestions.length,
    },
  });
}));

// Listar sessões recentes (para dashboard)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implementar listagem com paginação
  // Por enquanto, retorna resposta básica
  res.json({
    sessions: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },
  });
}));

// Finalizar sessão por Room ID (para WebRTC)
router.post('/end', asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.body;

  if (!roomId) {
    throw new ValidationError('Room ID é obrigatório');
  }

  console.log(`🔚 Solicitado fim de sessão para room: ${roomId}`);

  // Atualizar sessão para ended
  const success = await db.updateSessionByRoomId(roomId, {
    ended_at: new Date().toISOString(),
    status: 'ended',
  });

  if (!success) {
    return res.status(404).json({
      error: {
        code: 'SESSION_UPDATE_FAILED',
        message: 'Falha ao finalizar sessão ou sala não encontrada',
      },
    });
  }

  console.log(`✅ Sessão finalizada com sucesso para room: ${roomId}`);

  res.json({
    message: 'Sessão finalizada com sucesso',
    roomId,
    endedAt: new Date().toISOString(),
  });
}));

export default router;