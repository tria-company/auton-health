import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getCadastroAnamnese } from '../controllers/patientsController';

const router = Router();

/**
 * GET /cadastro-anamnese/:patientId
 * Busca dados do cadastro de anamnese do paciente
 */
router.get('/:patientId', authenticateToken, getCadastroAnamnese);

export default router;
