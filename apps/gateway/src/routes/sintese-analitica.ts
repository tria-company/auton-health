import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getSinteseAnalitica, updateSinteseAnalitica } from '../controllers/sinteseAnaliticaController';

const router = Router();

/**
 * GET /sintese-analitica/:consultaId
 * Busca síntese analítica da consulta
 */
router.get('/:consultaId', authenticateToken, getSinteseAnalitica);

/**
 * PATCH /sintese-analitica/:consultaId
 * Atualiza síntese analítica
 */
router.patch('/:consultaId', authenticateToken, updateSinteseAnalitica);

export default router;
