import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = Router();

// Configuration from environment variables
const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3002';

console.log('🔄 [PROXY] Configuring proxies:');
console.log(`   Realtime Service -> ${REALTIME_SERVICE_URL}`);

// Realtime Service Proxy
const realtimeProxy = createProxyMiddleware({
    target: REALTIME_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api', // Maintain /api prefix
    },
    ws: true, // Enable WebSocket proxying
    onError: (err: any, req: any, res: any) => {
        console.error('❌ [PROXY-REALTIME] Error:', err);
        res.writeHead(502, {
            'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'Realtime Service Unavailable' }));
    },
} as any);

// Apply proxies to specific routes - All routes go to realtime-service

// 1. Realtime Service Routes
router.use('/sessions', realtimeProxy);
router.use('/rooms', realtimeProxy);
router.use('/recordings', realtimeProxy);
router.use('/transcription', realtimeProxy);
router.use('/pcm-transcription', realtimeProxy); // Forward PCM stats/health
router.use('/openai/connections', realtimeProxy);
router.use('/openai/costs', realtimeProxy);

// 2. AI Routes (now handled by realtime-service)
router.use('/ai-pricing', realtimeProxy);
// Note: suggestions route removed - functionality disabled

export default router;

