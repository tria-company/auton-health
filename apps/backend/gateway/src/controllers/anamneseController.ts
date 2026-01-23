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

    // Buscar dados de todas as tabelas de anamnese
    const [
      cadastro_prontuario,
      objetivos_queixas,
      historico_risco,
      observacao_clinica_lab,
      historia_vida,
      setenios_eventos,
      ambiente_contexto,
      sensacao_emocoes,
      preocupacoes_crencas,
      reino_miasma
    ] = await Promise.all([
      supabase.from('a_cadastro_prontuario').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_objetivos_queixas').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_historico_risco').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_observacao_clinica_lab').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_historia_vida').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_setenios_eventos').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_ambiente_contexto').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_sensacao_emocoes').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_preocupacoes_crencas').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_reino_miasma').select('*').eq('consulta_id', consultaId).maybeSingle()
    ]);

    // Verificar se alguma query falhou
    const errors = [
      cadastro_prontuario, objetivos_queixas, historico_risco, observacao_clinica_lab,
      historia_vida, setenios_eventos, ambiente_contexto, sensacao_emocoes,
      preocupacoes_crencas, reino_miasma
    ].filter(result => result.error);

    if (errors.length > 0) {
      console.error('Erro ao buscar anamnese:', errors[0].error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anamnese'
      });
    }

    return res.json({
      success: true,
      cadastro_prontuario: cadastro_prontuario.data,
      objetivos_queixas: objetivos_queixas.data,
      historico_risco: historico_risco.data,
      observacao_clinica_lab: observacao_clinica_lab.data,
      historia_vida: historia_vida.data,
      setenios_eventos: setenios_eventos.data,
      ambiente_contexto: ambiente_contexto.data,
      sensacao_emocoes: sensacao_emocoes.data,
      preocupacoes_crencas: preocupacoes_crencas.data,
      reino_miasma: reino_miasma.data
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
