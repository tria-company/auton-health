/**
 * Gerador de Receita PDF - Prescricao de Formula
 * Estilo classico de receita medica/nutricional
 * Uma pagina por item prescrito
 */

import { jsPDF } from 'jspdf';

interface SuplementacaoItem {
  nome?: string;
  objetivo?: string;
  dosagem?: string;
  horario?: string;
  inicio?: string;
  termino?: string;
}

interface SuplementacaoData {
  suplementos: SuplementacaoItem[];
  fitoterapicos: SuplementacaoItem[];
  homeopatia: SuplementacaoItem[];
  florais_bach: SuplementacaoItem[];
}

interface DadosMedico {
  nome: string;
  crm?: string;
  especialidade?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

interface DadosPaciente {
  nome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
}

interface ReceitaParams {
  suplementacaoData: SuplementacaoData;
  medico: DadosMedico;
  paciente: DadosPaciente;
  dataConsulta: string;
}

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [120, 120, 120];
const LINE_COLOR: [number, number, number] = [0, 0, 0];

function drawHr(doc: jsPDF, y: number, x1: number = 25, x2: number = 185) {
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.4);
  doc.line(x1, y, x2, y);
}

function drawThinHr(doc: jsPDF, y: number, x1: number = 25, x2: number = 185) {
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.15);
  doc.line(x1, y, x2, y);
}

function getCategoryLabel(key: string): string {
  const map: Record<string, string> = {
    suplementos: 'SUPLEMENTACAO',
    fitoterapicos: 'FITOTERAPICO',
    homeopatia: 'HOMEOPATIA',
    florais_bach: 'FLORAIS DE BACH',
  };
  return map[key] || key.toUpperCase();
}

