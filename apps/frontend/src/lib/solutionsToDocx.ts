/**
 * Gera um documento DOCX editável com todas as soluções da consulta.
 * Formatação profissional: margens, fontes, tabelas com bordas e sombreamento.
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
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} from 'docx';

/** Margem de página em polegadas (1" = 2,54 cm) */
const PAGE_MARGIN_INCH = 1;
/** Tamanho de fonte: corpo (12 pt = 24 half-points) */
const FONT_SIZE_BODY = 24;
/** Tamanho de fonte: subtítulo (13 pt) */
const FONT_SIZE_SUBTITLE = 26;
/** Tamanho de fonte: H3 (13 pt) */
const FONT_SIZE_H3 = 26;
/** Tamanho de fonte: H2 (14 pt) */
const FONT_SIZE_H2 = 28;
/** Tamanho de fonte: H1 (16 pt) */
const FONT_SIZE_H1 = 32;
/** Espaçamento entre linhas (twips; ~1,15 linhas) */
const LINE_SPACING = 276;
/** Bordas das tabelas: cinza escuro */
const TABLE_BORDER = { style: BorderStyle.SINGLE as const, size: 4, color: '333333' };
/** Sombreamento do cabeçalho da tabela */
const TABLE_HEADER_SHADING = { fill: 'E8E8E8', type: ShadingType.CLEAR as const };

/** Item principal de uma refeição (formato gateway) */
export interface RefeicaoPrincipalItemDocx {
  alimento?: string;
  categoria?: string;
  gramas?: number;
}

/** Item de substituição (formato gateway) */
export interface SubstituicaoItemDocx {
  alimento?: string;
  gramas?: number;
}

/** Dados estruturados de uma refeição (principal + substituições por categoria) */
export interface RefeicaoDataDocx {
  principal?: RefeicaoPrincipalItemDocx[];
  substituicoes?: Record<string, SubstituicaoItemDocx[]>;
}

/** Item de alimentação estruturada (por refeição) para o DOCX */
export interface AlimentacaoStructuredItem {
  nome: string;
  data: RefeicaoDataDocx | string;
}

export interface SolutionsDataForDocx {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  /** Quando presente, o DOCX usa refeições principais + substituições por refeição */
  alimentacao_data?: AlimentacaoStructuredItem[] | null;
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

/** Parágrafo normal (fonte 12 pt, espaçamento legível) */
function p(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: FONT_SIZE_BODY })],
    spacing: { after: 140, line: LINE_SPACING },
  });
}

/** Título principal (nível 1, 16 pt) */
function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: FONT_SIZE_H1 })],
    spacing: { before: 280, after: 140 },
  });
}

/** Seção (nível 2, 14 pt) */
function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: FONT_SIZE_H2 })],
    spacing: { before: 240, after: 120 },
  });
}

/** Subseção (nível 3, 13 pt) */
function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: FONT_SIZE_H3 })],
    spacing: { before: 200, after: 100 },
  });
}

/** Subtítulo em negrito (13 pt, sem nível de heading) */
function boldSubtitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: FONT_SIZE_SUBTITLE })],
    spacing: { before: 140, after: 80 },
    indent: { left: 200 },
  });
}

/** Label em negrito + valor (12 pt, legível) */
function labelVal(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: FONT_SIZE_BODY }),
      new TextRun({ text: value, size: FONT_SIZE_BODY }),
    ],
    spacing: { after: 100, line: LINE_SPACING },
    indent: { left: 400 },
  });
}

/** Item de lista com marcador (12 pt) */
function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: FONT_SIZE_BODY })],
    spacing: { after: 80, line: LINE_SPACING },
    indent: { left: 400 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 100 } });
}

/** Célula de tabela com texto (12 pt; opcional negrito) */
function tableCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: FONT_SIZE_BODY })],
        spacing: { after: 60 },
      }),
    ],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

/** Célula de cabeçalho de tabela (negrito + fundo cinza claro) */
function tableHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: FONT_SIZE_BODY })],
        spacing: { after: 60 },
      }),
    ],
    shading: TABLE_HEADER_SHADING,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

