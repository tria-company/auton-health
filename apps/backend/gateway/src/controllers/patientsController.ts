import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

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
