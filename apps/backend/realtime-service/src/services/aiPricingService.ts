/**
 * Serviço de Monitoramento de Custos de IA
 * Registra todos os usos de IA na tabela ai_pricing para análise de custos
 * 
 * O campo 'tester' é determinado pelo campo 'tester' da tabela 'medicos'
 * associado à consulta. Se o médico for tester, ai_pricing.tester = true
 */

import { supabase, logError } from '../config/database';

// Tipos de LLM suportados
export type LLMType =
  | 'whisper-1'                                // Transcrição Whisper
  | 'gpt-4o-mini-realtime-preview'  // Realtime API (mini - mais barato)
  | 'gpt-4o'                                   // Chat Completion
  | 'gpt-4o-mini'                              // Chat Completion (mini)
  | 'gpt-4-turbo'                              // Chat Completion
  | 'gpt-3.5-turbo'                            // Chat Completion
  | 'text-embedding-3-small'                   // Embeddings
  | 'text-embedding-3-large';                  // Embeddings

// Cache para evitar múltiplas consultas ao banco para o mesmo médico
const doctorTesterCache = new Map<string, { isTester: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

// Etapas do processo onde IA é utilizada
export type AIStage =
  | 'transcricao_whisper'       // Transcrição de áudio com Whisper
  | 'transcricao_realtime'      // Transcrição em tempo real (Realtime API)
  | 'transcricao_input'         // Transcrição de áudio de entrada (conversation.item.input_audio_transcription.completed)
  | 'analise_contexto'          // Análise de contexto para sugestões
  | 'sugestoes_contextuais'     // Geração de sugestões contextuais
  | 'sugestoes_emergencia'      // Geração de sugestões de emergência
  | 'embedding'                 // Geração de embeddings
  | 'chat_completion';          // Chat completion genérico

// Preços por modelo (em USD por 1000 tokens ou por minuto para áudio)
const AI_PRICING: Record<LLMType, { input: number; output: number; unit: 'tokens' | 'minutes' }> = {
  'whisper-1': { input: 0.006, output: 0, unit: 'minutes' },
  'gpt-4o-mini-realtime-preview': { input: 0.01, output: 0.04, unit: 'minutes' }, // Audio input/output (6x mais barato!)
  'gpt-4o': { input: 0.0025, output: 0.01, unit: 'tokens' }, // per 1K tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, unit: 'tokens' },
  'gpt-4-turbo': { input: 0.01, output: 0.03, unit: 'tokens' },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015, unit: 'tokens' },
  'text-embedding-3-small': { input: 0.00002, output: 0, unit: 'tokens' },
  'text-embedding-3-large': { input: 0.00013, output: 0, unit: 'tokens' },
};

export interface AIPricingRecord {
  consulta_id?: string;
  LLM: LLMType;
  token: number;          // Total de tokens (mantido para compatibilidade) OU minutos de áudio
  in_tokens_ia?: number;  // Tokens de entrada (input) - DEPRECATED: usar tokens_text_in + tokens_audio_in
  out_tokens_ia?: number; // Tokens de saída (output) - DEPRECATED: usar tokens_text_out + tokens_audio_out
  cached_tokens_ia?: number; // Tokens de entrada em cache (desconto de 50%)
  // ✅ NOVO: Campos granulares para Realtime API
  tokens_text_in?: number;   // Tokens de texto de entrada
  tokens_audio_in?: number;  // Tokens de áudio de entrada
  tokens_text_out?: number;  // Tokens de texto de saída
  tokens_audio_out?: number; // Tokens de áudio de saída
  // ✅ NOVO: Token de transcrição de entrada
  token_transcription?: number; // Tokens de transcrição de áudio de entrada
  // ✅ NOVO: JSONs completos dos eventos OpenAI
  response_done?: object;  // JSON completo do evento response.done
  input_audio_transcription_completed?: object; // JSON completo do evento conversation.item.input_audio_transcription.completed
  // ✅ NOVO: Campos para auditoria Whisper
  transcricao_da_frase?: string; // Texto transcrito pelo Whisper
  payload?: object;       // Payload completo da resposta da API
  price: number;          // Preço calculado em USD
  tester?: boolean;       // Se é ambiente de teste
  etapa: AIStage;         // Etapa onde foi usado
}

