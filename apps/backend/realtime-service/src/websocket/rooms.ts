import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import WebSocket from 'ws';
import { db, logError, logWarning } from '../config/database';
import { aiPricingService } from '../services/aiPricingService';

// ==================== ESTRUTURAS DE DADOS ====================

// Mapa de salas: roomId -> roomData
const rooms = new Map();

// Mapa de usuário para sala ativa: userName -> roomId
const userToRoom = new Map();

// Mapa de socket para sala: socketId -> roomId
const socketToRoom = new Map();

// Mapa de conexões OpenAI: userName -> WebSocket
const openAIConnections = new Map();

// Mapa de keepalive timers para conexões OpenAI: userName -> Interval
const openAIKeepaliveTimers = new Map();

// 📊 Mapa para rastrear tempo de uso da Realtime API: userName -> { startTime, roomId }
// 📊 Mapa para rastrear tempo de uso da Realtime API: userName -> { startTime, roomId, tokens... }
const openAIUsageTracker = new Map<string, {
  startTime: number;
  roomId: string;
  textInputTokens: number;
  textOutputTokens: number;
  audioInputTokens: number;
  audioOutputTokens: number;
}>();

// ⏱️ Mapa para timeout máximo de conexões OpenAI: userName -> Timeout
const openAIMaxTimeoutTimers = new Map();

// 🔧 Constante: Timeout máximo para conexões OpenAI (2 horas)
const OPENAI_MAX_CONNECTION_TIME = 2 * 60 * 60 * 1000; // 2 horas em ms

// Mapa separado para timers (não serializar com room data)
const roomTimers = new Map(); // roomId -> Timeout

// ✅ NOVO: Mapa para timers de duração de chamada
const callTimers = new Map(); // roomId -> Interval
const callStartTimes = new Map(); // roomId -> timestamp (em segundos)

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Gera um roomId único
 */
function generateRoomId(): string {
  return 'room-' + crypto.randomBytes(6).toString('hex'); // Ex: room-a1b2c3d4e5f6
}

/**
 * ✅ NOVO: Inicia o timer da chamada
 */
function startCallTimer(roomId: string, io: SocketIOServer): void {
  // Se já existe timer, não criar outro
  if (callTimers.has(roomId)) {
    return;
  }

  const startTime = Math.floor(Date.now() / 1000); // timestamp em segundos
  callStartTimes.set(roomId, startTime);

  // Emitir atualização a cada segundo
  const timer = setInterval(() => {
    const currentTime = Math.floor(Date.now() / 1000);
    const duration = currentTime - startTime;

    // Emitir para todos na sala
    const room = rooms.get(roomId);
    if (room) {
      // Emitir para host se estiver conectado
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('callTimerUpdate', { duration });
      }
      // Emitir para participante se estiver conectado
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('callTimerUpdate', { duration });
      }
      // Também emitir para a sala inteira (backup)
      io.to(roomId).emit('callTimerUpdate', { duration });
    }
  }, 1000);

  callTimers.set(roomId, timer);
}

/**
 * ✅ NOVO: Para o timer da chamada
 */
function stopCallTimer(roomId: string): void {
  const timer = callTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    callTimers.delete(roomId);
    callStartTimes.delete(roomId);
  }
}

/**
 * ✅ NOVO: Obtém a duração atual da chamada
 */
function getCallDuration(roomId: string): number {
  const startTime = callStartTimes.get(roomId);
  if (!startTime) return 0;

  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - startTime;
}

/**
 * Limpa sala expirada (3min vazia, 15min com 1 pessoa)
 */
function cleanExpiredRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  console.log(`🧹 Limpando sala expirada: ${roomId}`);

  // Remover usuários do mapeamento
  if (room.hostUserName) userToRoom.delete(room.hostUserName);
  if (room.participantUserName) userToRoom.delete(room.participantUserName);

  // Limpar timer do mapa separado
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }

  // ✅ NOVO: Parar timer da chamada
  stopCallTimer(roomId);

  // 🔧 CORREÇÃO: Fechar conexões OpenAI dos usuários da sala
  if (room.hostUserName) {
    closeOpenAIConnection(room.hostUserName, 'sala expirada');
  }
  if (room.participantUserName) {
    closeOpenAIConnection(room.participantUserName, 'sala expirada');
  }

  // Remover sala
  rooms.delete(roomId);
}

/**
 * 🔧 Fecha conexão OpenAI de forma segura e registra uso
 */
async function closeOpenAIConnection(userName: string, reason: string = 'desconexão'): Promise<void> {
  const openAIWs = openAIConnections.get(userName);

  if (openAIWs) {
    console.log(`🔌 [OpenAI] Fechando conexão de ${userName} (motivo: ${reason})`);

    // 📊 Registrar uso antes de fechar
    const usageData = openAIUsageTracker.get(userName);
    if (usageData) {
      const durationMs = Date.now() - usageData.startTime;
      const durationMinutes = durationMs / 60000;

      console.log(`📊 [AI_PRICING] Registrando uso Realtime API: ${userName} - ${durationMinutes.toFixed(2)} minutos`);

      try {
        // Buscar consulta_id a partir do roomId
        const room = rooms.get(usageData.roomId);
        let consultaId = room?.consultationId || null;

        // Se não encontrou na room, buscar do banco de dados
        if (!consultaId && usageData.roomId) {
          console.log(`🔍 [AI_PRICING] Buscando consultaId do banco para room ${usageData.roomId}...`);
          consultaId = await db.getConsultationIdByRoomId(usageData.roomId);
          if (consultaId) {
            console.log(`✅ [AI_PRICING] consultaId recuperado do banco: ${consultaId}`);
          }
        }

        if (!consultaId) {
          console.warn(`⚠️ [AI_PRICING] Não foi possível obter consultaId para room ${usageData.roomId}`);
        }

        // 📊 Atualizado: Não logar acumulado no final, pois já estamos logando por interação.
        console.log(`📊 [AI_PRICING] Conexão encerrada (log individual já realizado a cada interação)`);
        console.log(`   - Duração Sessão: ${durationMinutes.toFixed(2)} minutos`);
      } catch (error) {
        console.error(`❌ [AI_PRICING] Erro ao registrar uso:`, error);
      }

      openAIUsageTracker.delete(userName);
    }

    // Fechar conexão WebSocket
    try {
      if (openAIWs.readyState === WebSocket.OPEN || openAIWs.readyState === WebSocket.CONNECTING) {
        openAIWs.close(1000, reason);
      }
    } catch (error) {
      console.error(`❌ [OpenAI] Erro ao fechar conexão de ${userName}:`, error);
    }

    openAIConnections.delete(userName);
  }

  // Limpar keepalive timer
  const keepaliveInterval = openAIKeepaliveTimers.get(userName);
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    openAIKeepaliveTimers.delete(userName);
  }

  // Limpar timeout máximo timer
  const maxTimeoutTimer = openAIMaxTimeoutTimers.get(userName);
  if (maxTimeoutTimer) {
    clearTimeout(maxTimeoutTimer);
    openAIMaxTimeoutTimers.delete(userName);
  }
}

/**
 * Inicia timer de expiração de sala (lógica inteligente baseada em histórico)
 */
function startRoomExpiration(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  // Limpar timer anterior do mapa separado
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
  }

  // Contar quantas pessoas estão conectadas
  const hasHost = room.hostSocketId !== null;
  const hasParticipant = room.participantSocketId !== null;
  const connectedCount = (hasHost ? 1 : 0) + (hasParticipant ? 1 : 0);

  // Verificar se sala já esteve ativa (teve 2 pessoas alguma vez)
  const wasActive = room.status === 'active'; // Status muda para 'active' quando 2ª pessoa entra

  let timeoutMinutes: number;

  if (connectedCount === 0) {
    if (wasActive) {
      // Sala estava ATIVA mas ambos desconectaram: 30 minutos para reconexão
      timeoutMinutes = 30;
      console.log(`⏱️ Timer iniciado para sala ATIVA (0 conectados) ${roomId}: ${timeoutMinutes} minutos (reconexão)`);
    } else {
      // Sala NUNCA ficou ativa (waiting): 3 minutos
      timeoutMinutes = 3;
      console.log(`⏱️ Timer iniciado para sala VAZIA (nunca ativa) ${roomId}: ${timeoutMinutes} minutos`);
    }
  } else if (connectedCount === 1) {
    if (wasActive) {
      // Sala estava ATIVA, 1 pessoa desconectou: 30 minutos para reconexão
      timeoutMinutes = 30;
      console.log(`⏱️ Timer iniciado para sala ATIVA (1 conectado) ${roomId}: ${timeoutMinutes} minutos (reconexão)`);
    } else {
      // Sala aguardando 2ª pessoa pela primeira vez: 15 minutos
      timeoutMinutes = 15;
      console.log(`⏱️ Timer iniciado para sala AGUARDANDO 2ª pessoa ${roomId}: ${timeoutMinutes} minutos`);
    }
  } else {
    // Sala ATIVA (2 pessoas): SEM timer automático
    console.log(`✅ Sala ATIVA ${roomId}: timer desabilitado (2 pessoas conectadas)`);
    return; // Não criar timer quando ambos estão conectados
  }

  const timer = setTimeout(() => {
    cleanExpiredRoom(roomId);
  }, timeoutMinutes * 60 * 1000);

  roomTimers.set(roomId, timer);
}

