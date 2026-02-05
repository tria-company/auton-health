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
 * Atualiza um campo da tabela s_agente_mentalidade_2
 * O frontend envia fieldPath: 'mentalidade_data.nome_coluna' (ex: mentalidade_data.padrao_01)
 * Mapeamos isso para a coluna real 'nome_coluna' (ex: padrao_01)
 */
export async function updateSolucaoMentalidadeField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { fieldPath, value } = req.body;

    console.log('[updateSolucaoMentalidadeField] 📝 Atualizando:', { consultaId, fieldPath, value });

    if (!fieldPath) {
      return res.status(400).json({ success: false, error: 'fieldPath é obrigatório' });
    }

    // Extrair o nome da coluna real
    // Esperado: mentalidade_data.NOME_COLUNA (ex: mentalidade_data.padrao_01)
    const parts = fieldPath.split('.');

    // Validação básica do formato
    if (parts[0] !== 'mentalidade_data' || parts.length < 2) {
      return res.status(400).json({ success: false, error: 'fieldPath deve começar com mentalidade_data.nome_coluna' });
    }

    // O nome da coluna é a segunda parte (ex: padrao_01, resumo_executivo, higiene_sono)
    let columnName = parts[1];

    // Lógica de atualização
    const updatePayload: any = {};

    // Se o path tiver mais de 2 partes (ex: mentalidade_data.higiene_sono.duracao_alvo),
    // precisamos fazer um merge manual, pois o Supabase/Postgres substituiria o JSON inteiro.
    if (parts.length > 2) {
      console.log(`[updateSolucaoMentalidadeField] 🔄 Atualização aninhada detectada para coluna '${columnName}'`);

      // 1. Buscar valor atual da coluna
      const { data: currentData, error: fetchError } = await supabase
        .from('s_agente_mentalidade_2')
        .select(columnName)
        .eq('consulta_id', consultaId)
        .single();

      if (fetchError) {
        console.error(`[updateSolucaoMentalidadeField] ❌ Erro ao buscar dados atuais:`, fetchError);
        throw fetchError;
      }

      let columnValue: any = currentData ? currentData[columnName] : {};
      // Garantir que é objeto
      if (!columnValue || typeof columnValue !== 'object') columnValue = {};

      // 2. Aplicar a atualização no objeto (deep set)
      let current: any = columnValue;
      for (let i = 2; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {}; // Criar caminho se não existir
        }
        current = current[key];
      }

      const lastKey = parts[parts.length - 1];
      current[lastKey] = value;

      // 3. Definir payload com o objeto completo atualizado
      updatePayload[columnName] = columnValue;

    } else {
      // Atualização direta da coluna (root level)
      updatePayload[columnName] = value;
    }

    // Salvar atualização
    const { data, error: updateError } = await supabase
      .from('s_agente_mentalidade_2')
      .update(updatePayload)
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (updateError) {
      // Se der erro de coluna não existe, tentamos dar uma dica melhor
      if (updateError.code === '42703') { // Undefined column
        console.error(`[updateSolucaoMentalidadeField] ❌ Coluna '${columnName}' não existe na tabela s_agente_mentalidade_2`);
        return res.status(400).json({ success: false, error: `Campo '${columnName}' inválido para esta solução.` });
      }

      console.error('[updateSolucaoMentalidadeField] ❌ Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('[updateSolucaoMentalidadeField] ✅ Atualizado com sucesso');
    return res.json({ success: true, solucao: data });
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
 * Atualiza um campo específico de um item dentro de uma categoria de suplementação
 * Body: { category: 'suplementos'|'fitoterapicos'|'homeopatia'|'florais_bach', index: number, field: string, value: any }
 */
export async function updateSolucaoSuplementacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { category, index, field, value } = req.body;

    console.log('[updateSolucaoSuplementacaoField] 📝 Atualizando:', { consultaId, category, index, field, value });

    if (!category || index === undefined || !field) {
      return res.status(400).json({ success: false, error: 'category, index e field são obrigatórios' });
    }

    // Buscar dados existentes
    const { data: existing, error: fetchError } = await supabase
      .from('s_suplementacao2')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('[updateSolucaoSuplementacaoField] ❌ Erro ao buscar:', fetchError);
      throw fetchError;
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Registro de suplementação não encontrado' });
    }

    // Obter o array da categoria
    const categoryArray = existing[category] || [];

    // Parse cada item do array (são JSON strings)
    const parsedArray = categoryArray.map((item: string) => {
      try { return JSON.parse(item); } catch { return item; }
    });

    // Verificar se o índice existe
    if (index < 0 || index >= parsedArray.length) {
      return res.status(400).json({ success: false, error: 'Índice inválido' });
    }

    // Atualizar o campo do item específico
    parsedArray[index] = {
      ...parsedArray[index],
      [field]: value
    };

    // Converter de volta para JSON strings
    const updatedArray = parsedArray.map((item: any) => JSON.stringify(item));

    // Salvar no banco
    const { data, error: updateError } = await supabase
      .from('s_suplementacao2')
      .update({ [category]: updatedArray })
      .eq('consulta_id', consultaId)
      .select()
      .single();

    if (updateError) {
      console.error('[updateSolucaoSuplementacaoField] ❌ Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('[updateSolucaoSuplementacaoField] ✅ Atualizado com sucesso');
    return res.json({ success: true, solucao: data });
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
 * Atualiza um campo específico de um alimento pelo ID do registro
 * Body: { id: number, field: string, value: any } ou { id: number, alimento, tipo, gramatura, kcal }
 */
export async function updateAlimentacaoField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { id, field, value, alimento, tipo, gramatura, kcal } = req.body;

    console.log('[updateAlimentacaoField] 📝 Atualizando alimento:', { consultaId, alimentoId: id, body: req.body });

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID do alimento é obrigatório' });
    }

    // Construir objeto de atualização
    let updateData: Record<string, any> = {};

    if (field && value !== undefined) {
      // Formato { id, field, value }
      updateData[field] = value;
    } else {
      // Formato legado com campos específicos
      if (alimento !== undefined) updateData.alimento = alimento;
      if (tipo !== undefined) updateData.tipo_de_alimentos = tipo;
      if (gramatura !== undefined) updateData.gramatura = gramatura;
      if (kcal !== undefined) updateData.kcal = kcal;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    const { data, error } = await supabase
      .from('s_gramaturas_alimentares')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateAlimentacaoField] ❌ Erro:', error);
      throw error;
    }

    console.log('[updateAlimentacaoField] ✅ Atualizado:', data);
    return res.json({ success: true, alimentacao: data });
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
 * Atualiza um campo específico de um exercício pelo ID do exercício
 * Body: { id: number, field: string, value: any }
 */
export async function updateAtividadeFisicaField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const { id, field, value } = req.body;

    console.log('[updateAtividadeFisicaField] 📝 Atualizando exercício:', { consultaId, exercicioId: id, field, value });

    if (!id || !field) {
      return res.status(400).json({ success: false, error: 'ID e field são obrigatórios' });
    }

    // Atualizar o campo específico do exercício pelo seu ID
    const updateData: Record<string, any> = {};
    updateData[field] = value;

    const { data, error } = await supabase
      .from('s_exercicios_fisicos')
      .update(updateData)
      .eq('id', id)
      .eq('consulta_id', consultaId) // Garantir que pertence à consulta certa
      .select()
      .single();

    if (error) {
      console.error('[updateAtividadeFisicaField] ❌ Erro:', error);
      throw error;
    }

    console.log('[updateAtividadeFisicaField] ✅ Atualizado:', data);
    return res.json({ success: true, atividadeFisica: data });
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
