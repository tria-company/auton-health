import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getExames, linkExames } from '../controllers/examesController';

const router = Router();

/**
 * GET /exames/:consultaId
 * Busca exames de uma consulta (lê de consultations.exames text[])
 */
router.get('/:consultaId', authenticateToken, getExames);

/**
 * POST /exames/:consultaId/link
 * Vincula URLs de arquivos já uploadados no Storage à consulta
 */
router.post('/:consultaId/link', authenticateToken, linkExames);

export default router;
