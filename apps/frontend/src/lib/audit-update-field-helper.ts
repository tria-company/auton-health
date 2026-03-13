/**
 * Helper para registrar auditoria em rotas de update-field
 */

import { logAudit, logAuditDirect, getAuditContext, sanitizeData } from './audit-helper';
import { NextRequest } from 'next/server';

interface AuditUpdateFieldParams {
  request: NextRequest;
  user_id: string;
  user_email: string;
  user_name?: string;
  consultaId: string;
  consultation?: { patient_id?: string; patient_name?: string } | null;
  resourceType: string;
  tableName: string;
  fieldPath: string;
  fieldName: string;
  existingRecord: any;
  updatedRecord: any;
  wasCreated: boolean;
  tableRef: string;  // Formato: tabela.coluna (ex: a_sintese_analitica.sintese)
  supabase?: any;  // Cliente Supabase opcional para inserção direta
}

/**
 * Registra auditoria para atualização de campo
 */
export async function auditUpdateField(params: AuditUpdateFieldParams): Promise<void> {
  const {
    request,
    user_id,
    user_email,
    user_name,
    consultaId,
    consultation,
    resourceType,
    tableName,
    fieldPath,
    fieldName,
    existingRecord,
    updatedRecord,
    wasCreated,
    tableRef,
    supabase
  } = params;

  const auditContext = getAuditContext(request);
  const dataBefore = existingRecord ? sanitizeData(existingRecord) : undefined;
  const dataAfter = updatedRecord ? sanitizeData(updatedRecord) : undefined;

  const auditParams = {
    user_id,
    user_email,
    user_name,
    user_role: 'medico' as const,
    action: wasCreated ? 'CREATE' as const : 'UPDATE' as const,
    resource_type: resourceType,
    resource_id: consultaId,
    resource_description: `${resourceType} - ${consultation?.patient_name || 'Paciente'}`,
    related_patient_id: consultation?.patient_id,
    related_consultation_id: consultaId,
    ...auditContext,
    http_method: 'PATCH' as const,
    data_category: 'sensivel' as const,
    legal_basis: 'tutela_saude',
    purpose: `Atualização de dados de ${resourceType}`,
    contains_sensitive_data: true,
    data_before: dataBefore,
    data_after: dataAfter,
    data_fields_accessed: [fieldPath],
    changes_summary: `${wasCreated ? 'Criado' : 'Atualizado'} campo ${fieldPath} na tabela ${tableName}`,
    table_ref: tableRef,
    metadata: {
      table: tableName,
      field_path: fieldPath,
      field_name: fieldName,
      was_created: wasCreated
    }
  };

  // Se temos acesso ao Supabase, inserir diretamente (mais confiável)
  if (supabase) {
    await logAuditDirect(supabase, auditParams);
  } else {
    // Caso contrário, usar o gateway via fetch
    await logAudit(auditParams);
  }
}
