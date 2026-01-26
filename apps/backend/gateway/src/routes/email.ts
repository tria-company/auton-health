import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendAnamneseEmail } from '../controllers/emailController';

const router = Router();

/**
 * POST /email/anamnese
 * Envia email de anamnese inicial para paciente
 * Requer autenticação
 */
router.post('/anamnese', authenticateToken, sendAnamneseEmail);

export default router;
