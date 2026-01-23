import { Router } from 'express';
import twilio from 'twilio';

const router = Router();

router.get('/turn-credentials', async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    // ✅ CORREÇÃO: Se Twilio não estiver configurado, retornar STUN apenas (não erro 500)
    // Isso permite que o WebRTC funcione mesmo sem TURN server
    if (!accountSid || !authToken) {
      console.warn('⚠️ Twilio credentials not configured, returning STUN servers only');
      return res.json({ 
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302'
            ]
          }
        ]
      });
    }

    const client = twilio(accountSid, authToken);
    // TTL aumentado de 1h (3600s) para 8h (28800s) para suportar consultas longas
    const token = await client.tokens.create({ ttl: 28800 });
    res.json({ iceServers: token.iceServers });
  } catch (error: any) {
    console.error('❌ Erro ao obter credenciais TURN:', error);
    // ✅ CORREÇÃO: Em caso de erro, retornar STUN apenas ao invés de erro 500
    res.json({ 
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
          ]
        }
      ]
    });
  }
});

export default router;

