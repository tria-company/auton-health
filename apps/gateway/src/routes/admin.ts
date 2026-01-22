import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAdminDashboard } from '../controllers/adminController';

const router = Router();

/**
 * GET /admin/dashboard
 * Dashboard administrativo
 */
router.get('/dashboard', authenticateToken, getAdminDashboard);

export default router;
