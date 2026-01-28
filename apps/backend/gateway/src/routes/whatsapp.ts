import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendAnamneseWhatsApp } from '../controllers/whatsappController';

const router = Router();

/**
 * POST /whatsapp/anamnese
 * Envia link da anamnese por WhatsApp via Evolution API
 */
router.post('/anamnese', authenticateToken, sendAnamneseWhatsApp);

export default router;
