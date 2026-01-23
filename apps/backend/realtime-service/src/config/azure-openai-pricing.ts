/**
 * Azure OpenAI Pricing Reference
 * 
 * Preços por 1 milhão (1M) de tokens - Dezembro 2024
 * Fonte: https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/
 * 
 * IMPORTANTE: Estes preços podem mudar. Verifique a página oficial da Azure para preços atualizados.
 * Última atualização: 2024-12-22
 */

export interface ModelPricing {
    /** Nome do modelo */
    model: string;
    /** Nome do deployment no Azure */
    deployment: string;
    /** Preço por 1M de tokens de input (em USD) */
    inputPer1M: number;
    /** Preço por 1M de tokens de output (em USD) */
    outputPer1M: number;
    /** Preço por 1M de tokens de input em cache (em USD) - se aplicável */
    cachedInputPer1M?: number;
    /** Unidade de cobrança (tokens ou minutos) */
    unit: 'tokens' | 'minutes';
    /** Notas adicionais */
    notes?: string;
}

export interface WhisperPricing {
    /** Nome do modelo */
    model: string;
    /** Nome do deployment no Azure */
    deployment: string;
    /** Preço por hora de áudio (em USD) */
    pricePerHour: number;
    /** Preço por minuto de áudio (em USD) */
    pricePerMinute: number;
    /** Notas adicionais */
    notes?: string;
}

export interface RealtimePricing {
    /** Nome do modelo */
    model: string;
    /** Nome do deployment no Azure */
    deployment: string;
    /** Preço por 1M de tokens de texto input (em USD) */
    textInputPer1M: number;
    /** Preço por 1M de tokens de texto output (em USD) */
    textOutputPer1M: number;
    /** Preço por 1M de tokens de áudio input (em USD) */
    audioInputPer1M: number;
    /** Preço por 1M de tokens de áudio output (em USD) */
    audioOutputPer1M: number;
    /** Preço por 1M de tokens de input em cache (texto/áudio) - se aplicável */
    cachedInputPer1M?: number;
    /** Notas adicionais */
    notes?: string;
}

// ============================================================================
// MODELOS DE CHAT (GPT-4o-mini)
// ============================================================================

export const GPT4O_MINI_PRICING: ModelPricing = {
    model: 'gpt-4o-mini',
    deployment: 'gpt-4o-mini',
    inputPer1M: 0.15,        // $0.15 por 1M tokens de input
    outputPer1M: 0.60,       // $0.60 por 1M tokens de output
    cachedInputPer1M: 0.075, // $0.075 por 1M tokens de input em cache (50% de desconto)
    unit: 'tokens',
    notes: 'Modelo mais econômico. Ideal para tarefas gerais de chat e assistência.'
};

// ============================================================================
// MODELOS DE TRANSCRIÇÃO (Whisper)
// ============================================================================

export const WHISPER_PRICING: WhisperPricing = {
    model: 'whisper-1',
    deployment: 'whisper',
    pricePerHour: 0.36,     // $0.36 por hora de áudio
    pricePerMinute: 0.006,  // $0.006 por minuto de áudio
    notes: 'Cobrado por duração do áudio, não por tokens. Suporta múltiplos formatos de áudio.'
};

// ============================================================================
// MODELOS REALTIME (GPT-4o-Realtime)
// ============================================================================

export const GPT4O_REALTIME_PRICING: RealtimePricing = {
    model: 'gpt-4o-realtime-preview',
    deployment: 'gpt-realtime-mini',
    textInputPer1M: 2.50,   // $2.50 por 1M tokens de texto input
    textOutputPer1M: 10.00, // $10.00 por 1M tokens de texto output
    audioInputPer1M: 40.00, // $40.00 por 1M tokens de áudio input
    audioOutputPer1M: 80.00, // $80.00 por 1M tokens de áudio output
    cachedInputPer1M: 0.40, // $0.40 por 1M tokens de input em cache
    notes: 'Modelo para conversação em tempo real. Preços significativamente mais altos que chat padrão.'
};

// ============================================================================
// TABELA CONSOLIDADA DE PREÇOS
// ============================================================================

export const AZURE_OPENAI_PRICING = {
    chat: {
        'gpt-4o-mini': GPT4O_MINI_PRICING,
    },
    whisper: {
        'whisper': WHISPER_PRICING,
    },
    realtime: {
        'gpt-realtime-mini': GPT4O_REALTIME_PRICING,
    }
} as const;

