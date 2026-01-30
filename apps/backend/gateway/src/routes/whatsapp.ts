import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendAnamneseWhatsApp } from '../controllers/whatsappController';
import { whatsappController } from '../controllers/whatsapp.controller';

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
router.post('/send', authenticateToken, whatsappController.sendText);

export default router;
