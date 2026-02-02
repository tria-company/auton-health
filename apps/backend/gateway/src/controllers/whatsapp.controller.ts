
import { Request, Response, NextFunction } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import { z } from 'zod';

// Schema de validação para envio de mensagem
const sendTextSchema = z.object({
    number: z.string().min(1, 'Número é obrigatório'),
    text: z.string().min(1, 'Texto da mensagem é obrigatório')
});

export class WhatsappController {

    /**
     * Envia uma mensagem de texto
     * POST /api/whatsapp/send
     */
    async sendText(req: Request, res: Response, next: NextFunction) {
        try {
            // Validar input
            const { number, text } = sendTextSchema.parse(req.body);

            // Verificar se o número possui WhatsApp
            const whatsappCheck = await whatsappService.checkWhatsappNumber(number);

            if (!whatsappCheck.exists) {
                return res.status(400).json({
                    success: false,
                    error: 'O número informado não possui WhatsApp',
                    code: 'WHATSAPP_NOT_FOUND',
                    number: whatsappCheck.number
                });
            }

            // Chamar serviço de envio
            const result = await whatsappService.sendText({ number, text });

            // Retornar resposta
            res.status(200).json({
                success: true,
                data: result,
                message: 'Mensagem enviada com sucesso'
            });
        } catch (error) {
            next(error);
        }
    }
}

export const whatsappController = new WhatsappController();
