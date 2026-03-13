/**
 * Helper para registrar auditoria em atualizações de campos de tabelas específicas
 * (a_*, d_*, s_*)
 */

import { logAudit, getAuditContext, sanitizeData } from './audit-helper';
import { NextRequest } from 'next/server';

interface AuditTableFieldParams {
  request: NextRequest;
  user_id: string;
  user_email: string;
  user_name?: string;
  consultaId: string;
  consultation?: { patient_id?: string; patient_name?: string } | null;
  tableName: string;  // Nome real da tabela (ex: a_sintese_analitica)
  fieldName: string;  // Nome do campo (ex: sintese)
  fieldPath: string;  // Caminho completo (ex: a_sintese_analitica.sintese)
  existingRecord: any;
  updatedRecord: any;
  wasCreated: boolean;
  resourceType: 'anamnese' | 'diagnostico' | 'solucao';
}

/**
 * Registra auditoria para atualização de campo em tabelas específicas
 */
export async function auditTableField(params: AuditTableFieldParams): Promise<void> {
  const {
    request,
    user_id,
    user_email,
    user_name,
    consultaId,
    consultation,
    tableName,
    fieldName,
    fieldPath,
    existingRecord,
    updatedRecord,
    wasCreated,
    resourceType
  } = params;

  const auditContext = getAuditContext(request);
  const dataBefore = existingRecord ? sanitizeData(existingRecord) : undefined;
  const dataAfter = updatedRecord ? sanitizeData(updatedRecord) : undefined;
  const tableRef = `${tableName}.${fieldName}`;

  await logAudit({
    user_id,
    user_email,
    user_name,
    user_role: 'medico',
    action: wasCreated ? 'CREATE' : 'UPDATE',
    resource_type: resourceType,
    resource_id: consultaId,
    resource_description: `${resourceType} - ${consultation?.patient_name || 'Paciente'}`,
    related_patient_id: consultation?.patient_id,
    related_consultation_id: consultaId,
    ...auditContext,
    http_method: 'POST',
    data_category: 'sensivel',
    legal_basis: 'tutela_saude',
    purpose: `Atualização de dados de ${resourceType}`,
    contains_sensitive_data: true,
    data_before: dataBefore,
    data_after: dataAfter,
    data_fields_accessed: [fieldPath],
    changes_summary: `${wasCreated ? 'Criado' : 'Atualizado'} campo ${fieldName} na tabela ${tableName}`,
    table_ref: tableRef,
    metadata: {
      table: tableName,
      field_path: fieldPath,
      field_name: fieldName,
      was_created: wasCreated
    }
  });
}
