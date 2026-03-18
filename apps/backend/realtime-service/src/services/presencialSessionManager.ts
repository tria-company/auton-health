import { whisperService } from './whisperService';
import { db, logError } from '../config/database';
import fetch from 'node-fetch';

/**
 * Interface para chunk de áudio em fila
 */
interface AudioChunk {
    sequence: number;
    speaker: 'doctor' | 'patient';
    audioBuffer: Buffer;
    timestamp: Date;
    sessionId: string;
}

/**
 * Interface para transcrição
 */
interface Transcription {
    speaker: 'doctor' | 'patient';
    text: string;
    timestamp: Date;
    sequence: number;
}

/**
 * Interface para sessão presencial em memória
 */
interface PresencialSession {
    sessionId: string;
    consultationId: string;
    callSessionId: string;
    doctorId: string;
    patientId: string;
    patientName: string;
    doctorName: string;

    startTime: Date;
    endTime?: Date;
    status: 'active' | 'paused' | 'ended';

    // Transcrições acumuladas
    transcriptions: Transcription[];

    // Metadados
    doctorMicrophoneId: string;
    patientMicrophoneId: string;

    // Estatísticas
    totalChunks: number;
    totalTranscriptions: number;
}

/**
 * Gerenciador de sessões presenciais
 * Mantém sessões ativas em memória e processa chunks de áudio
 */
class PresencialSessionManager {
    // Sessões ativas em memória
    private sessions = new Map<string, PresencialSession>();

    // Fila de chunks para processar
    private processingQueue: AudioChunk[] = [];
    private isProcessing = false;

    /**
     * Cria nova sessão presencial
     */
    async createSession(data: {
        sessionId: string;
        consultationId: string;
        doctorId: string;
        patientId: string;
        patientName: string;
        doctorName: string;
        doctorMicrophoneId: string;
        patientMicrophoneId: string;
    }): Promise<PresencialSession> {
        console.log(`📋 [PRESENCIAL] Criando sessão ${data.sessionId}...`);

        // Criar registro em call_sessions
        const callSession = await db.createCallSession({
            room_id: data.sessionId,
            room_name: `Presencial - ${data.patientName}`,
            session_type: 'presencial',
            participants: {
                doctor: data.doctorName,
                patient: data.patientName,
                doctorId: data.doctorId,
                patientId: data.patientId
            },
            metadata: {
                doctorMicrophoneId: data.doctorMicrophoneId,
                patientMicrophoneId: data.patientMicrophoneId,
                audioChunkSize: 5,
                vadEnabled: true,
                vadThreshold: 0.02
            }
        });

        if (!callSession) {
            throw new Error('Falha ao criar call_session no banco');
        }

        // Atualizar consultation com call_session
        await db.updateCallSession(data.sessionId, {
            consultation_id: data.consultationId
        });

        const session: PresencialSession = {
            sessionId: data.sessionId,
            consultationId: data.consultationId,
            callSessionId: callSession.id,
            doctorId: data.doctorId,
            patientId: data.patientId,
            patientName: data.patientName,
            doctorName: data.doctorName,
            startTime: new Date(),
            status: 'active',
            transcriptions: [],
            doctorMicrophoneId: data.doctorMicrophoneId,
            patientMicrophoneId: data.patientMicrophoneId,
            totalChunks: 0,
            totalTranscriptions: 0
        };

        this.sessions.set(data.sessionId, session);

        console.log(`✅ [PRESENCIAL] Sessão ${data.sessionId} criada`);

        return session;
    }

    /**
     * Obtém sessão existente
     */
    getSession(sessionId: string): PresencialSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Adiciona chunk de áudio à fila de processamento
     */
    async addAudioChunk(
        sessionId: string,
        speaker: 'doctor' | 'patient',
        audioBuffer: Buffer,
        sequence: number
    ): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        if (session.status !== 'active') {
            throw new Error(`Sessão ${sessionId} não está ativa (status: ${session.status})`);
        }

        // Adicionar à fila
        this.processingQueue.push({
            sequence,
            speaker,
            audioBuffer,
            timestamp: new Date(),
            sessionId
        });

        session.totalChunks++;

        console.log(`🎵 [PRESENCIAL] Chunk adicionado à fila: ${speaker} #${sequence} (${audioBuffer.length} bytes) - Fila: ${this.processingQueue.length}`);

