import { AzureOpenAI } from 'openai';
import { aiConfig } from '../config';

/**
 * Tipos para o LLM Service
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    text: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    cost: number;
}

/**
 * Serviço de LLM (Large Language Model)
 * Usa Azure OpenAI GPT-4o para geração de texto
 */
class LLMService {
    private client: AzureOpenAI | null = null;

    private getClient(): AzureOpenAI {
        if (!this.client) {
            if (!aiConfig.azure.apiKey) {
                throw new Error('AZURE_OPENAI_API_KEY não configurada. Verifique o arquivo .env do realtime-service.');
            }
            this.client = new AzureOpenAI({
                apiKey: aiConfig.azure.apiKey,
                endpoint: aiConfig.azure.endpoint,
                apiVersion: aiConfig.azure.apiVersions.chat,
                deployment: aiConfig.azure.deployments.chat,
            });
        }
        return this.client;
    }

    /**
     * Gera completions usando GPT-4o
     */
    async generateCompletion(messages: LLMMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
    }): Promise<LLMResponse> {
        try {
            const client = this.getClient();
            const response = await client.chat.completions.create({
                model: aiConfig.azure.deployments.chat,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                temperature: options?.temperature ?? aiConfig.openai.temperature,
                max_tokens: options?.maxTokens ?? aiConfig.openai.maxTokens,
                top_p: options?.topP ?? 0.95,
            });

            const choice = response.choices[0];
            const usage = response.usage;

            if (!choice?.message?.content || !usage) {
                throw new Error('Invalid response from Azure OpenAI');
            }

            // Calcular custo aproximado (GPT-4o pricing)
            // Input: $5.00 / 1M tokens, Output: $15.00 / 1M tokens
            const inputCost = (usage.prompt_tokens / 1_000_000) * 5.00;
            const outputCost = (usage.completion_tokens / 1_000_000) * 15.00;
            const totalCost = inputCost + outputCost;

            return {
                text: choice.message.content,
                tokens: {
                    prompt: usage.prompt_tokens,
                    completion: usage.completion_tokens,
                    total: usage.total_tokens,
                },
                cost: totalCost,
            };
        } catch (error: any) {
            console.error('❌ [LLM] Error generating completion:', error);
            throw new Error(`LLM Generation failed: ${error.message}`);
        }
    }

    /**
     * Gera texto simples a partir de um prompt
     */
    async generateText(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const messages: LLMMessage[] = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });

        return this.generateCompletion(messages);
    }

    /**
     * Verifica se o serviço está configurado corretamente
     */
    isConfigured(): boolean {
        return !!(
            aiConfig.azure.apiKey &&
            aiConfig.azure.endpoint &&
            aiConfig.azure.deployments.chat
        );
    }
}

export const llmService = new LLMService();
export default llmService;
