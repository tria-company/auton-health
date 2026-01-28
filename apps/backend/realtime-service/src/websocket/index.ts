import { Server as SocketIOServer, Socket } from 'socket.io';
import { isDevelopment } from '../config';
import { setupPresentialAudioHandlers } from './audioHandler';
import { setupOnlineConsultationHandlers } from './onlineConsultationHandler';
import { setupExamHandlers } from './suggestionHandler';

// Interfaces para eventos WebSocket
interface SessionJoinData {
  sessionId: string;
  userId: string;
  role: 'doctor' | 'patient';
}

interface AudioData {
  sessionId: string;
  chunk: Buffer;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

// Setup dos handlers WebSocket
export function setupWebSocketHandlers(io: SocketIOServer): void {
  const notifier = new SessionNotifier(io);
  io.on('connection', (socket: Socket) => {
    if (isDevelopment) {
      console.log(`WebSocket conectado: ${socket.id}`);
    }

    // Configurar handlers de áudio presencial
    setupPresentialAudioHandlers(socket, notifier);

    // Configurar handlers de consulta online
    setupOnlineConsultationHandlers(socket, notifier);

    // ✅ Configurar handlers de exames (upload/vínculo)
    setupExamHandlers(socket, io);

    // Handler para participar de uma sessão
    socket.on('session:join', async (data: SessionJoinData) => {
      const { sessionId, userId, role } = data;

      if (!sessionId || !userId || !role) {
        socket.emit('error', {
          code: 'INVALID_SESSION_DATA',
          message: 'Dados de sessão inválidos',
        });
        return;
      }

      // Entrar na sala da sessão
      socket.join(`session:${sessionId}`);

      // Notificar outros participantes
      socket.to(`session:${sessionId}`).emit('participant:joined', {
        userId,
        role,
        timestamp: new Date().toISOString(),
      });

      // ✅ NOVO: Buscar e enviar histórico de transcrições
      try {
        const { db } = await import('../config/database');
        const utterances = await db.getSessionUtterances(sessionId);

        if (utterances && utterances.length > 0) {
          // Enviar histórico completo via SessionNotifier
          notifier.emitTranscriptionHistory(sessionId, utterances);

          if (isDevelopment) {
            console.log(`📜 ${utterances.length} transcrições históricas enviadas para ${userId} na sessão ${sessionId}`);
          }
        } else {
          if (isDevelopment) {
            console.log(`📜 Nenhuma transcrição histórica encontrada para sessão ${sessionId}`);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao buscar histórico de transcrições:', error);
        // Não bloquear a conexão se houver erro ao buscar histórico
      }

      // Confirmar entrada na sessão
      socket.emit('session:joined', {
        sessionId,
        userId,
        role,
        timestamp: new Date().toISOString(),
      });


      if (isDevelopment) {
        console.log(`Usuario ${userId} (${role}) entrou na sessão ${sessionId}`);
      }
    });

    // Handler para sair de uma sessão
    socket.on('session:leave', (data: { sessionId: string; userId: string }) => {
      const { sessionId, userId } = data;

      if (sessionId) {
        socket.leave(`session:${sessionId}`);

        // Notificar outros participantes
        socket.to(`session:${sessionId}`).emit('participant:left', {
          userId,
          timestamp: new Date().toISOString(),
        });

        if (isDevelopment) {
          console.log(`Usuario ${userId} saiu da sessão ${sessionId}`);
        }
      }
    });

    // Handler para receber dados de áudio (preparação para futura implementação)
    socket.on('audio:data', (data: AudioData) => {
      // TODO: Implementar processamento de áudio
      // Por enquanto, apenas log em desenvolvimento
      if (isDevelopment) {
        console.log(`Áudio recebido da sessão ${data.sessionId}: ${data.chunk.length} bytes`);
      }

      // Placeholder: repassar para processamento de ASR
      // Será implementado nas próximas fases
    });

    // Handler para status de transcrição
    socket.on('transcription:request', (data: { sessionId: string }) => {
      const { sessionId } = data;

      // TODO: Buscar transcrições existentes da sessão
      // Por enquanto, retorna vazio
      socket.emit('transcription:update', {
        sessionId,
        utterances: [],
        timestamp: new Date().toISOString(),
      });
    });

    // Handler para marcar sugestão como usada
    // TODO: Migrado para ai-service - implementar chamada HTTP
    socket.on('suggestion:used', async (data: { suggestionId: string; sessionId: string; userId?: string }) => {
      const { suggestionId, sessionId, userId = 'unknown' } = data;

      console.log(`🤖 [DISABLED] Marcar sugestão como usada desabilitado (migração para ai-service) - ${suggestionId}`);
      socket.emit('error', {
        code: 'SUGGESTION_SERVICE_UNAVAILABLE',
        message: 'Serviço de sugestões em manutenção'
      });
    });

    // Handler para solicitar sugestões existentes
    // TODO: Migrado para ai-service - implementar chamada HTTP
    socket.on('suggestions:request', async (data: { sessionId: string }) => {
      const { sessionId } = data;

      console.log(`🤖 [DISABLED] Buscar sugestões desabilitado (migração para ai-service) - sessão ${sessionId}`);
      socket.emit('suggestions:response', {
        sessionId,
        suggestions: [],
        count: 0,
        message: 'Serviço de sugestões em manutenção',
        timestamp: new Date().toISOString()
      });
    });

    // Handler para solicitar geração manual de sugestões
    // TODO: Migrado para ai-service - implementar chamada HTTP
    socket.on('suggestions:generate', async (data: { sessionId: string; force?: boolean }) => {
      const { sessionId } = data;

      console.log(`🤖 [DISABLED] Gerar sugestões desabilitado (migração para ai-service) - sessão ${sessionId}`);
      socket.emit('error', {
        code: 'SUGGESTION_SERVICE_UNAVAILABLE',
        message: 'Serviço de sugestões em manutenção'
      });
    });

    // Handler para erros
    socket.on('error', (error) => {
      console.error(`WebSocket Error [${socket.id}]:`, error);
    });

    // Handler para desconexão
    socket.on('disconnect', (reason) => {
      if (isDevelopment) {
        console.log(`WebSocket desconectado: ${socket.id} - ${reason}`);
      }

      // TODO: Cleanup de sessões ativas
      // Remover usuário de todas as salas que estava participando
    });

    // Handler para ping/pong (manter conexão viva)
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
      });
    });
  });

  // Configurar middleware de autenticação para WebSocket (futuro)
  io.use((socket, next) => {
    // TODO: Implementar autenticação de WebSocket
    // Por enquanto, permitir todas as conexões
    next();
  });

  // Log de status do WebSocket
  if (isDevelopment) {
    io.engine.on('connection_error', (err) => {
      console.log('WebSocket connection error:', err.req, err.code, err.message, err.context);
    });
  }
}

