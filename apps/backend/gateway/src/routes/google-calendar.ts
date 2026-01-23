import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  getGoogleCalendarStatus,
  authorizeGoogleCalendar,
  handleGoogleCalendarCallback,
  disconnectGoogleCalendar
} from '../controllers/googleCalendarController';

const router = Router();

/**
 * GET /auth/google-calendar/status
 * Verifica status da integração
 */
router.get('/status', authenticateToken, getGoogleCalendarStatus);

/**
 * GET /auth/google-calendar/authorize
 * Inicia fluxo OAuth
 */
router.get('/authorize', authenticateToken, authorizeGoogleCalendar);

/**
 * GET /auth/google-calendar/callback
 * Callback do OAuth
 */
router.get('/callback', handleGoogleCalendarCallback);

/**
 * POST /auth/google-calendar/disconnect
 * Desconecta integração
 */
router.post('/disconnect', authenticateToken, disconnectGoogleCalendar);

export default router;
