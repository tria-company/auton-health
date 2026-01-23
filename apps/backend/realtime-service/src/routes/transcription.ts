import { Router } from 'express';
import { transcriptionController } from '../controllers/transcriptionController';

const router = Router();

// Rotas de controle de transcrição
router.post('/start', transcriptionController.startTranscription.bind(transcriptionController));
router.post('/stop/:roomName', transcriptionController.stopTranscription.bind(transcriptionController));
router.get('/stats/:roomName', transcriptionController.getTranscriptionStats.bind(transcriptionController));

// Rotas de processamento de áudio
router.post('/process-audio', transcriptionController.processAudio.bind(transcriptionController));

// Rotas de busca de transcrições
router.get('/consultation/:consultationId', transcriptionController.getTranscriptions.bind(transcriptionController));

// Rota de health check
router.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Transcription service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;