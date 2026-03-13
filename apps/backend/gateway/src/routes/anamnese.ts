import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAnamnese, updateAnamneseField, getAnamneseInicial, saveAnamneseInicial } from '../controllers/anamneseController';

const router = Router();

/**
 * GET /anamnese-inicial
 * Busca anamnese inicial do paciente
 */
router.get('/anamnese-inicial', authenticateToken, getAnamneseInicial);

/**
 * POST /anamnese-inicial/save
 * Salva anamnese inicial e atualiza dados do paciente
 */
router.post('/anamnese-inicial/save', authenticateToken, saveAnamneseInicial);

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