// ============================================================================
// FUNÇÕES UTILITÁRIAS DE CÁLCULO DE CUSTO
// ============================================================================

/**
 * Calcula o custo de tokens de chat
 * @param inputTokens - Número de tokens de input
 * @param outputTokens - Número de tokens de output
 * @param cachedInputTokens - Número de tokens de input em cache (opcional)
 * @param model - Nome do modelo (default: 'gpt-4o-mini')
 * @returns Custo total em USD
 */
export function calculateChatCost(
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens: number = 0,
    model: keyof typeof AZURE_OPENAI_PRICING.chat = 'gpt-4o-mini'
): number {
    const pricing = AZURE_OPENAI_PRICING.chat[model];

    const regularInputCost = ((inputTokens - cachedInputTokens) / 1_000_000) * pricing.inputPer1M;
    const cachedInputCost = (cachedInputTokens / 1_000_000) * (pricing.cachedInputPer1M || pricing.inputPer1M);
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

    return regularInputCost + cachedInputCost + outputCost;
}

/**
 * Calcula o custo de transcrição Whisper
 * @param durationMs - Duração do áudio em milissegundos
 * @returns Custo total em USD
 */
export function calculateWhisperCost(durationMs: number): number {
    const durationMinutes = durationMs / 1000 / 60;
    return durationMinutes * WHISPER_PRICING.pricePerMinute;
}

/**
 * Calcula o custo de sessão Realtime
 * @param textInputTokens - Número de tokens de texto input
 * @param textOutputTokens - Número de tokens de texto output
 * @param audioInputTokens - Número de tokens de áudio input
 * @param audioOutputTokens - Número de tokens de áudio output
 * @param cachedTokens - Número de tokens em cache (opcional)
 * @returns Custo total em USD
 */
export function calculateRealtimeCost(
    textInputTokens: number,
    textOutputTokens: number,
    audioInputTokens: number,
    audioOutputTokens: number,
    cachedTokens: number = 0
): number {
    const pricing = GPT4O_REALTIME_PRICING;

    const textInputCost = (textInputTokens / 1_000_000) * pricing.textInputPer1M;
    const textOutputCost = (textOutputTokens / 1_000_000) * pricing.textOutputPer1M;
    const audioInputCost = (audioInputTokens / 1_000_000) * pricing.audioInputPer1M;
    const audioOutputCost = (audioOutputTokens / 1_000_000) * pricing.audioOutputPer1M;
    const cachedCost = (cachedTokens / 1_000_000) * (pricing.cachedInputPer1M || 0);

    return textInputCost + textOutputCost + audioInputCost + audioOutputCost - cachedCost;
}

// ============================================================================
// EXPORTAÇÕES PARA LOGGING/MONITORAMENTO
// ============================================================================

/**
 * Retorna um resumo dos preços para logging
 */
export function getPricingSummary(): string {
    return `
📊 Azure OpenAI Pricing Summary (per 1M tokens/units)
======================================================

🤖 GPT-4o-mini (Chat):
   • Input:        $${GPT4O_MINI_PRICING.inputPer1M.toFixed(2)}
   • Output:       $${GPT4O_MINI_PRICING.outputPer1M.toFixed(2)}
   • Cached Input: $${GPT4O_MINI_PRICING.cachedInputPer1M?.toFixed(3) || 'N/A'}

🎤 Whisper (Transcrição):
   • Por Minuto:   $${WHISPER_PRICING.pricePerMinute.toFixed(4)}
   • Por Hora:     $${WHISPER_PRICING.pricePerHour.toFixed(2)}

🔴 GPT-4o-Realtime:
   • Text Input:   $${GPT4O_REALTIME_PRICING.textInputPer1M.toFixed(2)}
   • Text Output:  $${GPT4O_REALTIME_PRICING.textOutputPer1M.toFixed(2)}
   • Audio Input:  $${GPT4O_REALTIME_PRICING.audioInputPer1M.toFixed(2)}
   • Audio Output: $${GPT4O_REALTIME_PRICING.audioOutputPer1M.toFixed(2)}
   • Cached:       $${GPT4O_REALTIME_PRICING.cachedInputPer1M?.toFixed(2) || 'N/A'}

⚠️  Preços de referência - Dezembro 2024
    Verifique azure.microsoft.com para preços atualizados.
`.trim();
}
