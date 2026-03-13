import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendAnamneseWhatsApp, sendTextWhatsApp } from '../controllers/whatsappController';

const router = Router();

/**
 * POST /whatsapp/anamnese
 * Envia link da anamnese por WhatsApp via Evolution API
 */
router.post('/anamnese', authenticateToken, sendAnamneseWhatsApp);

/**
 * POST /whatsapp/send
 * Envia mensagem de texto genérica via WhatsApp
 */
router.post('/send', authenticateToken, sendTextWhatsApp);

export default router;
