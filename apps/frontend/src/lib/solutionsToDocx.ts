/**
 * Gera um documento DOCX editável com todas as soluções da consulta.
 * Formatação em estilo Markdown: títulos, listas e labels em negrito.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
} from 'docx';

export interface SolutionsDataForDocx {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

/** Parágrafo normal */
function p(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

/** Título principal (nível 1) */
function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 240, after: 120 },
  });
}

/** Seção (nível 2) */
function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 200, after: 100 },
  });
}

/** Subseção (nível 3) */
function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true })],
    spacing: { before: 160, after: 80 },
  });
}

/** Label em negrito + valor (ex: **Tipo:** valor) */
function labelVal(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(value),
    ],
    spacing: { after: 80 },
    indent: { left: 360 },
  });
}

/** Item de lista com marcador */
function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun(`• ${text}`)],
    spacing: { after: 60 },
    indent: { left: 360 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 80 } });
}

/** Célula de tabela com texto (opcional negrito no primeiro parágrafo) */
function tableCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

/** Agrupa itens de alimentação por refeição (_meal) */
function groupAlimentacaoByMeal(items: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  const order = ['Café da manhã', 'Almoço', 'Café da tarde', 'Jantar'];
  order.forEach((meal) => map.set(meal, []));
  items.forEach((item) => {
    const meal = item._meal || 'Outros';
    if (!map.has(meal)) map.set(meal, []);
    map.get(meal)!.push(item);
  });
  // Manter ordem: Café da manhã, Almoço, Café da tarde, Jantar, depois o resto
  const ordered = new Map<string, any[]>();
  order.forEach((meal) => {
    const list = map.get(meal);
    if (list && list.length > 0) ordered.set(meal, list);
  });
  map.forEach((list, meal) => {
    if (!ordered.has(meal) && list.length > 0) ordered.set(meal, list);
  });
  return ordered;
}

/** Converte chave snake_case em rótulo legível e amigável ao paciente */
function humanize(key: string): string {
  const map: Record<string, string> = {
    padrao: 'Padrão',
    'areas impacto': 'Áreas de impacto',
    'origem estimada': 'Origem estimada',
    'contexto provavel': 'Contexto provável',
    'conexoes padroes': 'Conexões com outros padrões',
    'raiz de': 'Raiz de',
    tipo_de_alimentos: 'Tipo de alimento',
    proporcao_fruta: 'Proporção de frutas',
    nome_exercicio: 'Exercício',
    tipo_treino: 'Tipo de treino',
    grupo_muscular: 'Grupo muscular',
    repeticoes: 'Repetições',
    descanso: 'Descanso entre séries',
    observacoes: 'Observações',
    objetivo_principal: 'Objetivo principal',
    realidade_caso: 'Realidade do caso',
    resumo_executivo: 'Resumo executivo',
    higiene_sono: 'Higiene do sono',
    ref1_g: 'Café da manhã (gramas)',
    ref1_kcal: 'Café da manhã (kcal)',
    ref2_g: 'Almoço (gramas)',
    ref2_kcal: 'Almoço (kcal)',
    ref3_g: 'Café da tarde (gramas)',
    ref3_kcal: 'Café da tarde (kcal)',
    ref4_g: 'Jantar (gramas)',
    ref4_kcal: 'Jantar (kcal)',
  };
  const lower = key.toLowerCase().replace(/\s+/g, '_');
  if (map[lower] != null) return map[lower];
  if (map[key] != null) return map[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Padrao/g, 'Padrão');
}

/** Chaves que não devem aparecer no documento (internas/sistema) */
const SKIP_KEYS = ['id', 'threadid', 'thread_id', 'consulta_id', 'patient_id', 'paciente_id', 'created_at', 'updated_at', 'user_id', 'doctor_id'];
function shouldSkipKey(key: string): boolean {
  return SKIP_KEYS.includes(key.toLowerCase());
}

