import { Router, Request, Response } from 'express';
import { testDatabaseConnection } from '../config/database';

import { asyncHandler } from '../middleware/errorHandler';
import { config } from '../config';

const router = Router();

// Health check simples (para load balancers e healthcheck do Docker)
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Health check detalhado
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();

  // Testar componentes
  const [dbHealth] = await Promise.allSettled([
    testDatabaseConnection(),
  ]);

  const responseTime = Date.now() - startTime;

  // Determinar status geral
  const dbOk = dbHealth.status === 'fulfilled' && dbHealth.value;

  // Status geral: healthy se database estiver OK
  const overallStatus = dbOk ? 'healthy' : 'unhealthy';
  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  const healthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    version: '1.0.0',
    environment: config.NODE_ENV,
    services: {
      database: {
        status: dbOk ? 'up' : 'down',
        required: true,
        details: dbHealth.status === 'rejected' ? dbHealth.reason?.message : undefined,
      },
      proxies: {
        realtime: process.env.REALTIME_SERVICE_URL || 'unknown',
        ai: process.env.AI_SERVICE_URL || 'unknown',
      }
    },
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
    },
    uptime: process.uptime(),
  };

  res.status(statusCode).json(healthCheck);
}));

// Health check rápido (para load balancers)
router.get('/quick', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Liveness probe (Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (Kubernetes)
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Verificar se serviços críticos estão prontos
    const dbReady = await testDatabaseConnection();

    if (!dbReady) {
      return res.status(503).json({
        status: 'not_ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      reason: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}));

export default router;