import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /anamnese/:consultaId
 * Busca dados da anamnese de uma consulta
 */
export async function getAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;

    const { data: anamnese, error } = await supabase
      .from('a_anamnese')
      .select('*')
      .eq('consultation_id', consultaId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar anamnese:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anamnese'
      });
    }

    return res.json({
      success: true,
      anamnese: anamnese || null
    });

  } catch (error) {
    console.error('Erro ao buscar anamnese:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /anamnese/:consultaId/update-field
 * Atualiza um campo específico da anamnese
 */
export async function updateAnamneseField(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;
    const updateData = req.body;

    // Verificar se já existe registro
    const { data: existing } = await supabase
      .from('a_anamnese')
      .select('id')
      .eq('consultation_id', consultaId)
      .maybeSingle();

    let result;
    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from('a_anamnese')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('consultation_id', consultaId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Criar
      const { data, error } = await supabase
        .from('a_anamnese')
        .insert({
          consultation_id: consultaId,
          ...updateData
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return res.json({
      success: true,
      anamnese: result
    });

  } catch (error) {
    console.error('Erro ao atualizar anamnese:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar anamnese'
    });
  }
}

/**
 * GET /anamnese-inicial
 * Busca anamnese inicial do paciente
 */
export async function getAnamneseInicial(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { patient_id } = req.query;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id é obrigatório'
      });
    }

    const { data: anamnese, error } = await supabase
      .from('a_anamnese_inicial')
      .select('*')
      .eq('patient_id', patient_id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar anamnese inicial:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anamnese inicial'
      });
    }

    return res.json({
      success: true,
      anamnese: anamnese || null
    });

  } catch (error) {
    console.error('Erro ao buscar anamnese inicial:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
