/**
 * Gera um documento DOCX editável com todas as soluções da consulta.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';

export interface SolutionsDataForDocx {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

function p(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true })],
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true })],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [] });
}

export function buildSolutionsDocx(solutions: SolutionsDataForDocx): Paragraph[] {
  const children: Paragraph[] = [];

  children.push(h2('Soluções da Consulta'));
  children.push(emptyLine());

  // Mentalidade / Livro da Vida
  if (solutions.mentalidade && typeof solutions.mentalidade === 'object') {
    const d = solutions.mentalidade;
    children.push(h2('Livro da Vida – Transformação Mental e Emocional'));
    children.push(h3('Objetivo Principal'));
    children.push(p(d.objetivo_principal || 'Não especificado'));
    children.push(h3('Realidade do Caso'));
    children.push(p(d.realidade_caso || 'Não especificada'));
    if (d.fase1_duracao) {
      children.push(h3('Fase 1 - Estabilização'));
      children.push(p(`Duração: ${d.fase1_duracao}`));
      if (d.fase1_objetivo) children.push(p(`Objetivo: ${d.fase1_objetivo}`));
    }
    if (d.psicoterapia_modalidade) {
      children.push(h3('Psicoterapia'));
      children.push(p(`Modalidade: ${d.psicoterapia_modalidade}`));
      if (d.psicoterapia_frequencia) children.push(p(`Frequência: ${d.psicoterapia_frequencia}`));
      if (d.psicoterapia_duracao_sessao) children.push(p(`Duração da Sessão: ${d.psicoterapia_duracao_sessao}`));
    }
    if (d.cronograma_mental_12_meses) {
      children.push(h3('Cronograma de 12 Meses'));
      children.push(p(d.cronograma_mental_12_meses));
    }
    children.push(emptyLine());
  }

  // Alimentação
  if (solutions.alimentacao && Array.isArray(solutions.alimentacao) && solutions.alimentacao.length > 0) {
    children.push(h2('Plano Alimentar'));
    solutions.alimentacao.forEach((item: any, index: number) => {
      children.push(h3(item.alimento || `Item ${index + 1}`));
      children.push(p(`Tipo: ${item.tipo_de_alimentos || '-'}`));
      children.push(p(`Proporção de Fruta: ${item.proporcao_fruta || '-'}`));
      if (item.ref1_g) children.push(p(`Refeição 1: ${item.ref1_g}g (${item.ref1_kcal || '-'} kcal)`));
      if (item.ref2_g) children.push(p(`Refeição 2: ${item.ref2_g}g (${item.ref2_kcal || '-'} kcal)`));
      if (item.ref3_g) children.push(p(`Refeição 3: ${item.ref3_g}g (${item.ref3_kcal || '-'} kcal)`));
      if (item.ref4_g) children.push(p(`Refeição 4: ${item.ref4_g}g (${item.ref4_kcal || '-'} kcal)`));
      children.push(emptyLine());
    });
  }

  // Suplementação
  if (solutions.suplementacao && typeof solutions.suplementacao === 'object') {
    const d = solutions.suplementacao;
    children.push(h2('Protocolo de Suplementação'));
    children.push(h3('Objetivo Principal'));
    children.push(p(d.objetivo_principal || 'Não especificado'));
    children.push(h3('Filosofia do Protocolo'));
    children.push(p(`Realidade: ${d.filosofia_realidade || '-'}`));
    children.push(p(`Princípio: ${d.filosofia_principio || '-'}`));
    children.push(p(`Duração: ${d.filosofia_duracao || '-'}`));
    if (d.protocolo_mes1_2_lista) {
      children.push(h3('Protocolo Meses 1-2'));
      children.push(p(`Lista: ${d.protocolo_mes1_2_lista}`));
      if (d.protocolo_mes1_2_justificativa) children.push(p(`Justificativa: ${d.protocolo_mes1_2_justificativa}`));
    }
    if (d.protocolo_mes3_6_lista) {
      children.push(h3('Protocolo Meses 3-6'));
      children.push(p(`Lista: ${d.protocolo_mes3_6_lista}`));
      if (d.protocolo_mes3_6_justificativa) children.push(p(`Justificativa: ${d.protocolo_mes3_6_justificativa}`));
    }
    children.push(emptyLine());
  }

  // Exercícios
  if (solutions.exercicios && Array.isArray(solutions.exercicios) && solutions.exercicios.length > 0) {
    children.push(h2('Programa de Exercícios'));
    solutions.exercicios.forEach((exercicio: any, index: number) => {
      children.push(h3(exercicio.nome_exercicio || `Exercício ${index + 1}`));
      children.push(p(`Tipo: ${exercicio.tipo_treino || '-'}`));
      children.push(p(`Grupo Muscular: ${exercicio.grupo_muscular || '-'}`));
      children.push(p(`Séries: ${exercicio.series || '-'} | Repetições: ${exercicio.repeticoes || '-'} | Descanso: ${exercicio.descanso || '-'}`));
      if (exercicio.observacoes) children.push(p(`Observações: ${exercicio.observacoes}`));
      children.push(emptyLine());
    });
  }

  // Hábitos (objeto genérico)
  if (solutions.habitos && typeof solutions.habitos === 'object') {
    children.push(h2('Hábitos de Vida'));
    const h = solutions.habitos;
    if (typeof h === 'object' && !Array.isArray(h)) {
      Object.entries(h).forEach(([key, value]) => {
        if (value == null || value === '') return;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        children.push(p(`${label}: ${String(value)}`));
      });
    } else {
      children.push(p(JSON.stringify(h, null, 2)));
    }
    children.push(emptyLine());
  }

  if (children.length <= 2) {
    children.push(p('Nenhuma solução com conteúdo disponível para exportar.'));
  }

  return children;
}

/**
 * Garante que solutions tem todos os campos esperados (evita undefined no build do doc).
 */
function normalizeSolutions(solutions: Partial<SolutionsDataForDocx> | null): SolutionsDataForDocx {
  if (!solutions || typeof solutions !== 'object') {
    return { ltb: null, mentalidade: null, alimentacao: [], suplementacao: null, exercicios: [], habitos: null };
  }
  return {
    ltb: solutions.ltb ?? null,
    mentalidade: solutions.mentalidade ?? null,
    alimentacao: Array.isArray(solutions.alimentacao) ? solutions.alimentacao : [],
    suplementacao: solutions.suplementacao ?? null,
    exercicios: Array.isArray(solutions.exercicios) ? solutions.exercicios : [],
    habitos: solutions.habitos ?? null,
  };
}

/**
 * Gera o DOCX e dispara o download no navegador.
 */
export async function downloadSolutionsDocx(
  solutions: SolutionsDataForDocx | Partial<SolutionsDataForDocx> | null,
  filename: string = 'solucoes-consulta.docx'
): Promise<void> {
  const normalized = normalizeSolutions(solutions);
  const paragraphs = buildSolutionsDocx(normalized);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  let blob: Blob;
  try {
    blob = await Packer.toBlob(doc);
  } catch (e) {
    console.error('Erro ao gerar DOCX (Packer.toBlob):', e);
    throw new Error('Falha ao gerar o documento. Tente novamente.');
  }

  const fileSaver = await import('file-saver');
  const saveAs = fileSaver.saveAs ?? (fileSaver as { default?: typeof fileSaver.saveAs }).default;
  if (typeof saveAs !== 'function') {
    throw new Error('Download não disponível neste navegador.');
  }
  saveAs(blob, filename);
}
