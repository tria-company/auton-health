/**
 * Protocol Service - Gera protocolo de atendimento baseado na transcrição
 */

interface ProtocolInput {
    transcriptText: string;
    utterances: Array<{
        speaker: string;
        text: string;
        confidence?: number;
    }>;
    suggestions: Array<{
        text: string;
        type: string;
        used?: boolean;
    }>;
    usedSuggestions: Array<{
        text: string;
        type: string;
    }>;
    participants: {
        doctor?: { name?: string };
        patient?: { name?: string };
    };
}

interface ProtocolOutput {
    summary: string;
    key_points: string[];
    diagnosis?: string;
    treatment?: string;
    observations?: string;
    full_text: string;
}

/**
 * Gera um protocolo simples de atendimento baseado nos dados da sessão
 */
export function generateSimpleProtocol(input: ProtocolInput): ProtocolOutput {
    const { transcriptText, utterances, suggestions, usedSuggestions, participants } = input;

    const doctorName = participants.doctor?.name || 'Médico';
    const patientName = participants.patient?.name || 'Paciente';
    const now = new Date().toLocaleString('pt-BR');

    // Extrair pontos-chave básicos da transcrição
    const keyPoints: string[] = [];

    // Adicionar sugestões usadas como pontos-chave
    usedSuggestions.forEach(suggestion => {
        keyPoints.push(`Sugestão aplicada: ${suggestion.text}`);
    });

    // Se não houver pontos-chave, adicionar um genérico
    if (keyPoints.length === 0) {
        keyPoints.push('Consulta realizada sem sugestões específicas aplicadas');
    }

    // Gerar resumo
    const utteranceCount = utterances.length;
    const wordCount = transcriptText.split(/\s+/).length;

    const summary = `Consulta entre ${doctorName} e ${patientName} realizada em ${now}. ` +
        `Foram registradas ${utteranceCount} intervenções com total de ${wordCount} palavras. ` +
        `${usedSuggestions.length} sugestão(ões) do sistema foram aplicadas.`;

    // Gerar texto completo do protocolo
    const fullText = `
PROTOCOLO DE ATENDIMENTO
========================
Data: ${now}
Médico: ${doctorName}
Paciente: ${patientName}

RESUMO
------
${summary}

PONTOS-CHAVE
------------
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

TRANSCRIÇÃO
-----------
${transcriptText || 'Transcrição não disponível'}

SUGESTÕES UTILIZADAS (${usedSuggestions.length}/${suggestions.length})
-------------------
${usedSuggestions.length > 0
            ? usedSuggestions.map(s => `- [${s.type}] ${s.text}`).join('\n')
            : 'Nenhuma sugestão foi utilizada.'}
`.trim();

    return {
        summary,
        key_points: keyPoints,
        full_text: fullText
    };
}
