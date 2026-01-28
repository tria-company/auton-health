
import fetch from 'node-fetch';
import { AppError } from '@/utils/AppError';

import { config } from '@/config';

interface SendTextOptions {
    number: string;
    text: string;
}

export class WhatsappService {
    private serviceUrl: string;
    private instanceName: string;
    private apiKey: string;

    constructor() {
        this.serviceUrl = config.EVO_SERVICE_URL || '';
        this.instanceName = config.EVO_INSTANCE_NAME || '';
        this.apiKey = config.EVO_APIKEY || '';

        if (!this.serviceUrl || !this.instanceName || !this.apiKey) {
            console.warn('⚠️ [WhatsappService] Variáveis de ambiente da Evolution API não configuradas corretamente.');
        }
    }

    /**
     * Envia uma mensagem de texto via Evolution API
     */
    async sendText({ number, text }: SendTextOptions): Promise<any> {
        if (!this.serviceUrl || !this.instanceName || !this.apiKey) {
            throw new AppError('Serviço de WhatsApp não configurado corretamente', 503);
        }

        // Formatar número: 55dddnumero (remover caracteres não numéricos)
        const formattedNumber = this.formatNumber(number);

        if (!formattedNumber) {
            throw new AppError('Número de telefone inválido', 400);
        }

        // Construir URL: https://sub.domain.com/message/sendText/instance
        // Garantir que serviceUrl não termine com / e instanceName não comece com /
        const baseUrl = this.serviceUrl.replace(/\/$/, '');
        const url = `${baseUrl}/message/sendText/${this.instanceName}`;

        try {
            console.log(`📱 [WhatsappService] Enviando mensagem para ${formattedNumber}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
                },
                body: JSON.stringify({
                    number: formattedNumber,
                    text
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [WhatsappService] Erro na API:', response.status, errorText);
                throw new AppError(`Erro na Evolution API: ${response.statusText}`, response.status);
            }

            const data = await response.json();
            console.log('✅ [WhatsappService] Mensagem enviada com sucesso');
            return data;

        } catch (error) {
            console.error('❌ [WhatsappService] Erro ao enviar mensagem:', error);
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Falha ao comunicar com serviço de WhatsApp', 502);
        }
    }

    /**
     * Formata o número para o padrão 55dddnumero
     * Remove caracteres não numéricos
     * Garante que tenha o código do país (55 para Brasil se não tiver)
     */
    private formatNumber(phone: string): string {
        // Remover tudo que não é dígito
        let cleaned = phone.replace(/\D/g, '');

        // Se estiver vazio, retorna vazio
        if (!cleaned) return '';

        // Se já tiver DDI (começa com 55 e tem tamanho suficiente para ser celular BR: 55 + 2 + 9 = 13 dígitos)
        // Celular BR: 55 (DDI) + 11 (DDD) + 9 (nono dígito) + 8888-8888 = 13 dígitos
        // Fixo BR: 55 (DDI) + 11 (DDD) + 8888-8888 = 12 dígitos

        // Assumir que se tiver menos de 12 dígitos, precisa de DDI
        // Se tiver 10 ou 11 dígitos (DDD + Número), adiciona 55
        if (cleaned.length === 10 || cleaned.length === 11) {
            return `55${cleaned}`;
        }

        // Se já parece ter DDI (12 ou 13 dígitos e começa com 55)
        if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith('55')) {
            return cleaned;
        }

        // Retornar o número limpo se não se encaixar nas regras acima (pode ser internacional ou já correto)
        return cleaned;
    }
}

export const whatsappService = new WhatsappService();
