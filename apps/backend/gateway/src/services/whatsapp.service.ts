
import fetch from 'node-fetch';
import { AppError } from '../utils/AppError';
import { createClient } from '@supabase/supabase-js';

import { config } from '../config';

const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
);

interface SendTextOptions {
    number: string;
    text: string;
    doctorId?: string;
}

interface ResolvedInstance {
    instanceName: string;
    isDefault: boolean;
}

export class WhatsappService {
    private serviceUrl: string;
    private defaultInstanceName: string;
    private apiKey: string;

    constructor() {
        this.serviceUrl = config.EVO_SERVICE_URL || '';
        this.defaultInstanceName = config.EVO_INSTANCE_NAME || '';
        this.apiKey = config.EVO_APIKEY || '';

        if (!this.serviceUrl || !this.defaultInstanceName || !this.apiKey) {
            console.warn('⚠️ [WhatsappService] Variáveis de ambiente da Evolution API não configuradas corretamente.');
        }
    }

    /**
     * Resolve qual instância usar para um médico.
     * Se o médico tiver uma instância conectada em conexoes_whatsapp, usa ela.
     * Caso contrário, usa a instância padrão do .env.
     * Retorna também se está usando a instância padrão (isDefault).
     */
    async resolveInstance(doctorId?: string): Promise<string> {
        return (await this.resolveInstanceDetailed(doctorId)).instanceName;
    }

    async resolveInstanceDetailed(doctorId?: string): Promise<ResolvedInstance> {
        if (!doctorId) return { instanceName: this.defaultInstanceName, isDefault: true };

        try {
            const { data: conexao } = await supabase
                .from('conexoes_whatsapp')
                .select('instancia_nome, instancia_status')
                .eq('doctor_id', doctorId)
                .eq('instancia_status', 'connected')
                .maybeSingle();

            if (conexao?.instancia_nome) {
                console.log(`📱 [WhatsappService] Usando instância do médico: ${conexao.instancia_nome}`);
                return { instanceName: conexao.instancia_nome, isDefault: false };
            }
        } catch (error) {
            console.warn('⚠️ [WhatsappService] Erro ao buscar instância do médico, usando padrão:', error);
        }

        console.log(`📱 [WhatsappService] Usando instância padrão: ${this.defaultInstanceName}`);
        return { instanceName: this.defaultInstanceName, isDefault: true };
    }

    /**
     * Envia uma mensagem de texto via Evolution API.
     * Se doctorId for passado e o médico tiver instância conectada, usa a instância dele.
     */
    async sendText({ number, text, doctorId }: SendTextOptions): Promise<any> {
        if (!this.serviceUrl || !this.apiKey) {
            throw new AppError('Serviço de WhatsApp não configurado corretamente', 503);
        }

        const resolved = await this.resolveInstanceDetailed(doctorId);
        const instanceName = resolved.instanceName;

        if (!instanceName) {
            throw new AppError('Nenhuma instância WhatsApp disponível', 503);
        }

        // Formatar número: 55dddnumero (remover caracteres não numéricos)
        const formattedNumber = this.formatNumber(number);

        if (!formattedNumber) {
            throw new AppError('Número de telefone inválido', 400);
        }

        const baseUrl = this.serviceUrl.replace(/\/$/, '');
        const url = `${baseUrl}/message/sendText/${instanceName}`;

        try {
            console.log(`📱 [WhatsappService] Enviando mensagem para ${formattedNumber} via instância "${instanceName}"...`);

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
            console.log(`✅ [WhatsappService] Mensagem enviada com sucesso via "${instanceName}"${resolved.isDefault ? ' (dispositivo padrão)' : ''}`);
            return { ...data as object, usedDefaultDevice: resolved.isDefault };

        } catch (error) {
            console.error('❌ [WhatsappService] Erro ao enviar mensagem:', error);
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Falha ao comunicar com serviço de WhatsApp', 502);
        }
    }

    /**
     * Verifica se um número possui WhatsApp.
     * Se doctorId for passado e o médico tiver instância conectada, usa a instância dele.
     */
    async checkWhatsappNumber(number: string, doctorId?: string): Promise<{ exists: boolean; jid?: string; number: string }> {
        if (!this.serviceUrl || !this.apiKey) {
            throw new AppError('Serviço de WhatsApp não configurado corretamente', 503);
        }

        const instanceName = await this.resolveInstance(doctorId);

        if (!instanceName) {
            throw new AppError('Nenhuma instância WhatsApp disponível', 503);
        }

        const formattedNumber = this.formatNumber(number);

        if (!formattedNumber) {
            throw new AppError('Número de telefone inválido', 400);
        }

        const baseUrl = this.serviceUrl.replace(/\/$/, '');
        const url = `${baseUrl}/chat/whatsappNumbers/${instanceName}`;

        try {
            console.log(`🔍 [WhatsappService] Verificando se ${formattedNumber} possui WhatsApp via "${instanceName}"...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
                },
                body: JSON.stringify({
                    numbers: [formattedNumber]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [WhatsappService] Erro ao verificar número:', response.status, errorText);
                throw new AppError(`Erro na Evolution API: ${response.statusText}`, response.status);
            }

            const data = await response.json() as any[];

            if (data && data.length > 0) {
                const result = data[0];
                console.log(`✅ [WhatsappService] Verificação: ${formattedNumber} ${result.exists ? 'TEM' : 'NÃO TEM'} WhatsApp`);
                return {
                    exists: result.exists === true,
                    jid: result.jid,
                    number: formattedNumber
                };
            }

            return { exists: false, number: formattedNumber };

        } catch (error) {
            console.error('❌ [WhatsappService] Erro ao verificar número:', error);
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError('Falha ao verificar número no WhatsApp', 502);
        }
    }

    /**
     * Formata o número para o padrão 55dddnumero
     */
    private formatNumber(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');

        if (!cleaned) return '';

        if (cleaned.length === 10 || cleaned.length === 11) {
            return `55${cleaned}`;
        }

        if ((cleaned.length === 12 || cleaned.length === 13) && cleaned.startsWith('55')) {
            return cleaned;
        }

        return cleaned;
    }
}

export const whatsappService = new WhatsappService();
