import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getDashboardData } from '../controllers/dashboardController';

const router = Router({ strict: false }); // Desabilitar strict routing para evitar redirects

/**
 * OPTIONS /dashboard - Handler para preflight CORS
 * DEVE vir antes das outras rotas para evitar redirects
 */
router.options('/', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-User-ID, X-Audio-Format, X-Sample-Rate, X-Request-ID, Cache-Control, Pragma');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.status(200).end();
});

router.options('', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-User-ID, X-Audio-Format, X-Sample-Rate, X-Request-ID, Cache-Control, Pragma');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.status(200).end();
});

/**
 * GET /dashboard
 * Retorna estatísticas do dashboard
 * Requer autenticação
 */
router.get('/', authenticateToken, getDashboardData);
router.get('', authenticateToken, getDashboardData); // Também aceitar sem trailing slash

export default router;
