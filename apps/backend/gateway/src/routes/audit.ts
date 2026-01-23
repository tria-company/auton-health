/**
 * =====================================================
 * MEDCALL AI - ROTAS DE AUDITORIA LGPD
 * =====================================================
 * Endpoints para consulta de logs de auditoria,
 * solicitações LGPD e gestão de consentimentos.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import auditService from '../services/auditService';

const router = Router();

// =====================================================
// ROTA PARA RECEBER LOGS DO FRONTEND
// =====================================================

/**
 * POST /api/audit/log
 * Recebe logs de auditoria do frontend
 */
router.post('/log', async (req: Request, res: Response) => {
  try {
    const entry = req.body;
    
    // Registrar log usando o serviço
    const logId = await auditService.log(entry);
    
    if (!logId) {
      return res.status(500).json({ error: 'Erro ao registrar log' });
    }
    
    res.status(201).json({ 
      success: true, 
      log_id: logId 
    });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção ao registrar log:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =====================================================
// ROTAS DE LOGS DE AUDITORIA
// =====================================================

/**
 * GET /api/audit/logs
 * Lista logs de auditoria com filtros
 * Requer: Admin
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    // Verificar se usuário é admin
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin, name, email')
      .eq('user_auth', user.id)
      .single();

    if (!medico?.admin) {
      // Registrar tentativa de acesso não autorizado
      await auditService.logAccessDenied({
        user_id: user.id,
        user_email: user.email,
        resource_type: 'audit_logs',
        endpoint: '/api/audit/logs',
        ip_address: auditService.getClientIp(req),
        user_agent: auditService.getUserAgent(req),
        error_message: 'Usuário não é admin'
      });
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar logs de auditoria.' });
    }

    // Parâmetros de filtro
    const {
      user_id,
      action,
      resource_type,
      start_date,
      end_date,
      patient_id,
      success,
      contains_sensitive_data,
      limit = '100',
      offset = '0'
    } = req.query;

    // Construir query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Aplicar filtros
    if (user_id) query = query.eq('user_id', user_id);
    if (action) query = query.eq('action', action);
    if (resource_type) query = query.eq('resource_type', resource_type);
    if (patient_id) query = query.eq('related_patient_id', patient_id);
    if (success !== undefined) query = query.eq('success', success === 'true');
    if (contains_sensitive_data !== undefined) {
      query = query.eq('contains_sensitive_data', contains_sensitive_data === 'true');
    }
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('❌ [AUDIT ROUTE] Erro ao buscar logs:', error);
      return res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }

    // Registrar acesso aos logs
    await auditService.logRead({
      user_id: user.id,
      user_email: user.email,
      user_name: medico?.name,
      user_role: 'admin',
      resource_type: 'audit_logs',
      endpoint: '/api/audit/logs',
      ip_address: auditService.getClientIp(req),
      user_agent: auditService.getUserAgent(req),
      purpose: 'Consulta de logs de auditoria',
      metadata: { filters: req.query }
    });

    res.json({
      data: logs,
      pagination: {
        total: count,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/audit/logs/user/:userId
 * Lista logs de um usuário específico
 * Requer: Admin ou próprio usuário
 */
router.get('/logs/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é o próprio usuário ou admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin, name, email, user_auth')
      .eq('user_auth', user.id)
      .single();

    const isOwnUser = user.id === userId;
    const isAdmin = medico?.admin === true;

    if (!isOwnUser && !isAdmin) {
      await auditService.logAccessDenied({
        user_id: user.id,
        user_email: user.email,
        resource_type: 'audit_logs',
        resource_id: userId,
        endpoint: `/api/audit/logs/user/${userId}`,
        ip_address: auditService.getClientIp(req),
        user_agent: auditService.getUserAgent(req),
        error_message: 'Tentativa de acessar logs de outro usuário'
      });
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { limit = '50', offset = '0', start_date, end_date } = req.query;

    const logs = await auditService.getUserLogs(userId, {
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json({ data: logs });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/audit/logs/patient/:patientId
 * Lista todos os acessos aos dados de um paciente
 * Requer: Admin ou médico responsável
 */
router.get('/logs/patient/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar permissão (admin ou médico do paciente)
    const { data: medico } = await supabase
      .from('medicos')
      .select('id, admin, name, email')
      .eq('user_auth', user.id)
      .single();

    // Verificar se o paciente pertence ao médico
    const { data: patient } = await supabase
      .from('patients')
      .select('doctor_id')
      .eq('id', patientId)
      .single();

    const isAdmin = medico?.admin === true;
    const isPatientDoctor = patient?.doctor_id === medico?.id;

    if (!isAdmin && !isPatientDoctor) {
      await auditService.logAccessDenied({
        user_id: user.id,
        user_email: user.email,
        resource_type: 'audit_logs',
        related_patient_id: patientId,
        endpoint: `/api/audit/logs/patient/${patientId}`,
        ip_address: auditService.getClientIp(req),
        user_agent: auditService.getUserAgent(req),
        error_message: 'Não é médico do paciente nem admin'
      });
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { start_date, end_date } = req.query;

    const logs = await auditService.getPatientDataAccessLogs(patientId, {
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined
    });

    // Registrar acesso
    await auditService.logRead({
      user_id: user.id,
      user_email: user.email,
      user_name: medico?.name,
      user_role: isAdmin ? 'admin' : 'medico',
      resource_type: 'audit_logs',
      related_patient_id: patientId,
      endpoint: `/api/audit/logs/patient/${patientId}`,
      ip_address: auditService.getClientIp(req),
      user_agent: auditService.getUserAgent(req),
      purpose: 'Consulta de acessos a dados do paciente',
      contains_sensitive_data: true
    });

    res.json({ data: logs });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =====================================================
// ROTAS DE SOLICITAÇÕES LGPD
// =====================================================

/**
 * POST /api/audit/lgpd/request
 * Cria uma nova solicitação LGPD
 */
router.post('/lgpd/request', async (req: Request, res: Response) => {
  try {
    const { request_type, description, scope } = req.body;

    if (!request_type) {
      return res.status(400).json({ error: 'Tipo de solicitação é obrigatório' });
    }

    const authHeader = req.headers.authorization;
    let requester_user_id: string | undefined;
    let requester_email: string;
    let requester_name: string | undefined;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        requester_user_id = user.id;
        requester_email = user.email || req.body.email;
        
        const { data: medico } = await supabase
          .from('medicos')
          .select('name')
          .eq('user_auth', user.id)
          .single();
        
        requester_name = medico?.name;
      } else {
        requester_email = req.body.email;
        requester_name = req.body.name;
      }
    } else {
      requester_email = req.body.email;
      requester_name = req.body.name;
    }

    if (!requester_email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const requestId = await auditService.createLgpdRequest({
      requester_user_id,
      requester_email,
      requester_name,
      requester_cpf: req.body.cpf,
      request_type,
      description,
      scope
    });

    if (!requestId) {
      return res.status(500).json({ error: 'Erro ao criar solicitação' });
    }

    res.status(201).json({
      message: 'Solicitação LGPD criada com sucesso',
      request_id: requestId,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() // 15 dias
    });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/audit/lgpd/requests
 * Lista solicitações LGPD (admin vê todas, usuário vê as próprias)
 */
router.get('/lgpd/requests', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .single();

    const isAdmin = medico?.admin === true;

    let query = supabase
      .from('lgpd_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Se não for admin, filtrar apenas as próprias solicitações
    if (!isAdmin) {
      query = query.eq('requester_user_id', user.id);
    }

    const { status } = req.query;
    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('❌ [AUDIT ROUTE] Erro ao buscar solicitações:', error);
      return res.status(500).json({ error: 'Erro ao buscar solicitações' });
    }

    res.json({ data: requests });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PATCH /api/audit/lgpd/requests/:requestId
 * Atualiza status de uma solicitação LGPD
 * Requer: Admin
 */
router.patch('/lgpd/requests/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status, response, rejection_reason } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .single();

    if (!medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (status) {
      updateData.status = status;
      if (status === 'completed' || status === 'rejected') {
        updateData.processed_at = new Date().toISOString();
        updateData.processed_by = user.id;
      }
    }
    if (response) updateData.response = response;
    if (rejection_reason) updateData.rejection_reason = rejection_reason;

    const { error } = await supabase
      .from('lgpd_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('❌ [AUDIT ROUTE] Erro ao atualizar solicitação:', error);
      return res.status(500).json({ error: 'Erro ao atualizar solicitação' });
    }

    res.json({ message: 'Solicitação atualizada com sucesso' });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =====================================================
// ROTAS DE RELATÓRIOS LGPD
// =====================================================

/**
 * GET /api/audit/lgpd/report/:patientId
 * Gera relatório LGPD de um paciente
 */
router.get('/lgpd/report/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar permissão
    const { data: medico } = await supabase
      .from('medicos')
      .select('id, admin, name, email')
      .eq('user_auth', user.id)
      .single();

    const { data: patient } = await supabase
      .from('patients')
      .select('doctor_id')
      .eq('id', patientId)
      .single();

    const isAdmin = medico?.admin === true;
    const isPatientDoctor = patient?.doctor_id === medico?.id;

    if (!isAdmin && !isPatientDoctor) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const report = await auditService.generateLgpdReport(patientId);

    if (!report) {
      return res.status(500).json({ error: 'Erro ao gerar relatório' });
    }

    // Registrar geração do relatório
    await auditService.logExport({
      user_id: user.id,
      user_email: user.email || '',
      user_name: medico?.name,
      user_role: isAdmin ? 'admin' : 'medico',
      resource_type: 'reports',
      resource_id: patientId,
      ip_address: auditService.getClientIp(req),
      user_agent: auditService.getUserAgent(req),
      related_patient_id: patientId,
      purpose: 'Geração de relatório LGPD'
    });

    res.json(report);
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =====================================================
// ROTAS DE CONSENTIMENTOS
// =====================================================

/**
 * POST /api/audit/consent
 * Registra um consentimento
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const {
      consent_type,
      granted,
      purpose,
      data_categories,
      third_parties,
      retention_period
    } = req.body;

    if (!consent_type || granted === undefined || !purpose) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: consent_type, granted, purpose' 
      });
    }

    const authHeader = req.headers.authorization;
    let user_id: string | undefined;
    let email: string | undefined;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        user_id = user.id;
        email = user.email;
      }
    }

    const consentId = await auditService.recordConsent({
      user_id,
      patient_id: req.body.patient_id,
      email: email || req.body.email,
      cpf: req.body.cpf,
      consent_type,
      consent_version: req.body.consent_version,
      granted,
      purpose,
      legal_basis: req.body.legal_basis,
      data_categories,
      third_parties,
      retention_period,
      collection_method: req.body.collection_method || 'api',
      ip_address: auditService.getClientIp(req),
      user_agent: auditService.getUserAgent(req)
    });

    if (!consentId) {
      return res.status(500).json({ error: 'Erro ao registrar consentimento' });
    }

    res.status(201).json({
      message: granted ? 'Consentimento registrado' : 'Consentimento revogado',
      consent_id: consentId
    });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/audit/consents
 * Lista consentimentos do usuário autenticado
 */
router.get('/consents', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const { data: consents, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [AUDIT ROUTE] Erro ao buscar consentimentos:', error);
      return res.status(500).json({ error: 'Erro ao buscar consentimentos' });
    }

    res.json({ data: consents });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// =====================================================
// ESTATÍSTICAS DE AUDITORIA
// =====================================================

/**
 * GET /api/audit/stats
 * Retorna estatísticas de auditoria (Admin only)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se é admin
    const { data: medico } = await supabase
      .from('medicos')
      .select('admin')
      .eq('user_auth', user.id)
      .single();

    if (!medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar estatísticas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const [
      totalLogs,
      todayLogs,
      sensitiveAccess,
      failedLogins,
      lgpdRequests
    ] = await Promise.all([
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('contains_sensitive_data', true),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'LOGIN_FAILED'),
      supabase.from('lgpd_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    res.json({
      total_logs: totalLogs.count || 0,
      logs_today: todayLogs.count || 0,
      sensitive_data_access: sensitiveAccess.count || 0,
      failed_login_attempts: failedLogins.count || 0,
      pending_lgpd_requests: lgpdRequests.count || 0,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AUDIT ROUTE] Exceção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
