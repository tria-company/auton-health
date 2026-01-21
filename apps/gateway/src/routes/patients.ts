import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getPatientById } from '../controllers/patientsController';

const router = Router();

/**
 * GET /patients/:id
 * Busca um paciente específico
 */
router.get('/:id', authenticateToken, getPatientById);

export default router;
