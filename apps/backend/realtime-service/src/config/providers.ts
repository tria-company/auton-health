import { AzureOpenAI } from 'openai';
import OpenAI from 'openai';
import { config } from './index';
import { aiPricingService, LLMType, AIStage } from '../services/aiPricingService';

// Configuração do Azure OpenAI
export const openaiClient = new AzureOpenAI({
  endpoint: config.AZURE_OPENAI_ENDPOINT,
  apiKey: config.AZURE_OPENAI_API_KEY,
  apiVersion: config.AZURE_OPENAI_CHAT_API_VERSION,
  timeout: 30000, // 30 segundos
  maxRetries: 3,
});

// Teste de conexão com Azure OpenAI
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    // Azure OpenAI não tem endpoint models.list(), então testamos com uma chamada simples
    const response = await openaiClient.chat.completions.create({
      model: config.AZURE_OPENAI_CHAT_DEPLOYMENT,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1,
    });

    if (response.choices && response.choices.length > 0) {
      console.log('✅ Conexão com Azure OpenAI estabelecida com sucesso');
      console.log(`   Deployment: ${config.AZURE_OPENAI_CHAT_DEPLOYMENT}`);
      return true;
    }

    console.error('❌ Azure OpenAI conectado mas resposta inválida');
    return false;
  } catch (error) {
    console.error('❌ Falha ao conectar com Azure OpenAI:', error);
    return false;
  }
}

// LiveKit removido - usando WebRTC direto via WebSocket

// Configuração Redis (opcional por enquanto)
export const redisSettings = config.REDIS_URL
  ? {
    url: config.REDIS_URL,
    password: config.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  }
  : null;

// Alias export compatível com redis.ts
export const redisConfig = redisSettings;

// Teste de conexão Redis (se configurado)
export async function testRedisConnection(): Promise<boolean> {
  if (!redisSettings) {
    console.log('⚠️  Redis não configurado - usando modo sem cache');
    return true; // Não é erro, apenas não está configurado
  }

  try {
    // TODO: Implementar teste de conexão Redis quando necessário
    console.log('⚠️  Redis configurado mas teste não implementado ainda');
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com Redis:', error);
    return false;
  }
}

// Configurações de AI específicas para diferentes modelos
export const aiModels = {
  transcription: {
    openai: {
      model: 'whisper-1',
      language: 'pt',
      response_format: 'verbose_json' as const,
      temperature: 0,
    },
    // Placeholder para outros providers
    google: {
      model: 'latest_long',
      languageCode: 'pt-BR',
      enableAutomaticPunctuation: true,
      useEnhanced: true,
    },
  },

  completion: {
    model: config.AZURE_OPENAI_CHAT_DEPLOYMENT, // Usa deployment name do Azure
    temperature: config.LLM_TEMPERATURE,
    max_tokens: config.LLM_MAX_TOKENS,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  },

  embedding: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
};

// Helper para criar chat completion
export async function makeChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {},
  trackingOptions?: {
    etapa?: AIStage;
    consultaId?: string;
  }
) {
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    ...aiModels.completion,
    messages,
    ...options,
    // garantir não-stream para que 'choices' exista
    stream: false,
  };

  const response = await openaiClient.chat.completions.create(params);

  // 📊 Registrar uso para monitoramento de custos
  if (response.usage) {
    const model = (params.model || aiModels.completion.model) as LLMType;
    const etapa = trackingOptions?.etapa || 'chat_completion';

    // Extrair cached tokens (se disponível na API version preview)
    const cachedTokens = (response.usage as any).prompt_tokens_details?.cached_tokens || 0;

    await aiPricingService.logChatCompletionUsage(
      model,
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      etapa,
      trackingOptions?.consultaId,
      cachedTokens
    );
  }

  return response;
}

// Helper para criar embeddings
export async function makeEmbedding(
  text: string,
  trackingOptions?: {
    consultaId?: string;
  }
) {
  const response = await openaiClient.embeddings.create({
    model: aiModels.embedding.model,
    input: text,
    dimensions: aiModels.embedding.dimensions,
  });

  // 📊 Registrar uso para monitoramento de custos
  if (response.usage) {
    const model = aiModels.embedding.model as 'text-embedding-3-small' | 'text-embedding-3-large';

    await aiPricingService.logEmbeddingUsage(
      model,
      response.usage.total_tokens,
      trackingOptions?.consultaId
    );
  }

  return response;
}

// Validação de todas as configurações
export async function validateAllProviders(): Promise<{
  openai: boolean;
  redis: boolean;
}> {
  console.log('🔄 Validando conexões com provedores...\n');

  const results = {
    openai: await testOpenAIConnection(),
    redis: await testRedisConnection(),
  };

  console.log('\n📊 Resultado da validação:');
  console.log(`   OpenAI: ${results.openai ? '✅' : '❌'}`);
  console.log(`   Redis: ${results.redis ? '✅' : '⚠️'}`);

  return results;
}