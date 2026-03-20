/**
 * Gerador de Receita PDF - Protocolo de Suplementacao
 * Usa jsPDF para gerar um PDF formatado como receita medica
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

// Cores do sistema
const PRIMARY = [26, 61, 97]; // #1A3D61
const TEXT_DARK = [15, 23, 42]; // #0F172A
const TEXT_GRAY = [100, 116, 139]; // #64748B
const TEXT_LIGHT = [148, 163, 184]; // #94A3B8
const BORDER = [226, 232, 240]; // #E2E8F0
const BG_LIGHT = [241, 245, 249]; // #F1F5F9

function drawLine(doc: jsPDF, y: number, x1: number = 20, x2: number = 190) {
  doc.setDrawColor(...BORDER as [number, number, number]);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function checkPageBreak(doc: jsPDF, y: number, needed: number = 40): number {
  if (y + needed > 270) {
    doc.addPage();
    return 25;
  }
  return y;
}

export function gerarReceitaPdf({
  suplementacaoData,
  medico,
  paciente,
  dataConsulta,
}: ReceitaParams) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // ════════════════════════════════════════════
  // HEADER - Dados do Medico
  // ════════════════════════════════════════════

  // Linha superior decorativa
  doc.setFillColor(...PRIMARY as [number, number, number]);
  doc.rect(0, 0, pageWidth, 3, 'F');

  y = 15;

  // Nome do medico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY as [number, number, number]);
  doc.text(medico.nome || 'Dr(a). Nome do Medico', margin, y);
  y += 7;

  // Especialidade e CRM
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_GRAY as [number, number, number]);
  const infoLine = [
    medico.especialidade,
    medico.crm ? `CRM: ${medico.crm}` : null,
  ].filter(Boolean).join(' | ');
  if (infoLine) {
    doc.text(infoLine, margin, y);
    y += 5;
  }

  // Contato do medico
  const contatoLine = [
    medico.telefone,
    medico.email,
  ].filter(Boolean).join(' | ');
  if (contatoLine) {
    doc.text(contatoLine, margin, y);
    y += 5;
  }

  if (medico.endereco) {
    doc.text(medico.endereco, margin, y);
    y += 5;
  }

  y += 2;
  drawLine(doc, y);
  y += 8;

  // ════════════════════════════════════════════
  // TITULO DA RECEITA
  // ════════════════════════════════════════════

  doc.setFillColor(...BG_LIGHT as [number, number, number]);
  doc.roundedRect(margin, y - 4, contentWidth, 14, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PRIMARY as [number, number, number]);
  doc.text('RECEITA - PROTOCOLO DE SUPLEMENTACAO', pageWidth / 2, y + 4, { align: 'center' });
  y += 16;

  // ════════════════════════════════════════════
  // DADOS DO PACIENTE
  // ════════════════════════════════════════════

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK as [number, number, number]);
  doc.text('Paciente:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(paciente.nome || 'N/A', margin + 22, y);

  // Data
  doc.setFont('helvetica', 'bold');
  doc.text('Data:', 130, y);
  doc.setFont('helvetica', 'normal');
  doc.text(dataConsulta || new Date().toLocaleDateString('pt-BR'), 143, y);
  y += 8;

  drawLine(doc, y);
  y += 10;

  // ════════════════════════════════════════════
  // ITENS DA RECEITA
  // ════════════════════════════════════════════

  const categories: { title: string; key: keyof SuplementacaoData }[] = [
    { title: 'SUPLEMENTOS', key: 'suplementos' },
    { title: 'FITOTERAPICOS', key: 'fitoterapicos' },
    { title: 'HOMEOPATIA', key: 'homeopatia' },
    { title: 'FLORAIS DE BACH', key: 'florais_bach' },
  ];

  let itemNumber = 1;

  categories.forEach(cat => {
    const items = suplementacaoData[cat.key] || [];
    if (items.length === 0) return;

    y = checkPageBreak(doc, y, 25);

    // Titulo da categoria
    doc.setFillColor(...PRIMARY as [number, number, number]);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(cat.title, margin + 5, y + 2);
    y += 12;

    items.forEach((item) => {
      y = checkPageBreak(doc, y, 45);

      // Numero do item
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY as [number, number, number]);
      doc.text(`${String(itemNumber).padStart(2, '0')}.`, margin, y);

      // Nome
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...TEXT_DARK as [number, number, number]);
      doc.text(item.nome || 'Sem nome', margin + 10, y);
      y += 7;

      // Dosagem
      if (item.dosagem) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY as [number, number, number]);
        doc.text('Dosagem:', margin + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.text(item.dosagem, margin + 32, y);
        y += 5;
      }

      // Horario
      if (item.horario) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY as [number, number, number]);
        doc.text('Horario:', margin + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.text(item.horario, margin + 30, y);
        y += 5;
      }

      // Periodo
      const periodo = [item.inicio, item.termino].filter(Boolean).join(' a ');
      if (periodo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY as [number, number, number]);
        doc.text('Periodo:', margin + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.text(periodo, margin + 31, y);
        y += 5;
      }

      // Objetivo
      if (item.objetivo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_GRAY as [number, number, number]);
        doc.text('Objetivo:', margin + 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(item.objetivo, contentWidth - 40);
        doc.text(lines, margin + 32, y);
        y += lines.length * 4 + 2;
      }

      y += 3;
      // Linha separadora entre itens
      doc.setDrawColor(...BORDER as [number, number, number]);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(margin + 10, y, pageWidth - margin, y);
      doc.setLineDashPattern([], 0);
      y += 5;

      itemNumber++;
    });

    y += 3;
  });

  // ════════════════════════════════════════════
  // OBSERVACOES
  // ════════════════════════════════════════════

  y = checkPageBreak(doc, y, 30);
  y += 5;
  drawLine(doc, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK as [number, number, number]);
  doc.text('OBSERVACOES IMPORTANTES:', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY as [number, number, number]);

  const obs = [
    'Este protocolo e personalizado e nao deve ser compartilhado com terceiros.',
    'Em caso de reacao adversa, suspenda o uso e entre em contato com o profissional.',
    'Manter os suplementos em local fresco e seco, ao abrigo da luz solar.',
    'Respeitar os horarios e dosagens prescritos para melhor eficacia.',
  ];

  obs.forEach(text => {
    doc.text(`- ${text}`, margin + 3, y);
    y += 5;
  });

  // ════════════════════════════════════════════
  // ASSINATURA
  // ════════════════════════════════════════════

  y = checkPageBreak(doc, y, 40);
  y += 15;

  // Linha de assinatura
  drawLine(doc, y, pageWidth / 2 - 40, pageWidth / 2 + 40);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY as [number, number, number]);
  doc.text(medico.nome || 'Dr(a). Nome do Medico', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY as [number, number, number]);
  const assinaturaInfo = [
    medico.especialidade,
    medico.crm ? `CRM: ${medico.crm}` : null,
  ].filter(Boolean).join(' | ');
  if (assinaturaInfo) {
    doc.text(assinaturaInfo, pageWidth / 2, y, { align: 'center' });
  }

  // ════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Linha inferior decorativa
    doc.setFillColor(...PRIMARY as [number, number, number]);
    doc.rect(0, 294, pageWidth, 3, 'F');

    // Numero da pagina
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_LIGHT as [number, number, number]);
    doc.text(
      `Pagina ${i} de ${totalPages}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );

    // Data de emissao
    doc.text(
      `Emitido em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      pageWidth - margin,
      290,
      { align: 'right' }
    );
  }

  // Salvar
  const nomeArquivo = `Receita_Suplementacao_${paciente.nome?.replace(/\s+/g, '_') || 'paciente'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
}
