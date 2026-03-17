import { Server as SocketIOServer } from 'socket.io';
import crypto from 'crypto';
import WebSocket from 'ws';
import { db, logError, logWarning } from '../config/database';
import { aiPricingService } from '../services/aiPricingService';
import { transcriptionService } from '../services/transcriptionService'; // ✅ Importado


// ==================== ESTRUTURAS DE DADOS ====================

// Mapa de salas: roomId -> roomData
const rooms = new Map();

// Mapa de usuário para sala ativa: userName -> roomId
const userToRoom = new Map();

// Mapa de socket para sala: socketId -> roomId
const socketToRoom = new Map();

// ❌ REMOVIDO: Mapas da Realtime API (openAIConnections, trackers) - Migrado para Whisper


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
/**
 * 🔧 Fecha conexão OpenAI de forma segura e registra uso
 * (Stub mantido para compatibilidade, mas lógica removida)
 */
async function closeOpenAIConnection(userName: string, reason: string = 'desconexão'): Promise<void> {
  // Lógica da Realtime API removida.
  // Clean up any remaining legacy state if needed.
  console.log(`🔌 [WHISPER-MIGRATION] closeOpenAIConnection chamado para ${userName} (${reason}) - Ignorado (Realtime API desativada)`);
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
  // ✅ LISTENER GLOBAL PARA TRANSCRIPTION SERVICE
  // Escuta eventos do serviço Whisper e retransmite para o socket como se fosse evento da OpenAI
  if (transcriptionService.listenerCount('transcription') === 0) {
    transcriptionService.on('transcription', ({ roomName, segment }) => {
      // console.log(`📝 [WHISPER->SOCKET] Retransmitindo transcrição para sala ${roomName}: "${segment.text}"`);

      // ✅ FIX: Adicionar ao array room.transcriptions para ser salvo em consultations.transcricao
      const room = rooms.get(roomName);
      if (room) {
        const transcriptionEntry = {
          speaker: segment.speaker || segment.participantName || 'UNKNOWN',
          text: segment.text,
          timestamp: segment.timestamp || new Date().toISOString()
        };
        room.transcriptions.push(transcriptionEntry);
        console.log(`📝 [WHISPER] Transcrição adicionada ao array (total: ${room.transcriptions.length}): "${segment.text.substring(0, 50)}..."`);
      }

      // Mock do evento 'conversation.item.input_audio_transcription.completed' da OpenAI
      const fakeOpenAIEvent = {
        type: 'conversation.item.input_audio_transcription.completed',
        event_id: `evt_${segment.id}`,
        item_id: `item_${segment.id}`,
        content_index: 0,
        transcript: segment.text, // O texto transcrito!
        timestamp: new Date().toISOString()
      };

      // Emitir para a sala inteira (Socket.IO)
      io.to(roomName).emit('transcription:message', JSON.stringify(fakeOpenAIEvent));
    });
    console.log('✅ [WHISPER] Listener global configurado em rooms.ts');
  }

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
      const { hostName, roomName, patientId, patientName, patientEmail, patientPhone, userAuth, consultationType, agendamentoId, andamento } = data;

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
        doctorName: null, // ✅ Nome do médico (será preenchido quando buscar dados do médico)
        joinedPatientName: null // ✅ NOVO: Persistir se o paciente já entrou alguma vez
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
                let consultationFrom: string | null = null;
                try {
                  // Tentar pegar do header origin ou referer
                  const origin = socket.handshake.headers.origin || socket.handshake.headers.referer || '';
                  // Se origem contiver medcall-ai-homolog ou localhost, marcar como homolog
                  if (origin.includes('medcall-ai-homolog.vercel.app') || origin.includes('localhost')) {
                    env = 'homolog';
                  }
                  // ✅ Determinar "from" baseado na URL de origem
                  const originStr = typeof origin === 'string' ? origin : '';
                  if (originStr.includes('medcall-ai-frontend-v2.vercel.app')) {
                    consultationFrom = 'medcall';
                  } else if (originStr.includes('autonhealth.com.br')) {
                    consultationFrom = 'auton';
                  } else if (originStr.includes('localhost')) {
                    consultationFrom = 'localhost';
                  }
                  console.log(`🌍 [ENV-CHECK] Origin: ${origin} -> Env: ${env}, From: ${consultationFrom}`);
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
                  from: consultationFrom, // ✅ Origem da plataforma
                  clinica_id: doctor.clinica_id, // ✅ Vinculando à clínica do médico
                  andamento: andamento || 'NOVA' // ✅ Tipo: NOVA ou RETORNO
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
              // ✅ Registrar nome do médico no serviço de transcrição
              transcriptionService.registerParticipant(userName || socket.id, doctorName, 'doctor');
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

        // ✅ Garantir que o serviço de transcrição conheça o ID da consulta
        if (room.consultationId) {
          transcriptionService.startTranscription(roomId, room.consultationId).catch(err => {
            console.error(`❌ Erro ao registrar transcrição para sala ${roomId} (Host):`, err);
          });
          // ✅ Registrar nome do médico no serviço de transcrição
          transcriptionService.registerParticipant(userName || socket.id, room.doctorName || room.hostUserName, 'doctor');
        }

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
          room.joinedPatientName = participantName; // ✅ NOVO: Persistir nome do paciente
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
          error: 'Esta sala já está cheia'
        });
        return;
      }

      console.log(`👤 Participante ${participantName} entrou na sala ${roomId}`);
      room.participantUserName = participantName;
      room.participantSocketId = socket.id;
      room.joinedPatientName = participantName; // ✅ NOVO: Persistir nome do paciente
      userToRoom.set(participantName, roomId);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId); // ✅ NOVO: Entrar na sala do Socket.IO
      resetRoomExpiration(roomId);

      // ✅ NOVO: Iniciar timer da chamada quando sala ficar ativa
      startCallTimer(roomId, io);

      console.log(`✅ ${participantName} entrou na sala ${roomId}`);

      // ✅ NOVO: Buscar transcrições do banco de dados
      // ✅ Garantir que o serviço de transcrição conheça o ID da consulta
      if (room.consultationId) {
        transcriptionService.startTranscription(roomId, room.consultationId).catch(err => {
          console.error(`❌ Erro ao registrar transcrição para sala ${roomId}:`, err);
        });
        // ✅ Registrar nome do paciente no serviço de transcrição
        transcriptionService.registerParticipant(userName || socket.id, participantName, 'patient');
      }

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
      console.log(`🔍 [TRANSCRIPTION] Conexão solicitada por ${socket.id} (MIGRADO PARA WHISPER)`);
      const roomId = socketToRoom.get(socket.id);

      if (!roomId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Você não está em uma sala.' });
        }
        return;
      }

      // Simplesmente retornar sucesso. O backend agora "só ouve".
      // Não abrimos conexão real com OpenAI.
      if (typeof callback === 'function') {
        callback({ success: true, message: 'Conectado (Whisper VAD Active)' });
      }
    });



    socket.on('transcription:send', (data) => {
      // ✅ INTERCEPTOR para o serviço Whisper VAD
      try {
        const payload = JSON.parse(data);

        // Extrair áudio do evento 'input_audio_buffer.append'
        if (payload.type === 'input_audio_buffer.append' && payload.audio) {
          const roomId = socketToRoom.get(socket.id);
          const userName = socket.handshake.auth.userName;

          if (roomId) {
            const audioBuffer = Buffer.from(payload.audio, 'base64');
            // Envia para o processador VAD + Whisper
            transcriptionService.processAudioChunk({
              data: audioBuffer,
              participantId: userName || socket.id,
              sampleRate: 24000, // Realtime API default é 24kHz
              channels: 1
            }, roomId);
          }
        }
      } catch (e) {
        // Se não for JSON ou erro de parse, ignora
      }
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
                consulta_finalizada: true,
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
              console.log(`📋 Consulta ${consultationId} finalizada e atualizada para PROCESSING (duração: ${duracaoMinutos.toFixed(2)} min)`);
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
                  consulta_finalizada: true,
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
        // 3. Atualizar CALL_SESSION (Sempre, usando o roomId)
        try {
          const callSessionUpdateData: any = {
            status: 'ended',
            ended_at: new Date().toISOString(),
            webrtc_active: false,
            metadata: {
              transcriptionsCount: room.transcriptions.length,
              duration: calculateDuration(room.createdAt), // Mantendo formato original (segundos?)
              participantName: room.participantUserName,
              terminatedBy: socket.id === room.hostSocketId ? 'host' : 'participant'
            }
          };

          // Se tiver consultationId, atualiza o vínculo também
          if (consultationId) {
            callSessionUpdateData.consultation_id = consultationId;
          }

          console.log(`💾 Atualizando call_session para ENDED (Room: ${roomId})`);
          await db.updateCallSession(roomId, callSessionUpdateData);
          saveResult.sessionUpdated = true;

        } catch (sessionError) {
          console.error('❌ Erro ao atualizar call_session:', sessionError);
          logError(
            `Erro ao atualizar call_session para ended`,
            'error',
            consultationId,
            { roomId, error: sessionError instanceof Error ? sessionError.message : String(sessionError) }
          );
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

          // ✅ CORREÇÃO: Salvar também na coluna 'transcricao' da tabela 'consultations' (requisito do usuário)
          await db.updateConsultation(consultationId, {
            transcricao: rawText
          });
          console.log(`📝 Transcrição salva na consulta ${consultationId} (coluna transcricao)`);

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
        participantUserName: room.participantUserName || room.joinedPatientName  // ✅ NOVO: Usar fallback persistente
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
  socketToRoom
};

/**
 * 📊 Obtém estatísticas das conexões OpenAI ativas em tempo real
 * Útil para monitoramento de custos
 */
/**
 * 📊 Obtém estatísticas (STUB - Realtime API desativada)
 */
export function getOpenAIConnectionsStats() {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalConnections: 0,
      totalMinutes: 0,
      totalEstimatedCost: 0,
      maxConnectionTime: 0,
    },
    connections: [],
    warning: null
  };
}