/** Formata um valor para texto legível (sem JSON bruto) */
function valueToReadable(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' && v !== null ? valueToReadable(v) : String(v))).join(', ');
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${humanize(k)}: ${valueToReadable(v)}`);
    return entries.join(' • ');
  }
  return String(value);
}

/** Adiciona ao array de filhos os parágrafos que formatam um objeto de "padrão" de forma legível */
function appendPadraoSection(children: Paragraph[], key: string, obj: Record<string, unknown>): void {
  const padraoNum = key.replace(/\D/g, '') || '?';
  children.push(h3(`Padrão ${padraoNum}`));
  if (obj.padrao != null) children.push(labelVal('Padrão', String(obj.padrao)));
  if (obj.categorias != null) {
    const arr = Array.isArray(obj.categorias) ? obj.categorias : [obj.categorias];
    children.push(labelVal('Categorias', arr.map(String).join(', ')));
  }
  if (obj.prioridade != null) children.push(labelVal('Prioridade', String(obj.prioridade)));
  if (obj.areas_impacto != null || (obj as any)['areas impacto'] != null) {
    const arr = Array.isArray(obj.areas_impacto) ? obj.areas_impacto : Array.isArray((obj as any)['areas impacto']) ? (obj as any)['areas impacto'] : [];
    children.push(labelVal('Áreas de impacto', arr.map(String).join(', ')));
  }
  const origem = obj.origem_estimada ?? (obj as any)['origem estimada'];
  if (origem != null && typeof origem === 'object') {
    const o = origem as Record<string, unknown>;
    if (o.periodo != null) children.push(labelVal('Período', String(o.periodo)));
    if (o.contexto_provavel != null || (o as any)['contexto provavel'] != null) {
      const ctx = o.contexto_provavel ?? (o as any)['contexto provavel'];
      children.push(labelVal('Contexto provável', String(ctx)));
    }
  }
  const conexoes = obj.conexoes_padroes ?? (obj as any)['conexoes padroes'];
  if (conexoes != null && typeof conexoes === 'object') {
    const raiz = (conexoes as any)['raiz de'];
    if (Array.isArray(raiz) && raiz.length > 0) {
      children.push(labelVal('Raiz de', raiz.map(String).join(', ')));
    }
  }
  const padraoDone = ['padrao', 'categorias', 'prioridade', 'areas_impacto', 'areas impacto', 'origem_estimada', 'origem estimada', 'conexoes_padroes', 'conexoes padroes'];
  Object.entries(obj).forEach(([k, v]) => {
    if (v == null || v === '' || padraoDone.includes(k) || shouldSkipKey(k)) return;
    children.push(labelVal(humanize(k), valueToReadable(v)));
  });
  children.push(emptyLine());
}

export function buildSolutionsDocx(solutions: SolutionsDataForDocx): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  children.push(h1('Suas Soluções de Saúde'));
  children.push(p('Este documento reúne as orientações e o plano definidos na sua consulta. Use-o como guia no dia a dia. Em caso de dúvidas, converse com seu médico.'));
  children.push(emptyLine());

  // --- Mentalidade / Livro da Vida ---
  if (solutions.mentalidade && typeof solutions.mentalidade === 'object') {
    const d = solutions.mentalidade as Record<string, unknown>;
    children.push(h2('Livro da Vida – Transformação Mental e Emocional'));
    if (d.objetivo_principal != null || d.realidade_caso != null) {
      children.push(labelVal('Objetivo Principal', String(d.objetivo_principal || 'Não especificado')));
      children.push(labelVal('Realidade do Caso', String(d.realidade_caso || 'Não especificada')));
      if (d.fase1_duracao) {
        children.push(h3('Fase 1 - Estabilização'));
        children.push(labelVal('Duração', String(d.fase1_duracao)));
        if (d.fase1_objetivo) children.push(labelVal('Objetivo', String(d.fase1_objetivo)));
      }
      if (d.psicoterapia_modalidade) {
        children.push(h3('Psicoterapia'));
        children.push(labelVal('Modalidade', String(d.psicoterapia_modalidade)));
        if (d.psicoterapia_frequencia) children.push(labelVal('Frequência', String(d.psicoterapia_frequencia)));
        if (d.psicoterapia_duracao_sessao) children.push(labelVal('Duração da Sessão', String(d.psicoterapia_duracao_sessao)));
      }
      if (d.cronograma_mental_12_meses) {
        children.push(h3('Cronograma de 12 Meses'));
        children.push(p(String(d.cronograma_mental_12_meses)));
      }
    } else {
      // Formato gateway: Resumo Executivo e Padrão 01, 02, etc. em texto legível (nunca JSON bruto)
      if (d.resumo_executivo != null && String(d.resumo_executivo).trim()) {
        children.push(h3('Resumo Executivo'));
        children.push(p(String(d.resumo_executivo).trim()));
        children.push(emptyLine());
      }
      const padraoKeys = Object.keys(d).filter((k) => /^padrao_\d+$/i.test(k)).sort();
      for (const key of padraoKeys) {
        const val = d[key];
        if (val != null && typeof val === 'object' && !Array.isArray(val)) {
          appendPadraoSection(children, key, val as Record<string, unknown>);
        }
      }
      // Outros campos (higiene_sono, etc.) como label + valor legível (oculta chaves internas)
      Object.entries(d).forEach(([key, value]) => {
        if (value == null || value === '' || typeof value === 'function') return;
        if (key === 'resumo_executivo' || /^padrao_\d+$/i.test(key) || shouldSkipKey(key)) return;
        const label = humanize(key);
        if (typeof value === 'object' && !Array.isArray(value)) {
          Object.entries(value as Record<string, unknown>).forEach(([k2, v2]) => {
            if (v2 == null || v2 === '') return;
            children.push(labelVal(`${label} – ${humanize(k2)}`, valueToReadable(v2)));
          });
        } else {
          children.push(labelVal(label, valueToReadable(value)));
        }
      });
    }
    children.push(emptyLine());
  }

  // --- Alimentação (tabelas por refeição) ---
  if (solutions.alimentacao && Array.isArray(solutions.alimentacao) && solutions.alimentacao.length > 0) {
    children.push(h2('Plano Alimentar'));
    children.push(p('Abaixo estão os alimentos e porções sugeridas, separados por refeição. Ajuste conforme a orientação do seu médico ou nutricionista.'));
    children.push(emptyLine());
    const byMeal = groupAlimentacaoByMeal(solutions.alimentacao);
    byMeal.forEach((items, mealName) => {
      children.push(h3(mealName));
      const hasProporcao = items.some((i: any) => i.proporcao_fruta != null && i.proporcao_fruta !== '');
      const headerCells = [
        tableCell('Alimento', true),
        tableCell('Tipo', true),
        tableCell('Porção (g)', true),
        tableCell('Energia (kcal)', true),
      ];
      if (hasProporcao) headerCells.push(tableCell('Proporção frutas', true));
      const headerRow = new TableRow({ children: headerCells });
      const dataRows = items.map((item: any) => {
        const porcao = item.ref1_g ?? item.ref2_g ?? item.ref3_g ?? item.ref4_g ?? item.gramatura ?? '—';
        const kcal = item.ref1_kcal ?? item.ref2_kcal ?? item.ref3_kcal ?? item.ref4_kcal ?? item.kcal ?? '—';
        const porcaoStr = porcao === '—' ? '—' : String(porcao).endsWith('g') ? String(porcao) : `${porcao}g`;
        const cells = [
          tableCell(String(item.alimento || '—')),
          tableCell(String(item.tipo_de_alimentos ?? item.tipo ?? '—')),
          tableCell(porcaoStr),
          tableCell(String(kcal)),
        ];
        if (hasProporcao) cells.push(tableCell(item.proporcao_fruta != null ? String(item.proporcao_fruta) : '—'));
        return new TableRow({ children: cells });
      });
      children.push(
        new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: 'pct' as const },
        })
      );
      children.push(emptyLine());
    });
  }

  // --- Suplementação ---
  if (solutions.suplementacao && typeof solutions.suplementacao === 'object') {
    const d = solutions.suplementacao as Record<string, any>;
    children.push(h2('Protocolo de Suplementação'));
    children.push(p('Siga as orientações de dosagem e horário. Em caso de dúvida ou efeito adverso, consulte seu médico.'));
    children.push(emptyLine());
    const hasCategories = Array.isArray(d.suplementos) || Array.isArray(d.fitoterapicos) || Array.isArray(d.homeopatia) || Array.isArray(d.florais_bach);
    if (hasCategories) {
      const categories = [
        { key: 'suplementos', label: 'Suplementos' },
        { key: 'fitoterapicos', label: 'Fitoterápicos' },
        { key: 'homeopatia', label: 'Homeopatia' },
        { key: 'florais_bach', label: 'Florais de Bach' }
      ];
      for (const { key, label } of categories) {
        const items = d[key];
        if (!Array.isArray(items) || items.length === 0) continue;
        children.push(h3(label));
        items.forEach((item: any, i: number) => {
          children.push(h3(item.nome || `Item ${i + 1}`));
          if (item.objetivo != null) children.push(labelVal('Objetivo', String(item.objetivo)));
          if (item.dosagem != null) children.push(labelVal('Dosagem', String(item.dosagem)));
          if (item.horario != null) children.push(labelVal('Horário', String(item.horario)));
          if (item.inicio != null) children.push(labelVal('Início', String(item.inicio)));
          if (item.termino != null) children.push(labelVal('Término', String(item.termino)));
          Object.entries(item).forEach(([k, v]) => {
            if (v == null || v === '' || ['nome', 'objetivo', 'dosagem', 'horario', 'inicio', 'termino'].includes(k) || shouldSkipKey(k)) return;
            children.push(labelVal(humanize(k), valueToReadable(v)));
          });
          children.push(emptyLine());
        });
      }
    } else {
      children.push(labelVal('Objetivo principal', String(d.objetivo_principal || 'Não especificado')));
      children.push(labelVal('Realidade', String(d.filosofia_realidade || '—')));
      children.push(labelVal('Princípio', String(d.filosofia_principio || '—')));
      children.push(labelVal('Duração', String(d.filosofia_duracao || '—')));
      if (d.protocolo_mes1_2_lista) {
        children.push(h3('Protocolo – Meses 1 e 2'));
        children.push(p(valueToReadable(d.protocolo_mes1_2_lista)));
        if (d.protocolo_mes1_2_justificativa) children.push(labelVal('Justificativa', String(d.protocolo_mes1_2_justificativa)));
      }
      if (d.protocolo_mes3_6_lista) {
        children.push(h3('Protocolo – Meses 3 a 6'));
        children.push(p(valueToReadable(d.protocolo_mes3_6_lista)));
        if (d.protocolo_mes3_6_justificativa) children.push(labelVal('Justificativa', String(d.protocolo_mes3_6_justificativa)));
      }
    }
    children.push(emptyLine());
  }

  // --- Exercícios ---
  if (solutions.exercicios && Array.isArray(solutions.exercicios) && solutions.exercicios.length > 0) {
    children.push(h2('Programa de Exercícios'));
    children.push(p('Siga a ordem e as séries indicadas. Respeite o descanso entre séries para melhores resultados.'));
    children.push(emptyLine());
    solutions.exercicios.forEach((exercicio: any, index: number) => {
      children.push(h3(exercicio.nome_exercicio || `Exercício ${index + 1}`));
      children.push(labelVal('Tipo de treino', String(exercicio.tipo_treino || '—')));
      children.push(labelVal('Grupo muscular', String(exercicio.grupo_muscular || '—')));
      children.push(labelVal('Séries', String(exercicio.series || '—')));
      children.push(labelVal('Repetições', String(exercicio.repeticoes || '—')));
      children.push(labelVal('Descanso entre séries', String(exercicio.descanso || '—')));
      if (exercicio.observacoes != null && String(exercicio.observacoes).trim()) children.push(labelVal('Observações', String(exercicio.observacoes).trim()));
      Object.entries(exercicio).forEach(([k, v]) => {
        if (v == null || v === '' || ['nome_exercicio', 'tipo_treino', 'grupo_muscular', 'series', 'repeticoes', 'descanso', 'observacoes'].includes(k) || shouldSkipKey(k)) return;
        children.push(labelVal(humanize(k), valueToReadable(v)));
      });
      children.push(emptyLine());
    });
  }

  // --- Hábitos ---
  if (solutions.habitos && typeof solutions.habitos === 'object') {
    children.push(h2('Hábitos de Vida'));
    children.push(p('Pequenas mudanças no dia a dia fazem diferença. Escolha um ou dois itens para começar.'));
    children.push(emptyLine());
    const h = solutions.habitos;
    if (typeof h === 'object' && !Array.isArray(h)) {
      Object.entries(h).forEach(([key, value]) => {
        if (value == null || value === '' || shouldSkipKey(key)) return;
        children.push(labelVal(humanize(key), valueToReadable(value)));
      });
    } else if (Array.isArray(h)) {
      h.forEach((item) => children.push(bullet(valueToReadable(item))));
    } else {
      children.push(p(valueToReadable(h)));
    }
    children.push(emptyLine());
  }

  if (children.length <= 2) {
    children.push(p('Ainda não há soluções registradas para esta consulta. Quando o plano for preenchido, você poderá baixar o documento aqui.'));
  } else {
    children.push(emptyLine());
    children.push(p('Em caso de dúvidas ou para ajustar seu plano, entre em contato com seu médico. Cuide-se.'));
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
