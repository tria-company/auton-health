import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getCadastroAnamnese, updateCadastroAnamnese } from '../controllers/patientsController';

const router = Router();

/**
 * GET /cadastro-anamnese/:patientId
 * Busca dados do cadastro de anamnese do paciente
 */
router.get('/:patientId', authenticateToken, getCadastroAnamnese);

/**
 * POST /cadastro-anamnese/:patientId
 * Atualiza ou cria cadastro de anamnese do paciente
 */
router.post('/:patientId', authenticateToken, updateCadastroAnamnese);

export default router;
