/**
 * Busca todas as soluções de uma consulta (mesma lógica do SolutionsList).
 * Usado na tela "Selecionar Solução" para gerar o DOCX.
 */
import { supabase } from '@/lib/supabase';
import type { SolutionsDataForDocx } from './solutionsToDocx';

export async function fetchSolutionsByConsultaId(
  consultaId: string
): Promise<SolutionsDataForDocx> {
  const [ltbResult, mentalidadeResult, suplementacaoResult, habitosResult, alimentacaoResult, atividadeResult] = await Promise.all([
    supabase.from('solucoes_ltb').select('*').eq('consulta_id', consultaId).single(),
    supabase.from('solucoes_mentalidade').select('*').eq('consulta_id', consultaId).single(),
    supabase.from('solucoes_suplementacao').select('*').eq('consulta_id', consultaId).single(),
    supabase.from('solucoes_habitos_vida').select('*').eq('consulta_id', consultaId).single(),
    supabase.from('alimentacao').select('*').eq('consulta_id', consultaId),
    supabase.from('atividade_fisica').select('*').eq('consulta_id', consultaId)
  ]);

  return {
    ltb: ltbResult.data || null,
    mentalidade: mentalidadeResult.data || null,
    alimentacao: alimentacaoResult.data || [],
    suplementacao: suplementacaoResult.data || null,
    exercicios: atividadeResult.data || [],
    habitos: habitosResult.data || null
  };
}
