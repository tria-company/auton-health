/**
 * Busca soluções para gerar o DOCX.
 * Usa a API do gateway (mesmas tabelas que a tela de consultas), não Supabase direto.
 */
import { gatewayClient } from '@/lib/gatewayClient';
import type { SolutionsDataForDocx } from './solutionsToDocx';

/** Resposta da API de mentalidade */
interface MentalidadeResponse {
  success: boolean;
  mentalidade_data?: Record<string, unknown> | null;
}

/** Resposta da API de suplementação */
interface SuplementacaoResponse {
  success: boolean;
  suplementacao_data?: {
    suplementos?: Array<{ nome?: string; objetivo?: string; dosagem?: string; horario?: string; inicio?: string; termino?: string }>;
    fitoterapicos?: Array<{ nome?: string; objetivo?: string; dosagem?: string; horario?: string }>;
    homeopatia?: Array<{ nome?: string; objetivo?: string; dosagem?: string }>;
    florais_bach?: Array<{ nome?: string; objetivo?: string; dosagem?: string }>;
  } | null;
}

/** Item de refeição da API de alimentação */
interface AlimentacaoItem {
  alimento?: string;
  tipo?: string;
  gramatura?: string | null;
  kcal?: string | null;
}

/** Resposta da API de alimentação */
interface AlimentacaoResponse {
  success: boolean;
  alimentacao_data?: {
    cafe_da_manha?: AlimentacaoItem[];
    almoco?: AlimentacaoItem[];
    cafe_da_tarde?: AlimentacaoItem[];
    jantar?: AlimentacaoItem[];
  } | null;
}

/** Resposta da API de atividade física */
interface AtividadeFisicaResponse {
  success: boolean;
  atividade_fisica_data?: Array<{
    nome_exercicio?: string;
    tipo_treino?: string;
    grupo_muscular?: string;
    series?: string;
    repeticoes?: string;
    descanso?: string;
    observacoes?: string;
  }> | null;
}

/**
 * Busca soluções pela API do gateway (mesma fonte que a tela de consultas).
 * Retorna dados no formato esperado pelo DOCX, incluindo formato gateway quando aplicável.
 */
export async function fetchSolutionsFromGateway(
  consultaId: string
): Promise<SolutionsDataForDocx & {
  alimentacao_data?: AlimentacaoResponse['alimentacao_data'];
  suplementacao_data?: SuplementacaoResponse['suplementacao_data'];
  mentalidade_data?: Record<string, unknown> | null;
}> {
  const [mentalidadeRes, suplementacaoRes, alimentacaoRes, atividadeRes] = await Promise.all([
    gatewayClient.get<MentalidadeResponse>(`/solucao-mentalidade/${consultaId}`).catch(() => ({ success: false, mentalidade_data: null })),
    gatewayClient.get<SuplementacaoResponse>(`/solucao-suplementacao/${consultaId}`).catch(() => ({ success: false, suplementacao_data: null })),
    gatewayClient.get<AlimentacaoResponse>(`/alimentacao/${consultaId}`).catch(() => ({ success: false, alimentacao_data: null })),
    gatewayClient.get<AtividadeFisicaResponse>(`/atividade-fisica/${consultaId}`).catch(() => ({ success: false, atividade_fisica_data: null }))
  ]);

  const mentalidadeData = mentalidadeRes.success ? (mentalidadeRes as MentalidadeResponse).mentalidade_data ?? null : null;
  const suplementacaoData = suplementacaoRes.success ? (suplementacaoRes as SuplementacaoResponse).suplementacao_data ?? null : null;
  const alimentacaoData = alimentacaoRes.success ? (alimentacaoRes as AlimentacaoResponse).alimentacao_data ?? null : null;
  const atividadeData = atividadeRes.success ? (atividadeRes as AtividadeFisicaResponse).atividade_fisica_data ?? null : null;

  // Flatten alimentação por refeição: uma entrada por item (alimento, tipo, gramatura/kcal da refeição)
  const alimentacaoFlat: Array<Record<string, unknown>> = [];
  if (alimentacaoData) {
    const meals: Array<{ key: keyof typeof alimentacaoData; label: string }> = [
      { key: 'cafe_da_manha', label: 'Café da manhã' },
      { key: 'almoco', label: 'Almoço' },
      { key: 'cafe_da_tarde', label: 'Café da tarde' },
      { key: 'jantar', label: 'Jantar' }
    ];
    for (const { key, label } of meals) {
      const items = alimentacaoData[key] || [];
      for (const item of items) {
        alimentacaoFlat.push({
          alimento: item.alimento || 'Item',
          tipo_de_alimentos: item.tipo,
          ref1_g: key === 'cafe_da_manha' ? item.gramatura : undefined,
          ref1_kcal: key === 'cafe_da_manha' ? item.kcal : undefined,
          ref2_g: key === 'almoco' ? item.gramatura : undefined,
          ref2_kcal: key === 'almoco' ? item.kcal : undefined,
          ref3_g: key === 'cafe_da_tarde' ? item.gramatura : undefined,
          ref3_kcal: key === 'cafe_da_tarde' ? item.kcal : undefined,
          ref4_g: key === 'jantar' ? item.gramatura : undefined,
          ref4_kcal: key === 'jantar' ? item.kcal : undefined,
          _meal: label
        });
      }
    }
  }

  return {
    ltb: null,
    mentalidade: mentalidadeData as any,
    alimentacao: alimentacaoFlat as any,
    suplementacao: suplementacaoData as any,
    exercicios: (atividadeData || []) as any,
    habitos: null,
    mentalidade_data: mentalidadeData,
    suplementacao_data: suplementacaoData,
    alimentacao_data: alimentacaoData
  };
}

/**
 * Busca todas as soluções de uma consulta (Supabase direto - tabelas antigas).
 * Mantido para compatibilidade; preferir fetchSolutionsFromGateway para dados da tela de consultas.
 */
export async function fetchSolutionsByConsultaId(
  consultaId: string
): Promise<SolutionsDataForDocx> {
  const { supabase } = await import('@/lib/supabase');
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
