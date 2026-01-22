import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /diagnostico/:consultaId
 * Busca diagnóstico de uma consulta
 */
export async function getDiagnostico(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;

    const { data: diagnostico, error } = await supabase
      .from('a_diagnostico')
      .select('*')
      .eq('consultation_id', consultaId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar diagnóstico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar diagnóstico'
      });
    }

    return res.json({
      success: true,
      diagnostico: diagnostico || null
    });

  } catch (error) {
    console.error('Erro ao buscar diagnóstico:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /diagnostico/:consultaId/update-field
 * Atualiza um campo específico do diagnóstico
 */
export async function updateDiagnosticoField(req: AuthenticatedRequest, res: Response) {
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
      .from('a_diagnostico')
      .select('id')
      .eq('consultation_id', consultaId)
      .maybeSingle();

    let result;
    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from('a_diagnostico')
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
        .from('a_diagnostico')
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
      diagnostico: result
    });

  } catch (error) {
    console.error('Erro ao atualizar diagnóstico:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar diagnóstico'
    });
  }
}
