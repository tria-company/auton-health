import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getDiagnostico, updateDiagnosticoField } from '../controllers/diagnosticoController';

const router = Router();

/**
 * GET /diagnostico/:consultaId
 * Busca diagnóstico de uma consulta
 */
router.get('/:consultaId', authenticateToken, getDiagnostico);

/**
 * POST /diagnostico/:consultaId/update-field
 * Atualiza um campo específico do diagnóstico
 */
router.post('/:consultaId/update-field', authenticateToken, updateDiagnosticoField);

export default router;
