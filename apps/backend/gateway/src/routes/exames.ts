import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getExames, processarExames } from '../controllers/examesController';

const router = Router();

/**
 * GET /exames/:consultaId
 * Busca exames de uma consulta
 */
router.get('/:consultaId', authenticateToken, getExames);

/**
 * POST /processar-exames/:consultaId
 * Processa exames de uma consulta
 */
router.post('/processar-exames/:consultaId', authenticateToken, processarExames);

export default router;
