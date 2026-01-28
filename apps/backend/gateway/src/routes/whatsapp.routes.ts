
import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';
// import { requireAuth } from '../middleware/auth'; // Descomente se precisar de autenticação

const router = Router();

// Endpoint para envio de mensagem
// POST /api/whatsapp/send
router.post('/send', whatsappController.sendText);

export default router;
