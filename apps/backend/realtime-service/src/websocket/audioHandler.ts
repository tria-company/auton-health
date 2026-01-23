import { Socket } from 'socket.io';
import { audioProcessor, AudioChunk } from '../services/audioProcessor';
import { asrService } from '../services/asrService';
import { SessionNotifier } from './index';

const isDevelopment = process.env.NODE_ENV === 'development';

export interface PresentialAudioData {
  sessionId: string;
  audioData: number[]; // Array serializado do Float32Array
  timestamp: number;
  sampleRate: number;
}

export interface PresentialSessionData {
  sessionId: string;
  consultationId: string;
  timestamp: string;
}

export function setupPresentialAudioHandlers(socket: Socket, notifier: SessionNotifier): void {

  // Handler para áudio do médico
  socket.on('presential:audio:doctor', (data: PresentialAudioData) => {
    try {
      const { sessionId, audioData, timestamp, sampleRate } = data;

      if (!sessionId || !audioData || !Array.isArray(audioData)) {
        socket.emit('error', {
          code: 'INVALID_AUDIO_DATA',
          message: 'Dados de áudio inválidos para médico'
        });
        return;
      }

      // Converter array de volta para Float32Array
      const float32AudioData = new Float32Array(audioData);

      // 🔍 DEBUG: Verificar se os dados chegam zerados
      const hasNonZeroData = float32AudioData.some(value => value !== 0);
      const maxValue = Math.max(...float32AudioData);
      const minValue = Math.min(...float32AudioData);
      const avgValue = float32AudioData.reduce((sum, val) => sum + Math.abs(val), 0) / float32AudioData.length;

      /**
      console.log(`🔍 DEBUG [AUDIO_RECEPTION] doctor:`, {
        arrayLength: audioData.length,
        float32Length: float32AudioData.length,
        hasNonZeroData,
        maxValue: maxValue.toFixed(6),
        minValue: minValue.toFixed(6),
        avgValue: avgValue.toFixed(6),
        first10Values: Array.from(float32AudioData.slice(0, 10)).map(v => v.toFixed(6))
      });
       */

      if (!hasNonZeroData) {
        console.warn(`⚠️⚠️⚠️ DADOS ZERADOS RECEBIDOS do frontend para doctor!`);
        return; // Não processar dados zerados
      }

      // Criar chunk de áudio
      const audioChunk: AudioChunk = {
        sessionId,
        channel: 'doctor',
        audioData: float32AudioData,
        timestamp,
        sampleRate
      };

      // Processar áudio
      audioProcessor.processAudioChunk(audioChunk);

      if (isDevelopment) {
        //console.log(`🎤 Áudio médico recebido: ${audioData.length} samples - Sessão: ${sessionId}`);
      }

    } catch (error) {
      console.error('Erro ao processar áudio do médico:', error);
      socket.emit('session:error', {
        sessionId: data.sessionId,
        error: {
          code: 'AUDIO_PROCESSING_ERROR',
          message: 'Erro ao processar áudio do médico'
        }
      });
    }
  });

  // Handler para áudio do paciente
  socket.on('presential:audio:patient', (data: PresentialAudioData) => {
    try {
      const { sessionId, audioData, timestamp, sampleRate } = data;

      if (!sessionId || !audioData || !Array.isArray(audioData)) {
        socket.emit('error', {
          code: 'INVALID_AUDIO_DATA',
          message: 'Dados de áudio inválidos para paciente'
        });
        return;
      }

      // Converter array de volta para Float32Array
      const float32AudioData = new Float32Array(audioData);

      // 🔍 DEBUG: Verificar se os dados chegam zerados
      const hasNonZeroData = float32AudioData.some(value => value !== 0);
      const maxValue = Math.max(...float32AudioData);
      const minValue = Math.min(...float32AudioData);
      const avgValue = float32AudioData.reduce((sum, val) => sum + Math.abs(val), 0) / float32AudioData.length;

      console.log(`🔍 DEBUG [AUDIO_RECEPTION] patient:`, {
        arrayLength: audioData.length,
        float32Length: float32AudioData.length,
        hasNonZeroData,
        maxValue: maxValue.toFixed(6),
        minValue: minValue.toFixed(6),
        avgValue: avgValue.toFixed(6),
        first10Values: Array.from(float32AudioData.slice(0, 10)).map(v => v.toFixed(6))
      });

      if (!hasNonZeroData) {
        console.warn(`⚠️⚠️⚠️ DADOS ZERADOS RECEBIDOS do frontend para patient!`);
        return; // Não processar dados zerados
      }

      // Criar chunk de áudio
      const audioChunk: AudioChunk = {
        sessionId,
        channel: 'patient',
        audioData: float32AudioData,
        timestamp,
        sampleRate
      };

      // Processar áudio
      audioProcessor.processAudioChunk(audioChunk);

      if (isDevelopment) {
        //console.log(`🎤 Áudio paciente recebido: ${audioData.length} samples - Sessão: ${sessionId}`);
      }

    } catch (error) {
      console.error('Erro ao processar áudio do paciente:', error);
      socket.emit('session:error', {
        sessionId: data.sessionId,
        error: {
          code: 'AUDIO_PROCESSING_ERROR',
          message: 'Erro ao processar áudio do paciente'
        }
      });
    }
  });

  // Handler para iniciar gravação presencial
  socket.on('presential:start_recording', (data: PresentialSessionData) => {
    try {
      const { sessionId, consultationId } = data;

      if (!sessionId) {
        socket.emit('error', {
          code: 'INVALID_SESSION_ID',
          message: 'ID da sessão é obrigatório'
        });
        return;
      }

      // Configurar listeners do processador de áudio para esta sessão
      setupAudioProcessorListeners(sessionId, notifier);

      // Notificar outros participantes que a gravação iniciou
      notifier.emitProcessingStatus(sessionId, 'processing', 'Gravação iniciada');

      // Confirmar início da gravação
      socket.emit('presential:recording_started', {
        sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao iniciar gravação presencial:', error);
      socket.emit('session:error', {
        sessionId: data.sessionId,
        error: {
          code: 'START_RECORDING_ERROR',
          message: 'Erro ao iniciar gravação presencial'
        }
      });
    }
  });

  // Handler para parar gravação presencial
  socket.on('presential:stop_recording', (data: { sessionId: string; timestamp: string }) => {
    try {
      const { sessionId } = data;

      if (!sessionId) {
        socket.emit('error', {
          code: 'INVALID_SESSION_ID',
          message: 'ID da sessão é obrigatório'
        });
        return;
      }

      // PRIORITÁRIO: Processar frases pendentes primeiro
      audioProcessor.flushPendingPhrases(sessionId);

      // CRÍTICO: Remover listeners para evitar vazamentos
      const listenersToRemove = activeListeners.get(sessionId);
      if (listenersToRemove) {
        globalListenerCount--;
        audioProcessor.off('audio:processed', listenersToRemove.onAudioProcessed);
        audioProcessor.off('audio:voice_activity', listenersToRemove.onVoiceActivity);
        audioProcessor.off('audio:silence', listenersToRemove.onSilence);
        activeListeners.delete(sessionId);
      }

      // DESABILITADO: Não processar buffers restantes no modo frases completas
      // audioProcessor.flushPendingBuffers(sessionId);

      // Limpar buffers da sessão
      audioProcessor.clearSession(sessionId);

      // Notificar fim da gravação
      notifier.emitProcessingStatus(sessionId, 'completed', 'Gravação finalizada');

      // Confirmar fim da gravação
      socket.emit('presential:recording_stopped', {
        sessionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao parar gravação presencial:', error);
      socket.emit('session:error', {
        sessionId: data.sessionId,
        error: {
          code: 'STOP_RECORDING_ERROR',
          message: 'Erro ao finalizar gravação presencial'
        }
      });
    }
  });

  // Handler para obter estatísticas de áudio
  socket.on('presential:audio_stats', (data: { sessionId: string }) => {
    try {
      const stats = audioProcessor.getStats();

      socket.emit('presential:audio_stats_response', {
        sessionId: data.sessionId,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao obter estatísticas de áudio:', error);
      socket.emit('error', {
        code: 'AUDIO_STATS_ERROR',
        message: 'Erro ao obter estatísticas de áudio'
      });
    }
  });
}

// Map para controlar listeners ativos por sessão
const activeListeners = new Map<string, {
  onAudioProcessed: (processedChunk: any) => void;
  onVoiceActivity: (data: any) => void;
  onSilence: (data: any) => void;
}>();

// 🔍 DEBUG: Contador global de listeners
let globalListenerCount = 0;

// 🛡️ PROTEÇÃO CONTRA RACE CONDITIONS: Set de IDs enviados recentemente
const sentTranscriptionIds = new Set<string>();


// Configurar listeners do processador de áudio para uma sessão
function setupAudioProcessorListeners(sessionId: string, notifier: SessionNotifier): void {

  // CRÍTICO: Remover listeners anteriores se existirem
  const existingListeners = activeListeners.get(sessionId);
  if (existingListeners) {
    globalListenerCount--;
    audioProcessor.off('audio:processed', existingListeners.onAudioProcessed);
    audioProcessor.off('audio:voice_activity', existingListeners.onVoiceActivity);
    audioProcessor.off('audio:silence', existingListeners.onSilence);
  }

  // Listener para áudio processado
  const onAudioProcessed = (processedChunk: any) => {
    if (processedChunk.sessionId === sessionId) {
      // 🔍 DEBUG [AUDIO_PROCESSING]: Começou processar áudio
      console.log(`🔍 DEBUG [AUDIO_PROCESSING] ${processedChunk.channel} - ${Math.round(processedChunk.duration)}ms`);
      console.log(`🔍 DEBUG [AUDIO_PROCESSING] sessionId: ${processedChunk.sessionId}`);

      // 🔍 DEBUG [TRANSCRIPTION_SEND]: Enviado para transcrição
      console.log(`🔍 DEBUG [TRANSCRIPTION_SEND] ${processedChunk.channel} → Whisper`);

      // Enviar para ASR
      asrService.processAudio(processedChunk)
        .then((transcription) => {
          if (transcription) {
            // 🔍 DEBUG [TRANSCRIPTION_RECEIVED]: Transcrição recebida
            console.log(`🔍 DEBUG [TRANSCRIPTION_RECEIVED] ${transcription.speaker}: "${transcription.text}"`);

            // Formatar transcrição para o frontend
            const utterance = {
              id: transcription.id,
              speaker: transcription.speaker,
              text: transcription.text,
              timestamp: transcription.timestamp,
              confidence: transcription.confidence
            };

            // 🛡️ PROTEÇÃO CONTRA RACE CONDITION: Verificar se ID já foi enviado
            if (sentTranscriptionIds.has(transcription.id)) {
              return;
            }

            // Marcar como enviado ANTES de enviar (evita race condition)
            sentTranscriptionIds.add(transcription.id);

            // 🔍 DEBUG [WEBSOCKET_SEND]: Enviado para WebSocket
            console.log(`🔍 DEBUG [WEBSOCKET_SEND] ${transcription.speaker} → Frontend`);

            // Emitir transcrição via WebSocket
            notifier.emitTranscriptionUpdate(sessionId, utterance);

            // Trigger geração de sugestões após transcrição
            triggerSuggestionGeneration(sessionId, utterance, notifier);

            // Limpeza periódica do Set (manter últimos 1000 IDs)
            if (sentTranscriptionIds.size > 1000) {
              const idsArray = Array.from(sentTranscriptionIds);
              sentTranscriptionIds.clear();
              // Manter só os últimos 500 IDs
              idsArray.slice(-500).forEach(id => sentTranscriptionIds.add(id));
            }
          }
        })
        .catch((error) => {
          console.error(`🔍 DEBUG [TRANSCRIPTION_ERROR]:`, error);
          notifier.emitSessionError(sessionId, {
            code: 'TRANSCRIPTION_ERROR',
            message: 'Erro no processamento de transcrição'
          });
        });
    }
  };

  // Listener para atividade de voz
  const onVoiceActivity = (data: any) => {
    if (data.sessionId === sessionId) {
      // 🔍 DEBUG [VOICE_START/END]: Log início/fim da fala
      if (data.isActive) {
        console.log(`🔍 DEBUG [VOICE_START] ${data.channel} começou a falar`);
      } else {
        console.log(`🔍 DEBUG [VOICE_END] ${data.channel} terminou de falar`);
      }

      // Emitir evento de atividade de voz
      notifier.emitVoiceActivity(sessionId, data.channel, data.isActive);
    }
  };

  // Listener para silêncio
  const onSilence = (data: any) => {
    // Removido - log desnecessário para o tunnel
  };

  // Registrar listeners
  globalListenerCount++;
  audioProcessor.on('audio:processed', onAudioProcessed);
  audioProcessor.on('audio:voice_activity', onVoiceActivity);
  audioProcessor.on('audio:silence', onSilence);

  // CRÍTICO: Armazenar referências dos listeners para remoção futura
  activeListeners.set(sessionId, {
    onAudioProcessed,
    onVoiceActivity,
    onSilence
  });
}

// Função para triggerar geração de sugestões
// TODO: Migrado para ai-service - implementar chamada HTTP
async function triggerSuggestionGeneration(sessionId: string, utterance: any, notifier: any): Promise<void> {
  // TODO: A funcionalidade de sugestões foi migrada para o microserviço ai-service.
  // Implementar chamada HTTP para: POST ${AI_SERVICE_URL}/api/suggestions
  console.log(`🤖 [DISABLED] Geração de sugestões desabilitada (migração para ai-service) - sessão ${sessionId}`);
}
