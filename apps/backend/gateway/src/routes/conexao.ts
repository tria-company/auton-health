import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getConexaoStatus,
  createInstance,
  disconnectInstance,
  handleEvolutionWebhook,
} from '../controllers/conexaoController';

const router = Router();

/**
 * GET /conexao/status
 * Retorna o status da conexão WhatsApp do médico logado
 */
router.get('/status', authenticateToken, getConexaoStatus);

/**
 * POST /conexao/connect
 * Cria instância na Evolution API e retorna QR Code
 */
router.post('/connect', authenticateToken, createInstance);

/**
 * POST /conexao/disconnect
 * Desconecta e remove a instância do médico
 */
router.post('/disconnect', authenticateToken, disconnectInstance);

/**
 * POST /conexao/webhook
 * Webhook chamado pela Evolution API quando o status da conexão muda.
 * SEM autenticação - a Evolution chama diretamente.
 */
router.post('/webhook', handleEvolutionWebhook);

export default router;
