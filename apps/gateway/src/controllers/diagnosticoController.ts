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

    // Buscar dados de todas as tabelas de diagnóstico
    const [
      diagnostico_principal,
      estado_geral,
      estado_fisiologico,
      estado_mental,
      agente_integracao_diagnostica,
      agente_habitos_vida_sistemica
    ] = await Promise.all([
      supabase.from('d_diagnostico_principal').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('d_estado_geral').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('d_estado_fisiologico').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('d_estado_mental').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('d_agente_integracao_diagnostica').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('d_agente_habitos_vida_sistemica').select('*').eq('consulta_id', consultaId).maybeSingle()
    ]);

    // Verificar se alguma query falhou
    const errors = [
      diagnostico_principal, estado_geral, estado_fisiologico, estado_mental,
      agente_integracao_diagnostica, agente_habitos_vida_sistemica
    ].filter(result => result.error);

    if (errors.length > 0) {
      console.error('Erro ao buscar diagnóstico:', errors[0].error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar diagnóstico'
      });
    }

    return res.json({
      success: true,
      diagnostico_principal: diagnostico_principal.data,
      estado_geral: estado_geral.data,
      estado_fisiologico: estado_fisiologico.data,
      estado_mental: estado_mental.data,
      agente_integracao_diagnostica: agente_integracao_diagnostica.data,
      agente_habitos_vida_sistemica: agente_habitos_vida_sistemica.data
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