        // Iniciar processamento se não estiver rodando
        if (!this.isProcessing) {
            console.log(`🚀 [PRESENCIAL] Iniciando processamento da fila...`);
            this.processQueue();
        } else {
            console.log(`⏳ [PRESENCIAL] Processamento já em andamento, chunk aguardando na fila...`);
        }
    }

    /**
     * Processa chunk de áudio imediatamente e retorna a transcrição
     * (Versão síncrona para uso com Socket.IO)
     */
    async processAudioChunkAndReturn(
        sessionId: string,
        speaker: 'doctor' | 'patient',
        audioBuffer: Buffer,
        sequence: number
    ): Promise<Transcription | null> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        if (session.status !== 'active') {
            throw new Error(`Sessão ${sessionId} não está ativa (status: ${session.status})`);
        }

        session.totalChunks++;

        console.log(`🎵 [PRESENCIAL] Processando chunk síncrono: ${speaker} #${sequence} (${audioBuffer.length} bytes)`);

        try {
            // Transcrever com Whisper
            console.log(`🔄 [PRESENCIAL] Enviando para Whisper API: ${speaker} #${sequence}`);
            const result = await whisperService.transcribeAudioChunk(
                audioBuffer,
                speaker,
                'pt',
                session.consultationId  // ✅ NOVO: Registrar custos vinculados à consulta
            );

            console.log(`✅ [PRESENCIAL] Whisper retornou: "${result.text}" (duração: ${result.duration}ms)`);

            if (!result.text || result.text.trim().length === 0) {
                console.log(`⚠️ [PRESENCIAL] Chunk ${speaker} #${sequence} sem transcrição (silêncio)`);
                return null;
            }

            // Criar transcrição
            const transcription: Transcription = {
                speaker: speaker,
                text: result.text,
                timestamp: new Date(),
                sequence: sequence
            };

            // Adicionar à sessão
            session.transcriptions.push(transcription);
            session.totalTranscriptions++;

            console.log(`📝 [PRESENCIAL] Transcrição ${speaker} #${sequence} salva: "${result.text}" (Total: ${session.totalTranscriptions})`);

            return transcription;

        } catch (error) {
            console.error(`❌ [PRESENCIAL] Erro ao processar chunk ${speaker} #${sequence}:`, error);

            logError(
                'Erro ao processar chunk de áudio',
                'error',
                null,
                {
                    sessionId,
                    speaker,
                    sequence,
                    error: error instanceof Error ? error.message : String(error)
                }
            );

            return null;
        }
    }

    /**
     * Processa fila de chunks de áudio
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        if (this.processingQueue.length === 0) return;

        this.isProcessing = true;

        console.log(`⚙️ [PRESENCIAL] Processando fila (${this.processingQueue.length} chunks)...`);

        while (this.processingQueue.length > 0) {
            const chunk = this.processingQueue.shift();
            if (!chunk) break;

            try {
                await this.processChunk(chunk);
            } catch (error) {
                console.error(`❌ [PRESENCIAL] Erro ao processar chunk ${chunk.speaker} #${chunk.sequence}:`, error);

                logError(
                    'Erro ao processar chunk de áudio',
                    'error',
                    null,
                    {
                        sessionId: chunk.sessionId,
                        speaker: chunk.speaker,
                        sequence: chunk.sequence,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );
            }
        }

        this.isProcessing = false;
        console.log(`✅ [PRESENCIAL] Fila processada`);
    }

    /**
     * Processa um chunk individual
     */
    private async processChunk(chunk: AudioChunk): Promise<void> {
        const session = this.sessions.get(chunk.sessionId);
        if (!session) {
            console.error(`❌ [PRESENCIAL] Sessão ${chunk.sessionId} não encontrada para chunk ${chunk.speaker} #${chunk.sequence}`);
            return;
        }

        console.log(`🎙️ [PRESENCIAL] Processando chunk ${chunk.speaker} #${chunk.sequence} (${chunk.audioBuffer.length} bytes)...`);

        // Transcrever com Whisper
        console.log(`🔄 [PRESENCIAL] Enviando para Whisper API: ${chunk.speaker} #${chunk.sequence}`);
        const result = await whisperService.transcribeAudioChunk(
            chunk.audioBuffer,
            chunk.speaker,
            'pt'
        );

        console.log(`✅ [PRESENCIAL] Whisper retornou: "${result.text}" (duração: ${result.duration}ms)`);

        if (!result.text || result.text.trim().length === 0) {
            console.log(`⚠️ [PRESENCIAL] Chunk ${chunk.speaker} #${chunk.sequence} sem transcrição (silêncio)`);
            return;
        }

        // Adicionar transcrição à sessão
        const transcription: Transcription = {
            speaker: chunk.speaker,
            text: result.text,
            timestamp: chunk.timestamp,
            sequence: chunk.sequence
        };

        session.transcriptions.push(transcription);
        session.totalTranscriptions++;

        console.log(`📝 [PRESENCIAL] Transcrição ${chunk.speaker} #${chunk.sequence} salva na sessão: "${result.text}" (Total: ${session.totalTranscriptions})`);
    }

    /**
     * Finaliza sessão e salva no banco
     */
    async endSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Sessão ${sessionId} não encontrada`);
        }

        console.log(`🏁 [PRESENCIAL] Finalizando sessão ${sessionId}...`);

        session.status = 'ended';
        session.endTime = new Date();

        // Aguardar processamento completo da fila
        while (this.processingQueue.some(c => c.sessionId === sessionId)) {
            console.log(`⏳ [PRESENCIAL] Aguardando fila processar...`);
            await this.sleep(500);
        }

        // Salvar transcrições no banco
        await this.saveTranscriptions(session);

        // Atualizar consultation
        const durationSeconds = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
        const durationMinutes = durationSeconds / 60; // Converter para minutos conforme schema do banco

        const { supabase } = await import('../config/database');
        await supabase
            .from('consultations')
            .update({
                status: 'PROCESSING',
                consulta_finalizada: true,
                consulta_fim: session.endTime.toISOString(),
                duracao: durationMinutes, // Campo duracao é REAL em minutos
                updated_at: new Date().toISOString()
            })
            .eq('id', session.consultationId);

        // Atualizar call_sessions.status para 'ended'
        {
            const { error: csError } = await supabase
                .from('call_sessions')
                .update({
                    status: 'ended',
                    ended_at: session.endTime.toISOString(),
                    webrtc_active: false
                })
                .eq('room_id', sessionId);

            if (csError) {
                console.error(`⚠️ [PRESENCIAL] Erro ao atualizar call_sessions:`, csError);
            } else {
                console.log(`✅ [PRESENCIAL] call_sessions.status atualizado para 'ended'`);
            }
        }

        console.log(`✅ [PRESENCIAL] Sessão ${sessionId} finalizada (${session.totalTranscriptions} transcrições, ${durationMinutes.toFixed(2)} min)`);

        // 💰 NOVO: Calcular e atualizar valor_consulta
        try {
            const { aiPricingService } = await import('./aiPricingService');
            const totalCost = await aiPricingService.calculateAndUpdateConsultationCost(session.consultationId);
            if (totalCost !== null) {
                console.log(`💰 [PRESENCIAL] Custo total calculado e salvo: $${totalCost.toFixed(6)}`);
            }
        } catch (costError) {
            console.error('❌ [PRESENCIAL] Erro ao calcular custo da consulta (não bloqueia finalização):', costError);
        }

        // 📤 NOVO: Enviar webhook com dados da consulta finalizada
        try {
            // Montar transcrição completa formatada
            const transcriptionText = session.transcriptions
                .map(t => `[${t.speaker}]: ${t.text}`)
                .join('\n');

            // Configurar webhook
            const webhookUrl = 'https://triahook.gst.dev.br/webhook/usi-analise-v2';
            const webhookHeaders = {
                'Content-Type': 'application/json',
                'Authorization': process.env.WEBHOOK_AUTH_HEADER || ''
            };

            const webhookData = {
                consultationId: session.consultationId,
                doctorId: session.doctorId,
                patientId: session.patientId,
                transcription: transcriptionText,
                consulta_finalizada: true,
                paciente_entrou_sala: true, // Em consultas presenciais, sempre true
                tipo_consulta: 'PRESENCIAL'
            };

            console.log(`📤 [PRESENCIAL] Enviando webhook para ${webhookUrl}...`);
            console.log(`📦 [PRESENCIAL] Dados: consultationId=${session.consultationId}, doctorId=${session.doctorId}, patientId=${session.patientId}`);

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: webhookHeaders,
                body: JSON.stringify(webhookData)
            });

            if (response.ok) {
                console.log(`✅ [PRESENCIAL] Webhook enviado com sucesso (status: ${response.status})`);
            } else {
                console.warn(`⚠️ [PRESENCIAL] Webhook retornou status ${response.status}`);
            }
        } catch (webhookError) {
            // Não bloquear finalização se webhook falhar
            console.error(`❌ [PRESENCIAL] Erro ao enviar webhook:`, webhookError);
            logError(
                'Erro ao enviar webhook de finalização de consulta presencial',
                'warning',
                session.consultationId,
                {
                    sessionId,
                    error: webhookError instanceof Error ? webhookError.message : String(webhookError)
                }
            );
        }

        // Remover da memória após 5 minutos
        setTimeout(() => {
            this.sessions.delete(sessionId);
            console.log(`🧹 [PRESENCIAL] Sessão ${sessionId} removida da memória`);
        }, 5 * 60 * 1000);
    }

    /**
     * Salva transcrições no banco de dados
     */
    private async saveTranscriptions(session: PresencialSession): Promise<void> {
        if (session.transcriptions.length === 0) {
            console.log(`⚠️ [PRESENCIAL] Nenhuma transcrição para salvar`);
            return;
        }

        // Formatar transcrições como JSON
        const transcriptionJSON = session.transcriptions.map(t => ({
            speaker: t.speaker,
            text: t.text,
            timestamp: t.timestamp.toISOString()
        }));

        // Salvar em consultations.transcricao
        const { supabase } = await import('../config/database');
        const { error } = await supabase
            .from('consultations')
            .update({
                transcricao: JSON.stringify(transcriptionJSON)
            })
            .eq('id', session.consultationId);

        if (error) {
            console.error('❌ [PRESENCIAL] Erro ao salvar transcrições:', error);
            throw error;
        }

        console.log(`💾 [PRESENCIAL] ${session.transcriptions.length} transcrições salvas no banco`);
    }

    /**
     * Retorna transcrições de uma sessão
     */
    getTranscriptions(sessionId: string): Transcription[] {
        const session = this.sessions.get(sessionId);
        return session?.transcriptions || [];
    }

    /**
     * Helper para sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Exportar instância singleton
export const presencialSessionManager = new PresencialSessionManager();
