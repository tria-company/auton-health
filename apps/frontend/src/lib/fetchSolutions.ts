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

/** Item de principal da refeição */
interface RefeicaoPrincipalItem {
  alimento: string;
  gramas: number;
  categoria: string;
}

/** Item de substituição */
interface SubstituicaoItem {
  alimento: string;
  gramas: number;
}

/** Estrutura de uma refeição na nova tabela */
interface RefeicaoData {
  principal: RefeicaoPrincipalItem[];
  substituicoes: Record<string, SubstituicaoItem[]>; // gordinhas, proteinas, etc.
}

/** Resposta da API de alimentação */
interface AlimentacaoResponse {
  success: boolean;
  alimentacao_data?: Array<{
    id: string;
    nome: string;
    data: RefeicaoData | string; // Pode vir como string JSON se o parse falhar em algum lugar, mas o backend manda objeto tipicamente se for jsonb no supabase. Controller manda data.ref_X que é jsonb.
  }> | null;
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

  // Flatten alimentação por refeição para o DOCX (Adaptação para o novo formato)
  // O DOCX espera uma lista plana. Vamos tentar converter o novo formato para algo que o DOCX "entenda" ou pelo menos não quebre.
  // Idealmente o DOCX generator também deveria ser atualizado, mas vamos fazer um best-effort mapping.
  const alimentacaoFlat: Array<Record<string, unknown>> = [];

  if (alimentacaoData && Array.isArray(alimentacaoData)) {
    for (const refeicao of alimentacaoData) {
      const nomeRefeicao = refeicao.nome;
      // ref_data pode ser string JSON ou objeto
      let refData = refeicao.data;
      if (typeof refData === 'string') {
        try {
          refData = JSON.parse(refData);
        } catch (e) {
          console.error('Erro ao fazer parse de dados de refeição', e);
          continue;
        }
      }

      const dadosRefeicao = refData as RefeicaoData; // Cast seguro após parse

      if (dadosRefeicao && dadosRefeicao.principal) {
        for (const item of dadosRefeicao.principal) {
          alimentacaoFlat.push({
            alimento: item.alimento,
            tipo_de_alimentos: item.categoria,
            gramatura: item.gramas ? `${item.gramas.toFixed(0)}g` : null, // DOCX espera string
            _meal: nomeRefeicao
          });
        }
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
