// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logError, logWarning } from '../config/database';
import { aiPricingService } from './aiPricingService';
import { aiConfig } from '../config';

import { TranscriptionSegment, Speaker } from '@medcall/shared-types';

interface AudioChunk {
  data: Buffer;
  participantId: string;
  sampleRate: number;
  channels: number;
}

interface TranscriptionOptions {
  language?: string;
  model?: 'whisper-1';
  temperature?: number;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export class TranscriptionService extends EventEmitter {
  private supabase: any;
  private activeRooms: Map<string, Set<string>> = new Map();
  private audioBuffers: Map<string, Buffer[]> = new Map();
  private processingQueue: Map<string, NodeJS.Timeout> = new Map();

  // Azure OpenAI config
  private azureEndpoint: string;
  private azureApiKey: string;
  private azureDeployment: string;
  private azureApiVersion: string;

  constructor() {
    super();

    // Configurar Azure OpenAI
    this.azureEndpoint = aiConfig.azure.endpoint;
    this.azureApiKey = aiConfig.azure.apiKey;
    this.azureDeployment = aiConfig.azure.deployments.whisper;
    this.azureApiVersion = aiConfig.azure.apiVersions.whisper;

    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async startTranscription(roomName: string, consultationId: string): Promise<void> {
    try {
      console.log(`🎤 Iniciando transcrição para sala: ${roomName}`);

      if (!this.activeRooms.has(roomName)) {
        this.activeRooms.set(roomName, new Set());
      }

      // Ativar transcrição via WebSocket
      console.log(`✅ Transcrição ativada para sala: ${roomName}`);

      // Captura de áudio via WebSocket
      this.setupAudioCapture(roomName, consultationId);

    } catch (error) {
      console.error('Erro ao iniciar transcrição:', error);
      logError(
        `Erro ao iniciar transcrição`,
        'error',
        consultationId || null,
        { roomName, error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  private setupAudioCapture(roomName: string, consultationId: string): void {
    console.log(`🎵 Configurando captura de áudio para sala: ${roomName}`);

    // Aguardar áudio real do frontend via WebSocket
    console.log(`⏳ Aguardando áudio via WebSocket para sala: ${roomName}`);

    // O áudio será recebido via WebSocket do frontend
    // quando o usuário falar no microfone
  }

  // Remover simulação - usar áudio real
  // private simulateLiveKitAudio() - REMOVIDO

  async stopTranscription(roomName: string): Promise<void> {
    try {
      console.log(`Parando transcrição para sala: ${roomName}`);

      this.audioBuffers.delete(roomName);

      const timeout = this.processingQueue.get(roomName);
      if (timeout) {
        clearTimeout(timeout);
        this.processingQueue.delete(roomName);
      }

      this.activeRooms.delete(roomName);

    } catch (error) {
      console.error('Erro ao parar transcrição:', error);
      logError(
        `Erro ao parar transcrição`,
        'error',
        null,
        { roomName, error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  async processAudioChunk(audioChunk: AudioChunk, roomName: string): Promise<void> {
    try {
      const { data, participantId } = audioChunk;

      const bufferKey = `${roomName}-${participantId}`;
      if (!this.audioBuffers.has(bufferKey)) {
        this.audioBuffers.set(bufferKey, []);
      }

      this.audioBuffers.get(bufferKey)!.push(data);
      this.scheduleProcessing(bufferKey, roomName, participantId);

    } catch (error) {
      console.error('Erro ao processar chunk de áudio:', error);
      logError(
        `Erro ao processar chunk de áudio`,
        'error',
        null,
        { roomName, participantId: audioChunk.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private scheduleProcessing(bufferKey: string, roomName: string, participantId: string): void {
    const existingTimeout = this.processingQueue.get(bufferKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      await this.processBufferedAudio(bufferKey, roomName, participantId);
    }, 1000);

    this.processingQueue.set(bufferKey, timeout);
  }

  private async processBufferedAudio(bufferKey: string, roomName: string, participantId: string): Promise<void> {
    try {
      const audioBuffers = this.audioBuffers.get(bufferKey);
      if (!audioBuffers || audioBuffers.length === 0) {
        return;
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      this.audioBuffers.set(bufferKey, []);

      if (combinedBuffer.length < 8000) {
        return;
      }

      const transcription = await this.transcribeAudio(combinedBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      });

      if (transcription && transcription.text.trim()) {
        await this.sendTranscriptionToRoom(roomName, {
          id: randomUUID(),
          text: transcription.text,
          participantId,
          participantName: await this.getParticipantName(participantId),
          timestamp: new Date().toISOString(),
          final: true,
          confidence: transcription.confidence,
          language: transcription.language,
          speaker: 'UNKNOWN' as Speaker // Default, will be refined in saveTranscriptionToDatabase
        });
      }

    } catch (error) {
      console.error('Erro ao processar áudio bufferizado:', error);
      logError(
        `Erro ao processar áudio bufferizado`,
        'error',
        null,
        { roomName, participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async transcribeAudio(audioBuffer: Buffer, options: TranscriptionOptions = {}, consultaId?: string): Promise<any> {
    try {
      const wavBuffer = this.convertToWav(audioBuffer);

      // Azure OpenAI Whisper endpoint
      const azureUrl = `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/audio/transcriptions?api-version=${this.azureApiVersion}`;

      // Usar node-fetch com form-data (compatibilidade com Node.js)
      const FormData = (await import('form-data')).default;
      const nodeFetch = (await import('node-fetch')).default;
      const { Readable } = await import('stream');

      const formData = new FormData();
      // Converter Buffer para Readable stream para form-data
      const audioStream = Readable.from(wavBuffer);
      formData.append('file', audioStream, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
        knownLength: wavBuffer.length
      });
      formData.append('language', options.language || 'pt');
      formData.append('response_format', options.response_format || 'verbose_json');
      formData.append('temperature', (options.temperature || 0).toString());

      console.log(`🌐 [TRANSCRIPTION-SERVICE] Enviando para Azure: ${azureUrl}`);

      const response = await nodeFetch(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.azureApiKey,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure Whisper API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as any;

      // 📊 Registrar uso do Whisper para monitoramento de custos
      // Estimar duração do áudio baseado no tamanho do buffer (aproximação)
      // Para áudio WAV 16kHz mono 16-bit: 1 segundo = 32KB
      const estimatedAudioDurationMs = Math.max(1000, (wavBuffer.length / 32000) * 1000);
      await aiPricingService.logWhisperUsage(estimatedAudioDurationMs, consultaId);
      console.log(`📊 [TRANSCRIPTION-SERVICE] Uso Whisper registrado: ~${Math.round(estimatedAudioDurationMs / 1000)}s de áudio`);

      return result;

    } catch (error) {
      console.error('Erro na transcrição:', error);
      logError(
        `Erro na transcrição de áudio via Azure OpenAI Whisper`,
        'error',
        consultaId || null,
        { language: options.language, error: error instanceof Error ? error.message : String(error) }
      );
      return null;
    }
  }

  private convertToWav(rawBuffer: Buffer, sampleRate: number = 16000, channels: number = 1): Buffer {
    const length = rawBuffer.length;
    const buffer = Buffer.alloc(44 + length);

    // WAV Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + length, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * 2, 28);
    buffer.writeUInt16LE(channels * 2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(length, 40);

    rawBuffer.copy(buffer, 44);
    return buffer;
  }

  private async sendTranscriptionToRoom(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // ✅ Salvar no banco (LiveKit removido - usando WebRTC direto via WebSocket)
      await this.saveTranscriptionToDatabase(roomName, segment);

      // Emitir evento para que outros serviços possam escutar
      this.emit('transcription', { roomName, segment });

      console.log(`📝 Transcrição salva no banco: ${segment.participantName}: ${segment.text}`);

    } catch (error) {
      console.error('❌ Erro ao salvar transcrição:', error);
      logError(
        `Erro ao salvar transcrição para sala`,
        'error',
        null,
        { roomName, participantId: segment.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async saveTranscriptionToDatabase(roomName: string, segment: TranscriptionSegment): Promise<void> {
    try {
      // ✅ NOVO: Buscar session_id a partir do roomName
      let sessionId: string | null = null;

      // Tentar buscar session_id da call_sessions usando roomName
      const { data: callSession, error: sessionError } = await this.supabase
        .from('call_sessions')
        .select('id')
        .or(`room_id.eq.${roomName},room_name.eq.${roomName}`)
        .maybeSingle();

      if (callSession?.id) {
        sessionId = callSession.id;
      } else {
        // Se não encontrou, tentar usar roomName como sessionId (fallback)
        sessionId = roomName;
        console.warn(`⚠️ Session ID não encontrado para roomName ${roomName}, usando roomName como sessionId`);
      }

      // Mapear speaker baseado no participantId ou participantName
      let speaker: 'doctor' | 'patient' | 'system' = 'system';
      const participantLower = ((segment.participantId || '') + (segment.participantName || '')).toLowerCase();
      if (participantLower.includes('doctor') || participantLower.includes('médico') || participantLower.includes('Medico')) {
        speaker = 'doctor';
      } else if (participantLower.includes('patient') || participantLower.includes('Paciente')) {
        speaker = 'patient';
      }

      // ✅ Usar addTranscriptionToSession em vez de insert direto
      // Isso garante que todas as transcrições sejam salvas em um único registro (array)
      const { db } = await import('../config/database');

      // ✅ Validar que sessionId é um UUID válido
      if (!sessionId || (sessionId.length !== 36 && !sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
        console.error('❌ [TRANSCRIPTION-SERVICE] sessionId inválido:', sessionId);
        console.error('❌ [TRANSCRIPTION-SERVICE] roomName:', roomName);
        return;
      }

      // ✅ Determinar speaker_id (nome real do participante)
      const speakerId = segment.participantName || segment.participantId || speaker;

      const success = await db.addTranscriptionToSession(sessionId, {
        speaker: speaker,
        speaker_id: speakerId,
        text: segment.text,
        confidence: segment.confidence || 0.9,
        start_ms: new Date(segment.timestamp).getTime(),
        end_ms: new Date(segment.timestamp).getTime() + 1000, // Assumir 1 segundo de duração
        doctor_name: speaker === 'doctor' ? speakerId : undefined
      });

      if (!success) {
        console.error('❌ [TRANSCRIPTION-SERVICE] Erro ao salvar transcrição no banco');
        console.error('❌ [TRANSCRIPTION-SERVICE] Dados tentados:', {
          session_id: sessionId,
          speaker,
          speaker_id: speakerId,
          text: segment.text.substring(0, 50) + '...',
          roomName
        });
        logError(
          `Erro ao salvar transcrição no banco via TranscriptionService`,
          'error',
          null,
          { sessionId, speaker, speakerId, roomName, textLength: segment.text.length }
        );
      } else {
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição salva no banco (${speaker}):`, segment.text.substring(0, 50) + '...');
      }

    } catch (error) {
      console.error('❌ Erro no banco de dados ao salvar transcrição:', error);
      logError(
        `Erro no banco de dados ao salvar transcrição via TranscriptionService`,
        'error',
        null,
        { roomName, participantId: segment.participantId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async getParticipantName(participantId: string): Promise<string> {
    try {
      const { data } = await this.supabase
        .from('participants')
        .select('name')
        .eq('id', participantId)
        .single();

      return data?.name || participantId;

    } catch (error) {
      return participantId;
    }
  }

  async getTranscriptionStats(roomName: string): Promise<any> {
    try {
      const activeParticipants = this.activeRooms.get(roomName)?.size || 0;
      const bufferSize = this.audioBuffers.size;

      return {
        roomName,
        activeParticipants,
        bufferSize,
        isActive: this.activeRooms.has(roomName),
        livekitConnected: false // Por enquanto false até resolver SSL
      };

    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return null;
    }
  }
}

export const transcriptionService = new TranscriptionService();