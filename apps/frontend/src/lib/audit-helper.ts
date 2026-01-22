/**
 * Helper para registrar logs de auditoria no frontend
 * Chama o serviço de auditoria do gateway via API
 * Também suporta inserção direta no Supabase para API routes
 */

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001';

interface AuditLogParams {
  user_id?: string;
  user_email?: string;
  user_role?: string;
  user_name?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'DOWNLOAD' | 'UPLOAD' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'PERMISSION_CHANGE' | 'SHARE' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'DATA_REQUEST' | 'DATA_PORTABILITY' | 'DATA_ERASURE' | 'ANONYMIZATION' | 'ACCESS_DENIED' | 'BULK_OPERATION' | 'SYSTEM_ACTION';
  resource_type: string;
  resource_id?: string;
  resource_description?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  request_id?: string;
  endpoint?: string;
  http_method?: string;
  data_category?: 'pessoal' | 'sensivel' | 'anonimizado';
  legal_basis?: string;
  purpose?: string;
  data_fields_accessed?: string[];
  contains_sensitive_data?: boolean;
  data_before?: Record<string, any>;
  data_after?: Record<string, any>;
  changes_summary?: string;
  success?: boolean;
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  related_patient_id?: string;
  related_consultation_id?: string;
  related_session_id?: string;
  table_ref?: string;  // Formato: tabela.coluna (ex: a_sintese_analitica.sintese)
}

/**
 * Registra um log de auditoria (não bloqueia a execução)
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    // Aguardar a resposta para garantir que foi enviado
    const response = await fetch(`${GATEWAY_URL}/api/audit/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.success) {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      console.warn(`⚠️ [AUDIT] Erro ao registrar log (status ${response.status}):`, errorText);
    } else {
      console.log('✅ [AUDIT] Log registrado com sucesso');
    }
  } catch (error) {
    // Falha silenciosa - não quebrar o fluxo principal
    console.warn('⚠️ [AUDIT] Exceção ao registrar log (não crítico):', error);
  }
}

/**
 * Extrai informações do request para auditoria
 */
export function getAuditContext(request?: Request): {
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
} {
  if (!request) {
    return {};
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;
  const url = new URL(request.url);
  const endpoint = url.pathname + url.search;

  return {
    ip_address: ip,
    user_agent: userAgent,
    endpoint,
  };
}

/**
 * Sanitiza dados sensíveis antes de logar
 */
export function sanitizeData(data: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'senha', 'token', 'secret', 'api_key', 'apikey'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(sf => lowerKey.includes(sf))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Registra um log de auditoria diretamente no Supabase (para uso em API routes)
 * Esta função deve ser usada quando já temos acesso ao cliente Supabase no servidor
 */
export async function logAuditDirect(
  supabase: any,
  params: AuditLogParams
): Promise<void> {
  if (!supabase || !supabase.from) {
    throw new Error('Cliente Supabase inválido ou não fornecido');
  }

  const auditData: any = {
    user_id: params.user_id || null,
    user_email: params.user_email || null,
    user_role: params.user_role || null,
    user_name: params.user_name || null,
    resource_type: params.resource_type,
    resource_id: params.resource_id || null,
    resource_description: params.resource_description || null,
    action: params.action,
    ip_address: params.ip_address || null,
    user_agent: params.user_agent || null,
    session_id: params.session_id || null,
    request_id: params.request_id || null,
    endpoint: params.endpoint || null,
    http_method: params.http_method || null,
    data_category: params.data_category || null,
    legal_basis: params.legal_basis || null,
    purpose: params.purpose || null,
    data_fields_accessed: params.data_fields_accessed || null,
    contains_sensitive_data: params.contains_sensitive_data ?? false,
    data_before: params.data_before || null,
    data_after: params.data_after || null,
    changes_summary: params.changes_summary || null,
    success: params.success ?? true,
    error_code: params.error_code || null,
    error_message: params.error_message || null,
    metadata: params.metadata || {},
    related_patient_id: params.related_patient_id || null,
    related_consultation_id: params.related_consultation_id || null,
    related_session_id: params.related_session_id || null,
    table_ref: params.table_ref || null,
  };

  const { error } = await supabase
    .from('audit_logs')
    .insert(auditData)
    .select();

  if (error) {
    throw error;
  }
}
