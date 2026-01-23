import { Request } from 'express';
import { createClient } from '@supabase/supabase-js';

/**
 * Audit Service - Registra logs de auditoria para conformidade LGPD
 */

interface AuditLogEntry {
    user_id: string;
    user_email?: string;
    user_name?: string;
    user_role?: string;
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'ACCESS';
    resource_type: string;
    resource_id?: string;
    resource_description?: string;
    related_patient_id?: string;
    related_consultation_id?: string;
    related_session_id?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    http_method?: string;
    data_category?: 'identificacao' | 'sensivel' | 'anonimizado';
    legal_basis?: 'consentimento' | 'contrato' | 'obrigacao_legal' | 'tutela_saude' | 'interesse_legitimo';
    purpose?: string;
    contains_sensitive_data?: boolean;
    data_before?: Record<string, any>;
    data_after?: Record<string, any>;
    metadata?: Record<string, any>;
}

class AuditService {
    private supabase: any;
    private enabled: boolean = true;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } else {
            console.warn('[AuditService] Supabase não configurado, logs de auditoria desabilitados');
            this.enabled = false;
        }
    }

    /**
     * Registra um log de auditoria
     */
    async log(entry: AuditLogEntry): Promise<void> {
        if (!this.enabled || !this.supabase) {
            console.log('[AuditService] Log (disabled):', entry.action, entry.resource_type);
            return;
        }

        try {
            const { error } = await this.supabase
                .from('audit_logs')
                .insert({
                    ...entry,
                    created_at: new Date().toISOString()
                });

            if (error) {
                // Apenas logar, não falhar a operação principal
                console.error('[AuditService] Erro ao registrar log:', error.message);
            }
        } catch (err) {
            // Silenciosamente falhar - auditoria não deve bloquear operações
            console.error('[AuditService] Exceção:', err);
        }
    }

    /**
     * Extrai o IP do cliente da requisição
     */
    getClientIp(req: Request): string {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || 'unknown';
    }

    /**
     * Extrai o User-Agent da requisição
     */
    getUserAgent(req: Request): string {
        return req.headers['user-agent'] || 'unknown';
    }
}

const auditService = new AuditService();
export default auditService;
