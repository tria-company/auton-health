import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAnamnese, updateAnamneseField, getAnamneseInicial } from '../controllers/anamneseController';

const router = Router();

/**
 * GET /anamnese-inicial
 * Busca anamnese inicial do paciente
 */
router.get('/anamnese-inicial', authenticateToken, getAnamneseInicial);

/**
 * GET /anamnese/:consultaId
 * Busca anamnese de uma consulta
 */
router.get('/:consultaId', authenticateToken, getAnamnese);

/**
 * POST /anamnese/:consultaId/update-field
 * Atualiza um campo específico da anamnese
 */
router.post('/:consultaId/update-field', authenticateToken, updateAnamneseField);

export default router;
