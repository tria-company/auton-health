import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAgenda } from '../controllers/agendaController';

const router = Router();

/**
 * GET /agenda
 * Busca agenda de consultas
 */
router.get('/', authenticateToken, getAgenda);

export default router;
