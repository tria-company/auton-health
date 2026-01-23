import { Request, Response } from 'express';
import { transcriptionService } from '../services/transcriptionService';

/**
 * Controller para gerenciar transcrições de consultas
 */
class TranscriptionController {
    /**
     * Inicia a transcrição para uma sala
     */
    async startTranscription(req: Request, res: Response): Promise<void> {
        try {
            const { roomName, consultationId } = req.body;

            if (!roomName) {
                res.status(400).json({ error: 'roomName é obrigatório' });
                return;
            }

            await transcriptionService.startTranscription(roomName, consultationId);

            res.status(200).json({
                success: true,
                message: `Transcrição iniciada para sala: ${roomName}`
            });
        } catch (error) {
            console.error('Erro ao iniciar transcrição:', error);
            res.status(500).json({
                error: 'Erro ao iniciar transcrição',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Para a transcrição de uma sala
     */
    async stopTranscription(req: Request, res: Response): Promise<void> {
        try {
            const { roomName } = req.params;
            const roomNameStr = Array.isArray(roomName) ? roomName[0] : roomName;

            if (!roomNameStr) {
                res.status(400).json({ error: 'roomName é obrigatório' });
                return;
            }

            await transcriptionService.stopTranscription(roomNameStr);

            res.status(200).json({
                success: true,
                message: `Transcrição parada para sala: ${roomName}`
            });
        } catch (error) {
            console.error('Erro ao parar transcrição:', error);
            res.status(500).json({
                error: 'Erro ao parar transcrição',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Obtém estatísticas de transcrição de uma sala
     */
    async getTranscriptionStats(req: Request, res: Response): Promise<void> {
        try {
            const { roomName } = req.params;
            const roomNameStr = Array.isArray(roomName) ? roomName[0] : roomName;

            if (!roomNameStr) {
                res.status(400).json({ error: 'roomName é obrigatório' });
                return;
            }

            const stats = await transcriptionService.getTranscriptionStats(roomNameStr);

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({
                error: 'Erro ao obter estatísticas de transcrição',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Processa um chunk de áudio manualmente
     */
    async processAudio(req: Request, res: Response): Promise<void> {
        try {
            const { roomName, audioData, participantId, sampleRate, channels } = req.body;

            if (!roomName || !audioData) {
                res.status(400).json({ error: 'roomName e audioData são obrigatórios' });
                return;
            }

            // Converter audioData de base64 para Buffer
            const audioBuffer = Buffer.from(audioData, 'base64');

            await transcriptionService.processAudioChunk(
                {
                    data: audioBuffer,
                    participantId: participantId || 'unknown',
                    sampleRate: sampleRate || 16000,
                    channels: channels || 1
                },
                roomName
            );

            res.status(200).json({
                success: true,
                message: 'Áudio processado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao processar áudio:', error);
            res.status(500).json({
                error: 'Erro ao processar áudio',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Obtém transcrições de uma consulta
     */
    async getTranscriptions(req: Request, res: Response): Promise<void> {
        try {
            const { consultationId } = req.params;

            if (!consultationId) {
                res.status(400).json({ error: 'consultationId é obrigatório' });
                return;
            }

            // Buscar transcrições do banco de dados via service
            // Por enquanto retorna placeholder - será implementado com Supabase query
            res.status(200).json({
                success: true,
                data: [],
                message: 'Funcionalidade de busca de transcrições será implementada'
            });
        } catch (error) {
            console.error('Erro ao buscar transcrições:', error);
            res.status(500).json({
                error: 'Erro ao buscar transcrições',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

export const transcriptionController = new TranscriptionController();
