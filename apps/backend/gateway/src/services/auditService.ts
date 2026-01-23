/**
 * =====================================================
 * MEDCALL AI - SERVIÇO DE AUDITORIA LGPD
 * =====================================================
 * Serviço para registrar logs de auditoria e atender
 * requisitos de compliance LGPD.
 * 
 * Funcionalidades:
 * - Registro de logs de acesso a dados
 * - Registro de modificações (CREATE, UPDATE, DELETE)
 * - Rastreamento de dados sensíveis (saúde)
 * - Relatórios para solicitações LGPD
 */

import { supabase } from '../config/database';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

/**
 * Tipos de ação para auditoria
 */
export type AuditAction = 
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'DOWNLOAD'
  | 'UPLOAD'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PERMISSION_CHANGE'
  | 'SHARE'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'DATA_REQUEST'
  | 'DATA_PORTABILITY'
  | 'DATA_ERASURE'
  | 'ANONYMIZATION'
  | 'ACCESS_DENIED'
  | 'BULK_OPERATION'
  | 'SYSTEM_ACTION';

/**
 * Tipos de recurso que podem ser auditados
 */
export type AuditResourceType = 
  | 'patients'
  | 'consultations'
  | 'transcriptions'
  | 'anamnese'
  | 'documents'
  | 'call_sessions'
  | 'suggestions'
  | 'medicos'
  | 'prescriptions'
  | 'exams'
  | 'reports'
  | 'auth'
  | 'system';

/**
 * Categoria de dados para LGPD
 */
export type DataCategory = 'pessoal' | 'sensivel' | 'anonimizado';

/**
 * Base legal para tratamento de dados
 */
export type LegalBasis = 
  | 'consentimento'
  | 'contrato'
  | 'obrigacao_legal'
  | 'interesse_legitimo'
  | 'protecao_vida'
  | 'tutela_saude'
  | 'execucao_politicas_publicas';

/**
 * Interface para log de auditoria
 */
export interface AuditLogEntry {
  // Quem
  user_id?: string;
  user_email?: string;
  user_role?: string;
  user_name?: string;
  
  // O quê
  action: AuditAction;
  resource_type: AuditResourceType | string;
  resource_id?: string;
  resource_description?: string;
  
  // Contexto
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  request_id?: string;
  endpoint?: string;
  http_method?: string;
  
  // LGPD
  data_category?: DataCategory;
  legal_basis?: LegalBasis;
  purpose?: string;
  data_fields_accessed?: string[];
  contains_sensitive_data?: boolean;
  
  // Modificações
  data_before?: Record<string, any>;
  data_after?: Record<string, any>;
  changes_summary?: string;
  
  // Referência de tabela.coluna
  table_ref?: string;  // Formato: tabela.coluna (ex: a_sintese_analitica.sintese)
  
  // Resultado
  success?: boolean;
  error_code?: string;
  error_message?: string;
  
  // Metadados
  metadata?: Record<string, any>;
  
  // Relacionamentos
  related_patient_id?: string;
  related_consultation_id?: string;
  related_session_id?: string;
}

/**
 * Interface para solicitação LGPD
 */
export interface LgpdRequest {
  requester_user_id?: string;
  requester_email: string;
  requester_name?: string;
  requester_cpf?: string;
  request_type: 'ACCESS' | 'CORRECTION' | 'DELETION' | 'PORTABILITY' | 'REVOKE_CONSENT' | 'OBJECTION' | 'INFORMATION';
  description?: string;
  scope?: string[];
}

/**
 * Interface para registro de consentimento
 */
export interface ConsentRecord {
  user_id?: string;
  patient_id?: string;
  email?: string;
  cpf?: string;
  consent_type: string;
  consent_version?: string;
  granted: boolean;
  purpose: string;
  legal_basis?: LegalBasis;
  data_categories?: string[];
  third_parties?: string[];
  retention_period?: string;
  collection_method?: 'web_form' | 'mobile_app' | 'verbal' | 'written' | 'electronic_signature' | 'api';
  ip_address?: string;
  user_agent?: string;
}

// =====================================================
// SERVIÇO DE AUDITORIA
// =====================================================