/**
 * Reseta timer de expiração (chamado em atividade)
 */
function resetRoomExpiration(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.lastActivity = new Date().toISOString();
  startRoomExpiration(roomId); // Reinicia o timer
}

/**
 * Calcula duração em segundos entre dois timestamps
 */
function calculateDuration(startTime: string): number {
  const start = new Date(startTime).getTime();
  const end = new Date().getTime();
  return Math.floor((end - start) / 1000); // retorna em segundos
}

// ==================== SOCKET.IO HANDLERS ====================

export function setupRoomsWebSocket(io: SocketIOServer): void {
  io.on('connection', (socket) => {

    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== "x") {
      socket.disconnect(true);
      return;
    }

    console.log(`[${userName}] conectado - Socket: ${socket.id}`);

    // ==================== CRIAR SALA ====================

    socket.on('createRoom', async (data, callback) => {
      const { hostName, roomName, patientId, patientName, patientEmail, patientPhone, userAuth, consultationType, agendamentoId } = data;

      // Verificar se usuário já está em outra sala ATIVA
      if (userToRoom.has(hostName)) {
        const existingRoomId = userToRoom.get(hostName);
        const existingRoom = rooms.get(existingRoomId);

        // Verificar se a sala ainda existe e se o host está realmente conectado
        if (existingRoom && existingRoom.hostSocketId && existingRoom.hostSocketId !== socket.id) {
          // Sala existe e host está conectado com outro socket - bloquear
          callback({
            success: false,
            error: 'Você já está em outra sala ativa',
            existingRoomId: existingRoomId
          });
          return;
        }

        // Sala não existe mais ou host não está conectado - limpar e permitir criar nova
        console.log(`🧹 Limpando sala antiga ${existingRoomId} para ${hostName} (sala inexistente ou host desconectado)`);
        userToRoom.delete(hostName);

        // Se a sala ainda existe mas host desconectou, limpar a sala também
        if (existingRoom && !existingRoom.hostSocketId) {
          // Limpar timer se existir
          if (roomTimers.has(existingRoomId)) {
            clearTimeout(roomTimers.get(existingRoomId));
            roomTimers.delete(existingRoomId);
          }
          stopCallTimer(existingRoomId);

          // Remover participante se existir
          if (existingRoom.participantUserName) {
            userToRoom.delete(existingRoom.participantUserName);
          }

          rooms.delete(existingRoomId);
          console.log(`🧹 Sala antiga ${existingRoomId} removida`);
        }
      }

      const roomId = generateRoomId();

      // Criar sala
      const room: any = {
        roomId: roomId,
        roomName: roomName || 'Sala sem nome',
        hostUserName: hostName,
        hostSocketId: socket.id,
        participantUserName: null,
        participantSocketId: null,
        status: 'waiting', // waiting | active | ended
        offer: null,
        answer: null,
        offerIceCandidates: [],
        answererIceCandidates: [],
        transcriptions: [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        // Dados médicos integrados
        patientId: patientId,
        patientName: patientName,
        patientEmail: patientEmail,
        patientPhone: patientPhone,
        userAuth: userAuth, // ID do user autenticado (Supabase Auth)
        callSessionId: null, // Será preenchido após criar no banco
        doctorName: null // ✅ Nome do médico (será preenchido quando buscar dados do médico)
      };
      rooms.set(roomId, room);
      userToRoom.set(hostName, roomId);
      socketToRoom.set(socket.id, roomId);

      // Iniciar timer de expiração
      startRoomExpiration(roomId);

      // ✅ CRIAR CALL_SESSION NO BANCO DE DADOS
      let consultationId = null;
      try {
        const callSession = await db.createCallSession({
          room_id: roomId,
          room_name: roomName || 'Sala sem nome',
          session_type: 'online',
          participants: {
            host: hostName,
            patient: patientName,
            patientId: patientId
          },
          metadata: {
            patientEmail: patientEmail,
            patientPhone: patientPhone,
            userAuth: userAuth
          }
        });

        if (callSession) {
          console.log(`✅ [CALL_SESSION] Criada no banco: ${callSession.id} para sala ${roomId}`);
          room.callSessionId = callSession.id; // Salvar referência
          console.log(`✅ [CALL_SESSION] callSessionId salvo na room: ${room.callSessionId}`);

          // ✅ NOVO: Atualizar webrtc_active = true quando o médico criar a sala (já está entrando)
          console.log(`🔗 [WebRTC] Médico criou sala ${roomId} - atualizando webrtc_active = true`);
          db.setWebRTCActive(roomId, true);
        } else {
          console.error(`❌ [CALL_SESSION] Falha ao criar call_session no banco para sala ${roomId} (sala criada apenas em memória)`);
          console.error(`❌ [CALL_SESSION] Isso impedirá o salvamento de transcrições!`);
          logError(
            `Falha ao criar call_session no banco - transcrições não serão salvas`,
            'error',
            null,
            { roomId, hostName, patientId, patientName }
          );
        }

        // ✅ CRIAR OU ATUALIZAR CONSULTA COM STATUS RECORDING QUANDO A SALA É CRIADA
        // ✅ Também salvar nome do médico na room para uso posterior
        let doctorName = hostName; // Fallback para hostName
        if (userAuth && patientId) {
          try {
            const doctor = await db.getDoctorByAuth(userAuth);

            if (doctor && doctor.id) {
              // ✅ Salvar nome do médico (pode estar em 'name', 'nome', 'full_name', etc.)
              doctorName = doctor.name || doctor.nome || doctor.full_name || doctor.nome_completo || hostName;
              room.doctorName = doctorName; // Salvar na room para uso posterior

              // ✅ Salvar nome do médico também na call_sessions metadata
              if (callSession && callSession.id) {
                const currentMetadata = callSession.metadata || {};
                await db.updateCallSession(roomId, {
                  metadata: {
                    ...currentMetadata,
                    doctorName: doctorName
                  }
                });
              }

              const consultationTypeValue = consultationType === 'presencial' ? 'PRESENCIAL' : 'TELEMEDICINA';

              // ✅ NOVO: Verificar se é um agendamento existente
              if (agendamentoId) {
                // Atualizar o agendamento existente para status RECORDING
                console.log(`📅 Atualizando agendamento ${agendamentoId} para status RECORDING`);
                const { supabase } = await import('../config/database');

                const { error: updateError } = await supabase
                  .from('consultations')
                  .update({
                    status: 'RECORDING',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', agendamentoId);

                if (updateError) {
                  console.error('❌ Erro ao atualizar agendamento:', updateError);
                  logError(
                    `Erro ao atualizar agendamento para RECORDING`,
                    'error',
                    agendamentoId,
                    { roomId, hostName, patientId, patientName, error: updateError.message }
                  );
                } else {
                  consultationId = agendamentoId;
                  room.consultationId = consultationId;
                  console.log(`✅ Agendamento ${agendamentoId} atualizado para RECORDING`);

                  if (callSession && callSession.id) {
                    await db.updateCallSession(roomId, {
                      consultation_id: consultationId
                    });
                  }
                }
              } else {
                // Criar nova consulta (comportamento original)

                // ✅ Determinar ambiente baseado na origem do socket
                let env = 'prod'; // Default production
                try {
                  // Tentar pegar do header origin ou referer
                  const origin = socket.handshake.headers.origin || socket.handshake.headers.referer || '';
                  // Se origem contiver medcall-ai-homolog ou localhost, marcar como homolog
                  if (origin.includes('medcall-ai-homolog.vercel.app') || origin.includes('localhost')) {
                    env = 'homolog';
                  }
                  console.log(`🌍 [ENV-CHECK] Origin: ${origin} -> Env: ${env}`);
                } catch (e) {
                  console.warn('⚠️ [ENV-CHECK] Erro ao determinar ambiente:', e);
                }

                const consultation = await db.createConsultation({
                  doctor_id: doctor.id,
                  patient_id: patientId,
                  patient_name: patientName,
                  consultation_type: consultationTypeValue,
                  status: 'RECORDING',
                  patient_context: `Consulta ${consultationTypeValue.toLowerCase()} - Sala: ${roomName || 'Sala sem nome'}`,
                  env: env, // ✅ Passando ambiente detectado
                  clinica_id: doctor.clinica_id // ✅ Vinculando à clínica do médico
                });

                if (consultation) {
                  consultationId = consultation.id;
                  room.consultationId = consultationId;

                  if (callSession && callSession.id) {
                    await db.updateCallSession(roomId, {
                      consultation_id: consultationId
                    });
                  }
                }
              }
            }
          } catch (consultationError) {
            console.error('❌ Erro ao criar/atualizar consulta:', consultationError);
            logError(
              `Erro ao criar/atualizar consulta ao criar sala`,
              'error',
              null,
              { roomId, hostName, patientId, patientName, agendamentoId, error: consultationError instanceof Error ? consultationError.message : String(consultationError) }
            );
          }
        }
      } catch (error) {
        console.error('❌ Erro ao criar call_session:', error);
        logError(
          `Exceção ao criar call_session`,
          'error',
          null,
          { roomId, hostName, error: error instanceof Error ? error.message : String(error) }
        );
        // Continuar mesmo se falhar (sala funciona em memória)
      }

      console.log(`✅ Sala criada: ${roomId} por ${hostName}`);

      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

      callback({
        success: true,
        roomId: roomId,
        roomUrl: `${FRONTEND_URL}/consulta/online/patient?roomId=${roomId}`
      });
    });

    // ==================== ENTRAR EM SALA ====================

    socket.on('joinRoom', async (data, callback) => {
      const { roomId, participantName } = data;

      const room = rooms.get(roomId);

      // Verificar se sala existe
      if (!room) {
        callback({
          success: false,
          error: 'Sala não encontrada ou expirada'
        });
        return;
      }

      // Verificar se é host pela role (independente do nome) ou reconexão por nome igual
      const requesterRole = (socket.handshake && socket.handshake.auth && socket.handshake.auth.role) || null;
      const isHostByRole = requesterRole === 'host' || requesterRole === 'doctor';

      if (isHostByRole || participantName === room.hostUserName) {
        console.log(`🔄 Reconexão do host: ${participantName} na sala ${roomId}`);
        room.hostSocketId = socket.id;
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId); // ✅ NOVO: Entrar na sala do Socket.IO
        resetRoomExpiration(roomId);

        // ✅ NOVO: Atualizar webrtc_active = true quando o médico entrar na consulta
        console.log(`🔗 [WebRTC] Médico entrou na sala ${roomId} - atualizando webrtc_active = true`);
        db.setWebRTCActive(roomId, true);

        // ✅ NOVO: Buscar transcrições do banco de dados
        let transcriptionHistory: any[] = room.transcriptions || [];
        if (room.callSessionId) {
          try {
            const { db } = await import('../config/database');
            const dbUtterances = await db.getSessionUtterances(room.callSessionId);

            if (dbUtterances && dbUtterances.length > 0) {
              // ✅ CORREÇÃO: Fazer parse do JSON e extrair cada conversa individualmente
              const parsedTranscriptions: any[] = [];

              for (const u of dbUtterances) {
                try {
                  const parsed = JSON.parse(u.text);
                  if (Array.isArray(parsed)) {
                    // Array de conversas - adicionar cada uma individualmente
                    for (const conv of parsed) {
                      parsedTranscriptions.push({
                        speaker: conv.speaker === 'doctor'
                          ? room.hostUserName
                          : room.participantUserName || 'Paciente',
                        text: conv.text,
                        timestamp: u.created_at
                      });
                    }
                  } else {
                    // Fallback: texto simples (não é array)
                    parsedTranscriptions.push({
                      speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                      text: u.text,
                      timestamp: u.created_at
                    });
                  }
                } catch {
                  // Não é JSON válido - usar como texto simples
                  parsedTranscriptions.push({
                    speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                    text: u.text,
                    timestamp: u.created_at
                  });
                }
              }

              transcriptionHistory = parsedTranscriptions;

              // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
              const memoryTranscriptions = room.transcriptions || [];
              const dbTexts = new Set(transcriptionHistory.map((t: any) => t.text));
              const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTexts.has(t.text));
              transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];

              console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (host)`);
            }
          } catch (error) {
            console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
            // Logar erro no banco
            logError(
              `Erro ao buscar transcrições do banco para host`,
              'error',
              room.consultationId || null,
              { roomId, error: error instanceof Error ? error.message : String(error) }
            );
            // Usar apenas transcrições em memória se falhar
          }
        }

        // ✅ CORREÇÃO: Enviar transcrições históricas para reconexão
        const roomDataWithHistory = {
          ...room,
          // Enviar histórico de transcrições (do banco + memória)
          transcriptionHistory: transcriptionHistory,
          // ✅ NOVO: Enviar duração atual da chamada
          callDuration: getCallDuration(roomId)
        };

        callback({
          success: true,
          role: 'host',
          roomData: roomDataWithHistory
        });

        // ✅ NOVO: Enviar duração atual imediatamente
        socket.emit('callTimerUpdate', { duration: getCallDuration(roomId) });

        // Se já tem participante E já tem oferta, reenviar para o participante
        if (room.participantSocketId && room.offer) {
          console.log(`🔄 Reenviando oferta para participante após reconexão do host`);
          io.to(room.participantSocketId).emit('newOfferAwaiting', {
            roomId: roomId,
            offer: room.offer,
            offererUserName: room.hostUserName
          });
        }

        return;
      }

      // Verificar se usuário já está em outra sala
      if (userToRoom.has(participantName)) {
        const existingRoom = userToRoom.get(participantName);

        // Se é a mesma sala, é reconexão
        if (existingRoom === roomId) {
          console.log(`🔄 Reconexão do participante: ${participantName} na sala ${roomId}`);
          room.participantSocketId = socket.id;
          socketToRoom.set(socket.id, roomId);
          resetRoomExpiration(roomId);

          // ✅ NOVO: Buscar transcrições do banco de dados
          let transcriptionHistory: any[] = room.transcriptions || [];
          if (room.callSessionId) {
            try {
              const { db } = await import('../config/database');
              const dbUtterances = await db.getSessionUtterances(room.callSessionId);

              if (dbUtterances && dbUtterances.length > 0) {
                // ✅ CORREÇÃO: Fazer parse do JSON e extrair cada conversa individualmente
                const parsedTranscriptions: any[] = [];

                for (const u of dbUtterances) {
                  try {
                    const parsed = JSON.parse(u.text);
                    if (Array.isArray(parsed)) {
                      // Array de conversas - adicionar cada uma individualmente
                      for (const conv of parsed) {
                        parsedTranscriptions.push({
                          speaker: conv.speaker === 'doctor'
                            ? room.hostUserName
                            : room.participantUserName || 'Paciente',
                          text: conv.text,
                          timestamp: u.created_at
                        });
                      }
                    } else {
                      // Fallback: texto simples (não é array)
                      parsedTranscriptions.push({
                        speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                        text: u.text,
                        timestamp: u.created_at
                      });
                    }
                  } catch {
                    // Não é JSON válido - usar como texto simples
                    parsedTranscriptions.push({
                      speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
                      text: u.text,
                      timestamp: u.created_at
                    });
                  }
                }

                transcriptionHistory = parsedTranscriptions;

                // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
                const memoryTranscriptions = room.transcriptions || [];
                const dbTexts = new Set(transcriptionHistory.map((t: any) => t.text));
                const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTexts.has(t.text));
                transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];

                console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (participant)`);
              }
            } catch (error) {
              console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
              // Logar erro no banco
              logError(
                `Erro ao buscar transcrições do banco para participante reconectando`,
                'error',
                room.consultationId || null,
                { roomId, error: error instanceof Error ? error.message : String(error) }
              );
            }
          }

          // ✅ CORREÇÃO: Enviar transcrições históricas para reconexão
          const roomDataWithHistory = {
            ...room,
            // Enviar histórico de transcrições (do banco + memória)
            transcriptionHistory: transcriptionHistory
          };

          callback({
            success: true,
            role: 'participant',
            roomData: roomDataWithHistory
          });

          // ✅ NOVO: Se host está conectado, notificar para RECONECTAR WebRTC
          if (room.hostSocketId) {
            console.log(`🔔 Notificando host para RECONECTAR WebRTC (paciente ${participantName} reconectou)`);
            io.to(room.hostSocketId).emit('patient-entered-reconnect-webrtc', {
              roomId: roomId,
              participantName: participantName,
              isReconnection: true
            });

            // Manter o evento antigo para compatibilidade
            io.to(room.hostSocketId).emit('participantRejoined', {
              roomId: roomId,
              participantName: participantName
            });
          }

          return;
        }

        callback({
          success: false,
          error: 'Você já está em outra sala ativa'
        });
        return;
      }

      console.log("[DEBUG-IGOR] participantName", participantName)
      console.log("[DEBUG-IGOR] room.participantUserName", room.participantUserName)
      // Verificar se sala já tem participante
      if (room.participantUserName && room.participantUserName !== participantName) {
        callback({
          success: false,
          error: 'Esta sala já está cheia'
        });
        return;
      }

      // Adicionar participante à sala
      room.participantUserName = participantName;
      room.participantSocketId = socket.id;
      room.status = 'active';

      userToRoom.set(participantName, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId); // ✅ NOVO: Entrar na sala do Socket.IO

      resetRoomExpiration(roomId);

      // ✅ NOVO: Iniciar timer da chamada quando sala ficar ativa
      startCallTimer(roomId, io);

      console.log(`✅ ${participantName} entrou na sala ${roomId}`);

      // ✅ NOVO: Buscar transcrições do banco de dados
      let transcriptionHistory = room.transcriptions || [];
      if (room.callSessionId) {
        try {
          const { db } = await import('../config/database');
          const dbUtterances = await db.getSessionUtterances(room.callSessionId);

          if (dbUtterances && dbUtterances.length > 0) {
            // Converter utterances do banco para formato do frontend
            transcriptionHistory = dbUtterances.map((u: any) => ({
              speaker: u.speaker === 'doctor' ? room.hostUserName : room.participantUserName || 'Paciente',
              text: u.text,
              timestamp: u.created_at || u.timestamp
            }));

            // Mesclar com transcrições em memória (caso haja alguma não salva ainda)
            const memoryTranscriptions = room.transcriptions || [];
            const dbTimestamps = new Set(transcriptionHistory.map((t: any) => t.timestamp));
            const uniqueMemory = memoryTranscriptions.filter((t: any) => !dbTimestamps.has(t.timestamp));
            transcriptionHistory = [...transcriptionHistory, ...uniqueMemory];

            console.log(`📜 [ROOM ${roomId}] ${transcriptionHistory.length} transcrições históricas carregadas do banco (new participant)`);
          }
        } catch (error) {
          console.error(`❌ [ROOM ${roomId}] Erro ao buscar transcrições do banco:`, error);
          // Logar erro no banco
          logError(
            `Erro ao buscar transcrições do banco para novo participante`,
            'error',
            room.consultationId || null,
            { roomId, error: error instanceof Error ? error.message : String(error) }
          );
        }
      }

      // ✅ CORREÇÃO: Enviar transcrições históricas (caso seja reconexão ou sala já iniciada)
      const roomDataWithHistory = {
        ...room,
        // Enviar histórico de transcrições (do banco + memória)
        transcriptionHistory: transcriptionHistory,
        // ✅ NOVO: Enviar duração atual da chamada
        callDuration: getCallDuration(roomId)
      };

      callback({
        success: true,
        role: 'participant',
        roomData: roomDataWithHistory
      });

      // ✅ NOVO: Enviar duração atual imediatamente
      socket.emit('callTimerUpdate', { duration: getCallDuration(roomId) });

      // Notificar host que participante entrou
      io.to(room.hostSocketId).emit('participantJoined', {
        participantName: participantName
      });

      // ✅ NOVO: Notificar host para RECONECTAR WebRTC quando paciente entrar
      console.log(`🔔 Notificando host para RECONECTAR WebRTC (paciente ${participantName} entrou)`);
      io.to(room.hostSocketId).emit('patient-entered-reconnect-webrtc', {
        roomId: roomId,
        participantName: participantName
      });

      // ✅ CORREÇÃO: NÃO enviar oferta pendente aqui pois o médico vai reconectar
      // e criar uma nova oferta automaticamente. Enviar oferta antiga causava
      // múltiplas offers simultâneas e loop de reconexões.
      // A oferta será gerada pelo evento 'patient-entered-reconnect-webrtc'
    });

    // ==================== WEBRTC COM ROOMS ====================

    socket.on('newOffer', (data) => {
      const { roomId, offer } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.log(`❌ Oferta rejeitada: sala ${roomId} não existe`);
        return;
      }

      // Salvar oferta APENAS nesta sala específica
      room.offer = offer;
      room.offererUserName = userName;
      resetRoomExpiration(roomId);

      console.log(`📤 Nova oferta salva na sala ${roomId}`);

      // Enviar oferta APENAS para o participante DESTA sala
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('newOfferAwaiting', {
          roomId: roomId,
          offer: offer,
          offererUserName: room.hostUserName
        });
        console.log(`📨 Oferta enviada para participante da sala ${roomId}`);
      } else {
        console.log(`📦 Oferta salva, aguardando participante entrar na sala ${roomId}`);
      }
    });

    socket.on('newAnswer', async (data, ackFunction) => {
      const { roomId, answer } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.log(`❌ Resposta rejeitada: sala ${roomId} não existe`);
        return;
      }

      room.answer = answer;
      room.answererUserName = userName;
      resetRoomExpiration(roomId);

      console.log(`📥 Nova resposta na sala ${roomId}`);

      // ✅ NOVO: Atualizar webrtc_active = true quando a conexão WebRTC é estabelecida
      // (host + participant conectados E tem offer + answer)
      if (room.hostSocketId && room.participantSocketId && room.offer && room.answer) {
        console.log(`🔗 [WebRTC] Conexão estabelecida na sala ${roomId}`);
        db.setWebRTCActive(roomId, true);
      }

      // Enviar resposta para host
      io.to(room.hostSocketId).emit('answerResponse', {
        roomId: roomId,
        answer: answer,
        answererUserName: room.participantUserName
      });

      // Enviar ICE candidates do ofertante
      ackFunction(room.offerIceCandidates);
    });

    socket.on('sendIceCandidateToSignalingServer', (data) => {
      const { roomId, iceCandidate, didIOffer } = data;
      const room = rooms.get(roomId);

      if (!room) return;

      resetRoomExpiration(roomId);

      if (didIOffer) {
        // ICE do host
        room.offerIceCandidates.push(iceCandidate);

        if (room.participantSocketId && room.answererUserName) {
          io.to(room.participantSocketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
      } else {
        // ICE do participante
        room.answererIceCandidates.push(iceCandidate);

        if (room.hostSocketId) {
          io.to(room.hostSocketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
      }
    });

    // ==================== PARTICIPANT MEDIA READY ====================
    // Evento disparado quando o participante (paciente) tem mídia pronta
    // Isso permite que o médico saiba exatamente quando pode enviar offer

    socket.on('participant-media-ready', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);

      if (!room) {
        console.log(`❌ [MEDIA-READY] Sala ${data.roomId} não encontrada`);
        return;
      }

      // Verificar se quem enviou é realmente o participante
      if (socket.id !== room.participantSocketId) {
        console.log(`❌ [MEDIA-READY] Socket ${socket.id} não é o participante da sala`);
        return;
      }

      console.log(`✅ [MEDIA-READY] Paciente ${room.participantUserName} com mídia pronta na sala ${data.roomId}`);

      // Notificar médico que pode iniciar negociação
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('participant-ready', {
          roomId: data.roomId,
          participantName: room.participantUserName,
          participantId: room.patientId,
        });
        console.log(`📨 [MEDIA-READY] Médico notificado para iniciar negociação`);
      }
    });

    // ==================== PEER VISIBILITY (Background/Foreground) ====================
    // Eventos para quando usuário minimiza app (mobile) ou muda de aba

    socket.on('peer-went-background', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      const userName = socket.handshake.auth.userName || 'Usuário';
      const isHost = socket.id === room.hostSocketId;
      const otherPeerSocketId = isHost ? room.participantSocketId : room.hostSocketId;

      console.log(`📱 [VISIBILITY] ${userName} foi para background na sala ${data.roomId}`);

      if (otherPeerSocketId) {
        io.to(otherPeerSocketId).emit('peer-status', {
          status: 'background',
          peerName: userName,
          isHost: isHost,
        });
      }
    });

    socket.on('peer-returned', (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      const userName = socket.handshake.auth.userName || 'Usuário';
      const isHost = socket.id === room.hostSocketId;
      const otherPeerSocketId = isHost ? room.participantSocketId : room.hostSocketId;

      console.log(`📱 [VISIBILITY] ${userName} retornou do background na sala ${data.roomId}`);

      if (otherPeerSocketId) {
        io.to(otherPeerSocketId).emit('peer-status', {
          status: 'active',
          peerName: userName,
          isHost: isHost,
        });
      }
    });

    // ==================== TRANSCRIÇÕES COM ROOMS ====================

    socket.on('transcription:connect', (data, callback) => {
      console.log(`🔍 [TRANSCRIPTION] Solicitação de conexão recebida de socket ${socket.id}`);

      const roomId = socketToRoom.get(socket.id);
      const userName = socket.handshake.auth.userName;

      console.log(`🔍 [TRANSCRIPTION] Room ID: ${roomId}, User: ${userName}`);

      if (!roomId) {
        console.error(`❌ [TRANSCRIPTION] Socket ${socket.id} não está em uma sala`);
        // Logar warning no banco (não é um erro crítico)
        logWarning(
          `Tentativa de conexão de transcrição sem estar em sala`,
          null,
          { socketId: socket.id, userName }
        );
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Você não está em uma sala. Entre em uma sala primeiro.' });
        }
        return;
      }

      console.log(`[${userName}] Solicitando conexão OpenAI na sala ${roomId}`);

      // ✅ CORREÇÃO: Se já existe uma conexão OpenAI ativa, reutilizar
      if (openAIConnections.has(userName)) {
        const existingWs = openAIConnections.get(userName);

        // Verificar se a conexão ainda está aberta
        if (existingWs && existingWs.readyState === WebSocket.OPEN) {
          console.log(`[${userName}] ✅ Reutilizando conexão OpenAI existente (reconexão)`);

          // Reconfigurar listeners para o novo socket
          existingWs.removeAllListeners('message');
          existingWs.removeAllListeners('error');
          existingWs.removeAllListeners('close');

          // Adicionar listeners para o socket atual
          existingWs.on('message', (data: any) => {
            const message = data.toString();
            try {
              const parsed = JSON.parse(message);
              if (parsed.type === 'conversation.item.input_audio_transcription.completed') {
                console.log(`[${userName}] 📝 TRANSCRIÇÃO:`, parsed.transcript);
              }
            } catch (e) {
              // Ignorar erros de parsing
            }
            socket.emit('transcription:message', message);
          });

          existingWs.on('error', (error: Error) => {
            console.error(`[${userName}] ❌ Erro OpenAI:`, error.message);
            socket.emit('transcription:error', { error: error.message });
          });

          existingWs.on('close', () => {
            console.log(`[${userName}] OpenAI WebSocket fechado`);
            openAIConnections.delete(userName);

            const keepaliveInterval = openAIKeepaliveTimers.get(userName);
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
              openAIKeepaliveTimers.delete(userName);
            }

            socket.emit('transcription:disconnected');
          });

          callback({ success: true, message: 'Conexão existente reutilizada' });
          return;
        } else {
          // Conexão antiga está fechada, remover e criar nova
          console.log(`[${userName}] ⚠️ Conexão OpenAI antiga fechada, criando nova...`);
          openAIConnections.delete(userName);
          const keepaliveInterval = openAIKeepaliveTimers.get(userName);
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            openAIKeepaliveTimers.delete(userName);
          }
        }
      }

      // Azure OpenAI Realtime API configuration
      const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
      const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
      const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-realtime-mini';
      const AZURE_API_VERSION = process.env.AZURE_OPENAI_REALTIME_API_VERSION || '2024-10-01-preview';

      if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
        console.error('❌ [TRANSCRIPTION] Azure OpenAI não configurado!');
        console.error('❌ [TRANSCRIPTION] Verifique as variáveis de ambiente no gateway');
        // Logar erro crítico de configuração
        const room = rooms.get(roomId);
        logError(
          `Azure OpenAI não configurado no servidor`,
          'error',
          room?.consultationId || null,
          { roomId, userName }
        );
        callback({ success: false, error: 'Azure OpenAI não configurado no servidor' });
        return;
      }

      // Extrair hostname do endpoint (remover https://)
      const azureHost = AZURE_ENDPOINT.replace('https://', '').replace('http://', '');

      console.log(`🔗 [TRANSCRIPTION] Tentando conectar à Azure OpenAI Realtime para ${userName} na sala ${roomId}`);

      // Azure Realtime API WebSocket - api-key na query string
      const azureWsUrl = `wss://${azureHost}/openai/realtime?api-version=${AZURE_API_VERSION}&deployment=${AZURE_DEPLOYMENT}&api-key=${AZURE_API_KEY}`;

      const openAIWs = new WebSocket(azureWsUrl);

      openAIWs.on('open', () => {
        console.log(`[${userName}] ✅ Conectado à Azure OpenAI Realtime na sala ${roomId}`);
        openAIConnections.set(userName, openAIWs);

        // 📊 Iniciar tracking de uso da Realtime API
        openAIUsageTracker.set(userName, {
          startTime: Date.now(),
          roomId: roomId,
          textInputTokens: 0,
          textOutputTokens: 0,
          audioInputTokens: 0,
          audioOutputTokens: 0
        });
        console.log(`📊 [AI_PRICING] Iniciando tracking Realtime API para ${userName}`);

        // ✅ Iniciar keepalive para manter conexão viva (ping a cada 5 minutos)
        const keepaliveInterval = setInterval(() => {
          if (openAIWs.readyState === WebSocket.OPEN) {
            // Enviar ping simples via mensagem vazia ou session.update
            try {
              openAIWs.send(JSON.stringify({
                type: 'session.update',
                session: {} // Atualização vazia apenas para keepalive
              }));
              console.log(`[${userName}] 💓 Keepalive enviado para OpenAI`);
            } catch (error) {
              console.error(`[${userName}] ❌ Erro ao enviar keepalive:`, error);
            }
          } else {
            // Se conexão está fechada, limpar interval
            clearInterval(keepaliveInterval);
            openAIKeepaliveTimers.delete(userName);
          }
        }, 5 * 60 * 1000); // 5 minutos

        openAIKeepaliveTimers.set(userName, keepaliveInterval);

        // ⏱️ NOVO: Timeout máximo de 2 horas para evitar cobranças excessivas
        const maxTimeoutTimer = setTimeout(() => {
          console.log(`⏱️ [OpenAI] Timeout máximo atingido para ${userName} (2 horas)`);
          closeOpenAIConnection(userName, 'timeout máximo de 2 horas');
          socket.emit('transcription:disconnected', { reason: 'Conexão encerrada após 2 horas (limite de segurança)' });
        }, OPENAI_MAX_CONNECTION_TIME);

        openAIMaxTimeoutTimers.set(userName, maxTimeoutTimer);
        console.log(`⏱️ [OpenAI] Timer de 2h iniciado para ${userName}`);

        callback({ success: true, message: 'Conectado com sucesso' });
      });

      openAIWs.on('message', (data) => {
        const message = data.toString();
        // Log específico para transcrições e uso
        try {
          const parsed = JSON.parse(message);

          if (parsed.type === 'conversation.item.input_audio_transcription.completed') {
            console.log(`[${userName}] 📝 TRANSCRIÇÃO:`, parsed.transcript);
          }

          // ✅ CÁLCULO DE TOKENS: Capturar evento response.done
          if (parsed.type === 'response.done' && parsed.response?.usage) {
            const usage = parsed.response.usage;

            // 1. Atualizar tracking para estatísticas em tempo real (dashboard)
            const currentUsage = openAIUsageTracker.get(userName);
            if (currentUsage) {
              currentUsage.textInputTokens += (usage.input_token_details?.text_tokens || 0);
              currentUsage.textOutputTokens += (usage.output_token_details?.text_tokens || 0);
              currentUsage.audioInputTokens += (usage.input_token_details?.audio_tokens || 0);
              currentUsage.audioOutputTokens += (usage.output_token_details?.audio_tokens || 0);
            }

            // 2. Registrar no banco IMEDIATAMENTE (solicitação do usuário)
            const room = rooms.get(roomId);

            // Tentar obter consultationId
            let consultaId = room?.consultationId || null;
            if (!consultaId && roomId) {
              // Tentar buscar do banco se não estiver na memória, 
              // mas como isso é assíncrono e estamos dentro de um handler síncrono, 
              // vamos disparar a promise sem await ou usar o que temos.
              // Para evitar complexidade async aqui dentro do handler de mensagem (que é síncrono/rápido),
              // vamos usar apenas o que está na memória room.consultationId.
              // Se não tiver, o log será sem consultaId (null).
            }

            // Chamar logRealtimeUsage para ESTA interação específica
            // Precisamos chamar de forma async sem bloquear o loop de eventos
            (async () => {
              try {
                // Se não tem consultaId na memória, tenta buscar rápido antes de logar
                if (!consultaId && roomId) {
                  const { db } = await import('../config/database'); // Import inside async block
                  consultaId = await db.getConsultationIdByRoomId(roomId);
                  if (consultaId && room) room.consultationId = consultaId;
                }
                const { aiPricingService } = await import('../services/aiPricingService'); // Import inside async block
                await aiPricingService.logRealtimeUsage({
                  durationMs: 0, // Duração é irrelevante para log por token
                  // Nota: Input Tokens incluem TODO o histórico da conversa (contexto),
                  // por isso os valores podem parecer altos em conversas longas.
                  textInputTokens: usage.input_token_details?.text_tokens || 0,
                  textOutputTokens: usage.output_token_details?.text_tokens || 0,
                  audioInputTokens: usage.input_token_details?.audio_tokens || 0,
                  audioOutputTokens: usage.output_token_details?.audio_tokens || 0,
                  cachedTokens: usage.input_token_details?.cached_tokens || 0
                }, consultaId);
              } catch (err) {
                console.error('Erro ao logar uso realtime por interação:', err);
              }
            })();
          }
        } catch (e) {
          // Ignorar erros de parsing
        }
        socket.emit('transcription:message', data.toString());
      });

      openAIWs.on('error', (error: any) => {
        console.error(`❌ [TRANSCRIPTION] Erro OpenAI para ${userName}:`, error);
        console.error(`❌ [TRANSCRIPTION] Mensagem:`, error?.message || 'Erro desconhecido');
        console.error(`❌ [TRANSCRIPTION] Stack:`, error?.stack);
        // Logar erro de conexão OpenAI
        const room = rooms.get(roomId);
        logError(
          `Erro na conexão WebSocket com OpenAI Realtime API`,
          'error',
          room?.consultationId || null,
          { roomId, userName, errorMessage: error?.message || 'Erro desconhecido', errorStack: error?.stack }
        );
        socket.emit('transcription:error', { error: error?.message || 'Erro desconhecido ao conectar à OpenAI' });
        if (typeof callback === 'function') {
          callback({ success: false, error: error?.message || 'Erro desconhecido ao conectar à OpenAI' });
        }
      });

      openAIWs.on('close', async () => {
        console.log(`[${userName}] OpenAI WebSocket fechado`);
        openAIConnections.delete(userName);

        // 📊 Registrar uso da Realtime API
        const usageData = openAIUsageTracker.get(userName);
        if (usageData) {
          const durationMs = Date.now() - usageData.startTime;
          const room = rooms.get(usageData.roomId);

          // Prioridade: consultationId da room > buscar do banco pelo roomId
          let consultaId = room?.consultationId || null;

          // Se não encontrou na room, buscar do banco de dados
          if (!consultaId && usageData.roomId) {
            console.log(`🔍 [AI_PRICING] Buscando consultaId do banco para room ${usageData.roomId}...`);
            consultaId = await db.getConsultationIdByRoomId(usageData.roomId);

            // Atualizar a room em memória se encontrou
            if (consultaId && room) {
              room.consultationId = consultaId;
              console.log(`✅ [AI_PRICING] consultaId recuperado do banco: ${consultaId}`);
            }
          }

          if (!consultaId) {
            console.warn(`⚠️ [AI_PRICING] Não foi possível obter consultaId para room ${usageData.roomId}`);
          }

          // 📊 Atualizado: Não logar acumulado no final, pois já estamos logando por interação.
          // Apenas logar informativo no console de encerramento
          const totalTextIn = usageData.textInputTokens || 0;
          const totalTextOut = usageData.textOutputTokens || 0;
          const totalAudioIn = usageData.audioInputTokens || 0;
          const totalAudioOut = usageData.audioOutputTokens || 0;

          console.log(`📊 [AI_PRICING] Realtime API encerrada para ${userName}`);
          console.log(`   - Duração Sessão: ${(durationMs / 60000).toFixed(2)} minutos`);
          console.log(`   - Total Tokens Acumulados (para conferência):`);
          console.log(`     - Text In/Out: ${totalTextIn} / ${totalTextOut}`);
          console.log(`     - Audio In/Out: ${totalAudioIn} / ${totalAudioOut}`);

          // NÃO chamamos aiPricingService.logRealtimeUsage aqui para não duplicar cobrança.

          openAIUsageTracker.delete(userName);
        }

        // Limpar keepalive timer
        const keepaliveInterval = openAIKeepaliveTimers.get(userName);
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          openAIKeepaliveTimers.delete(userName);
        }

        socket.emit('transcription:disconnected');
      });
    });

    socket.on('transcription:send', (data) => {
      const openAIWs = openAIConnections.get(userName);

      if (!openAIWs || openAIWs.readyState !== WebSocket.OPEN) {
        // Logar warning de conexão não disponível
        const roomId = socketToRoom.get(socket.id);
        const room = roomId ? rooms.get(roomId) : null;
        logWarning(
          `Tentativa de enviar transcrição sem conexão OpenAI ativa`,
          room?.consultationId || null,
          { userName, roomId, wsReadyState: openAIWs?.readyState }
        );
        socket.emit('transcription:error', { error: 'Não conectado à OpenAI' });
        return;
      }
      openAIWs.send(data);
    });

    socket.on('transcription:disconnect', async () => {
      // 🔧 CORREÇÃO: Usar função centralizada para fechar conexão
      await closeOpenAIConnection(userName, 'transcription:disconnect solicitado');
    });

    socket.on('sendTranscriptionToPeer', async (data) => {
      console.log(`📨 [RECEIVED] Evento sendTranscriptionToPeer recebido:`, {
        roomId: data.roomId,
        from: data.from,
        to: data.to,
        transcriptionLength: data.transcription?.length || 0,
        hasTranscription: !!data.transcription
      });

      const { roomId, transcription, from, to } = data;
      const room = rooms.get(roomId);

      if (!room) {
        console.error(`❌ [AUTO-SAVE] Transcrição rejeitada: sala ${roomId} não existe`);
        console.error(`❌ [AUTO-SAVE] Salas disponíveis:`, Array.from(rooms.keys()));
        // Logar warning - sala não encontrada
        logWarning(
          `Transcrição rejeitada: sala não existe`,
          null,
          { roomId, salasDisponiveis: Array.from(rooms.keys()), userName }
        );
        return;
      }

      //console.log(`✅ [AUTO-SAVE] Sala encontrada: ${roomId}`, {
      //  hasCallSessionId: !!room.callSessionId,
      //  callSessionId: room.callSessionId,
      //  hostUserName: room.hostUserName,
      //  participantUserName: room.participantUserName
      //});

      // Salvar transcrição no histórico da sala (memória)
      const transcriptionEntry = {
        speaker: from,
        text: transcription,
        timestamp: new Date().toISOString()
      };
      room.transcriptions.push(transcriptionEntry);
      console.log('[DEBUG] [sendTranscriptionToPeer]')

      // ✅ NOVO: Salvar transcrição em array único (atualizando o registro existente)
      //console.log(`🔍 [AUTO-SAVE] Verificando condições para salvar:`, {
      //  roomId: roomId,
      //  hasCallSessionId: !!room.callSessionId,
      //  callSessionId: room.callSessionId,
      //  from: from,
      //  transcriptionLength: transcription.length
      //});

      if (room.callSessionId) {
        try {
          const { db } = await import('../config/database');

          // ✅ CORREÇÃO: Usar socket.id para identificar quem é o médico (mais confiável que comparar nomes)
          const isDoctor = socket.id === room.hostSocketId;
          const speaker = isDoctor ? 'doctor' : 'patient';
          const speakerId = isDoctor
            ? (room.doctorName || room.hostUserName)
            : (room.participantUserName || room.patientName || 'Paciente');

          //console.log(`💾 [AUTO-SAVE] Tentando salvar transcrição:`, {
          //  sessionId: room.callSessionId,
          //  speaker: speaker,
          //  speakerId: speakerId,
          //  doctorName: room.doctorName || room.hostUserName,
          //  textLength: transcription.length,
          //  roomId: roomId,
          //  socketId: socket.id,
          //  hostSocketId: room.hostSocketId,
          //  isDoctor: isDoctor,
          //  environment: process.env.NODE_ENV
          //});

          // ✅ Salvar no array de conversas (atualiza o registro único)
          const success = await db.addTranscriptionToSession(room.callSessionId, {
            speaker: speaker,
            speaker_id: speakerId,
            text: transcription,
            confidence: 0.95,
            start_ms: Date.now(),
            end_ms: Date.now(),
            doctor_name: room.doctorName || room.hostUserName // ✅ Passar nome do médico
          });

          if (!success) {
            console.error(`❌ [AUTO-SAVE] Falha ao adicionar transcrição ao array`);
            console.error(`❌ [AUTO-SAVE] Session ID: ${room.callSessionId}`);
            console.error(`❌ [AUTO-SAVE] Room ID: ${roomId}`);
            console.error(`❌ [AUTO-SAVE] Verifique os logs anteriores para mais detalhes`);
            // Logar erro de salvamento de transcrição
            logError(
              `Falha ao adicionar transcrição ao array no banco`,
              'error',
              room.consultationId || null,
              { roomId, sessionId: room.callSessionId, speaker, textLength: transcription.length }
            );
          } else {
            console.log(`✅ [AUTO-SAVE] Transcrição salva com sucesso! Session: ${room.callSessionId}`);
          }
        } catch (error) {
          console.error(`❌ [AUTO-SAVE] Erro ao salvar transcrição no banco:`, error);
          if (error instanceof Error) {
            console.error(`❌ [AUTO-SAVE] Stack:`, error.stack);
          }
          // Logar erro de exceção ao salvar
          logError(
            `Erro ao salvar transcrição no banco`,
            'error',
            room.consultationId || null,
            { roomId, sessionId: room.callSessionId, error: error instanceof Error ? error.message : String(error) }
          );
          // Continuar mesmo se falhar (não bloquear transcrição)
        }
      } else {
        console.error(`❌ [AUTO-SAVE] callSessionId não disponível para sala ${roomId}, transcrição NÃO será salva no banco!`);
        console.error(`❌ [AUTO-SAVE] Room data:`, {
          roomId,
          hostUserName: room.hostUserName,
          participantUserName: room.participantUserName,
          patientName: room.patientName,
          hasCallSessionId: !!room.callSessionId,
          callSessionId: room.callSessionId
        });
        console.error(`❌ [AUTO-SAVE] Isso indica que a call_session não foi criada corretamente!`);
        // Logar warning - sessão não configurada corretamente
        logWarning(
          `callSessionId não disponível - transcrição não será salva no banco`,
          room.consultationId || null,
          {
            roomId,
            hostUserName: room.hostUserName,
            participantUserName: room.participantUserName,
            patientName: room.patientName
          }
        );
      }

      resetRoomExpiration(roomId);

      console.log(`[ROOM ${roomId}] ${from} -> ${to}: "${transcription}"`);

      // ✅ CORREÇÃO: Enviar para todos os participantes da sala
      const participants = [
        { socketId: room.hostSocketId, userName: room.hostUserName },
        { socketId: room.participantSocketId, userName: room.participantUserName }
      ].filter(p => p.socketId && p.userName); // Filtrar participantes válidos

      participants.forEach(participant => {
        if (participant.socketId !== socket.id) { // Não enviar para quem enviou
          io.to(participant.socketId).emit('receiveTranscriptionFromPeer', {
            roomId: roomId,
            transcription: transcription,
            from: from
          });
        }
      });

      console.log(`[ROOM ${roomId}] 📝 Transcrição "${transcription}" enviada para ${participants.length - 1} participantes`);

      // 🤖 GERAÇÃO DE SUGESTÕES DE IA
      // TODO: Implementar chamada HTTP para o ai-service em /api/suggestions
      // A funcionalidade de sugestões foi migrada para o microserviço ai-service.
      // Disparar análise de IA a cada 10 transcrições (otimizado para custo)
      if (room.transcriptions.length % 10 === 0 && room.transcriptions.length > 0) {
        console.log(`🤖 [ROOM ${roomId}] Sugestões de IA desabilitadas temporariamente (migração para ai-service)`);
        // TODO: Implementar HTTP client para chamar ai-service
        // const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3003';
        // fetch(`${AI_SERVICE_URL}/api/suggestions`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ ... })
        // });
      }
    });

    // ==================== FINALIZAR SALA ====================

    socket.on('endRoom', async (data, callback) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      // Verificar se quem está finalizando é o host
      if (socket.id !== room.hostSocketId) {
        const requester = (socket.handshake && socket.handshake.auth) || {};
        const requesterName = requester.userName || null;
        const requesterRole = requester.role || null;

        const isHostByIdentity = Boolean(requesterName && requesterName === room.hostUserName);
        const isHostByRole = requesterRole === 'host' || requesterRole === 'doctor';

        if (isHostByIdentity || isHostByRole) {
          console.log(`🔄 Reatando host ao novo socket para finalizar sala ${roomId}`);
          room.hostSocketId = socket.id;
        } else {
          callback({ success: false, error: 'Apenas o host pode finalizar a sala' });
          return;
        }
      }

      console.log(`🏁 Finalizando sala ${roomId}...`);

      let saveResult: any = {
        transcriptionsCount: room.transcriptions.length,
        transcriptions: room.transcriptions
      };

      // ==================== SALVAR NO BANCO DE DADOS ====================
      try {
        // 1. Buscar doctor_id pelo userAuth (se necessário para fallback)
        let doctorId = null;
        if (room.userAuth && !room.consultationId) {
          // Só buscar se não temos consultationId (para fallback)
          const doctor = await db.getDoctorByAuth(room.userAuth);
          if (doctor) {
            doctorId = doctor.id;
            console.log(`👨‍⚕️ Médico encontrado: ${doctor.name} (${doctorId})`);
          } else {
            console.warn(`⚠️ Médico não encontrado para userAuth: ${room.userAuth}`);
          }
        }

        // 2. Usar CONSULTATION existente ou criar se não existir
        let consultationId = room.consultationId || null;

        if (consultationId) {
          // ✅ Consulta já existe (foi criada quando a sala foi criada)
          // Atualizar status para PROCESSING e registrar fim da consulta
          try {
            const { supabase } = await import('../config/database');

            // ✅ Calcular duração em minutos (duracao é REAL no banco)
            const duracaoSegundos = calculateDuration(room.createdAt);
            const duracaoMinutos = duracaoSegundos / 60; // Converter para minutos
            const consultaFim = new Date().toISOString();

            const { error: updateError } = await supabase
              .from('consultations')
              .update({
                status: 'PROCESSING',
                consulta_fim: consultaFim, // ✅ Registrar fim da consulta
                duracao: duracaoMinutos, // ✅ Duração em minutos
                updated_at: consultaFim
              })
              .eq('id', consultationId);

            if (updateError) {
              console.error('❌ Erro ao atualizar status da consulta:', updateError);
              logError(
                `Erro ao atualizar status da consulta para PROCESSING`,
                'error',
                consultationId,
                { roomId, error: updateError.message }
              );
            } else {
              console.log(`📋 Consulta ${consultationId} atualizada para PROCESSING (duração: ${duracaoMinutos.toFixed(2)} min)`);
            }
          } catch (updateError) {
            console.error('❌ Erro ao atualizar consulta:', updateError);
            logError(
              `Exceção ao atualizar consulta`,
              'error',
              consultationId,
              { roomId, error: updateError instanceof Error ? updateError.message : String(updateError) }
            );
          }
        } else if (doctorId && room.patientId) {
          // ✅ Fallback: criar consulta se não foi criada antes (compatibilidade)
          console.warn('⚠️ Consulta não encontrada na room, criando nova...');
          const consultation = await db.createConsultation({
            doctor_id: doctorId,
            patient_id: room.patientId,
            patient_name: room.patientName,
            consultation_type: 'TELEMEDICINA',
            status: 'PROCESSING',
            patient_context: `Consulta online - Sala: ${room.roomName}`
          });

          if (consultation) {
            consultationId = consultation.id;
            console.log(`📋 Consulta criada (fallback): ${consultationId}`);
            saveResult.consultationId = consultationId;

            // ✅ Atualizar consulta_fim e duracao (já que a consulta foi criada no fim)
            try {
              const { supabase } = await import('../config/database');
              const duracaoSegundos = calculateDuration(room.createdAt);
              const duracaoMinutos = duracaoSegundos / 60;

              await supabase
                .from('consultations')
                .update({
                  consulta_fim: new Date().toISOString(),
                  duracao: duracaoMinutos
                })
                .eq('id', consultationId);

              console.log(`📋 Consulta ${consultationId} atualizada com duração: ${duracaoMinutos.toFixed(2)} min`);
            } catch (updateError) {
              console.error('❌ Erro ao atualizar duração da consulta fallback:', updateError);
              logError(
                `Erro ao atualizar duração da consulta fallback`,
                'error',
                consultationId,
                { roomId, error: updateError instanceof Error ? updateError.message : String(updateError) }
              );
            }
          } else {
            console.warn('⚠️ Falha ao criar consulta no banco');
            logError(
              `Falha ao criar consulta no banco (fallback)`,
              'error',
              null,
              { roomId, doctorId, patientId: room.patientId, patientName: room.patientName }
            );
          }
        } else {
          console.warn('⚠️ Consulta não criada/atualizada - faltam doctor_id ou patientId');
          logWarning(
            `Consulta não criada/atualizada - faltam doctor_id ou patientId`,
            null,
            { roomId, hasDoctorId: !!doctorId, hasPatientId: !!room.patientId }
          );
        }

        // 3. Atualizar CALL_SESSION com consultation_id
        if (room.callSessionId && consultationId) {
          const updated = await db.updateCallSession(roomId, {
            consultation_id: consultationId,
            status: 'ended',
            ended_at: new Date().toISOString(),
            webrtc_active: false, // ✅ NOVO: Garantir que webrtc_active seja false ao encerrar
            metadata: {
              transcriptionsCount: room.transcriptions.length,
              duration: calculateDuration(room.createdAt),
              participantName: room.participantUserName
            }
          });

          if (updated) {
            console.log(`💾 Call session atualizada: ${room.callSessionId}`);
          }
        } else {
          // ✅ NOVO: Mesmo sem callSessionId, atualizar webrtc_active
          db.setWebRTCActive(roomId, false);
        }

        // 4. Salvar TRANSCRIÇÕES (raw_text completo)
        if (consultationId && room.transcriptions.length > 0) {
          // Juntar todas as transcrições em um único texto
          const rawText = room.transcriptions
            .map((t: any) => `[${t.speaker}] (${t.timestamp}): ${t.text}`)
            .join('\n');

          const transcription = await db.saveConsultationTranscription({
            consultation_id: consultationId,
            raw_text: rawText,
            language: 'pt-BR',
            model_used: 'gpt-4o-mini-realtime-preview'
          });

          if (transcription) {
            console.log(`📝 Transcrição salva: ${transcription.id}`);
            saveResult.transcriptionId = transcription.id;
          } else {
            console.warn('⚠️ Falha ao salvar transcrição no banco');
            logError(
              `Falha ao salvar transcrição completa no banco ao finalizar consulta`,
              'error',
              consultationId,
              { roomId, transcriptionsCount: room.transcriptions.length }
            );
          }
        }

        console.log(`✅ Dados salvos no banco de dados com sucesso`);

        // 💰 NOVO: Calcular e atualizar valor_consulta
        if (consultationId) {
          try {
            const totalCost = await aiPricingService.calculateAndUpdateConsultationCost(consultationId);
            if (totalCost !== null) {
              console.log(`💰 [CONSULTA] Custo total calculado e salvo: $${totalCost.toFixed(6)}`);
            }
          } catch (costError) {
            console.error('❌ Erro ao calcular custo da consulta (não bloqueia finalização):', costError);
          }
        }

      } catch (error) {
        console.error('❌ Erro ao salvar no banco de dados:', error);
        saveResult.error = 'Erro ao salvar alguns dados no banco';
        logError(
          `Erro geral ao salvar dados no banco ao finalizar consulta`,
          'error',
          room.consultationId || null,
          { roomId, error: error instanceof Error ? error.message : String(error) }
        );
      }
      // ================================================================

      // Notificar participante que sala foi finalizada
      if (room.participantSocketId) {
        io.to(room.participantSocketId).emit('roomEnded', {
          roomId: roomId,
          message: 'A sala foi finalizada pelo host'
        });
      }

      // Limpar timer do mapa separado
      if (roomTimers.has(roomId)) {
        clearTimeout(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }

      // Remover mapeamentos
      if (room.hostUserName) userToRoom.delete(room.hostUserName);
      if (room.participantUserName) userToRoom.delete(room.participantUserName);
      socketToRoom.delete(room.hostSocketId);
      if (room.participantSocketId) socketToRoom.delete(room.participantSocketId);

      // Remover sala
      rooms.delete(roomId);

      console.log(`✅ Sala ${roomId} finalizada`);

      callback({
        success: true,
        message: 'Sala finalizada com sucesso',
        saveResult: saveResult,
        participantUserName: room.participantUserName  // ✅ NOVO: Indicar se paciente entrou
      });
    });

    // ==================== DESCONEXÃO ====================

    socket.on('disconnect', () => {
      console.log(`[${userName}] desconectado - Socket: ${socket.id}`);

      const roomId = socketToRoom.get(socket.id);

      if (roomId) {
        const room = rooms.get(roomId);

        if (room) {
          // Se host desconectou
          if (socket.id === room.hostSocketId) {
            console.log(`⚠️ Host desconectou da sala ${roomId}`);
            room.hostSocketId = null;

            // ✅ NOVO: Atualizar webrtc_active = false quando host desconecta
            console.log(`🔌 [WebRTC] Conexão perdida na sala ${roomId} (host desconectou)`);
            db.setWebRTCActive(roomId, false);
          }

          // Se participante desconectou
          if (socket.id === room.participantSocketId) {
            console.log(`⚠️ Participante desconectou da sala ${roomId}`);
            // Liberar vaga do participante para evitar sala ficar "cheia"
            if (room.participantUserName) {
              userToRoom.delete(room.participantUserName);
            }
            room.participantUserName = null;
            room.participantSocketId = null;

            // ✅ NOVO: Atualizar webrtc_active = false quando participante desconecta
            console.log(`🔌 [WebRTC] Conexão perdida na sala ${roomId} (participante desconectou)`);
            db.setWebRTCActive(roomId, false);
          }

          // Continuar com timer de expiração (permite reconexão)
          resetRoomExpiration(roomId);
        }
      }

      // 🔧 CORREÇÃO: Fechar conexão OpenAI corretamente quando usuário desconecta
      closeOpenAIConnection(userName, 'usuário desconectou');

      socketToRoom.delete(socket.id);
    });
  });

  // console.log('✅ Handlers de salas WebSocket configurados');
}

