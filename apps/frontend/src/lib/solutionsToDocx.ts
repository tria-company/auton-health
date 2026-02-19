/**
 * DOCX Premium v3 — Soluções da Consulta
 *
 * Melhorias sobre v2:
 * ─────────────────────────────────────────────────────────────
 * 1. WidthType.DXA em todas as tabelas (compatível Google Docs)
 * 2. Bullets nativos (LevelFormat.BULLET) em vez de "• " unicode
 * 3. Estilos globais (fontes, headings, cores) via Document styles
 * 4. Header com nome do documento + Footer com paginação
 * 5. Table of Contents automático
 * 6. Page breaks entre seções
 * 7. Tipografia refinada (Inter/Arial, hierarquia visual clara)
 * 8. Accent bar lateral nos cards (via bordas)
 * 9. columnWidths + cell width em DXA (dual widths obrigatório)
 * 10. Espaçamento e ritmo vertical consistentes
 *
 * Requisitos: npm i docx
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
  WidthType,
  AlignmentType,
  LevelFormat,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  TableOfContents,
  TabStopType,
  TabStopPosition,
} from "docx";

// ═══════════════════════════════════════════════════════════════
// INTERFACES (mesmas da v2 – mantendo compatibilidade)
// ═══════════════════════════════════════════════════════════════

export interface RefeicaoPrincipalItemDocx {
  alimento?: string;
  categoria?: string;
  gramas?: number;
}

export interface SubstituicaoItemDocx {
  alimento?: string;
  gramas?: number;
}

export interface RefeicaoDataDocx {
  principal?: RefeicaoPrincipalItemDocx[];
  substituicoes?: Record<string, SubstituicaoItemDocx[]>;
}

export interface AlimentacaoStructuredItem {
  nome: string;
  data: RefeicaoDataDocx | string;
}

export interface SolutionsDataForDocx {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  alimentacao_data?: AlimentacaoStructuredItem[] | null;
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS (US Letter, DXA units)
// ═══════════════════════════════════════════════════════════════

/** 1 inch = 1440 DXA (twentieths of a point × 20) */
const INCH = 1440;

const PAGE = {
  width: 12240, // 8.5″
  height: 15840, // 11″
  marginTop: INCH,
  marginBottom: INCH,
  marginLeft: INCH,
  marginRight: INCH,
} as const;

/** Largura útil de conteúdo */
const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight; // 9360

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════

const FONT = {
  primary: "Arial", // universalmente suportada
  mono: "Consolas",
} as const;

/** Tamanhos em half-points (24 = 12pt) */
const SIZE = {
  xs: 18, // 9pt
  sm: 20, // 10pt
  base: 22, // 11pt
  md: 24, // 12pt
  lg: 28, // 14pt
  xl: 32, // 16pt
  xxl: 40, // 20pt
  hero: 52, // 26pt
} as const;

const COLOR = {
  // Texto
  text: "1F2937",
  secondary: "4B5563",
  muted: "9CA3AF",
  white: "FFFFFF",

  // Superfícies
  bg: "FFFFFF",
  surface: "F9FAFB",
  surfaceAlt: "F3F4F6",
  border: "E5E7EB",
  borderLight: "F3F4F6",

  // Accent (paleta profissional saúde)
  primary: "0F766E", // teal-700
  primaryLight: "CCFBF1", // teal-100
  primaryDark: "134E4A", // teal-900

  // Section accents
  mental: "1E3A5F", // azul profundo
  mentalLight: "DBEAFE",
  food: "065F46", // verde escuro
  foodLight: "D1FAE5",
  supp: "5B21B6", // roxo
  suppLight: "EDE9FE",
  train: "9A3412", // laranja escuro
  trainLight: "FEF3C7",
  habits: "0F766E", // teal
  habitsLight: "CCFBF1",

  // Utilidade
  danger: "DC2626",
  warning: "D97706",
} as const;

const SPACING = {
  xs: 60,
  sm: 100,
  md: 160,
  lg: 240,
  xl: 360,
  xxl: 480,
} as const;

const LINE_SPACING = 276; // ~1.15

// ═══════════════════════════════════════════════════════════════
// BORDERS
// ═══════════════════════════════════════════════════════════════

const B_NONE = { style: BorderStyle.NONE as const, size: 0, color: "FFFFFF" };
const B_SOFT = { style: BorderStyle.SINGLE as const, size: 4, color: COLOR.border };
const B_ACCENT = (color: string) => ({ style: BorderStyle.SINGLE as const, size: 12, color });

const BORDERS_NONE = { top: B_NONE, bottom: B_NONE, left: B_NONE, right: B_NONE, insideHorizontal: B_NONE, insideVertical: B_NONE };
const BORDERS_TABLE = {
  top: B_SOFT,
  bottom: B_SOFT,
  left: B_SOFT,
  right: B_SOFT,
  insideHorizontal: B_SOFT,
  insideVertical: B_SOFT,
};

// ═══════════════════════════════════════════════════════════════
// DATA HELPERS
// ═══════════════════════════════════════════════════════════════

const SKIP_KEYS = new Set([
  "id", "threadid", "thread_id", "consulta_id", "patient_id",
  "paciente_id", "created_at", "updated_at", "user_id", "doctor_id",
  "status", "ativo", "active", "enabled", "disabled",
  "version", "versao", "tipo", "type", "source", "origem",
]);