// Utilitários para emitir eventos para sessões específicas
export class SessionNotifier {
  constructor(private io: SocketIOServer) { }

  // Notificar nova transcrição para uma sessão
  emitTranscriptionUpdate(sessionId: string, utterance: any) {
    this.io.to(`session:${sessionId}`).emit('transcription:update', {
      sessionId,
      utterance,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar nova sugestão de IA para uma sessão
  emitAISuggestion(sessionId: string, suggestion: any) {
    this.io.to(`session:${sessionId}`).emit('ai:suggestion', {
      sessionId,
      suggestion,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar múltiplas sugestões de IA para uma sessão
  emitAISuggestions(sessionId: string, suggestions: any[]) {
    this.io.to(`session:${sessionId}`).emit('ai:suggestions', {
      sessionId,
      suggestions,
      count: suggestions.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar atualização de contexto da IA
  emitContextUpdate(sessionId: string, context: any) {
    this.io.to(`session:${sessionId}`).emit('ai:context_update', {
      sessionId,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar que uma sugestão foi marcada como usada
  emitSuggestionUsed(sessionId: string, suggestionId: string, userId: string) {
    this.io.to(`session:${sessionId}`).emit('ai:suggestion:used', {
      sessionId,
      suggestionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar status de processamento
  emitProcessingStatus(sessionId: string, status: 'processing' | 'completed' | 'error', message?: string) {
    this.io.to(`session:${sessionId}`).emit('processing:status', {
      sessionId,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar erro específico de sessão
  emitSessionError(sessionId: string, error: { code: string; message: string }) {
    this.io.to(`session:${sessionId}`).emit('session:error', {
      sessionId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Notificar atividade de voz
  emitVoiceActivity(sessionId: string, channel: string, isActive: boolean) {
    this.io.to(`session:${sessionId}`).emit('presential:voice_activity', {
      sessionId,
      channel,
      isActive,
      timestamp: new Date().toISOString()
    });
  }

  // ✅ NOVO: Enviar histórico de transcrições para uma sessão
  emitTranscriptionHistory(sessionId: string, utterances: any[]) {
    this.io.to(`session:${sessionId}`).emit('transcription:history', {
      sessionId,
      utterances,
      count: utterances.length,
      timestamp: new Date().toISOString(),
    });
  }
}