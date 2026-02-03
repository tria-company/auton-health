import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

// Mapeamento de rotas para tabelas
const TABLE_MAP: Record<string, string> = {
  'solucao-mentalidade': 's_agente_mentalidade_2',
  'solucao-suplementacao': 's_suplementacao2',
  'solucao-habitos-vida': 'a_solucao_habitos_vida',
  'solucao-ltb': 'a_solucao_ltb',
  'alimentacao': 's_gramaturas_alimentares',
  'atividade-fisica': 's_exercicios_fisicos'
};

/**
 * Helper genérico para buscar solução
 */
async function getSolucaoGeneric(tableName: string, consultaId: string) {
  console.log(`[getSolucaoGeneric] Buscando em ${tableName} para consulta ${consultaId}`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('consulta_id', consultaId)
    .maybeSingle();

  if (error) {
    console.error(`[getSolucaoGeneric] ❌ Erro em ${tableName}:`, JSON.stringify(error, null, 2));
    throw error;
  }

  console.log(`[getSolucaoGeneric] ✅ Resultado:`, data ? 'encontrado' : 'não encontrado');
  return data || null;
}

/**
 * Helper genérico para atualizar campo da solução
 */
async function updateSolucaoFieldGeneric(tableName: string, consultaId: string, updateData: any) {
  console.log(`[updateSolucaoFieldGeneric] Atualizando ${tableName} para consulta ${consultaId}`);
  console.log(`[updateSolucaoFieldGeneric] Dados:`, JSON.stringify(updateData, null, 2));

  // Verificar se já existe registro
  const { data: existing, error: existingError } = await supabase
    .from(tableName)
    .select('consulta_id')
    .eq('consulta_id', consultaId)
    .maybeSingle();

  if (existingError) {
    console.error(`[updateSolucaoFieldGeneric] ❌ Erro ao buscar existente:`, existingError);
  }

  if (existing) {
    // Atualizar
    console.log(`[updateSolucaoFieldGeneric] Registro existe, atualizando...`);
    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (error) {
      console.error(`[updateSolucaoFieldGeneric] ❌ Erro UPDATE:`, JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(`[updateSolucaoFieldGeneric] ✅ Atualizado com sucesso`);
    return data;
  } else {
    // Criar
    console.log(`[updateSolucaoFieldGeneric] Registro não existe, criando...`);
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        consulta_id: consultaId,
        ...updateData
      })
      .select()
      .single();

    if (error) {
      console.error(`[updateSolucaoFieldGeneric] ❌ Erro INSERT:`, JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(`[updateSolucaoFieldGeneric] ✅ Criado com sucesso`);
    return data;
  }
}

/**
 * GET /solucao-mentalidade/:consultaId
 */
export async function getSolucaoMentalidade(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getSolucaoMentalidade] Buscando para consulta:', consultaId);

    const data = await getSolucaoGeneric(TABLE_MAP['solucao-mentalidade'], consultaId);
    console.log('[getSolucaoMentalidade] Resultado:', data ? 'encontrado' : 'null');

    // Frontend espera mentalidade_data
    return res.json({ success: true, mentalidade_data: data });
  } catch (error: any) {
    console.error('[getSolucaoMentalidade] ❌ Erro:', error?.message || error);
    console.error('[getSolucaoMentalidade] ❌ Detalhes:', JSON.stringify(error, null, 2));
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error?.message || 'Erro desconhecido'
    });
  }
}

/**
 * POST /solucao-mentalidade/:consultaId/update-field
 */