function shouldSkipKey(key: string) {
  return SKIP_KEYS.has(String(key).toLowerCase());
}

const HUMANIZE_MAP: Record<string, string> = {
  padrao: "Padrão", categorias: "Categorias", prioridade: "Prioridade",
  areas_impacto: "Áreas de impacto", periodo: "Período",
  contexto_provavel: "Contexto provável", manifestacoes_atuais: "Manifestações atuais",
  orientacoes_transformacao: "Orientações de Transformação",
  objetivo: "Objetivo", dosagem: "Dosagem", horario: "Horário",
  inicio: "Início", termino: "Término", alertas_importantes: "Alertas importantes",
  nome_treino: "Nome treino", treino_atual: "Treino atual",
  proximo_treino: "Próximo treino", ultimo_treino: "Último treino",
};

function humanize(key: string): string {
  const k = String(key).trim().toLowerCase();
  if (HUMANIZE_MAP[k]) return HUMANIZE_MAP[k];
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/Padrao/g, "Padrão");
}

function valueToReadable(value: any): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "—";
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const list = value.map((v) => valueToReadable(v)).filter((s) => s !== "—");
    return list.length ? list.join(", ") : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([k, v]) => !shouldSkipKey(k) && v != null && v !== false && String(v).trim() !== "")
      .map(([k, v]) => `${humanize(k)}: ${valueToReadable(v)}`);
    return entries.length ? entries.join(" · ") : "—";
  }
  return String(value);
}

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return (raw as T) ?? fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ═══════════════════════════════════════════════════════════════
// NUMBERING CONFIG (bullets + numbers nativos)
// ═══════════════════════════════════════════════════════════════

const NUMBERING_CONFIG = [
  {
    reference: "premium-bullets",
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      },
      {
        level: 1,
        format: LevelFormat.BULLET,
        text: "\u25E6",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
      },
    ],
  },
  {
    reference: "premium-numbers",
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// PARAGRAPH BUILDERS
// ═══════════════════════════════════════════════════════════════

function para(text: string, opts?: {
  bold?: boolean; color?: string; size?: number;
  after?: number; before?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  italic?: boolean; font?: string;
}) {
  return new Paragraph({
    alignment: opts?.align,
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        color: opts?.color ?? COLOR.text,
        size: opts?.size ?? SIZE.base,
        font: opts?.font ?? FONT.primary,
      }),
    ],
    spacing: { before: opts?.before ?? 0, after: opts?.after ?? 120, line: LINE_SPACING },
  });
}

function emptyLine(after = 120) {
  return new Paragraph({ children: [], spacing: { after } });
}

/** Heading usável no TOC (usa HeadingLevel nativo) */
function heading1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: SIZE.xxl, color: COLOR.text, font: FONT.primary })],
    spacing: { before: SPACING.lg, after: SPACING.md },
  });
}

function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: SIZE.xl, color: COLOR.text, font: FONT.primary })],
    spacing: { before: SPACING.md, after: SPACING.sm },
  });
}

function heading3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: SIZE.lg, color: COLOR.text, font: FONT.primary })],
    spacing: { before: SPACING.sm, after: SPACING.xs },
  });
}

/** Bullet nativo (não unicode!) */
function bulletItem(text: string, level = 0) {
  return new Paragraph({
    numbering: { reference: "premium-bullets", level },
    children: [new TextRun({ text, size: SIZE.base, color: COLOR.text, font: FONT.primary })],
    spacing: { after: 80, line: LINE_SPACING },
  });
}

/** Numbered item nativo */
function numberedItem(text: string) {
  return new Paragraph({
    numbering: { reference: "premium-numbers", level: 0 },
    children: [new TextRun({ text, size: SIZE.base, color: COLOR.text, font: FONT.primary })],
    spacing: { after: 80, line: LINE_SPACING },
  });
}

function labelValue(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: SIZE.base, color: COLOR.text, font: FONT.primary }),
      new TextRun({ text: value || "—", size: SIZE.base, color: COLOR.secondary, font: FONT.primary }),
    ],
    spacing: { after: 80, line: LINE_SPACING },
  });
}

function caption(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: SIZE.sm, color: COLOR.muted, italics: true, font: FONT.primary })],
    spacing: { after: 100, line: LINE_SPACING },
  });
}

function divider() {
  return new Paragraph({
    children: [],
    spacing: { before: SPACING.sm, after: SPACING.sm },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.border, space: 1 } },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ═══════════════════════════════════════════════════════════════
// TABLE BUILDERS (DXA only, dual widths)
// ═══════════════════════════════════════════════════════════════

const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text: string, widthDxa: number) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: COLOR.surfaceAlt },
    borders: { top: B_SOFT, bottom: B_SOFT, left: B_SOFT, right: B_SOFT },
    margins: CELL_MARGINS,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: SIZE.sm, color: COLOR.text, font: FONT.primary })],
        spacing: { after: 0 },
      }),
    ],
  });
}

function textCell(text: string, widthDxa: number, opts?: { bold?: boolean; color?: string }) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: { top: B_SOFT, bottom: B_SOFT, left: B_SOFT, right: B_SOFT },
    margins: CELL_MARGINS,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || "—",
            bold: opts?.bold ?? false,
            size: SIZE.base,
            color: opts?.color ?? COLOR.text,
            font: FONT.primary,
          }),
        ],
        spacing: { after: 0 },
      }),
    ],
  });
}