export function gerarReceitaPdf({
  suplementacaoData,
  medico,
  paciente,
  dataConsulta,
}: ReceitaParams) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  const center = pageWidth / 2;

  // Coletar todos os itens com sua categoria
  const allItems: { item: SuplementacaoItem; category: string }[] = [];

  const categories: { key: keyof SuplementacaoData }[] = [
    { key: 'suplementos' },
    { key: 'fitoterapicos' },
    { key: 'homeopatia' },
    { key: 'florais_bach' },
  ];

  categories.forEach(cat => {
    const items = suplementacaoData[cat.key] || [];
    items.forEach(item => {
      if (item.nome) {
        allItems.push({ item, category: cat.key });
      }
    });
  });

  if (allItems.length === 0) {
    // Pagina vazia se nao tem itens
    doc.setFont('courier', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text('Nenhum item prescrito.', center, 140, { align: 'center' });
    doc.save('Receita_Vazia.pdf');
    return;
  }

  // Gerar uma pagina por item
  allItems.forEach(({ item, category }, idx) => {
    if (idx > 0) doc.addPage();

    let y = 20;

    // ════════════════════════════════════════════
    // TITULO: Prescricao de formula
    // ════════════════════════════════════════════
    doc.setFont('courier', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('Prescricao de formula', center, y, { align: 'center' });
    y += 7;

    // Nome do paciente
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`Nome do paciente: ${paciente.nome || 'N/A'}`, center, y, { align: 'center' });
    y += 10;

    // Linha separadora
    drawHr(doc, y);
    y += 10;

    // ════════════════════════════════════════════
    // USO INTERNO
    // ════════════════════════════════════════════
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text('Uso Interno', center, y, { align: 'center' });
    y += 15;

    // ════════════════════════════════════════════
    // CATEGORIA + NOME
    // ════════════════════════════════════════════
    doc.setFont('courier', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(`${getCategoryLabel(category)} - ${(item.nome || '').toUpperCase()}`, margin, y);
    y += 12;

    // ════════════════════════════════════════════
    // DOSAGEM (linha pontilhada)
    // ════════════════════════════════════════════
    if (item.dosagem) {
      const dotsWidth = 100;
      const labelText = item.nome || '';
      const valueText = item.dosagem;

      doc.setFont('courier', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...BLACK);

      // Nome do componente --- dosagem
      const labelWidth = doc.getTextWidth(labelText);
      const valueWidth = doc.getTextWidth(valueText);
      const dotsCount = Math.floor((contentWidth - labelWidth - valueWidth - 4) / doc.getTextWidth('-'));
      const dots = '-'.repeat(Math.max(dotsCount, 3));

      doc.text(`${labelText} ${dots} ${valueText}`, margin, y);
      y += 10;
    }

    // ════════════════════════════════════════════
    // HORARIO DE USO
    // ════════════════════════════════════════════
    if (item.horario) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...BLACK);
      const horarioLines = doc.splitTextToSize(item.horario, contentWidth);
      doc.text(horarioLines, margin, y);
      y += horarioLines.length * 6 + 8;
    }

    // ════════════════════════════════════════════
    // OBJETIVO
    // ════════════════════════════════════════════
    if (item.objetivo) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      const objLines = doc.splitTextToSize(item.objetivo, contentWidth);
      doc.text(objLines, margin, y);
      y += objLines.length * 5 + 8;
    }

    // ════════════════════════════════════════════
    // PERIODO
    // ════════════════════════════════════════════
    if (item.inicio || item.termino) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      const periodoText = [
        item.inicio ? `Inicio: ${item.inicio}` : null,
        item.termino ? `Termino: ${item.termino}` : null,
      ].filter(Boolean).join('. ');
      const periodoLines = doc.splitTextToSize(periodoText, contentWidth);
      doc.text(periodoLines, margin, y);
      y += periodoLines.length * 5 + 8;
    }

    // ════════════════════════════════════════════
    // ASSINATURA (parte inferior fixa)
    // ════════════════════════════════════════════

    // Linha de assinatura
    const sigY = 210;
    drawHr(doc, sigY, center - 50, center + 50);

    // Nome do profissional + registro
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);

    const sigParts = [medico.nome || ''];
    if (medico.especialidade) sigParts[0] = `${medico.nome} - ${medico.especialidade}`;
    if (medico.crm) sigParts.push(medico.crm);

    const sigText = sigParts.join(' ');
    doc.text(sigText, center, sigY + 6, { align: 'center' });

    // ════════════════════════════════════════════
    // FOOTER
    // ════════════════════════════════════════════

    // Texto de verificacao
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    const verifyText = [
      'Visualize o documento original atraves da',
      'leitura do QR Code ao lado. Em caso de',
      'divergencias, entre em contato com o',
      'profissional responsavel pelo documento.',
    ];
    verifyText.forEach((line, i) => {
      doc.text(line, center + 5, 255 + (i * 4), { align: 'left' });
    });

    // Pagina
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Pagina ${idx + 1}/${allItems.length}`, margin, 285);

    // Nome do profissional no footer
    const footerName = [medico.especialidade, medico.nome].filter(Boolean).join(' ');
    doc.text(footerName, pageWidth - margin, 285, { align: 'right' });
  });

  // Salvar
  const nomeArquivo = `Prescricao_${paciente.nome?.replace(/\s+/g, '_') || 'paciente'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * Gerar PDF de prescricao para um unico item
 */
interface ReceitaItemParams {
  item: SuplementacaoItem;
  category: string;
  medico: DadosMedico;
  paciente: DadosPaciente;
}

export function gerarReceitaItemPdf({
  item,
  category,
  medico,
  paciente,
}: ReceitaItemParams) {
  // Reutilizar a funcao principal com apenas 1 item
  const suplementacaoData: SuplementacaoData = {
    suplementos: [],
    fitoterapicos: [],
    homeopatia: [],
    florais_bach: [],
  };

  // Colocar o item na categoria correta
  const key = category as keyof SuplementacaoData;
  if (key in suplementacaoData) {
    suplementacaoData[key] = [item];
  }

  gerarReceitaPdf({
    suplementacaoData,
    medico,
    paciente,
    dataConsulta: new Date().toLocaleDateString('pt-BR'),
  });
}
