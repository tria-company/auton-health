import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { sendAnamneseEmail, sendPatientCredentialsEmail } from '../controllers/emailController';

const router = Router();

/**
 * POST /email/anamnese
 * Envia email de anamnese inicial para paciente
 * Requer autenticação
 */
router.post('/anamnese', authenticateToken, sendAnamneseEmail);

/**
 * POST /email/patient-credentials
 * Envia email com credenciais de acesso (usuário e senha) para paciente
 * Requer autenticação
 */
router.post('/patient-credentials', authenticateToken, sendPatientCredentialsEmail);

export default router;
