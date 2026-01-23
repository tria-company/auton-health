import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import { presencialSessionManager } from '../services/presencialSessionManager';
import { db, logError } from '../config/database';

/**
 * Configurar handlers Socket.IO para consultas presenciais
 */
export function setupPresencialWebSocket(io: SocketIOServer): void {
    io.on('connection', (socket: Socket) => {
        const userName = socket.handshake.auth.userName;
        const password = socket.handshake.auth.password;

        // Autenticação básica
        if (password !== "x") {
            socket.disconnect(true);
            return;
        }

        console.log(`[PRESENCIAL] ${userName} conectado - Socket: ${socket.id}`);

        // ==================== INICIAR SESSÃO PRESENCIAL ====================

        socket.on('startPresencialSession', async (data, callback) => {
            try {
                const {
                    consultationId,
                    doctorMicrophoneId,
                    patientMicrophoneId
                } = data;

                console.log(`[PRESENCIAL] Iniciando sessão para consulta ${consultationId}...`);

                // Buscar dados da consulta
                const { supabase } = await import('../config/database');
                const { data: consultation, error: consultError } = await supabase
                    .from('consultations')
                    .select('*, medicos(id, name)')
                    .eq('id', consultationId)
                    .single();

                if (consultError || !consultation) {
                    console.error('[PRESENCIAL] Consulta não encontrada:', consultError);
                    callback({
                        success: false,
                        error: 'Consulta não encontrada'
                    });
                    return;
                }

                // Gerar ID da sessão
                const sessionId = 'pres-' + crypto.randomBytes(6).toString('hex');

                // Criar sessão
                const session = await presencialSessionManager.createSession({
                    sessionId,
                    consultationId: consultation.id,
                    doctorId: consultation.doctor_id,
                    patientId: consultation.patient_id,
                    patientName: consultation.patient_name,
                    doctorName: consultation.medicos?.name || userName,
                    doctorMicrophoneId,
                    patientMicrophoneId
                });

                // Atualizar consultation para status RECORDING
                await supabase
                    .from('consultations')
                    .update({
                        status: 'RECORDING',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', consultationId);

                // Entrar na sala Socket.IO
                socket.join(sessionId);

                console.log(`✅ [PRESENCIAL] Sessão ${sessionId} criada`);

                callback({
                    success: true,
                    sessionId,
                    session: {
                        sessionId: session.sessionId,
                        consultationId: session.consultationId,
                        patientName: session.patientName,
                        doctorName: session.doctorName,
                        startTime: session.startTime
                    }
                });
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao criar sessão:', error);

                logError(
                    'Erro ao criar sessão presencial',
                    'error',
                    null,
                    {
                        consultationId: data.consultationId,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );

                callback({
                    success: false,
                    error: 'Erro ao criar sessão: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
                });
            }
        });

        // ==================== CHUNK DE ÁUDIO ====================

        socket.on('presencialAudioChunk', async (data, callback) => {
            try {
                const {
                    sessionId,
                    speaker, // 'doctor' | 'patient'
                    audioChunk, // base64 string
                    sequence,
                    timestamp
                } = data;

                console.log(`📥 [PRESENCIAL] Chunk recebido: ${speaker} #${sequence} (${audioChunk.length} chars base64)`);

                // Converter base64 para Buffer
                const audioBuffer = Buffer.from(audioChunk, 'base64');

                console.log(`🔄 [PRESENCIAL] Buffer criado: ${audioBuffer.length} bytes`);

                // Processar chunk imediatamente e obter transcrição
                const transcription = await presencialSessionManager.processAudioChunkAndReturn(
                    sessionId,
                    speaker,
                    audioBuffer,
                    sequence
                );

                // Confirmar recebimento
                if (callback) {
                    callback({ success: true });
                }

                // Se houve transcrição, emitir imediatamente
                if (transcription) {
                    console.log(`📡 [PRESENCIAL] Emitindo transcrição para sala ${sessionId}: "${transcription.text}"`);
                    io.to(sessionId).emit('presencialTranscription', {
                        sessionId,
                        speaker: transcription.speaker,
                        text: transcription.text,
                        timestamp: transcription.timestamp,
                        sequence: transcription.sequence
                    });
                } else {
                    console.log(`⚠️ [PRESENCIAL] Nenhuma transcrição gerada para chunk ${speaker} #${sequence}`);
                }

            } catch (error) {
                console.error('[PRESENCIAL] Erro ao processar chunk:', error);

                if (callback) {
                    callback({
                        success: false,
                        error: error instanceof Error ? error.message : 'Erro desconhecido'
                    });
                }
            }
        });

        // ==================== FINALIZAR SESSÃO ====================

        socket.on('endPresencialSession', async (data, callback) => {
            try {
                const { sessionId } = data;

                console.log(`[PRESENCIAL] Finalizando sessão ${sessionId}...`);

                // Finalizar sessão
                await presencialSessionManager.endSession(sessionId);

                // Sair da sala
                socket.leave(sessionId);

                console.log(`✅ [PRESENCIAL] Sessão ${sessionId} finalizada`);

                callback({
                    success: true,
                    message: 'Sessão finalizada com sucesso'
                });
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao finalizar sessão:', error);

                logError(
                    'Erro ao finalizar sessão presencial',
                    'error',
                    null,
                    {
                        sessionId: data.sessionId,
                        error: error instanceof Error ? error.message : String(error)
                    }
                );

                callback({
                    success: false,
                    error: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        });

        // ==================== OBTER TRANSCRIÇÕES ====================

        socket.on('getPresencialTranscriptions', (data, callback) => {
            try {
                const { sessionId } = data;

                const transcriptions = presencialSessionManager.getTranscriptions(sessionId);

                callback({
                    success: true,
                    transcriptions: transcriptions.map(t => ({
                        speaker: t.speaker,
                        text: t.text,
                        timestamp: t.timestamp,
                        sequence: t.sequence
                    }))
                });
            } catch (error) {
                console.error('[PRESENCIAL] Erro ao obter transcrições:', error);
                callback({
                    success: false,
                    error: error instanceof Error ? error.message : 'Erro desconhecido'
                });
            }
        });

        // ==================== DESCONEXÃO ====================

        socket.on('disconnect', (reason) => {
            console.log(`[PRESENCIAL] ${userName} desconectado: ${reason}`);
        });
    });
}