export const auditService = {
  /**
   * Registra um log de auditoria
   */
  async log(entry: AuditLogEntry): Promise<string | null> {
    try {
      // Determinar automaticamente se contém dados sensíveis
      if (entry.contains_sensitive_data === undefined) {
        entry.contains_sensitive_data = this.isSensitiveResource(entry.resource_type);
      }

      // Definir categoria padrão para recursos de saúde
      if (!entry.data_category && entry.contains_sensitive_data) {
        entry.data_category = 'sensivel';
      }

      // Definir base legal padrão para dados de saúde
      if (!entry.legal_basis && entry.contains_sensitive_data) {
        entry.legal_basis = 'tutela_saude';
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: entry.user_id,
          user_email: entry.user_email,
          user_role: entry.user_role,
          user_name: entry.user_name,
          action: entry.action,
          resource_type: entry.resource_type,
          resource_id: entry.resource_id,
          resource_description: entry.resource_description,
          ip_address: entry.ip_address,
          user_agent: entry.user_agent,
          session_id: entry.session_id,
          request_id: entry.request_id,
          endpoint: entry.endpoint,
          http_method: entry.http_method,
          data_category: entry.data_category,
          legal_basis: entry.legal_basis,
          purpose: entry.purpose,
          data_fields_accessed: entry.data_fields_accessed,
          contains_sensitive_data: entry.contains_sensitive_data,
          data_before: entry.data_before,
          data_after: entry.data_after,
          changes_summary: entry.changes_summary,
          table_ref: entry.table_ref,
          success: entry.success ?? true,
          error_code: entry.error_code,
          error_message: entry.error_message,
          metadata: entry.metadata,
          related_patient_id: entry.related_patient_id,
          related_consultation_id: entry.related_consultation_id,
          related_session_id: entry.related_session_id,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [AUDIT] Erro ao registrar log:', error.message);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao registrar log:', error);
      return null;
    }
  },

  /**
   * Registra acesso a dados (READ)
   */
  async logRead(params: {
    user_id?: string;
    user_email?: string;
    user_role?: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    data_fields_accessed?: string[];
    related_patient_id?: string;
    related_consultation_id?: string;
    purpose?: string;
    metadata?: Record<string, any>;
    contains_sensitive_data?: boolean;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'READ',
      http_method: 'GET',
      success: true
    });
  },

  /**
   * Registra criação de dados (CREATE)
   */
  async logCreate(params: {
    user_id?: string;
    user_email?: string;
    user_role?: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    data_after?: Record<string, any>;
    related_patient_id?: string;
    related_consultation_id?: string;
    purpose?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'CREATE',
      http_method: 'POST',
      success: true,
      changes_summary: `Registro criado: ${params.resource_type}`
    });
  },

  /**
   * Registra atualização de dados (UPDATE)
   */
  async logUpdate(params: {
    user_id?: string;
    user_email?: string;
    user_role?: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    data_before?: Record<string, any>;
    data_after?: Record<string, any>;
    changes_summary?: string;
    related_patient_id?: string;
    related_consultation_id?: string;
    purpose?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    // Gerar resumo das alterações automaticamente se não fornecido
    let summary = params.changes_summary;
    if (!summary && params.data_before && params.data_after) {
      const changedFields = this.getChangedFields(params.data_before, params.data_after);
      summary = `Campos alterados: ${changedFields.join(', ')}`;
    }

    return this.log({
      ...params,
      action: 'UPDATE',
      http_method: 'PUT',
      success: true,
      changes_summary: summary
    });
  },

  /**
   * Registra exclusão de dados (DELETE)
   */
  async logDelete(params: {
    user_id?: string;
    user_email?: string;
    user_role?: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    data_before?: Record<string, any>;
    related_patient_id?: string;
    related_consultation_id?: string;
    purpose?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'DELETE',
      http_method: 'DELETE',
      success: true,
      changes_summary: `Registro excluído: ${params.resource_type} (${params.resource_id})`
    });
  },

  /**
   * Registra login bem sucedido
   */
  async logLogin(params: {
    user_id: string;
    user_email: string;
    user_name?: string;
    user_role?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'LOGIN',
      resource_type: 'auth',
      success: true,
      purpose: 'Autenticação no sistema'
    });
  },

  /**
   * Registra tentativa de login falha
   */
  async logLoginFailed(params: {
    user_email: string;
    ip_address?: string;
    user_agent?: string;
    error_message?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'LOGIN_FAILED',
      resource_type: 'auth',
      success: false,
      purpose: 'Tentativa de autenticação'
    });
  },

  /**
   * Registra logout
   */
  async logLogout(params: {
    user_id: string;
    user_email: string;
    user_name?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'LOGOUT',
      resource_type: 'auth',
      success: true,
      purpose: 'Encerramento de sessão'
    });
  },

  /**
   * Registra acesso negado
   */
  async logAccessDenied(params: {
    user_id?: string;
    user_email?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    ip_address?: string;
    user_agent?: string;
    endpoint?: string;
    error_message?: string;
    metadata?: Record<string, any>;
    related_patient_id?: string;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'ACCESS_DENIED',
      success: false,
      error_code: 'FORBIDDEN'
    });
  },

  /**
   * Registra exportação de dados
   */
  async logExport(params: {
    user_id: string;
    user_email: string;
    user_name?: string;
    user_role?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    ip_address?: string;
    user_agent?: string;
    related_patient_id?: string;
    purpose?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'EXPORT',
      success: true,
      contains_sensitive_data: true
    });
  },

  /**
   * Registra download de arquivo
   */
  async logDownload(params: {
    user_id: string;
    user_email: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    related_patient_id?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'DOWNLOAD',
      success: true
    });
  },

  /**
   * Registra upload de arquivo
   */
  async logUpload(params: {
    user_id: string;
    user_email: string;
    user_name?: string;
    resource_type: AuditResourceType | string;
    resource_id?: string;
    resource_description?: string;
    ip_address?: string;
    user_agent?: string;
    related_patient_id?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return this.log({
      ...params,
      action: 'UPLOAD',
      success: true
    });
  },

  // =====================================================
  // FUNÇÕES LGPD
  // =====================================================

  /**
   * Cria uma solicitação LGPD
   */
  async createLgpdRequest(request: LgpdRequest): Promise<string | null> {
    try {
      // Calcular prazo legal (15 dias)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 15);

      const { data, error } = await supabase
        .from('lgpd_requests')
        .insert({
          ...request,
          status: 'pending',
          deadline_at: deadline.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [AUDIT] Erro ao criar solicitação LGPD:', error.message);
        return null;
      }

      // Registrar no log de auditoria
      await this.log({
        user_email: request.requester_email,
        action: 'DATA_REQUEST',
        resource_type: 'system',
        resource_id: data?.id,
        resource_description: `Solicitação LGPD: ${request.request_type}`,
        success: true,
        purpose: request.description
      });

      return data?.id || null;
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao criar solicitação LGPD:', error);
      return null;
    }
  },

  /**
   * Registra consentimento
   */
  async recordConsent(consent: ConsentRecord): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('consent_records')
        .insert({
          ...consent,
          granted_at: consent.granted ? new Date().toISOString() : null,
          revoked_at: !consent.granted ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ [AUDIT] Erro ao registrar consentimento:', error.message);
        return null;
      }

      // Registrar no log de auditoria
      await this.log({
        user_id: consent.user_id,
        user_email: consent.email,
        action: consent.granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        resource_type: 'system',
        resource_id: data?.id,
        resource_description: `Consentimento: ${consent.consent_type}`,
        ip_address: consent.ip_address,
        user_agent: consent.user_agent,
        success: true,
        purpose: consent.purpose,
        legal_basis: consent.legal_basis,
        related_patient_id: consent.patient_id
      });

      return data?.id || null;
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao registrar consentimento:', error);
      return null;
    }
  },

  /**
   * Busca logs de um usuário
   */
  async getUserLogs(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      action?: AuditAction;
      resourceType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }
      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }
      if (options?.action) {
        query = query.eq('action', options.action);
      }
      if (options?.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [AUDIT] Erro ao buscar logs do usuário:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao buscar logs do usuário:', error);
      return [];
    }
  },

  /**
   * Busca logs de acesso a dados de um paciente (para LGPD)
   */
  async getPatientDataAccessLogs(
    patientId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('related_patient_id', patientId)
        .order('created_at', { ascending: false });

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }
      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [AUDIT] Erro ao buscar logs do paciente:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao buscar logs do paciente:', error);
      return [];
    }
  },

  /**
   * Gera relatório LGPD para um paciente
   */
  async generateLgpdReport(patientId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .rpc('generate_lgpd_access_report', { p_patient_id: patientId });

      if (error) {
        console.error('❌ [AUDIT] Erro ao gerar relatório LGPD:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ [AUDIT] Exceção ao gerar relatório LGPD:', error);
      return null;
    }
  },

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  /**
   * Verifica se um tipo de recurso contém dados sensíveis
   */
  isSensitiveResource(resourceType: string): boolean {
    const sensitiveResources = [
      'patients',
      'consultations',
      'transcriptions',
      'anamnese',
      'documents',
      'prescriptions',
      'exams',
      'reports'
    ];
    return sensitiveResources.includes(resourceType);
  },

  /**
   * Retorna os campos que foram alterados entre dois objetos
   */
  getChangedFields(before: Record<string, any>, after: Record<string, any>): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      // Ignorar campos de timestamp
      if (['updated_at', 'created_at'].includes(key)) continue;
      
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedFields.push(key);
      }
    }
    
    return changedFields;
  },

  /**
   * Sanitiza dados sensíveis para não armazenar em logs
   * (ex: senhas, tokens)
   */
  sanitizeData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'senha', 'token', 'secret', 'api_key', 'apikey'];
    const sanitized = { ...data };
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(sf => lowerKey.includes(sf))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  },

  /**
   * Extrai IP do request (considerando proxies)
   */
  getClientIp(req: any): string | undefined {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress;
  },

  /**
   * Extrai User-Agent do request
   */
  getUserAgent(req: any): string | undefined {
    return req.headers?.['user-agent'];
  }
};

