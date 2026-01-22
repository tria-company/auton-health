import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  getPatients, 
  getPatientById, 
  updatePatient, 
  deletePatient 
} from '../controllers/patientsController';

const router = Router();

/**
 * GET /patients
 * Lista todos os pacientes do médico autenticado
 */
router.get('/', authenticateToken, getPatients);

/**
 * GET /patients/:id
 * Busca um paciente específico
 */
router.get('/:id', authenticateToken, getPatientById);

/**
 * PUT /patients/:id
 * Atualiza um paciente existente
 */
router.put('/:id', authenticateToken, updatePatient);

/**
 * DELETE /patients/:id
 * Remove um paciente
 */
router.delete('/:id', authenticateToken, deletePatient);

export default router;
