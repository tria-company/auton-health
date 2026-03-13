import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Rota para editar campos com IA
router.post('/edit', async (req, res) => {
    try {
        const { webhookUrl, ...payload } = req.body;

        console.log('🤖 [AI] Recebendo requisição de edição');
        console.log('🔗 [AI] Target URL:', webhookUrl);
        console.log('📦 [AI] Payload:', JSON.stringify(payload, null, 2));

        if (!webhookUrl) {
            return res.status(400).json({
                success: false,
                error: 'webhookUrl is required'
            });
        }

        // Fazer requisição para o webhook
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Adicionar auth headers se necessário (geralmente vêm do config no frontend, mas aqui estamos repassando)
                // Se o frontend mandar headers específicos no body, precisamos tratar.
                // Mas o frontend 'page.tsx' manda apenas o body.
                // O webhook-config.ts tem authHeader, mas ele é usado no frontend?
                // Ah, no frontend 'page.tsx' ele pega getWebhookHeaders() mas NÃO manda no body da requisição pro gateway.
                // O gatewayClient pega o token do usuário logado?
                'Authorization': process.env.WEBHOOK_AUTH_HEADER || ''
            },
            body: JSON.stringify(payload)
        });

        console.log('📡 [AI] Webhook status:', response.status);

        // Tentar ler a resposta como texto primeiro
        const responseText = await response.text();
        console.log('📥 [AI] Webhook response body:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = responseText;
        }

        if (!response.ok) {
            console.error('❌ [AI] Webhook falhou com status:', response.status, 'Body:', responseText);
            return res.status(response.status).json({
                success: false,
                error: `Webhook error ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
                details: data
            });
        }

        // Retornar sucesso com o resultado
        res.json({
            success: true,
            result: data
        });

    } catch (error: any) {
        console.error('❌ [AI] Erro ao processar requisição:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

export default router;
