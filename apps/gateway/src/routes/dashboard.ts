import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getDashboardData } from '../controllers/dashboardController';

const router = Router();

/**
 * GET /dashboard
 * Retorna estatísticas do dashboard
 * Requer autenticação
 */
router.get('/', authenticateToken, getDashboardData);

export default router;
