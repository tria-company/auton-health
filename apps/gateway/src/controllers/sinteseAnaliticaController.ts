import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /sintese-analitica/:consultaId
 * Busca síntese analítica da consulta
 */
export async function getSinteseAnalitica(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('[getSinteseAnalitica] consultaId:', req.params.consultaId);
    
    const { consultaId } = req.params;

    const { data: sintese, error } = await supabase
      .from('a_sintese_analitica')
      .select('*')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (error) {
      console.error('[getSinteseAnalitica] Erro Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar síntese analítica'
      });
    }

    if (!sintese) {
      return res.status(404).json({
        success: false,
        error: 'Síntese analítica não encontrada'
      });
    }

    console.log('[getSinteseAnalitica] ✅ Sucesso');
    return res.json({
      success: true,
      data: sintese
    });

  } catch (error: any) {
    console.error('[getSinteseAnalitica] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * PATCH /sintese-analitica/:consultaId
 * Atualiza campo da síntese analítica
 */
export async function updateSinteseAnalitica(req: AuthenticatedRequest, res: Response) {
  try {
    const { consultaId } = req.params;
    const updateData = req.body;

    // Verificar se existe
    const { data: existing } = await supabase
      .from('a_sintese_analitica')
      .select('id')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    let result;
    if (existing) {
      // Atualizar
      const { data, error } = await supabase
        .from('a_sintese_analitica')
        .update(updateData)
        .eq('consulta_id', consultaId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Criar
      const { data, error } = await supabase
        .from('a_sintese_analitica')
        .insert({
          consulta_id: consultaId,
          ...updateData
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erro ao atualizar síntese analítica:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar síntese analítica'
    });
  }
}
