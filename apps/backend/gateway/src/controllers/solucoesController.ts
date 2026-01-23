import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

// Mapeamento de rotas para tabelas
const TABLE_MAP: Record<string, string> = {
  'solucao-mentalidade': 'a_solucao_mentalidade',
  'solucao-suplementacao': 'a_solucao_suplementacao',
  'solucao-habitos-vida': 'a_solucao_habitos_vida',
  'solucao-ltb': 'a_solucao_ltb',
  'alimentacao': 'a_alimentacao',
  'atividade-fisica': 'a_atividade_fisica'
};

/**
 * Helper genérico para buscar solução
 */
async function getSolucaoGeneric(tableName: string, consultaId: string) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('consultation_id', consultaId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Helper genérico para atualizar campo da solução
 */
async function updateSolucaoFieldGeneric(tableName: string, consultaId: string, updateData: any) {
  // Verificar se já existe registro
  const { data: existing } = await supabase
    .from(tableName)
    .select('id')
    .eq('consultation_id', consultaId)
    .maybeSingle();

  if (existing) {
    // Atualizar
    const { data, error } = await supabase
      .from(tableName)
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('consultation_id', consultaId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Criar
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        consultation_id: consultaId,
        ...updateData
      })
      .select()
      .single();

    if (error) throw error;
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
    const data = await getSolucaoGeneric(TABLE_MAP['solucao-mentalidade'], consultaId);

    return res.json({ success: true, solucao: data });
  } catch (error) {
    console.error('Erro ao buscar solução mentalidade:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
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

    return res.json({ success: true, solucao: data });
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
 */
export async function getAlimentacao(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const data = await getSolucaoGeneric(TABLE_MAP['alimentacao'], consultaId);

    return res.json({ success: true, alimentacao: data });
  } catch (error) {
    console.error('Erro ao buscar alimentação:', error);
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
 */
export async function getAtividadeFisica(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' });
    }

    const { consultaId } = req.params;
    const data = await getSolucaoGeneric(TABLE_MAP['atividade-fisica'], consultaId);

    return res.json({ success: true, atividadeFisica: data });
  } catch (error) {
    console.error('Erro ao buscar atividade física:', error);
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
