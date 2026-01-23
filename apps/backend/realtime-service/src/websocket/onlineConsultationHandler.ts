import { Socket } from 'socket.io';
import { transcriptionService } from '../services/transcriptionService';
import { SessionNotifier } from './index';

interface OnlineConsultationData {
  roomName: string;
  consultationId: string;
  participantId: string;
  participantName: string;
}

export function setupOnlineConsultationHandlers(socket: Socket, notifier: SessionNotifier): void {
  
  // Handler para iniciar transcrição em consulta online
  socket.on('online:start-transcription', async (data: OnlineConsultationData) => {
    try {
      const { roomName, consultationId, participantId, participantName } = data;
      
      console.log(`🎤 Iniciando transcrição online para sala: ${roomName}`);
      
      // Validar dados
      if (!roomName || !consultationId || !participantId) {
        socket.emit('error', {
          code: 'INVALID_CONSULTATION_DATA',
          message: 'Dados de consulta online inválidos'
        });
        return;
      }

      // Iniciar transcrição
      await transcriptionService.startTranscription(roomName, consultationId);

      // Entrar na sala de notificação
      socket.join(`consultation:${consultationId}`);
      
      // Confirmar início da transcrição
      socket.emit('online:transcription-started', {
        roomName,
        consultationId,
        timestamp: new Date().toISOString()
      });

      // Notificar outros participantes
      socket.to(`consultation:${consultationId}`).emit('online:transcription-status', {
        status: 'started',
        roomName,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Transcrição online iniciada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao iniciar transcrição online:', error);
      socket.emit('error', {
        code: 'TRANSCRIPTION_START_ERROR',
        message: 'Erro ao iniciar transcrição online'
      });
    }
  });

  // Handler para parar transcrição em consulta online
  socket.on('online:stop-transcription', async (data: { roomName: string; consultationId: string }) => {
    try {
      const { roomName, consultationId } = data;
      
      console.log(`🛑 Parando transcrição online para sala: ${roomName}`);
      
      // Parar transcrição
      await transcriptionService.stopTranscription(roomName);
      
      // Sair da sala de notificação
      socket.leave(`consultation:${consultationId}`);
      
      // Confirmar parada da transcrição
      socket.emit('online:transcription-stopped', {
        roomName,
        consultationId,
        timestamp: new Date().toISOString()
      });

      // Notificar outros participantes
      socket.to(`consultation:${consultationId}`).emit('online:transcription-status', {
        status: 'stopped',
        roomName,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Transcrição online parada para sala: ${roomName}`);
      
    } catch (error) {
      console.error('❌ Erro ao parar transcrição online:', error);
      socket.emit('error', {
        code: 'TRANSCRIPTION_STOP_ERROR',
        message: 'Erro ao parar transcrição online'
      });
    }
  });

  // Handler para obter estatísticas de transcrição online
  socket.on('online:transcription-stats', async (data: { roomName: string }) => {
    try {
      const { roomName } = data;
      
      // TODO: Implementar getStats no transcriptionService se necessário
      const stats = {
        roomName,
        active: true,
        startTime: new Date().toISOString()
      };
      
      socket.emit('online:transcription-stats-response', {
        roomName,
        stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de transcrição:', error);
      socket.emit('error', {
        code: 'TRANSCRIPTION_STATS_ERROR',
        message: 'Erro ao obter estatísticas de transcrição'
      });
    }
  });

  // Handler para participar de uma consulta online
  socket.on('online:join-consultation', (data: { consultationId: string; participantId: string; participantName: string }) => {
    try {
      const { consultationId, participantId, participantName } = data;
      
      // Entrar na sala de notificação
      socket.join(`consultation:${consultationId}`);
      
      // Notificar outros participantes
      socket.to(`consultation:${consultationId}`).emit('online:participant-joined', {
        participantId,
        participantName,
        timestamp: new Date().toISOString()
      });
      
      // Confirmar entrada
      socket.emit('online:consultation-joined', {
        consultationId,
        participantId,
        participantName,
        timestamp: new Date().toISOString()
      });

      console.log(`👤 Participante ${participantName} entrou na consulta ${consultationId}`);
      
    } catch (error) {
      console.error('❌ Erro ao entrar na consulta online:', error);
      socket.emit('error', {
        code: 'JOIN_CONSULTATION_ERROR',
        message: 'Erro ao entrar na consulta online'
      });
    }
  });

  // Handler para sair de uma consulta online
  socket.on('online:leave-consultation', (data: { consultationId: string; participantId: string }) => {
    try {
      const { consultationId, participantId } = data;
      
      // Sair da sala de notificação
      socket.leave(`consultation:${consultationId}`);
      
      // Notificar outros participantes
      socket.to(`consultation:${consultationId}`).emit('online:participant-left', {
        participantId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`👋 Participante ${participantId} saiu da consulta ${consultationId}`);
      
    } catch (error) {
      console.error('❌ Erro ao sair da consulta online:', error);
      socket.emit('error', {
        code: 'LEAVE_CONSULTATION_ERROR',
        message: 'Erro ao sair da consulta online'
      });
    }
  });

  // Handler para solicitar transcrições existentes
  socket.on('online:get-transcriptions', async (data: { consultationId: string }) => {
    try {
      const { consultationId } = data;
      
      // TODO: Implementar busca de transcrições existentes no banco
      // Por enquanto, retorna vazio
      socket.emit('online:transcriptions-response', {
        consultationId,
        transcriptions: [],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar transcrições:', error);
      socket.emit('error', {
        code: 'GET_TRANSCRIPTIONS_ERROR',
        message: 'Erro ao buscar transcrições'
      });
    }
  });

  // Handler para receber áudio
  socket.on('online:audio-data', async (data: { roomName: string; participantId: string; audioData: string; sampleRate: number; channels: number }) => {
    try {
      const { roomName, participantId, audioData, sampleRate, channels } = data;
      
      console.log(`🎤 Áudio recebido para sala: ${roomName}, participante: ${participantId}`);
      
      // Converter base64 para Buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Processar áudio via transcriptionService
      await transcriptionService.processAudioChunk({
        data: audioBuffer,
        participantId,
        sampleRate,
        channels
      }, roomName);
      
    } catch (error) {
      console.error('❌ Erro ao processar áudio:', error);
      socket.emit('error', {
        code: 'AUDIO_PROCESSING_ERROR',
        message: 'Erro ao processar áudio'
      });
    }
  });
}
