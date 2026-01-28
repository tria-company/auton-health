import { Server as SocketIOServer, Socket } from 'socket.io';
import { db, supabase, logError } from '../config/database';

export function setupExamHandlers(socket: Socket, io: SocketIOServer) {
    /**
     * Handler para vincular exames à consulta
     * Recebe URLs de arquivos já uploadados para o Storage e atualiza a tabela consultations
     */
    socket.on('exam:upload', async (data: { roomId: string; fileUrls: string[]; patientId?: string }) => {
        const { roomId, fileUrls, patientId } = data;
        const requestId = `req_${Date.now()}`;

        console.log(`📥 [EXAM-DEBUG] [${requestId}] RECEIVED 'exam:upload' | Room: ${roomId} | Files: ${fileUrls?.length}`);

        if (!roomId || !fileUrls || fileUrls.length === 0) {
            console.warn(`⚠️ [EXAM-DEBUG] [${requestId}] Invalid payload:`, data);
            socket.emit('exam:upload:error', { message: 'Dados inválidos para vínculo de exames.' });
            return;
        }

        // Wrapper com timeout para operações de banco
        // Aceita PromiseLike para funcionar com Supabase Builders
        const withTimeout = <T>(promise: PromiseLike<T>, ms: number, description: string): Promise<T> => {
            return Promise.race([
                Promise.resolve(promise),
                new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${description} took longer than ${ms}ms`)), ms))
            ]);
        };

        try {
            console.log(`🕵️ [EXAM-DEBUG] [${requestId}] STEP 1: Resolving consultationId...`);

            // 1. Obter ID da Consulta com timeout de 5s
            let consultationId: string | null = null;

            try {
                consultationId = await withTimeout(
                    db.getConsultationIdByRoomId(roomId),
                    5000,
                    'resolve_consultation_id'
                );
            } catch (err: any) {
                console.error(`❌ [EXAM-DEBUG] [${requestId}] Error resolving ID via helper:`, err.message);
            }
            // --- LOG SOLICITADO PELO USUÁRIO ---
            console.log(`🎯 [EXAM-DEBUG] [${requestId}] CONSULTATION ID TARGET: ${consultationId}`);
            // ------------------------------------
            if (!consultationId) {
                console.warn(`⚠️ [EXAM-DEBUG] [${requestId}] Helper returned null. Attempting direct fallback query...`);

                // Fallback query com timeout
                // Explicitamente tipando como any para evitar erros de TS com o retorno do wrapper
                const result: any = await withTimeout(
                    supabase
                        .from('consultations')
                        .select('id')
                        .or(`room_id.eq.${roomId},videocall_url.ilike.%${roomId}%,video_url.ilike.%${roomId}%`)
                        .limit(1)
                        .maybeSingle(),
                    5000,
                    'fallback_query'
                );

                const { data: consultResolve, error: fallbackError } = result;

                if (fallbackError) {
                    console.error(`❌ [EXAM-DEBUG] [${requestId}] Fallback query failed:`, fallbackError);
                }

                if (consultResolve?.id) {
                    consultationId = consultResolve.id;
                    console.log(`✅ [EXAM-DEBUG] [${requestId}] Resolved via fallback: ${consultationId}`);
                }
            }



            if (!consultationId) {
                console.error(`❌ [EXAM-DEBUG] [${requestId}] FAILED: Could not resolve consultationId for room ${roomId}`);
                socket.emit('exam:upload:error', { message: 'Consulta não encontrada. Exames salvos mas não vinculados.' });
                return;
            }

            // 2. Buscar exames atuais
            console.log(`🕵️ [EXAM-DEBUG] [${requestId}] STEP 2: Fetching current exams...`);

            const fetchResult: any = await withTimeout(
                supabase
                    .from('consultations')
                    .select('exames')
                    .eq('id', consultationId)
                    .single(),
                5000,
                'fetch_current_exams'
            );

            const { data: consultation, error: fetchError } = fetchResult;

            if (fetchError) {
                console.error(`❌ [EXAM-DEBUG] [${requestId}] Fetch error:`, fetchError);
                throw fetchError;
            }

            // 3. Atualizar array
            const currentExames = consultation?.exames || [];
            const newExames = [...currentExames];

            fileUrls.forEach(url => {
                if (!newExames.includes(url)) {
                    newExames.push(url);
                }
            });

            console.log(`🕵️ [EXAM-DEBUG] [${requestId}] STEP 3: Updating database... (Old: ${currentExames.length}, New: ${newExames.length})`);

            const updateResult: any = await withTimeout(
                supabase
                    .from('consultations')
                    .update({ exames: newExames })
                    .eq('id', consultationId),
                5000,
                'update_consultation'
            );

            const { error: updateError } = updateResult;

            if (updateError) {
                console.error(`❌ [EXAM-DEBUG] [${requestId}] Update error:`, updateError);
                throw updateError;
            }

            console.log(`✅ [EXAM-DEBUG] [${requestId}] SUCCESS! Database updated.`);

            // 4. Notificar sucesso
            socket.emit('exam:upload:success', {
                consultationId,
                count: fileUrls.length,
                totalExams: newExames.length
            });

            // 5. Broadcast para sala
            io.to(roomId).emit('exam:updated', {
                consultationId,
                newExames,
                addedCount: fileUrls.length
            });

            console.log(`📢 [EXAM-DEBUG] [${requestId}] Events emitted. Done.`);

        } catch (error: any) {
            console.error(`❌ [EXAM-DEBUG] [${requestId}] CRITICAL FAILURE:`, error);
            logError('Erro ao vincular exames via socket', 'error', null, { roomId, error: error.message || error });
            socket.emit('exam:upload:error', { message: `Erro interno: ${error.message || 'Falha desconhecida'}` });
        }
    });
}