/** Opções de bordas para tabelas (visual profissional) */
const TABLE_BORDERS = {
  top: TABLE_BORDER,
  bottom: TABLE_BORDER,
  left: TABLE_BORDER,
  right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER,
  insideVertical: TABLE_BORDER,
};

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

  // --- Alimentação (refeições principais + substituições por refeição, ou fallback para lista plana) ---
  const hasStructuredAlimentacao = solutions.alimentacao_data && Array.isArray(solutions.alimentacao_data) && solutions.alimentacao_data.length > 0;

  if (hasStructuredAlimentacao) {
    children.push(h2('Plano Alimentar'));
    children.push(p('Abaixo estão as refeições principais e as substituições sugeridas por refeição. Ajuste conforme a orientação do seu médico ou nutricionista.'));
    children.push(emptyLine());

    for (const refeicao of solutions.alimentacao_data!) {
      let dadosRefeicao: RefeicaoDataDocx = typeof refeicao.data === 'string'
        ? (() => { try { return JSON.parse(refeicao.data) as RefeicaoDataDocx; } catch { return {}; } })()
        : (refeicao.data || {});

      const principal = Array.isArray(dadosRefeicao.principal) ? dadosRefeicao.principal : [];
      const substituicoes = dadosRefeicao.substituicoes && typeof dadosRefeicao.substituicoes === 'object' ? dadosRefeicao.substituicoes : {};

      const temPrincipal = principal.length > 0;
      const temSubstituicoes = Object.keys(substituicoes).length > 0;
      if (!temPrincipal && !temSubstituicoes) continue;

      children.push(h3(refeicao.nome));

      if (temPrincipal) {
        children.push(boldSubtitle('Refeições principais'));
        const headerRow = new TableRow({
          children: [
            tableHeaderCell('Alimento'),
            tableHeaderCell('Categoria'),
            tableHeaderCell('Porção (g)'),
          ],
        });
        const dataRows = principal.map((item: RefeicaoPrincipalItemDocx) => {
          const porcao = item.gramas != null ? `${item.gramas}g` : '—';
          return new TableRow({
            children: [
              tableCell(String(item.alimento || '—')),
              tableCell(String(item.categoria || '—')),
              tableCell(porcao),
            ],
          });
        });
        children.push(
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: 'pct' as const },
            borders: TABLE_BORDERS,
          })
        );
        children.push(emptyLine());
      }

      if (temSubstituicoes) {
        for (const [categoria, itens] of Object.entries(substituicoes)) {
          if (!Array.isArray(itens) || itens.length === 0) continue;
          const labelCategoria = categoria.trim() || 'Substituições';
          children.push(boldSubtitle(`Substituições: ${labelCategoria}`));
          const headerRow = new TableRow({
            children: [
              tableHeaderCell('Alimento'),
              tableHeaderCell('Porção (g)'),
            ],
          });
          const dataRows = itens.map((item: SubstituicaoItemDocx) => {
            const porcao = item.gramas != null ? `${item.gramas}g` : '—';
            return new TableRow({
              children: [
                tableCell(String(item.alimento || '—')),
                tableCell(porcao),
              ],
            });
          });
          children.push(
            new Table({
              rows: [headerRow, ...dataRows],
              width: { size: 100, type: 'pct' as const },
              borders: TABLE_BORDERS,
            })
          );
          children.push(emptyLine());
        }
      }
    }
  } else if (solutions.alimentacao && Array.isArray(solutions.alimentacao) && solutions.alimentacao.length > 0) {
    children.push(h2('Plano Alimentar'));
    children.push(p('Abaixo estão os alimentos e porções sugeridas, separados por refeição. Ajuste conforme a orientação do seu médico ou nutricionista.'));
    children.push(emptyLine());
    const byMeal = groupAlimentacaoByMeal(solutions.alimentacao);
    byMeal.forEach((items, mealName) => {
      children.push(h3(mealName));
      const hasProporcao = items.some((i: any) => i.proporcao_fruta != null && i.proporcao_fruta !== '');
      const headerCells = [
        tableHeaderCell('Alimento'),
        tableHeaderCell('Tipo'),
        tableHeaderCell('Porção (g)'),
        tableHeaderCell('Energia (kcal)'),
      ];
      if (hasProporcao) headerCells.push(tableHeaderCell('Proporção frutas'));
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
          borders: TABLE_BORDERS,
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
 * Preserva alimentacao_data quando presente (formato gateway: refeições principais + substituições).
 */
function normalizeSolutions(solutions: Partial<SolutionsDataForDocx> | null): SolutionsDataForDocx {
  if (!solutions || typeof solutions !== 'object') {
    return { ltb: null, mentalidade: null, alimentacao: [], alimentacao_data: null, suplementacao: null, exercicios: [], habitos: null };
  }
  const data = solutions as Partial<SolutionsDataForDocx> & { alimentacao_data?: AlimentacaoStructuredItem[] | null };
  return {
    ltb: solutions.ltb ?? null,
    mentalidade: solutions.mentalidade ?? null,
    alimentacao: Array.isArray(solutions.alimentacao) ? solutions.alimentacao : [],
    alimentacao_data: data.alimentacao_data != null && Array.isArray(data.alimentacao_data) ? data.alimentacao_data : null,
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

  const marginTwips = convertInchesToTwip(PAGE_MARGIN_INCH);
  const headerFooterTwips = convertInchesToTwip(0.5);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginTwips,
              right: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              header: headerFooterTwips,
              footer: headerFooterTwips,
              gutter: 0,
            },
          },
        },
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