export async function updateSolucaoMentalidadeField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const result = await updateSolucaoFieldGeneric(TABLE_MAP['solucao-mentalidade'], consultaId, req.body);

    return res.json({ success: true, solucao: result });
  } catch (error) {
    console.error('Erro ao atualizar solução mentalidade:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /solucao-suplementacao/:consultaId
 */
export async function getSolucaoSuplementacao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const data = await getSolucaoGeneric(TABLE_MAP['solucao-suplementacao'], consultaId);

    // Parse JSON strings in arrays (the table stores as text[] with JSON strings)
    let parsedData = null;
    if (data) {
      parsedData = {
        suplementos: (data.suplementos || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        fitoterapicos: (data.fitoterapicos || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        homeopatia: (data.homeopatia || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        }),
        florais_bach: (data.florais_bach || []).map((item: string) => {
          try { return JSON.parse(item); } catch { return item; }
        })
      };
    }

    // Return with key that frontend expects
    return res.json({ success: true, suplementacao_data: parsedData });
  } catch (error) {
    console.error('Erro ao buscar solução suplementação:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /solucao-suplementacao/:consultaId/update-field
 */
export async function updateSolucaoSuplementacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const result = await updateSolucaoFieldGeneric(TABLE_MAP['solucao-suplementacao'], consultaId, req.body);

    return res.json({ success: true, solucao: result });
  } catch (error) {
    console.error('Erro ao atualizar solução suplementação:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /alimentacao/:consultaId
 * Tabela s_gramaturas_alimentares usa paciente_id, não consulta_id
 * Frontend espera: { cafe_da_manha: [], almoco: [], cafe_da_tarde: [], jantar: [] }
 */
export async function getAlimentacao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getAlimentacao] 🔍 Iniciando busca para consulta:', consultaId);

    // Primeiro, buscar a consulta para obter o paciente_id
    const { data: consulta, error: consultaError } = await supabase
      .from('consultations')
      .select('patient_id')
      .eq('id', consultaId)
      .maybeSingle();

    console.log('[getAlimentacao] 📋 Resultado consulta:', { consulta, consultaError });

    if (consultaError) {
      console.error('[getAlimentacao] ❌ Erro ao buscar consulta:', consultaError);
      throw consultaError;
    }

    if (!consulta || !consulta.patient_id) {
      console.log('[getAlimentacao] ⚠️ Consulta não encontrada ou sem paciente');
      return res.json({ success: true, alimentacao_data: { cafe_da_manha: [], almoco: [], cafe_da_tarde: [], jantar: [] } });
    }

    const patientId = consulta.patient_id;
    console.log('[getAlimentacao] 👤 Paciente ID encontrado:', patientId);

    // Buscar alimentação pelo paciente_id
    const { data, error } = await supabase
      .from('s_gramaturas_alimentares')
      .select('*')
      .eq('paciente_id', patientId);

    console.log('[getAlimentacao] 🍽️ Registros encontrados:', data?.length || 0);

    if (error) {
      console.error('[getAlimentacao] ❌ Erro ao buscar alimentação:', error);
      throw error;
    }

    // Transformar dados para o formato esperado pelo frontend
    // Tabela tem: alimento, tipo_de_alimentos, ref1_g/kcal (café), ref2_g/kcal (almoço), ref3_g/kcal (tarde), ref4_g/kcal (jantar)
    const alimentacaoData = {
      cafe_da_manha: (data || []).filter(item => item.ref1_g || item.ref1_kcal).map(item => ({
        id: item.id,
        alimento: item.alimento,
        tipo: item.tipo_de_alimentos,
        gramatura: item.ref1_g ? `${item.ref1_g}g` : null,
        kcal: item.ref1_kcal ? `${item.ref1_kcal}kcal` : null
      })),
      almoco: (data || []).filter(item => item.ref2_g || item.ref2_kcal).map(item => ({
        id: item.id,
        alimento: item.alimento,
        tipo: item.tipo_de_alimentos,
        gramatura: item.ref2_g ? `${item.ref2_g}g` : null,
        kcal: item.ref2_kcal ? `${item.ref2_kcal}kcal` : null
      })),
      cafe_da_tarde: (data || []).filter(item => item.ref3_g || item.ref3_kcal).map(item => ({
        id: item.id,
        alimento: item.alimento,
        tipo: item.tipo_de_alimentos,
        gramatura: item.ref3_g ? `${item.ref3_g}g` : null,
        kcal: item.ref3_kcal ? `${item.ref3_kcal}kcal` : null
      })),
      jantar: (data || []).filter(item => item.ref4_g || item.ref4_kcal).map(item => ({
        id: item.id,
        alimento: item.alimento,
        tipo: item.tipo_de_alimentos,
        gramatura: item.ref4_g ? `${item.ref4_g}g` : null,
        kcal: item.ref4_kcal ? `${item.ref4_kcal}kcal` : null
      }))
    };

    console.log('[getAlimentacao] ✅ Dados transformados:', {
      cafe_da_manha: alimentacaoData.cafe_da_manha.length,
      almoco: alimentacaoData.almoco.length,
      cafe_da_tarde: alimentacaoData.cafe_da_tarde.length,
      jantar: alimentacaoData.jantar.length
    });

    return res.json({ success: true, alimentacao_data: alimentacaoData });
  } catch (error: any) {
    console.error('[getAlimentacao] ❌ Erro geral:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /alimentacao/:consultaId/update-field
 */
export async function updateAlimentacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const result = await updateSolucaoFieldGeneric(TABLE_MAP['alimentacao'], consultaId, req.body);

    return res.json({ success: true, alimentacao: result });
  } catch (error) {
    console.error('Erro ao atualizar alimentação:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /atividade-fisica/:consultaId
 * Retorna múltiplos exercícios por consulta
 */
export async function getAtividadeFisica(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    console.log('[getAtividadeFisica] Buscando exercícios para consulta:', consultaId);

    // Buscar múltiplos exercícios (sem .single())
    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .select('*')
      .eq('consulta_id', consultaId);

    if (error) {
      console.error('[getAtividadeFisica] ❌ Erro:', error);
      throw error;
    }

    console.log('[getAtividadeFisica] ✅ Exercícios encontrados:', data?.length || 0);

    return res.json({ success: true, atividade_fisica_data: data || [] });
  } catch (error: any) {
    console.error('[getAtividadeFisica] Erro:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

/**
 * POST /atividade-fisica/:consultaId/update-field
 */
export async function updateAtividadeFisicaField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const result = await updateSolucaoFieldGeneric(TABLE_MAP['atividade-fisica'], consultaId, req.body);

    return res.json({ success: true, atividadeFisica: result });
  } catch (error) {
    console.error('Erro ao atualizar atividade física:', error);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar' });
  }
}

/**
 * GET /lista-exercicios-fisicos
 */
export async function getListaExerciciosFisicos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { search } = req.query;

    let query = supabase
      .from('exercicios_fisicos')
      .select('*');

    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    const { data: exercicios, error } = await query.limit(50);

    if (error) throw error;

    return res.json({ success: true, exercicios: exercicios || [] });
  } catch (error) {
    console.error('Erro ao buscar exercícios:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
