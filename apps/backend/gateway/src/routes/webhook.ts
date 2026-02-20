import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Configuration for webhooks
const WEBHOOK_BASE_URL = 'https://triahook.gst.dev.br';
const WEBHOOK_AUTH_HEADER = 'Vc1mgGDEcnyqLH3LoHGUXoLTUg2BRVSu';

router.post('/edicao-livro-da-vida', async (req, res) => {
    try {
        const { consultaId, medicoId, pacienteId } = req.body;

        // Construct the payload as expected by the external webhook
        const payload = {
            consultaId,
            medicoId,
            pacienteId
        };

        const webhookUrl = `${WEBHOOK_BASE_URL}/webhook/usi-solucao-v2`;

        console.log(`🔄 [WEBHOOK PROXY] Forwarding to: ${webhookUrl}`);

        // Forward the request
        const response = await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': WEBHOOK_AUTH_HEADER
            }
        });

        console.log('✅ [WEBHOOK PROXY] Success:', response.data);
        res.json({ success: true, data: response.data });
    } catch (error: any) {
        console.error('❌ [WEBHOOK PROXY] Error forwarding to edicao-livro-da-vida:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to forward webhook',
            details: error.message
        });
    }
});

export default router;