// ─── Section Band (faixa colorida de seção) ───

function sectionBand(title: string, fill: string, subtitle?: string) {
  const content: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, color: COLOR.white, size: SIZE.xl, font: FONT.primary })],
      spacing: { after: subtitle ? 40 : 0 },
    }),
  ];
  if (subtitle) {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: subtitle, color: "D1D5DB", size: SIZE.sm, font: FONT.primary })],
        spacing: { after: 0 },
      })
    );
  }

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 200, bottom: 200, left: 280, right: 280 },
            borders: { top: B_NONE, bottom: B_NONE, left: B_NONE, right: B_NONE },
            children: content,
          }),
        ],
      }),
    ],
  });
}

// ─── Info Card (caixa com accent bar lateral) ───

function infoCard(
  title: string,
  body: (Paragraph | Table)[],
  opts?: { accentColor?: string; fill?: string }
) {
  const accent = opts?.accentColor ?? COLOR.primary;
  const fill = opts?.fill ?? COLOR.surface;

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            borders: {
              top: B_SOFT,
              bottom: B_SOFT,
              right: B_SOFT,
              left: B_ACCENT(accent), // accent bar esquerda
            },
            margins: { top: 160, bottom: 160, left: 260, right: 260 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: SIZE.lg, color: COLOR.text, font: FONT.primary })],
                spacing: { after: SPACING.sm },
              }),
              ...body,
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Highlight Box (para dicas/avisos) ───

