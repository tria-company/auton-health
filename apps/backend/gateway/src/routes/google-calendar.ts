import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getGoogleCalendarStatus,
  authorizeGoogleCalendar,
  disconnectGoogleCalendar,
  exchangeGoogleCalendarToken,
  createCalendarEvent
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
 * POST /auth/google-calendar/exchange
 * Troca código por token (chamado pelo frontend)
 */
router.post('/exchange', authenticateToken, exchangeGoogleCalendarToken);

// /**
//  * GET /auth/google-calendar/callback
//  * Callback do OAuth (deprecated - frontend handles directly)
//  */
// router.get('/callback', handleGoogleCalendarCallback);

/**
 * POST /auth/google-calendar/disconnect
 * Desconecta integração
 */
router.post('/disconnect', authenticateToken, disconnectGoogleCalendar);

/**
 * POST /auth/google-calendar/events
 * Cria um evento no Google Calendar
 */
// @ts-ignore - Ignore type error manually
router.post('/events', authenticateToken, createCalendarEvent);

export default router;