class AIPricingService {
  private isEnabled: boolean = true;

  constructor() {
    console.log(`📊 AI Pricing Service inicializado`);
  }

  /**
   * Busca se o médico da consulta é tester
   * Verifica na tabela 'medicos' através da consulta ou sessão
   * @param consultaId ID da consulta ou sessão
   * @returns true se o médico for tester, false caso contrário
   */
  private async isDoctorTester(consultaId?: string): Promise<boolean> {
    if (!consultaId) {
      return false; // Se não tem consultaId, assume que não é tester
    }

    // Verificar cache primeiro
    const cached = doctorTesterCache.get(consultaId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.isTester;
    }

    try {
      // Tentar buscar pela tabela consultations primeiro
      let doctorId: string | null = null;

      // 1. Tentar buscar na tabela consultations
      const { data: consultation } = await supabase
        .from('consultations')
        .select('doctor_id')
        .eq('id', consultaId)
        .maybeSingle();

      if (consultation?.doctor_id) {
        doctorId = consultation.doctor_id;
      }

      // 2. Se não encontrou, tentar buscar na tabela call_sessions
      if (!doctorId) {
        const { data: callSession } = await supabase
          .from('call_sessions')
          .select('consultation_id, metadata')
          .eq('id', consultaId)
          .maybeSingle();

        if (callSession?.consultation_id) {
          // Buscar a consulta associada
          const { data: linkedConsultation } = await supabase
            .from('consultations')
            .select('doctor_id')
            .eq('id', callSession.consultation_id)
            .maybeSingle();

          if (linkedConsultation?.doctor_id) {
            doctorId = linkedConsultation.doctor_id;
          }
        }

        // Tentar buscar do metadata
        if (!doctorId && callSession?.metadata?.doctorId) {
          doctorId = callSession.metadata.doctorId;
        }
      }

      // 3. Se encontrou o doctor_id, buscar se é tester
      if (doctorId) {
        const { data: doctor } = await supabase
          .from('medicos')
          .select('tester')
          .eq('id', doctorId)
          .maybeSingle();

        const isTester = doctor?.tester === true;

        // Salvar no cache
        doctorTesterCache.set(consultaId, { isTester, timestamp: Date.now() });

        console.log(`📊 [AI_PRICING] Médico ${doctorId} é tester: ${isTester}`);
        return isTester;
      }

      // Se não encontrou nada, assume que não é tester
      doctorTesterCache.set(consultaId, { isTester: false, timestamp: Date.now() });
      return false;

    } catch (error) {
      console.error('❌ [AI_PRICING] Erro ao verificar se médico é tester:', error);
      logError(
        `Erro ao verificar se médico é tester`,
        'error',
        consultaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return false; // Em caso de erro, assume que não é tester (registra como produção)
    }
  }

  /**
   * Limpa o cache de tester (útil para testes)
   */
  clearTesterCache(): void {
    doctorTesterCache.clear();
    console.log('📊 [AI_PRICING] Cache de tester limpo');
  }

  /**
   * Calcula o preço baseado no modelo e quantidade de tokens/minutos
   */
  private calculatePrice(model: LLMType, inputTokens: number, outputTokens: number = 0, cachedTokens: number = 0): number {
    const pricing = AI_PRICING[model];
    if (!pricing) {
      console.warn(`⚠️ Modelo não encontrado para pricing: ${model}`);
      return 0;
    }

    if (pricing.unit === 'minutes') {
      // Para modelos de áudio, inputTokens representa minutos
      return (inputTokens * pricing.input) + (outputTokens * pricing.output);
    } else {
      // Para modelos de texto, tokens são divididos por 1000
      // Cached tokens têm 50% de desconto no preço de input
      const regularInputTokens = inputTokens - cachedTokens;
      const regularInputCost = (regularInputTokens / 1000) * pricing.input;
      const cachedInputCost = (cachedTokens / 1000) * pricing.input * 0.5;
      const outputCost = (outputTokens / 1000) * pricing.output;
      return regularInputCost + cachedInputCost + outputCost;
    }
  }

  /**
   * Registra uso de IA na tabela ai_pricing
   * O campo 'tester' é determinado pelo campo 'tester' do médico da consulta
   */
  async logUsage(record: AIPricingRecord): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Determinar se é tester baseado no médico da consulta
      let isTester = record.tester;

      // Se não foi passado explicitamente, buscar do médico
      if (isTester === undefined && record.consulta_id) {
        isTester = await this.isDoctorTester(record.consulta_id);
      }

      // Default para false se não conseguiu determinar
      if (isTester === undefined) {
        isTester = false;
      }

      const { error } = await supabase
        .from('ai_pricing')
        .insert({
          consulta_id: record.consulta_id || null,
          LLM: record.LLM,
          token: record.token,
          in_tokens_ia: record.in_tokens_ia || null,
          out_tokens_ia: record.out_tokens_ia || null,
          cached_tokens_ia: record.cached_tokens_ia || null,
          // ✅ NOVO: Campos granulares
          tokens_text_in: record.tokens_text_in || null,
          tokens_audio_in: record.tokens_audio_in || null,
          tokens_text_out: record.tokens_text_out || null,
          tokens_audio_out: record.tokens_audio_out || null,
          // ✅ NOVO: Token de transcrição de entrada
          token_transcription: record.token_transcription || null,
          // ✅ NOVO: JSONs completos dos eventos OpenAI
          response_done: record.response_done || null,
          input_audio_transcription_completed: record.input_audio_transcription_completed || null,
          // ✅ NOVO: Campos para auditoria Whisper
          transcricao_da_frase: record.transcricao_da_frase || null,
          payload: record.payload || null,
          price: record.price,
          tester: isTester,
          etapa: record.etapa,
        });

      if (error) {
        console.error('❌ Erro ao registrar ai_pricing:', error.message);
        logError(
          `Erro ao registrar ai_pricing no banco`,
          'error',
          record.consulta_id || null,
          { error: error.message, model: record.LLM, etapa: record.etapa, token: record.token }
        );
        return false;
      }

      const testerLabel = isTester ? '[TESTER]' : '[PROD]';

      // ✅ Log unificado e detalhado para TODAS as transações
      console.log(`[SUPABASE-AI TOKEN] Registrando uso (${record.etapa}):
      - Modelo: ${record.LLM} ${testerLabel}
      - Total Tokens/Min: ${record.token}
      - Text In: ${record.tokens_text_in || record.in_tokens_ia || 0}
      - Text Out: ${record.tokens_text_out || record.out_tokens_ia || 0}
      - Audio In: ${record.tokens_audio_in || 0}
      - Audio Out: ${record.tokens_audio_out || 0}
      - Cached Tokens: ${record.cached_tokens_ia || 0}
      - Preço: $${record.price.toFixed(6)}
      - Consulta ID: ${record.consulta_id || 'N/A'}
      `);

      return true;
    } catch (error) {
      console.error('❌ Erro ao registrar ai_pricing:', error);
      logError(
        `Exceção ao registrar ai_pricing`,
        'error',
        record.consulta_id || null,
        { error: error instanceof Error ? error.message : String(error), model: record.LLM, etapa: record.etapa }
      );
      return false;
    }
  }

  /**
   * Registra uso do Whisper (transcrição de áudio)
   * @param durationMs Duração do áudio em milissegundos
   * @param consultaId ID da consulta (opcional)
   * @param transcription Texto transcrito pelo Whisper (opcional)
   * @param apiResponse Resposta completa da API Whisper (opcional)
   */
  async logWhisperUsage(
    durationMs: number,
    consultaId?: string,
    transcription?: string,
    apiResponse?: object
  ): Promise<boolean> {
    const durationMinutes = durationMs / 60000; // Converter para minutos
    const price = this.calculatePrice('whisper-1', durationMinutes);

    return this.logUsage({
      consulta_id: consultaId,
      LLM: 'whisper-1',
      token: durationMinutes, // Armazenar em minutos (para compatibilidade)
      in_tokens_ia: Math.round(durationMs), // Duração em ms como "input"
      out_tokens_ia: 0, // Whisper não tem output tokens
      transcricao_da_frase: transcription, // ✅ NOVO: Texto transcrito
      payload: apiResponse, // ✅ NOVO: Payload completo da API
      price,
      etapa: 'transcricao_whisper',
    });
  }

  /**
   * Registra uso da Realtime API (transcrição em tempo real)
   * Agora suporta contagem exata de tokens de áudio e texto
   * @param params Parâmetros de uso incluindo tokens e JSON do response.done
   * @param consultaId ID da consulta (opcional)
   */
  async logRealtimeUsage(
    params: {
      durationMs?: number; // Mantido para compatibilidade ou fallback
      textInputTokens?: number;
      textOutputTokens?: number;
      audioInputTokens?: number;
      audioOutputTokens?: number;
      cachedTokens?: number;
      responseDoneJson?: object; // ✅ NOVO: JSON completo do evento response.done
    },
    consultaId?: string
  ): Promise<boolean> {
    let price = 0;
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let textIn = 0;
    let textOut = 0;
    let audioIn = 0;
    let audioOut = 0;
    let cachedTokens = 0;

    // Extrair valores dos parâmetros
    textIn = params.textInputTokens || 0;
    textOut = params.textOutputTokens || 0;
    audioIn = params.audioInputTokens || 0;
    audioOut = params.audioOutputTokens || 0;
    cachedTokens = params.cachedTokens || 0;

    // Calcular preço exato usando os preços da Realtime API
    // Preços por 1M de tokens (USD):
    // textInput: $2.50/1M, textOutput: $10.00/1M
    // audioInput: $40.00/1M, audioOutput: $80.00/1M
    const pricing = {
      textInput: 2.50,
      textOutput: 10.00,
      audioInput: 40.00,
      audioOutput: 80.00
    };

    price = (textIn / 1_000_000 * pricing.textInput) +
      (textOut / 1_000_000 * pricing.textOutput) +
      (audioIn / 1_000_000 * pricing.audioInput) +
      (audioOut / 1_000_000 * pricing.audioOutput);

    totalTokens = textIn + textOut + audioIn + audioOut;
    inputTokens = textIn + audioIn;
    outputTokens = textOut + audioOut;

    totalTokens = textIn + textOut + audioIn + audioOut;
    inputTokens = textIn + audioIn;
    outputTokens = textOut + audioOut;

    return this.logUsage({
      consulta_id: consultaId,
      LLM: 'gpt-4o-mini-realtime-preview',
      token: totalTokens,
      in_tokens_ia: inputTokens,
      out_tokens_ia: outputTokens,
      cached_tokens_ia: cachedTokens,
      // ✅ Campos granulares
      tokens_text_in: textIn,
      tokens_audio_in: audioIn,
      tokens_text_out: textOut,
      tokens_audio_out: audioOut,
      // ✅ NOVO: JSON completo do response.done
      response_done: params.responseDoneJson,
      price,
      etapa: 'transcricao_realtime',
    });
  }

  /**
   * Registra uso de transcrição de áudio de entrada (conversation.item.input_audio_transcription.completed)
   * Este é cobrado separadamente do modelo de conversação
   * @param params Parâmetros incluindo tokens e JSON do evento
   * @param consultaId ID da consulta (opcional)
   */
  async logInputTranscriptionUsage(
    params: {
      inputTokens: number; // Tokens cobrados pela transcrição
      audioTokens?: number; // Tokens de áudio (input_token_details.audio_tokens)
      inputAudioTranscriptionJson?: object; // ✅ JSON completo do evento
    },
    consultaId?: string
  ): Promise<boolean> {
    // Preço do Whisper/transcription: $0.006 por minuto
    // Mas quando vem via Realtime API, provavelmente segue outra tabela
    // Por enquanto, vamos usar o mesmo pricing do Whisper como aproximação
    // ~100 tokens de áudio = ~1 segundo ≈ 0.0001 por token
    const transcriptionPricePerToken = 0.0001;
    const price = params.inputTokens * transcriptionPricePerToken;

    return this.logUsage({
      consulta_id: consultaId,
      LLM: 'gpt-4o-mini-realtime-preview', // Usando o mesmo modelo da Realtime API
      token: params.inputTokens,
      token_transcription: params.inputTokens, // ✅ Campo específico para transcrição
      tokens_audio_in: params.audioTokens || params.inputTokens, // Audio tokens
      // ✅ NOVO: JSON completo do evento
      input_audio_transcription_completed: params.inputAudioTranscriptionJson,
      price,
      etapa: 'transcricao_input', // ✅ Nova etapa específica
    });
  }


  /**
   * Registra uso de Chat Completion
   * @param model Modelo usado (ex: gpt-4o, gpt-4o-mini)
   * @param inputTokens Tokens de entrada
   * @param outputTokens Tokens de saída
   * @param etapa Etapa do processo
   * @param consultaId ID da consulta (opcional)
   */
  async logChatCompletionUsage(
    model: LLMType,
    inputTokens: number,
    outputTokens: number,
    etapa: AIStage,
    consultaId?: string,
    cachedTokens: number = 0
  ): Promise<boolean> {
    const price = this.calculatePrice(model, inputTokens, outputTokens, cachedTokens);
    const totalTokens = inputTokens + outputTokens;

    return this.logUsage({
      consulta_id: consultaId,
      LLM: model,
      token: totalTokens,
      in_tokens_ia: inputTokens,
      out_tokens_ia: outputTokens,
      cached_tokens_ia: cachedTokens,
      // ✅ Granular data for detailed logging
      tokens_text_in: inputTokens,
      tokens_text_out: outputTokens,
      price,
      etapa,
    });
  }

  /**
   * Registra uso de Embeddings
   * @param model Modelo de embedding
   * @param tokens Tokens processados
   * @param consultaId ID da consulta (opcional)
   */
  async logEmbeddingUsage(
    model: 'text-embedding-3-small' | 'text-embedding-3-large',
    tokens: number,
    consultaId?: string
  ): Promise<boolean> {
    const price = this.calculatePrice(model, tokens);

    return this.logUsage({
      consulta_id: consultaId,
      LLM: model,
      token: tokens,
      in_tokens_ia: tokens,  // Embeddings só têm input tokens
      out_tokens_ia: 0,
      // ✅ Granular data for detailed logging
      tokens_text_in: tokens,
      price,
      etapa: 'embedding',
    });
  }

  /**
   * Obter resumo de custos por consulta
   */
  async getConsultaCosts(consultaId: string): Promise<{
    total: number;
    byEtapa: Record<string, number>;
    byModel: Record<string, number>;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('ai_pricing')
        .select('*')
        .eq('consulta_id', consultaId);

      if (error) {
        console.error('❌ Erro ao buscar custos:', error.message);
        logError(
          `Erro ao buscar custos de AI por consulta`,
          'error',
          consultaId,
          { error: error.message }
        );
        return null;
      }

      const result = {
        total: 0,
        byEtapa: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
      };

      for (const record of data || []) {
        result.total += record.price || 0;

        // Por etapa
        if (record.etapa) {
          result.byEtapa[record.etapa] = (result.byEtapa[record.etapa] || 0) + (record.price || 0);
        }

        // Por modelo
        if (record.LLM) {
          result.byModel[record.LLM] = (result.byModel[record.LLM] || 0) + (record.price || 0);
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar custos:', error);
      logError(
        `Exceção ao buscar custos de AI por consulta`,
        'error',
        consultaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return null;
    }
  }

  /**
   * Obter resumo de custos total (para dashboard)
   */
  async getTotalCosts(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    totalTester: number;
    totalProduction: number;
    byEtapa: Record<string, number>;
    byModel: Record<string, number>;
    count: number;
  } | null> {
    try {
      let query = supabase
        .from('ai_pricing')
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar custos totais:', error.message);
        logError(
          `Erro ao buscar custos totais de AI`,
          'error',
          null,
          { error: error.message, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() }
        );
        return null;
      }

      const result = {
        total: 0,
        totalTester: 0,
        totalProduction: 0,
        byEtapa: {} as Record<string, number>,
        byModel: {} as Record<string, number>,
        count: data?.length || 0,
      };

      for (const record of data || []) {
        const price = record.price || 0;
        result.total += price;

        if (record.tester) {
          result.totalTester += price;
        } else {
          result.totalProduction += price;
        }

        // Por etapa
        if (record.etapa) {
          result.byEtapa[record.etapa] = (result.byEtapa[record.etapa] || 0) + price;
        }

        // Por modelo
        if (record.LLM) {
          result.byModel[record.LLM] = (result.byModel[record.LLM] || 0) + price;
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar custos totais:', error);
      logError(
        `Exceção ao buscar custos totais de AI`,
        'error',
        null,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return null;
    }
  }

  /**
   * Calcula o custo total de uma consulta e atualiza o campo valor_consulta
   * Soma todos os registros de ai_pricing para a consulta e atualiza a tabela consultations
   * @param consultaId ID da consulta
   * @returns Valor total calculado em USD
   */
  async calculateAndUpdateConsultationCost(consultaId: string): Promise<number | null> {
    try {
      console.log(`💰 [AI_PRICING] Calculando custo total da consulta ${consultaId}...`);

      // Buscar todos os registros de AI pricing para esta consulta
      const { data, error } = await supabase
        .from('ai_pricing')
        .select('*')
        .eq('consulta_id', consultaId);

      if (error) {
        console.error('❌ Erro ao buscar registros de AI pricing:', error.message);
        logError(
          `Erro ao buscar registros de AI pricing para cálculo de custo`,
          'error',
          consultaId,
          { error: error.message }
        );
        return null;
      }

      if (!data || data.length === 0) {
        console.log(`ℹ️ [AI_PRICING] Nenhum registro de IA encontrado para consulta ${consultaId}`);
        // Atualizar com valor 0
        await supabase
          .from('consultations')
          .update({ valor_consulta: 0 })
          .eq('id', consultaId);
        return 0;
      }

      // Somar todos os preços
      const totalCost = data.reduce((sum, record) => sum + (record.price || 0), 0);

      // Log detalhado dos tokens (apenas se houver registros)
      const summary = {
        totalRecords: data.length,
        totalCost: totalCost,
        breakdown: data.map(r => ({
          model: r.LLM,
          etapa: r.etapa,
          textIn: r.tokens_text_in || 0,
          textOut: r.tokens_text_out || 0,
          audioIn: r.tokens_audio_in || 0,
          audioOut: r.tokens_audio_out || 0,
          price: r.price || 0
        }))
      };

      console.log(`💰 [AI_PRICING] Resumo da consulta ${consultaId}:`, {
        totalRecords: summary.totalRecords,
        totalCost: `$${totalCost.toFixed(6)}`,
        models: [...new Set(data.map(r => r.LLM))].join(', ')
      });

      // Atualizar campo valor_consulta na tabela consultations
      const { error: updateError } = await supabase
        .from('consultations')
        .update({ valor_consulta: totalCost })
        .eq('id', consultaId);

      if (updateError) {
        console.error('❌ Erro ao atualizar valor_consulta:', updateError.message);
        logError(
          `Erro ao atualizar valor_consulta no banco`,
          'error',
          consultaId,
          { error: updateError.message, totalCost }
        );
        return null;
      }

      console.log(`✅ [AI_PRICING] valor_consulta atualizado: $${totalCost.toFixed(6)}`);
      return totalCost;

    } catch (error) {
      console.error('❌ Erro ao calcular e atualizar custo da consulta:', error);
      logError(
        `Exceção ao calcular e atualizar custo da consulta`,
        'error',
        consultaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return null;
    }
  }

  /**
   * Habilitar/desabilitar o serviço
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📊 AI Pricing Service ${enabled ? 'habilitado' : 'desabilitado'}`);
  }

  /**
   * Força um valor de tester para um registro específico
   * Útil para casos onde você já sabe se é tester
   */
  async logUsageWithTester(record: AIPricingRecord, isTester: boolean): Promise<boolean> {
    return this.logUsage({ ...record, tester: isTester });
  }
}

// Instância singleton
export const aiPricingService = new AIPricingService();
export default aiPricingService;