function highlightBox(text: string, opts?: { fill?: string; borderColor?: string; icon?: string }) {
  const fill = opts?.fill ?? COLOR.primaryLight;
  const bc = opts?.borderColor ?? COLOR.primary;
  const displayText = opts?.icon ? `${opts.icon}  ${text}` : text;

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    borders: BORDERS_NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: bc },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: bc },
              left: { style: BorderStyle.SINGLE, size: 12, color: bc },
              right: { style: BorderStyle.SINGLE, size: 4, color: bc },
            },
            margins: { top: 120, bottom: 120, left: 220, right: 220 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: displayText, size: SIZE.sm, color: COLOR.text, font: FONT.primary })],
                spacing: { after: 0 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Tag Line (categorias, prioridade) ───

function tagLine(label: string, value: any, opts?: { color?: string }) {
  const display = typeof value === "string" ? value : valueToReadable(value);
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}:  `, bold: true, size: SIZE.sm, color: COLOR.secondary, font: FONT.primary }),
      new TextRun({ text: display || "—", size: SIZE.sm, color: opts?.color ?? COLOR.text, font: FONT.primary }),
    ],
    spacing: { after: 60 },
  });
}

// ═══════════════════════════════════════════════════════════════
// MENTALIDADE: Orientações → Steps
// ═══════════════════════════════════════════════════════════════

type Step = { nome?: string; passo?: string; como?: string; oQue?: string; porque?: string };

function parseOrientacoes(raw: string): Step[] {
  if (!raw?.trim()) return [];
  const blocks = raw
    .split(/\s*,\s*Nome:\s*/g)
    .map((b, i) => (i === 0 ? b : `Nome: ${b}`))
    .map((s) => s.trim())
    .filter(Boolean);

  const steps: Step[] = [];
  for (const b of blocks) {
    const nome = (b.match(/Nome:\s*([^•]+)/)?.[1] ?? "").trim();
    const passo = (b.match(/Passo:\s*([^•]+)/)?.[1] ?? "").trim();
    const como = (b.match(/Como Fazer:\s*([^•]+)/)?.[1] ?? "").trim();
    const oQue = (b.match(/O Que Fazer:\s*([^•]+)/)?.[1] ?? "").trim();
    const porque = (b.match(/Porque Funciona:\s*(.+)$/)?.[1] ?? "").trim();
    if (nome || passo || como || oQue || porque) steps.push({ nome, passo, como, oQue, porque });
  }
  return steps;
}

function renderSteps(steps: Step[], accentColor: string): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];
  steps.forEach((s, idx) => {
    const n = s.passo || String(idx + 1);
    const body: (Paragraph | Table)[] = [];
    if (s.como) body.push(bulletItem(`Como fazer: ${s.como}`));
    if (s.oQue) body.push(bulletItem(`O que fazer: ${s.oQue}`));
    if (s.porque) body.push(bulletItem(`Por que funciona: ${s.porque}`));

    blocks.push(
      infoCard(`Passo ${n}${s.nome ? ` — ${s.nome}` : ""}`, body, { accentColor, fill: COLOR.bg })
    );
    blocks.push(emptyLine(100));
  });
  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// ALIMENTAÇÃO: Tabelas estruturadas
// ═══════════════════════════════════════════════════════════════

function mealTablePrincipal(principal: RefeicaoPrincipalItemDocx[]) {
  const colWidths = [4200, 3000, 2160]; // soma = 9360
  const header = new TableRow({
    children: [headerCell("Alimento", colWidths[0]), headerCell("Categoria", colWidths[1]), headerCell("Porção", colWidths[2])],
  });
  const rows = principal.map((it) =>
    new TableRow({
      children: [
        textCell(String(it.alimento || "—"), colWidths[0]),
        textCell(String(it.categoria || "—"), colWidths[1]),
        textCell(it.gramas != null ? `${it.gramas}g` : "—", colWidths[2]),
      ],
    })
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: BORDERS_TABLE,
    rows: [header, ...rows],
  });
}

function mealTableSubs(items: SubstituicaoItemDocx[]) {
  const colWidths = [6500, 2860]; // soma = 9360
  const header = new TableRow({
    children: [headerCell("Alimento substituto", colWidths[0]), headerCell("Porção", colWidths[1])],
  });
  const rows = items.map((it) =>
    new TableRow({
      children: [
        textCell(String(it.alimento || "—"), colWidths[0]),
        textCell(it.gramas != null ? `${it.gramas}g` : "—", colWidths[1]),
      ],
    })
  );
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: BORDERS_TABLE,
    rows: [header, ...rows],
  });
}

// ═══════════════════════════════════════════════════════════════
// SUPLEMENTAÇÃO
// ═══════════════════════════════════════════════════════════════

function renderSupplementItem(item: any, fallbackTitle: string, accentColor: string) {
  const title = String(item?.nome || fallbackTitle).trim();
  const lines: Paragraph[] = [];

  if (item?.objetivo) lines.push(labelValue("Objetivo", valueToReadable(item.objetivo)));
  if (item?.dosagem) lines.push(labelValue("Dosagem", valueToReadable(item.dosagem)));
  if (item?.horario) lines.push(labelValue("Horário", valueToReadable(item.horario)));
  if (item?.inicio) lines.push(labelValue("Início", valueToReadable(item.inicio)));
  if (item?.termino) lines.push(labelValue("Término", valueToReadable(item.termino)));

  const skip = new Set(["nome", "objetivo", "dosagem", "horario", "inicio", "termino"]);
  const extra = Object.entries(item || {})
    .filter(([k, v]) => !skip.has(String(k)) && !shouldSkipKey(String(k)) && v != null && String(v).trim() !== "")
    .map(([k, v]) => labelValue(humanize(k), valueToReadable(v)));

  return infoCard(title, [...lines, ...(extra.length ? [emptyLine(40), ...extra] : [])], {
    accentColor,
    fill: COLOR.bg,
  });
}

// ═══════════════════════════════════════════════════════════════
// EXERCÍCIOS: Agrupar & Dedup
// ═══════════════════════════════════════════════════════════════

function normalizeExercise(ex: any) {
  return {
    nomeTreino: String(ex?.["Nome Treino"] ?? ex?.nome_treino ?? ex?.nomeTreino ?? "").trim() || "Treino",
    nome: String(ex?.nome_exercicio ?? ex?.["Nome Exercicio"] ?? ex?.["Exercício"] ?? ex?.nome ?? "").trim() || "Exercício",
    tipo: valueToReadable(ex?.tipo_treino ?? ex?.["Tipo de treino"] ?? ex?.tipo),
    grupo: valueToReadable(ex?.grupo_muscular ?? ex?.["Grupo muscular"] ?? ex?.grupo),
    series: valueToReadable(ex?.series ?? ex?.["Séries"]),
    repeticoes: valueToReadable(ex?.repeticoes ?? ex?.["Repetições"]),
    descanso: valueToReadable(ex?.descanso ?? ex?.["Descanso entre séries"]),
    observacoes: valueToReadable(ex?.observacoes ?? ex?.["Observações"]),
    alertas: ex?.alertas_importantes ?? ex?.["Alertas Importantes"] ?? null,
  };
}

function groupExercises(exercicios: any[]) {
  const map = new Map<string, any[]>();
  const seen = new Set<string>();
  for (const raw of exercicios) {
    const ex = normalizeExercise(raw);
    const key = `${ex.nomeTreino}|${ex.nome}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!map.has(ex.nomeTreino)) map.set(ex.nomeTreino, []);
    map.get(ex.nomeTreino)!.push(raw);
  }
  return map;
}

