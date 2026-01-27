import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { Resend } from 'resend';

/**
 * GET /patients
 * Lista todos os pacientes do médico autenticado
 */
export async function getPatients(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // Parâmetros de paginação e filtros
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const status = req.query.status as string || 'all';

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Construir query base
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('doctor_id', medico.id);

    // Aplicar filtro de status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Aplicar busca por nome, email ou CPF
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,cpf.ilike.%${search}%`);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Executar query
    const { data: patients, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar pacientes'
      });
    }

    // Calcular paginação
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      patients: patients || [],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Erro ao listar pacientes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /patients/:id
 * Busca um paciente específico
 */
export async function getPatientById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar paciente
    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    return res.json({
      success: true,
      patient
    });

  } catch (error) {
    console.error('Erro ao buscar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * PUT /patients/:id
 * Atualiza um paciente existente
 */
export async function updatePatient(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const patientData = req.body;

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingPatient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Atualizar paciente
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        ...patientData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar paciente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar paciente'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Erro ao atualizar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * DELETE /patients/:id
 * Remove um paciente
 */
export async function deletePatient(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingPatient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Deletar paciente
    const { error: deleteError } = await supabase
      .from('patients')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar paciente:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar paciente'
      });
    }

    return res.json({
      success: true,
      message: 'Paciente deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /cadastro-anamnese/:patientId
 * Busca dados do cadastro de anamnese do paciente (peso, altura, tipo sanguíneo, etc)
 */
export async function getCadastroAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('[getCadastroAnamnese] ========== INICIANDO ==========');
    console.log('[getCadastroAnamnese] patientId:', req.params.patientId);
    console.log('[getCadastroAnamnese] user:', req.user ? 'autenticado' : 'NÃO AUTENTICADO');
    
    const { patientId } = req.params;

    // Buscar cadastro de anamnese
    console.log('[getCadastroAnamnese] Fazendo query no Supabase...');
    const { data: cadastro, error } = await supabase
      .from('a_cadastro_anamnese')
      .select('*')
      .eq('paciente_id', patientId)  // ← CORRIGIDO: era 'patient_id'
      .maybeSingle();

    if (error) {
      console.error('[getCadastroAnamnese] ❌ ERRO Supabase:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do cadastro',
        details: error.message
      });
    }

    console.log('[getCadastroAnamnese] ✅ Query OK - cadastro:', cadastro ? 'encontrado' : 'não encontrado (null)');
    
    // Se não encontrou, retorna dados vazios (não é erro)
    return res.json({
      success: true,
      cadastro: cadastro || null
    });

  } catch (error: any) {
    console.error('[getCadastroAnamnese] ❌❌ ERRO CATCH:', error);
    console.error('[getCadastroAnamnese] Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

/**
 * POST /cadastro-anamnese/:patientId
 * Atualiza ou cria cadastro de anamnese do paciente
 */
export async function updateCadastroAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { patientId } = req.params;
    const cadastroData = req.body;

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('a_cadastro_anamnese')
      .select('id')
      .eq('paciente_id', patientId)  // ← CORRIGIDO
      .maybeSingle();

    let result;
    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from('a_cadastro_anamnese')
        .update({
          ...cadastroData,
          updated_at: new Date().toISOString()
        })
        .eq('paciente_id', patientId)  // ← CORRIGIDO
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Criar
      const { data, error } = await supabase
        .from('a_cadastro_anamnese')
        .insert({
          paciente_id: patientId,  // ← CORRIGIDO
          ...cadastroData
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return res.json({
      success: true,
      cadastro: result
    });

  } catch (error) {
    console.error('Erro ao atualizar cadastro de anamnese:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar cadastro'
    });
  }
}

/**
 * POST /patients/:id/sync-user
 * Cria ou atualiza usuário no sistema externo e sincroniza com paciente
 */
export async function syncPatientUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const { action } = req.body; // 'create', 'activate', 'deactivate'

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Verificar se email está presente (necessário para criar usuário)
    if (!patient.email) {
      return res.status(400).json({
        success: false,
        error: 'Email do paciente é obrigatório para criar usuário'
      });
    }

    let userAuthId: string | null = patient.user_auth || null;
    let userStatus: 'active' | 'inactive' = (patient.user_status as 'active' | 'inactive') || 'inactive';

    // Função para gerar senha temporária segura
    const generateTemporaryPassword = (): string => {
      const length = 12;
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%&*';
      const allChars = uppercase + lowercase + numbers + special;
      
      let password = '';
      // Garantir pelo menos um de cada tipo
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];
      
      // Preencher o resto
      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }
      
      // Embaralhar
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    // Criar ou atualizar usuário no banco de dados (Supabase Auth)
    let generatedPassword: string | null = null;
    
    if (!userAuthId || action === 'create') {
      // Gerar senha temporária segura
      generatedPassword = generateTemporaryPassword();
      
      // Criar novo usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: patient.email!,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          name: patient.name,
          phone: patient.phone,
          cpf: patient.cpf,
          patient_id: patient.id,
          role: 'patient',
          temporary_password: true // Marcar como senha temporária
        }
      });

      if (authError || !authData.user) {
        console.error('Erro ao criar usuário no Supabase Auth:', authError);
        return res.status(500).json({
          success: false,
          error: authError?.message || 'Erro ao criar usuário no banco de dados'
        });
      }

      userAuthId = authData.user.id;
      userStatus = 'active';

      // Enviar email com credenciais
      let emailSent = false;
      let emailError: any = null;
      try {
        console.log('📧 [USER] Tentando enviar email com credenciais para:', patient.email);
        await sendCredentialsEmail(patient.email!, patient.name, patient.email!, generatedPassword, true);
        emailSent = true;
        console.log('✅ [USER] Email com credenciais enviado com sucesso para:', patient.email);
      } catch (err: any) {
        emailError = err;
        console.error('❌ [USER] Erro ao enviar email com credenciais:', err);
        console.error('❌ [USER] Detalhes do erro:', {
          message: err.message,
          stack: err.stack,
          email: patient.email
        });
        // Não falhar se apenas o email não for enviado - usuário já foi criado
      }
    } else {
      // Atualizar status do usuário existente
      if (action === 'activate') {
        userStatus = 'active';
      } else if (action === 'deactivate') {
        userStatus = 'inactive';
      }

      // Atualizar metadata do usuário se necessário
      if (userAuthId) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(userAuthId, {
          user_metadata: {
            name: patient.name,
            phone: patient.phone,
            cpf: patient.cpf,
            patient_id: patient.id,
            role: 'patient',
            status: userStatus
          }
        });

        if (updateError) {
          console.warn('Aviso ao atualizar metadata do usuário:', updateError);
          // Não falhar se apenas a atualização de metadata falhar
        }
      }
    }

    // Atualizar paciente com user_auth e user_status
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        user_auth: userAuthId,
        user_status: userStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar paciente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar paciente'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient,
      message: action === 'deactivate' 
        ? 'Usuário desativado com sucesso' 
        : action === 'activate'
        ? 'Usuário ativado com sucesso'
        : 'Usuário criado com sucesso',
      emailSent: emailSent || false,
      emailError: emailError ? emailError.message : null,
      password: generatedPassword || undefined // Retornar senha para debug (remover em produção se necessário)
    });

  } catch (error: any) {
    console.error('Erro ao sincronizar usuário do paciente:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * PATCH /patients/:id/user-status
 * Ativa ou desativa usuário do paciente
 */
export async function togglePatientUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const { status } = req.body; // 'active' ou 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido. Use "active" ou "inactive"'
      });
    }

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    if (!patient.user_auth) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui usuário criado. Crie o usuário primeiro.'
      });
    }

    // Atualizar status do usuário no Supabase Auth (banco de dados)
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(patient.user_auth, {
      user_metadata: {
        ...(patient.user_auth ? {} : {}), // Preservar metadata existente
        status: status,
        patient_id: patient.id
      }
    });

    if (updateAuthError) {
      console.warn('Aviso ao atualizar status do usuário no Auth:', updateAuthError);
      // Continuar mesmo se a atualização do Auth falhar
    }

    // Atualizar status local
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        user_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar status do usuário:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status do usuário'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient,
      message: status === 'active' ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao alterar status do usuário:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * POST /patients/:id/resend-credentials
 * Reenvia email com credenciais de acesso para o paciente
 */
export async function resendPatientCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Verificar se email está presente
    if (!patient.email) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui email cadastrado'
      });
    }

    // Verificar se usuário existe
    if (!patient.user_auth) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui usuário criado. Crie o usuário primeiro.'
      });
    }

    // Buscar usuário no Supabase Auth para obter email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(patient.user_auth);

    if (authError || !authUser.user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado no sistema de autenticação'
      });
    }

    // Gerar nova senha temporária
    const generateTemporaryPassword = (): string => {
      const length = 12;
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%&*';
      const allChars = uppercase + lowercase + numbers + special;
      
      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];
      
      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }
      
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    const newPassword = generateTemporaryPassword();

    // Atualizar senha do usuário no Supabase Auth
    const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(patient.user_auth, {
      password: newPassword,
      user_metadata: {
        ...authUser.user.user_metadata,
        temporary_password: true
      }
    });

    if (updatePasswordError) {
      console.error('Erro ao atualizar senha do usuário:', updatePasswordError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar senha do usuário'
      });
    }

    // Enviar email com novas credenciais
    let emailSent = false;
    let emailError: any = null;
    try {
      console.log('📧 [RESEND] Tentando reenviar email com credenciais para:', patient.email);
      await sendCredentialsEmail(patient.email!, patient.name, authUser.user.email!, newPassword, true);
      emailSent = true;
      console.log('✅ [RESEND] Email reenviado com sucesso para:', patient.email);
    } catch (err: any) {
      emailError = err;
      console.error('❌ [RESEND] Erro ao reenviar email:', err);
      // Não falhar completamente se apenas o email não for enviado
    }

    return res.json({
      success: true,
      message: emailSent ? 'Email com credenciais reenviado com sucesso' : 'Senha atualizada, mas email não foi enviado',
      emailSent: emailSent,
      emailError: emailError ? emailError.message : null,
      password: emailSent ? undefined : newPassword // Retornar senha apenas se email falhou
    });

  } catch (error: any) {
    console.error('Erro ao reenviar credenciais:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * Função auxiliar para enviar email com credenciais
 */
async function sendCredentialsEmail(
  to: string,
  patientName: string,
  userEmail: string,
  password: string,
  temporaryPassword: boolean = false
): Promise<void> {
  console.log('📧 [EMAIL] Iniciando envio de email com credenciais...');
  console.log('  - Para:', to);
  console.log('  - Nome:', patientName);
  console.log('  - RESEND_API_KEY configurado:', !!process.env.RESEND_API_KEY);
  
  if (!process.env.RESEND_API_KEY) {
    const error = 'RESEND_API_KEY não configurado no servidor';
    console.error('❌ [EMAIL]', error);
    throw new Error(error);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const appName = process.env.APP_NAME || 'Auton Health';
  const loginUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

  console.log('📧 [EMAIL] Configurações:');
  console.log('  - From:', fromEmail);
  console.log('  - App Name:', appName);
  console.log('  - Login URL:', loginUrl);

  // Verificar se está em modo de teste
  const isTestMode = fromEmail.includes('@resend.dev');
  console.log('📧 [EMAIL] Modo de teste:', isTestMode);
  
  if (isTestMode) {
    const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
    console.log('📧 [EMAIL] Email verificado para modo de teste:', verifiedEmail);
    if (to !== verifiedEmail) {
      const error = `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}. Tentando enviar para: ${to}`;
      console.error('❌ [EMAIL]', error);
      throw new Error(error);
    }
  }

  console.log('📧 [EMAIL] Enviando email via Resend...');
  
  const { data, error } = await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: [to],
    subject: temporaryPassword 
      ? `Suas Credenciais de Acesso - ${appName} (Senha Temporária)`
      : `Suas Credenciais de Acesso - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credenciais de Acesso</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Credenciais de Acesso</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Olá <strong>${patientName}</strong>,
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Sua conta de acesso ao sistema foi criada com sucesso! ${temporaryPassword ? 'Você recebeu uma <strong>senha temporária</strong> que deve ser alterada no primeiro acesso.' : ''}
          </p>
          
          <div style="background: #f9fafb; border: 2px solid #1B4266; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h2 style="color: #1B4266; margin-top: 0; font-size: 18px; margin-bottom: 15px;">📧 Suas Credenciais:</h2>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">E-mail (Usuário):</strong>
              <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600;">
                ${userEmail}
              </div>
            </div>
            
            <div>
              <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Senha${temporaryPassword ? ' Temporária' : ''}:</strong>
              <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600; letter-spacing: 2px;">
                ${password}
              </div>
            </div>
          </div>
          
          ${temporaryPassword ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ Importante:</strong> Esta é uma senha temporária. Por segurança, altere sua senha no primeiro acesso ao sistema.
            </p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a 
              href="${loginUrl}/auth/login" 
              style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
              Acessar Sistema
            </a>
          </div>
          
          <div style="background: #f9fafb; border-left: 4px solid #1B4266; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              <strong>🔒 Dicas de Segurança:</strong><br>
              • Guarde suas credenciais em local seguro<br>
              • Não compartilhe sua senha com ninguém<br>
              • Use uma senha forte e única<br>
              ${temporaryPassword ? '• Altere sua senha temporária no primeiro acesso' : ''}
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Se você não solicitou esta conta ou tiver alguma dúvida, entre em contato com seu médico ou suporte.
          </p>
          
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
            Este é um email automático, por favor não responda.
          </p>
        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error('❌ [EMAIL] Erro do Resend:', error);
    console.error('❌ [EMAIL] Detalhes:', JSON.stringify(error, null, 2));
    throw new Error(error.message || 'Erro ao enviar email via Resend');
  }

  console.log('✅ [EMAIL] Email enviado com sucesso!');
  console.log('✅ [EMAIL] ID do email:', data?.id);
}