// =====================================================
// MIDDLEWARE DE AUDITORIA
// =====================================================

/**
 * Middleware Express para auditoria automática de requisições
 */
export function auditMiddleware(options?: {
  excludePaths?: string[];
  excludeMethods?: string[];
}) {
  const excludePaths = options?.excludePaths || ['/health', '/ping', '/metrics'];
  const excludeMethods = options?.excludeMethods || ['OPTIONS'];

  return async (req: any, res: any, next: any) => {
    // Ignorar paths e métodos excluídos
    if (excludePaths.some(p => req.path.startsWith(p))) {
      return next();
    }
    if (excludeMethods.includes(req.method)) {
      return next();
    }

    // Capturar informações do request
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Adicionar request_id ao request para uso posterior
    req.requestId = requestId;

    // Interceptar resposta para logar resultado
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;

      // Log assíncrono para não bloquear resposta
      setImmediate(async () => {
        try {
          // Extrair informações do usuário (se autenticado)
          const user = req.user || {};
          
          await auditService.log({
            user_id: user.id,
            user_email: user.email,
            user_role: user.role,
            user_name: user.name,
            action: mapHttpMethodToAction(req.method),
            resource_type: extractResourceType(req.path),
            resource_id: extractResourceId(req.path),
            ip_address: auditService.getClientIp(req),
            user_agent: auditService.getUserAgent(req),
            request_id: requestId,
            endpoint: req.path,
            http_method: req.method,
            success,
            error_code: success ? undefined : String(res.statusCode),
            metadata: {
              duration_ms: duration,
              status_code: res.statusCode
            }
          });
        } catch (error) {
          console.error('❌ [AUDIT MIDDLEWARE] Erro ao registrar log:', error);
        }
      });

      return originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * Mapeia método HTTP para ação de auditoria
 */
function mapHttpMethodToAction(method: string): AuditAction {
  const mapping: Record<string, AuditAction> = {
    'GET': 'READ',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };
  return mapping[method] || 'SYSTEM_ACTION';
}

/**
 * Extrai tipo de recurso do path
 */
function extractResourceType(path: string): string {
  const parts = path.split('/').filter(Boolean);
  // Ignorar prefixos de API (ex: /api/v1/)
  const resourceIndex = parts.findIndex(p => !['api', 'v1', 'v2'].includes(p));
  return parts[resourceIndex] || 'system';
}

/**
 * Extrai ID do recurso do path (se existir)
 */
function extractResourceId(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean);
  // Procurar por UUID no path
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return parts.find(p => uuidRegex.test(p));
}

export default auditService;
