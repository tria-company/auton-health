export type AIServiceType = 'whisper' | 'gpt-4' | 'gpt-3.5';

export interface AIPricingLog {
    id: string;
    consultation_id?: string;
    service: AIServiceType;
    model: string;
    tokens_input?: number;
    tokens_output?: number;
    duration_seconds?: number; // for audio
    cost: number;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface AIPricingStats {
    total_cost: number;
    total_tokens: number;
    usage_by_service: Record<AIServiceType, number>;
    period_start: string;
    period_end: string;
}
