import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  getPatients, 
  getPatientById, 
  getPatientMetrics,
  createPatient,
  updatePatient, 
  deletePatient,
  syncPatientUser,
  togglePatientUserStatus,
  resendPatientCredentials
} from '../controllers/patientsController';

const router = Router();

/**
 * GET /patients
 * Lista todos os pacientes do médico autenticado
 */
router.get('/', authenticateToken, getPatients);

/**
 * POST /patients
 * Cria um novo paciente
 */
router.post('/', authenticateToken, createPatient);

/**
 * GET /patients/:id/metrics
 * Métricas de check-in diário do paciente (sono, atividade, alimentação, equilíbrio)
 */
router.get('/:id/metrics', authenticateToken, getPatientMetrics);

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

/**
 * POST /patients/:id/sync-user
 * Cria ou sincroniza usuário do paciente no sistema externo
 */
router.post('/:id/sync-user', authenticateToken, syncPatientUser);

/**
 * PATCH /patients/:id/user-status
 * Ativa ou desativa usuário do paciente
 */
router.patch('/:id/user-status', authenticateToken, togglePatientUserStatus);

/**
 * POST /patients/:id/resend-credentials
 * Reenvia email com credenciais de acesso para o paciente
 */
router.post('/:id/resend-credentials', authenticateToken, resendPatientCredentials);

export default router;
