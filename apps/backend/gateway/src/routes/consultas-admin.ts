import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getActiveConsultations,
  terminateConsultation,
  terminateSessionByRoom
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

/**
 * POST /admin/consultations/terminate-room/:roomId
 * Encerra uma sessão pelo room_id diretamente
 * Apenas para administradores
 */
router.post('/terminate-room/:roomId', authenticateToken, terminateSessionByRoom);

export default router;