function renderTrainingBlock(treinoName: string, items: any[]): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];

  // Tabela resumo
  const colWidths = [2400, 1800, 1400, 1400, 2360]; // soma = 9360
  const header = new TableRow({
    children: [
      headerCell("Exercício", colWidths[0]),
      headerCell("Grupo", colWidths[1]),
      headerCell("Séries", colWidths[2]),
      headerCell("Reps", colWidths[3]),
      headerCell("Descanso", colWidths[4]),
    ],
  });

  const dataRows = items.map((raw) => {
    const ex = normalizeExercise(raw);
    return new TableRow({
      children: [
        textCell(ex.nome, colWidths[0], { bold: true }),
        textCell(ex.grupo, colWidths[1]),
        textCell(ex.series, colWidths[2]),
        textCell(ex.repeticoes, colWidths[3]),
        textCell(ex.descanso, colWidths[4]),
      ],
    });
  });

  blocks.push(heading3(treinoName));
  blocks.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: colWidths,
      borders: BORDERS_TABLE,
      rows: [header, ...dataRows],
    })
  );
  blocks.push(emptyLine(SPACING.sm));

  // Cards detalhados
  for (const raw of items) {
    const ex = normalizeExercise(raw);
    const body: (Paragraph | Table)[] = [];
    body.push(labelValue("Tipo de treino", ex.tipo));
    body.push(labelValue("Grupo muscular", ex.grupo));
    body.push(labelValue("Séries x Reps", `${ex.series} x ${ex.repeticoes}`));
    body.push(labelValue("Descanso", ex.descanso));
    if (ex.observacoes && ex.observacoes !== "—") body.push(labelValue("Observações", ex.observacoes));

    const alerts = ex.alertas;
    if (alerts && Array.isArray(alerts) && alerts.length) {
      body.push(emptyLine(60));
      body.push(para("Alertas importantes", { bold: true, color: COLOR.danger, size: SIZE.sm }));
      alerts.forEach((a: any) => body.push(bulletItem(valueToReadable(a))));
    }

    blocks.push(
      infoCard(ex.nome, body, { accentColor: COLOR.train, fill: COLOR.bg })
    );
    blocks.push(emptyLine(100));
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// MENTALIDADE: Padrões
// ═══════════════════════════════════════════════════════════════

function buildPadrao(key: string, obj: Record<string, any>): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  const padraoNum = key.replace(/\D/g, "") || "?";
  const padraoNome = valueToReadable(obj?.padrao).replace(/^—$/, "");

  const categorias = valueToReadable(obj?.categorias);

  const areas = valueToReadable(obj?.areas_impacto ?? obj?.["areas impacto"]);

  const periodo = valueToReadable(obj?.periodo ?? obj?.origem_estimada?.periodo);
  const contexto = valueToReadable(obj?.contexto_provavel ?? obj?.origem_estimada?.contexto_provavel ?? obj?.["contexto provavel"]);
  const manifest = obj?.manifestacoes_atuais ?? obj?.["Manifestacoes Atuais"] ?? null;
  const orientRaw = obj?.orientacoes_transformacao ?? obj?.["Orientacoes Transformacao"] ?? obj?.["Orientações Transformacao"] ?? obj?.orientacoes ?? null;

  const body: (Paragraph | Table)[] = [];
  body.push(tagLine("Categorias", categorias));
  body.push(tagLine("Prioridade", obj?.prioridade));
  body.push(tagLine("Áreas de impacto", areas));
  body.push(emptyLine(60));
  body.push(labelValue("Período", periodo));
  body.push(labelValue("Contexto provável", contexto));

  if (manifest) {
    body.push(emptyLine(60));
    body.push(para("Manifestações atuais", { bold: true, size: SIZE.sm, color: COLOR.mental }));
    if (Array.isArray(manifest)) {
      manifest.forEach((m: any) => body.push(bulletItem(valueToReadable(m))));
    } else {
      const text = valueToReadable(manifest);
      const parts = text.split(/\s*,\s*/).filter(Boolean);
      if (parts.length >= 3) parts.forEach((p) => body.push(bulletItem(p)));
      else body.push(para(text));
    }
  }

  children.push(
    infoCard(
      `Padrão ${padraoNum}${padraoNome ? ` — ${padraoNome}` : ""}`,
      body,
      { accentColor: COLOR.mental, fill: COLOR.mentalLight }
    )
  );

  // Orientações (Steps) — pode vir como string, array de strings ou array de objetos
  const orientSteps: Step[] = [];

  if (orientRaw != null) {
    if (Array.isArray(orientRaw)) {
      // Array de objetos com campos como nome, passo, como_fazer, etc.
      for (const [idx, item] of orientRaw.entries()) {
        if (typeof item === "string") {
          orientSteps.push({ nome: item, passo: String(idx + 1) });
        } else if (typeof item === "object" && item !== null) {
          orientSteps.push({
            nome: String(item.nome ?? item.Nome ?? "").trim(),
            passo: String(item.passo ?? item.Passo ?? idx + 1).trim(),
            como: String(item.como_fazer ?? item["Como Fazer"] ?? item.como ?? "").trim(),
            oQue: String(item.o_que_fazer ?? item["O Que Fazer"] ?? item.oQue ?? "").trim(),
            porque: String(item.porque_funciona ?? item["Porque Funciona"] ?? item.porque ?? "").trim(),
          });
        }
      }
    } else if (typeof orientRaw === "string" && orientRaw.trim()) {
      orientSteps.push(...parseOrientacoes(orientRaw));
    }
  }

  if (orientSteps.length) {
    children.push(emptyLine(100));
    children.push(para("Orientações de Transformação", { bold: true, size: SIZE.md, color: COLOR.mental }));
    children.push(emptyLine(60));
    children.push(...renderSteps(orientSteps, COLOR.mental));
  } else if (orientRaw != null && valueToReadable(orientRaw) !== "—") {
    // Fallback: texto livre que não fez parse
    children.push(emptyLine(100));
    children.push(infoCard("Orientações de Transformação", [para(valueToReadable(orientRaw))], { accentColor: COLOR.mental }));
  }

  // Extras
  const taken = new Set([
    "padrao", "categorias", "prioridade", "areas_impacto", "areas impacto", "periodo",
    "contexto_provavel", "origem_estimada", "manifestacoes_atuais", "Manifestacoes Atuais",
    "orientacoes_transformacao", "Orientacoes Transformacao", "Orientações Transformacao",
    "orientacoes", "conexoes_padroes", "conexoes padroes",
  ]);

  const extras = Object.entries(obj)
    .filter(([k, v]) => !taken.has(k) && !shouldSkipKey(k) && v != null && String(v).trim() !== "")
    .map(([k, v]) => labelValue(humanize(k), valueToReadable(v)));

  if (extras.length) {
    children.push(emptyLine(100));
    children.push(infoCard("Notas adicionais", extras, { accentColor: COLOR.muted }));
  }

  children.push(emptyLine(SPACING.md));
  return children;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT BUILDER
// ═══════════════════════════════════════════════════════════════

export function buildSolutionsDocxPremiumV3(solutions: SolutionsDataForDocx): Document {
  const children: (Paragraph | Table)[] = [];

  // ──── Capa ────
  children.push(emptyLine(SPACING.xxl));
  children.push(
    para("SUAS SOLUÇÕES DE SAÚDE", {
      bold: true,
      size: SIZE.hero,
      color: COLOR.primary,
      align: AlignmentType.CENTER,
      after: SPACING.sm,
    })
  );
  children.push(divider());
  children.push(
    para(
      "Este documento reúne as orientações e o plano definidos na sua consulta. Use-o como guia no dia a dia. Em caso de dúvidas, converse com seu médico.",
      { color: COLOR.secondary, size: SIZE.md, align: AlignmentType.CENTER, after: SPACING.md }
    )
  );
  children.push(emptyLine(SPACING.lg));

  // ──── Sumário (TOC) ────
  children.push(heading2("Sumário"));
  children.push(
    new TableOfContents("Sumário", {
      hyperlink: true,
      headingStyleRange: "1-3",
    })
  );
  children.push(caption("Atualize o sumário no Word: clique com botão direito > Atualizar campo."));
  children.push(pageBreak());

  // ════════════════════════════════════════════════════════════
  // MENTALIDADE / LIVRO DA VIDA
  // ════════════════════════════════════════════════════════════
  if (solutions.mentalidade && typeof solutions.mentalidade === "object") {
    children.push(sectionBand("Livro da Vida — Transformação Mental e Emocional", COLOR.mental, "Clareza de padrões, passos práticos e acompanhamento"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Livro da Vida — Transformação Mental e Emocional"));

    const d = solutions.mentalidade as Record<string, any>;

    if (d.resumo_executivo && valueToReadable(d.resumo_executivo) !== "—") {
      children.push(
        infoCard("Resumo Executivo", [para(valueToReadable(d.resumo_executivo))], {
          accentColor: COLOR.mental,
          fill: COLOR.mentalLight,
        })
      );
      children.push(emptyLine(SPACING.md));
    }

    const padraoKeys = Object.keys(d)
      .filter((k) => /^padrao_\d+$/i.test(k))
      .sort((a, b) => (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0));

    for (const key of padraoKeys) {
      const val = d[key];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        children.push(...buildPadrao(key, val as Record<string, any>));
      }
    }

    // Outros campos
    const others = Object.entries(d).filter(([k, v]) => {
      if (k === "resumo_executivo" || /^padrao_\d+$/i.test(k) || shouldSkipKey(k)) return false;
      return v != null && valueToReadable(v) !== "—";
    });

    if (others.length) {
      children.push(heading3("Outras orientações"));
      for (const [k, v] of others) {
        children.push(infoCard(humanize(k), [para(valueToReadable(v))], { accentColor: COLOR.mental }));
        children.push(emptyLine(100));
      }
    }

    children.push(pageBreak());
  }

  // ════════════════════════════════════════════════════════════
  // ALIMENTAÇÃO
  // ════════════════════════════════════════════════════════════
  const hasStructured = Array.isArray(solutions.alimentacao_data) && solutions.alimentacao_data.length > 0;

  if (hasStructured) {
    children.push(sectionBand("Plano Alimentar", COLOR.food, "Refeições principais + substituições por categoria"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Plano Alimentar"));

    children.push(
      highlightBox(
        "Siga as porções como referência diária. Use as substituições quando necessário. Ajuste qualquer ponto apenas com orientação do seu médico/nutricionista.",
        { fill: COLOR.foodLight, borderColor: COLOR.food }
      )
    );
    children.push(emptyLine(SPACING.md));

    for (const refeicao of solutions.alimentacao_data!) {
      const dados = safeParse<RefeicaoDataDocx>(refeicao.data, {});
      const principal = Array.isArray(dados.principal) ? dados.principal : [];
      const subs = dados.substituicoes && typeof dados.substituicoes === "object" ? dados.substituicoes : {};

      const body: (Paragraph | Table)[] = [];

      if (principal.length) {
        body.push(para("Refeição principal", { bold: true, size: SIZE.sm, color: COLOR.food }));
        body.push(mealTablePrincipal(principal));
        body.push(emptyLine(100));
      }

      const subCats = Object.entries(subs).filter(([, v]) => Array.isArray(v) && v.length);
      for (const [cat, items] of subCats) {
        body.push(para(`Substituições — ${cat}`, { bold: true, size: SIZE.sm, color: COLOR.secondary }));
        body.push(mealTableSubs(items as SubstituicaoItemDocx[]));
        body.push(emptyLine(100));
      }

      if (body.length) {
        children.push(heading3(refeicao.nome));
        children.push(
          infoCard(refeicao.nome, body, { accentColor: COLOR.food, fill: COLOR.bg })
        );
        children.push(emptyLine(SPACING.md));
      }
    }

    children.push(pageBreak());
  } else if (Array.isArray(solutions.alimentacao) && solutions.alimentacao.length) {
    children.push(sectionBand("Plano Alimentar", COLOR.food, "Lista geral por refeição"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Plano Alimentar"));

    children.push(
      highlightBox(
        "Seu plano veio em formato de lista. Para uma versão mais detalhada, solicite o formato estruturado por refeição.",
        { fill: COLOR.foodLight, borderColor: COLOR.food }
      )
    );
    children.push(emptyLine(SPACING.md));

    const map = new Map<string, any[]>();
    for (const it of solutions.alimentacao) {
      const meal = String(it?._meal ?? "Outros").trim();
      if (!map.has(meal)) map.set(meal, []);
      map.get(meal)!.push(it);
    }

    for (const [meal, items] of map.entries()) {
      const colWidths = [3000, 2160, 2100, 2100]; // soma = 9360
      const header = new TableRow({
        children: [
          headerCell("Alimento", colWidths[0]),
          headerCell("Tipo", colWidths[1]),
          headerCell("Porção (g)", colWidths[2]),
          headerCell("Energia (kcal)", colWidths[3]),
        ],
      });

      const rows = items.map((item: any) => {
        const porcao = item.ref1_g ?? item.ref2_g ?? item.ref3_g ?? item.ref4_g ?? item.gramatura ?? "—";
        const kcal = item.ref1_kcal ?? item.ref2_kcal ?? item.ref3_kcal ?? item.ref4_kcal ?? item.kcal ?? "—";
        const porcaoStr = porcao === "—" ? "—" : String(porcao).endsWith("g") ? String(porcao) : `${porcao}g`;
        return new TableRow({
          children: [
            textCell(String(item.alimento ?? "—"), colWidths[0]),
            textCell(String(item.tipo_de_alimentos ?? item.tipo ?? "—"), colWidths[1]),
            textCell(porcaoStr, colWidths[2]),
            textCell(String(kcal), colWidths[3]),
          ],
        });
      });

      children.push(heading3(meal));
      children.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: colWidths,
          borders: BORDERS_TABLE,
          rows: [header, ...rows],
        })
      );
      children.push(emptyLine(SPACING.md));
    }

    children.push(pageBreak());
  }

  // ════════════════════════════════════════════════════════════
  // SUPLEMENTAÇÃO
  // ════════════════════════════════════════════════════════════
  if (solutions.suplementacao && typeof solutions.suplementacao === "object") {
    children.push(sectionBand("Protocolo de Suplementação", COLOR.supp, "Dose, horários e objetivos"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Protocolo de Suplementação"));

    children.push(
      highlightBox(
        "Se houver qualquer reação adversa, suspenda e contate seu médico. Evite alterar dose/horário sem orientação. Siga o período de início/término e reavaliação.",
        { fill: COLOR.suppLight, borderColor: COLOR.supp }
      )
    );
    children.push(emptyLine(SPACING.md));

    const d = solutions.suplementacao as Record<string, any>;
    const categories = [
      { key: "suplementos", label: "Suplementos" },
      { key: "fitoterapicos", label: "Fitoterápicos" },
      { key: "homeopatia", label: "Homeopatia" },
      { key: "florais_bach", label: "Florais de Bach" },
    ];

    let anyCategory = false;

    for (const { key, label } of categories) {
      const items = d[key];
      if (!Array.isArray(items) || !items.length) continue;
      anyCategory = true;

      children.push(heading3(label));
      items.forEach((item: any, i: number) => {
        children.push(renderSupplementItem(item, `${label} ${i + 1}`, COLOR.supp));
        children.push(emptyLine(100));
      });
    }

    if (!anyCategory) {
      const pairs = Object.entries(d)
        .filter(([k, v]) => !shouldSkipKey(k) && v != null && String(v).trim() !== "")
        .map(([k, v]) => labelValue(humanize(k), valueToReadable(v)));

      children.push(
        infoCard("Detalhes", pairs.length ? pairs : [para("Sem itens detalhados disponíveis.")], {
          accentColor: COLOR.supp,
        })
      );
    }

    children.push(pageBreak());
  }

  // ════════════════════════════════════════════════════════════
  // EXERCÍCIOS
  // ════════════════════════════════════════════════════════════
  if (Array.isArray(solutions.exercicios) && solutions.exercicios.length) {
    children.push(sectionBand("Programa de Exercícios", COLOR.train, "Treinos agrupados + resumo + detalhes por exercício"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Programa de Exercícios"));

    children.push(
      highlightBox(
        "Respeite descansos e priorize técnica (não carga). Se sentir dor aguda, interrompa imediatamente. Hidratação e consistência são mais importantes que intensidade.",
        { fill: COLOR.trainLight, borderColor: COLOR.train }
      )
    );
    children.push(emptyLine(SPACING.md));

    const grouped = groupExercises(solutions.exercicios);
    for (const [treinoName, items] of grouped.entries()) {
      children.push(...renderTrainingBlock(treinoName, items));
      children.push(emptyLine(SPACING.md));
    }

    children.push(pageBreak());
  }

  // ════════════════════════════════════════════════════════════
  // HÁBITOS
  // ════════════════════════════════════════════════════════════
  if (solutions.habitos != null) {
    children.push(sectionBand("Hábitos de Vida", COLOR.habits, "Pequenas mudanças que sustentam o plano"));
    children.push(emptyLine(SPACING.md));
    children.push(heading1("Hábitos de Vida"));

    const h = solutions.habitos;

    if (Array.isArray(h)) {
      const body = h.map((x: any) => bulletItem(valueToReadable(x)));
      children.push(infoCard("Seus hábitos recomendados", body, { accentColor: COLOR.habits, fill: COLOR.habitsLight }));
    } else if (typeof h === "object") {
      const lines = Object.entries(h)
        .filter(([k, v]) => !shouldSkipKey(k) && v != null && String(v).trim() !== "")
        .map(([k, v]) => labelValue(humanize(k), valueToReadable(v)));
      children.push(
        infoCard("Hábitos", lines.length ? lines : [para("Sem hábitos informados.")], {
          accentColor: COLOR.habits,
          fill: COLOR.habitsLight,
        })
      );
    } else {
      children.push(infoCard("Hábitos", [para(valueToReadable(h))], { accentColor: COLOR.habits }));
    }

    children.push(emptyLine(SPACING.lg));
  }

  // ──── Encerramento ────
  children.push(divider());
  children.push(emptyLine(SPACING.sm));
  children.push(
    highlightBox(
      "Em caso de dúvidas ou para ajustar seu plano, entre em contato com seu médico. Este documento é um guia de apoio e não substitui avaliação clínica individual.",
      { fill: COLOR.primaryLight, borderColor: COLOR.primary }
    )
  );

  // ──── Montar Document ────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT.primary, size: SIZE.base, color: COLOR.text },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: SIZE.xxl, bold: true, font: FONT.primary, color: COLOR.text },
          paragraph: { spacing: { before: SPACING.lg, after: SPACING.md }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: SIZE.xl, bold: true, font: FONT.primary, color: COLOR.text },
          paragraph: { spacing: { before: SPACING.md, after: SPACING.sm }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: SIZE.lg, bold: true, font: FONT.primary, color: COLOR.text },
          paragraph: { spacing: { before: SPACING.sm, after: SPACING.xs }, outlineLevel: 2 },
        },
      ],
    },
    numbering: { config: NUMBERING_CONFIG as any },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.marginTop,
              right: PAGE.marginRight,
              bottom: PAGE.marginBottom,
              left: PAGE.marginLeft,
              header: 720, // 0.5″
              footer: 720,
              gutter: 0,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Soluções de Saúde", size: SIZE.xs, color: COLOR.muted, font: FONT.primary }),
                ],
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border, space: 1 } },
                spacing: { after: 0 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Documento confidencial", size: SIZE.xs, color: COLOR.muted, font: FONT.primary }),
                  new TextRun({ text: "\t", size: SIZE.xs }),
                  new TextRun({ text: "Página ", size: SIZE.xs, color: COLOR.muted, font: FONT.primary }),
                  new TextRun({ children: [PageNumber.CURRENT], size: SIZE.xs, color: COLOR.muted, font: FONT.primary }),
                ],
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border, space: 1 } },
                spacing: { before: 60 },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return doc;
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZATION & DOWNLOAD
// ═══════════════════════════════════════════════════════════════

