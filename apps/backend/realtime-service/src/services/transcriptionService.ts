// Carregar variáveis de ambiente primeiro
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logError, logWarning } from '../config/database';
import { aiPricingService } from './aiPricingService';
import { aiConfig } from '../config';
import { VoiceActivityDetector } from '../utils/vad';
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
  // ✅ Armazenar metadados junto com o buffer
  private audioBuffers: Map<string, { data: Buffer; sampleRate: number }[]> = new Map();
  // private processingQueue: Map<string, NodeJS.Timeout> = new Map(); // Removed: timer-based queue
  private vadInstances: Map<string, VoiceActivityDetector> = new Map(); // Added: VAD instances
  private roomConsultations: Map<string, string> = new Map(); // ✅ Mapeamento roomName -> consultationId

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
      // Captura de áudio via WebSocket
      this.setupAudioCapture(roomName, consultationId);

      // ✅ Salvar consultationId para uso posterior (salvamento no banco)
      if (consultationId) {
        this.roomConsultations.set(roomName, consultationId);
        console.log(`✅ [TRANSCRIPTION] ConsultationId vinculado à sala ${roomName}: ${consultationId}`);
      }

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

      // Limpar instâncias VAD associadas à sala
      for (const [key, vad] of this.vadInstances.entries()) {
        if (key.startsWith(`${roomName}-`)) {
          console.log(`🧹 [VAD] Limpando VAD para ${key}`);
          vad.removeAllListeners();
          this.vadInstances.delete(key);
        }
      }

      this.activeRooms.delete(roomName);
      this.roomConsultations.delete(roomName); // ✅ Limpar mapeamento

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

  // ✅ Armazenar metadados junto com o buffer
  private prerollBuffers: Map<string, { data: Buffer; sampleRate: number }[]> = new Map();
  private isSpeakingMap: Map<string, boolean> = new Map();

  async processAudioChunk(audioChunk: AudioChunk, roomName: string): Promise<void> {
    try {
      const { data, participantId, sampleRate } = audioChunk;
      const bufferKey = `${roomName}-${participantId}`;
      const chunkData = { data, sampleRate: sampleRate || 16000 };

      // DEBUG: Log para verificar se audio do médico está chegando
      // console.log(`🎤 [AUDIO-CHUNK] Recebido de ${participantId} (${data.length} bytes) - Key: ${bufferKey}`);

      // Inicializar VAD se não existir
      if (!this.vadInstances.has(bufferKey)) {
        console.log(`🎙️ [VAD] Inicializando para ${participantId} na sala ${roomName}`);

        const vad = new VoiceActivityDetector({
          sampleRate: chunkData.sampleRate, // Use chunk sample rate
          energyThreshold: 0.02, // 0.02 para evitar respiracão/ruído
          silenceDuration: 1000,  // 1s silêncio = fim
          minSpeechDuration: 500  // Min 0.5s fala
        });

        // Inicializar estados
        this.prerollBuffers.set(bufferKey, []);
        this.isSpeakingMap.set(bufferKey, false);
        this.audioBuffers.set(bufferKey, []);

        // Evento: Início de fala detectado
        vad.on('speechStart', () => {
          console.log(`🗣️ [VAD] Fala detectada: ${participantId} (Room: ${roomName})`);
          this.isSpeakingMap.set(bufferKey, true);

          // Mover preroll para o buffer principal (para não perder o início da frase)
          const preroll = this.prerollBuffers.get(bufferKey) || [];
          const mainBuffer = this.audioBuffers.get(bufferKey) || [];
          this.audioBuffers.set(bufferKey, [...preroll, ...mainBuffer]); // Type safety ensured by map definition
          this.prerollBuffers.set(bufferKey, []); // Limpar preroll
        });

        // Evento: Fim de fala detectado (Silêncio) -> Enviar para Whisper
        vad.on('speechEnd', async ({ duration }) => {
          console.log(`🤐 [VAD] Silêncio detectado para ${participantId} (Fala: ${duration}ms). Processando transcrição...`);
          this.isSpeakingMap.set(bufferKey, false);
          await this.processBufferedAudio(bufferKey, roomName, participantId);
        });

        this.vadInstances.set(bufferKey, vad);
      }

      // Processar no VAD (dispara eventos acima)
      const vad = this.vadInstances.get(bufferKey);
      if (vad) {
        vad.processAudio(data);
      }

      // LÓGICA DE BUFFERIZACAO INTELIGENTE (GATED)
      const isSpeaking = this.isSpeakingMap.get(bufferKey) || false;

      if (isSpeaking) {
        // Se está falando, grava no buffer principal
        if (!this.audioBuffers.has(bufferKey)) this.audioBuffers.set(bufferKey, []);
        this.audioBuffers.get(bufferKey)!.push(chunkData);
      } else {
        // Se NÃO está falando, grava apenas no Ring Buffer (Preroll)
        if (!this.prerollBuffers.has(bufferKey)) this.prerollBuffers.set(bufferKey, []);

        const preroll = this.prerollBuffers.get(bufferKey)!;
        preroll.push(chunkData);

        // Manter apenas ~600ms de áudio no preroll (aprox 20 chunks de 30ms se assumirmos chunks pequenos, ou baseado em bytes)
        // Se data.length for 2000 bytes (aprox 60ms a 16khz), manter 10 chunks = 600ms
        if (preroll.length > 20) {
          preroll.shift(); // Remove o mais antigo
        }
      }

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

  // Método scheduleProcessing removido em favor do VAD logic


  private async processBufferedAudio(bufferKey: string, roomName: string, participantId: string): Promise<void> {
    try {
      const audioChunks = this.audioBuffers.get(bufferKey);
      if (!audioChunks || audioChunks.length === 0) {
        return;
      }

      // Extrair buffers e determinar sampleRate (assumindo constante no segmento)
      const dataBuffers = audioChunks.map(c => c.data);
      const sampleRate = audioChunks[0]?.sampleRate || 16000;

      const combinedBuffer = Buffer.concat(dataBuffers);

      // Limpar buffer após consumo
      this.audioBuffers.set(bufferKey, []);

      // Resetar estado do VAD para evitar falsos positivos imediatos
      const vad = this.vadInstances.get(bufferKey);
      if (vad) vad.reset();

      // Mínimo de áudio para enviar (aprox 0.5s)
      if (combinedBuffer.length < (sampleRate * 0.5 * 2)) { // 0.5s de audio (sampleRate * duration * bytesPerSample)
        // Aprox check
        if (combinedBuffer.length < 8000) { // Fallback check
          console.log(`⚠️ [TRANSCRIPTION] Áudio muito curto descartado`);
          return;
        }
      }

      // ✅ Obter consultationId do mapa para registrar uso de IA
      const consultaId = this.roomConsultations.get(roomName) || undefined;

      // ✅ PASSAR SAMPLE RATE CORRETA E CONSULTA ID
      const transcription = await this.transcribeAudio(combinedBuffer, {
        language: 'pt',
        model: 'whisper-1',
        response_format: 'verbose_json'
      }, consultaId, sampleRate); // ✅ Agora passa o consultaId corretamente

      if (transcription && transcription.text.trim()) {
        const text = transcription.text.trim();

        // 🛡️ FILTRO ANTI-ALUCINAÇÃO
        // Whisper tende a gerar essas frases em silêncio absoluto
        const HALLUCINATIONS = [
          'Sous-titres', 'Amara.org', 'Obrigado.', 'Súbricas',
          'Subtitles by', 'Translated by', 'Unara.org',
          'Aguarde um momento.'
        ];

        // 1. Verificar frases bloqueadas
        if (HALLUCINATIONS.some(h => text.includes(h)) || text === '.') {
          console.log(`🛡️ [ANTI-HALLUCINATION] Texto descartado (frase proibida): "${text}"`);
          return;
        }

        // 2. Verificar caracteres repetidos ou símbolos isolados
        if (text.length < 3 && !['Oi', 'Sim', 'Não', 'Ok'].includes(text)) {
          console.log(`🛡️ [ANTI-HALLUCINATION] Texto descartado (muito curto): "${text}"`);
          return;
        }

        // 3. Verificar repetição de caracteres especiais (ex: "???")
        if (/^[?.!,\s]+$/.test(text)) {
          console.log(`🛡️ [ANTI-HALLUCINATION] Texto descartado (apenas pontuação): "${text}"`);
          return;
        }

        const role = this.getParticipantRole(participantId);
        // console.log(`====> Role: ${role}`); // Remove debug logs
        let speaker: Speaker = 'UNKNOWN';
        if (role === 'doctor') speaker = 'MEDICO';
        else if (role === 'patient') speaker = 'PACIENTE';
        else if (role === 'system') speaker = 'SISTEMA';

        await this.sendTranscriptionToRoom(roomName, {
          id: randomUUID(),
          text: transcription.text,
          participantId,
          participantName: await this.getParticipantName(participantId),
          timestamp: new Date().toISOString(),
          final: true,
          confidence: transcription.confidence,
          language: transcription.language,
          speaker: speaker
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

  private async transcribeAudio(audioBuffer: Buffer, options: TranscriptionOptions = {}, consultaId?: string, sampleRate: number = 16000): Promise<any> {
    try {
      const wavBuffer = this.convertToWav(audioBuffer, sampleRate);

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
      formData.append('temperature', '0'); // Temperatura 0 para determinismo

      // ✅ Prompt para contexto médico e redução de alucinações
      formData.append('prompt', 'Transcrição de uma consulta médica entre doutor e paciente. Evite alucinações em silêncio.');

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

      // 1. Tentar usar o papel já identificado no segmento se confiável
      if (segment.speaker === 'MEDICO') speaker = 'doctor';
      else if (segment.speaker === 'PACIENTE') speaker = 'patient';

      // 2. Fallback: Analisar nome/ID (Se ainda for system ou UNKNOWN)
      if (speaker === 'system') {
        const participantLower = ((segment.participantId || '') + (segment.participantName || '')).toLowerCase();

        // Identificação de Médico (Case insensitive e variações)
        if (participantLower.includes('doctor') || participantLower.includes('médico') || participantLower.includes('medico')) {
          speaker = 'doctor';
        } else {
          // Para transcrições de áudio, se não é médico, assumimos que é o paciente
          // Isso resolve o problema de IDs temporários (ex: Temp-123) sendo marcados como system
          speaker = 'patient';
        }
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
        console.error('❌ [TRANSCRIPTION-SERVICE] Erro ao salvar transcrição no banco (array)');
        // ... (logging error)
      } else {
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição salva no banco (array - ${speaker}):`, segment.text.substring(0, 50) + '...');
      }

      // ✅ NOVO: Salvar na tabela 'transcriptions' (append) para cumprir requisito "salvar toda vez"
      // Tentar pegar consultationId do mapa ou buscar do banco se necessário
      let consultationId = this.roomConsultations.get(roomName) || null;

      if (!consultationId && sessionId) {
        // Tentar recuperar da call_sessions se tivermos sessionId mas não consultationId
        // (Otimização: idealmente já teríamos no map)
        const { data: sessionData } = await this.supabase
          .from('call_sessions')
          .select('consultation_id')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionData?.consultation_id) {
          consultationId = sessionData.consultation_id;
          this.roomConsultations.set(roomName, consultationId as string); // Cache
        }
      }

      if (consultationId) {
        console.log(`===> SPEAKER: ${speaker}`)
        // Formatar speaker para o padrão solicitado: [MEDICO] ou [PACIENTE - NOME]
        let formattedSpeaker = '';
        if (speaker === 'doctor') {
          formattedSpeaker = 'MEDICO';
        } else {
          console.log(`===> PARTICIPANT NAME: ${segment.participantName}`)
          // Tentar pegar nome do paciente
          const patientName = segment.participantName || 'Paciente';
          formattedSpeaker = `PACIENTE - ${patientName}`;
        }

        // Formatar timestamp para visualização (HH:mm:ss)
        const date = new Date(segment.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;

        // Salvar raw_text appendado (Req 2)
        await db.appendConsultationTranscription(
          consultationId as string,
          segment.text,
          formattedSpeaker,
          formattedTime
        );
        console.log(`✅ [TRANSCRIPTION-SERVICE] Transcrição anexada à tabela 'transcriptions' para consulta ${consultationId}`);
      } else {
        console.warn(`⚠️ [TRANSCRIPTION-SERVICE] Não foi possível anexar à tabela 'transcriptions': consultationId não encontrado para sala ${roomName}`);
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

  // ✅ Cache de nomes e roles de participantes
  private participantRegistry: Map<string, { name: string; role: 'doctor' | 'patient' }> = new Map();

  public registerParticipant(participantId: string, name: string, role: 'doctor' | 'patient') {
    this.participantRegistry.set(participantId, { name, role });
    console.log(`👤 [TRANSCRIPTION-SERVICE] Participante registrado: ${name} (${role}) - ID: ${participantId}`);
  }

  private async getParticipantName(participantId: string): Promise<string> {
    try {
      if (this.participantRegistry.has(participantId)) {
        return this.participantRegistry.get(participantId)!.name;
      }

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

  private getParticipantRole(participantId: string): 'doctor' | 'patient' | 'system' {
    if (this.participantRegistry.has(participantId)) {
      return this.participantRegistry.get(participantId)!.role;
    }
    return 'system';
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