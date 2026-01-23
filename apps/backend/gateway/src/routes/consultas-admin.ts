import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  getActiveConsultations, 
  terminateConsultation 
} from '../controllers/consultasAdminController';

const router = Router();

/**
 * GET /admin/consultations
 * Lista todas as consultas ativas (status RECORDING)
 * Apenas para administradores
 */
router.get('/', authenticateToken, getActiveConsultations);

/**
 * POST /admin/consultations/:id/terminate
 * Encerra uma consulta específica
 * Apenas para administradores
 */
router.post('/:id/terminate', authenticateToken, terminateConsultation);

export default router;