// Exportar funções e mapas para uso em outras partes do sistema
export {
  rooms,
  userToRoom,
  socketToRoom,
  openAIConnections
};

/**
 * 📊 Obtém estatísticas das conexões OpenAI ativas em tempo real
 * Útil para monitoramento de custos
 */
export function getOpenAIConnectionsStats() {
  const now = Date.now();
  const connections: Array<{
    userName: string;
    roomId: string;
    startTime: string;
    durationMinutes: number;
    estimatedCost: number;
    status: string;
  }> = [];

  // Iterar sobre conexões ativas
  for (const [userName, ws] of openAIConnections.entries()) {
    const usageData = openAIUsageTracker.get(userName);

    if (usageData) {
      const durationMs = now - usageData.startTime;
      const durationMinutes = durationMs / 60000;
      // Custo estimado: $0.06/min input + $0.24/min output ≈ $0.30/min total
      const estimatedCost = durationMinutes * 0.30;

      connections.push({
        userName,
        roomId: usageData.roomId,
        startTime: new Date(usageData.startTime).toISOString(),
        durationMinutes: Math.round(durationMinutes * 100) / 100,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        status: ws.readyState === 1 ? 'OPEN' : ws.readyState === 0 ? 'CONNECTING' : 'CLOSING/CLOSED'
      });
    }
  }

  // Calcular totais
  const totalConnections = connections.length;
  const totalMinutes = connections.reduce((sum, c) => sum + c.durationMinutes, 0);
  const totalEstimatedCost = connections.reduce((sum, c) => sum + c.estimatedCost, 0);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalConnections,
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      maxConnectionTime: OPENAI_MAX_CONNECTION_TIME / 60000, // em minutos
    },
    connections,
    warning: totalConnections > 0 ?
      `⚠️ ${totalConnections} conexão(ões) OpenAI ativa(s) consumindo aproximadamente $${totalEstimatedCost.toFixed(2)} até agora` :
      null
  };
}
