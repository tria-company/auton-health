import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getSolucaoMentalidade,
  updateSolucaoMentalidadeField,
  getSolucaoSuplementacao,
  updateSolucaoSuplementacaoField,
  addSolucaoSuplementacaoItem,
  getAlimentacao,
  updateAlimentacaoField,
  getAtividadeFisica,
  updateAtividadeFisicaField,
  getListaExerciciosFisicos
} from '../controllers/solucoesController';

const router = Router();

/**
 * Solução Mentalidade
 */
router.get('/solucao-mentalidade/:consultaId', authenticateToken, getSolucaoMentalidade);
router.post('/solucao-mentalidade/:consultaId/update-field', authenticateToken, updateSolucaoMentalidadeField);

/**
 * Solução Suplementação
 */
router.get('/solucao-suplementacao/:consultaId', authenticateToken, getSolucaoSuplementacao);
router.post('/solucao-suplementacao/:consultaId/update-field', authenticateToken, updateSolucaoSuplementacaoField);
router.post('/solucao-suplementacao/:consultaId/add-item', authenticateToken, addSolucaoSuplementacaoItem);

/**
 * Alimentação
 */
router.get('/alimentacao/:consultaId', authenticateToken, getAlimentacao);
router.post('/alimentacao/:consultaId/update-field', authenticateToken, updateAlimentacaoField);

/**
 * Atividade Física
 */
router.get('/atividade-fisica/:consultaId', authenticateToken, getAtividadeFisica);
router.post('/atividade-fisica/:consultaId/update-field', authenticateToken, updateAtividadeFisicaField);

/**
 * Lista de Exercícios
 */
router.get('/lista-exercicios-fisicos', authenticateToken, getListaExerciciosFisicos);

export default router;