function normalizeSolutions(solutions: Partial<SolutionsDataForDocx> | null): SolutionsDataForDocx {
  if (!solutions || typeof solutions !== "object") {
    return { ltb: null, mentalidade: null, alimentacao: [], alimentacao_data: null, suplementacao: null, exercicios: [], habitos: null };
  }
  return {
    ltb: solutions.ltb ?? null,
    mentalidade: solutions.mentalidade ?? null,
    alimentacao: Array.isArray(solutions.alimentacao) ? solutions.alimentacao : [],
    alimentacao_data: Array.isArray((solutions as any).alimentacao_data) ? (solutions as any).alimentacao_data : null,
    suplementacao: solutions.suplementacao ?? null,
    exercicios: Array.isArray(solutions.exercicios) ? solutions.exercicios : [],
    habitos: solutions.habitos ?? null,
  };
}

/** Gera o DOCX e dispara download no browser */
export async function downloadSolutionsDocxPremium(
  solutions: SolutionsDataForDocx | Partial<SolutionsDataForDocx> | null,
  filename: string = "solucoes-consulta-premium.docx"
): Promise<void> {
  const normalized = normalizeSolutions(solutions);
  const doc = buildSolutionsDocxPremiumV3(normalized);

  let blob: Blob;
  try {
    blob = await Packer.toBlob(doc);
  } catch (e) {
    console.error("Erro ao gerar DOCX (Packer.toBlob):", e);
    throw new Error("Falha ao gerar o documento. Tente novamente.");
  }

  const fileSaver = await import("file-saver");
  const saveAs = (fileSaver as any).saveAs ?? (fileSaver as any).default;
  if (typeof saveAs !== "function") {
    throw new Error("Download não disponível neste navegador.");
  }
  saveAs(blob, filename);
}

/** Gera o DOCX como Buffer (para uso server-side) */
export async function generateSolutionsDocxBuffer(
  solutions: SolutionsDataForDocx | Partial<SolutionsDataForDocx> | null
): Promise<Buffer> {
  const normalized = normalizeSolutions(solutions);
  const doc = buildSolutionsDocxPremiumV3(normalized);
  return await Packer.toBuffer(doc);
}