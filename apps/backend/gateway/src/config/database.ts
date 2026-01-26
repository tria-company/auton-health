import { createClient } from '@supabase/supabase-js';
import { config } from './index';

// Configuração do cliente Supabase
// ✅ IMPORTANTE: Usar service role key para bypassar RLS
export const supabase = createClient(
  config.SUPABASE_URL || 'https://placeholder.supabase.co',
  config.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      // ✅ Service role key não precisa de refresh token
    },
    // Configurações específicas para o backend
    db: {
      schema: 'public',
    },
    // Timeout para operações
    global: {
      headers: {
        'x-application-name': 'medcall-gateway',
        // ✅ Garantir que estamos usando service role
        'apikey': config.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
      },
    },
  }
);

// ✅ Verificar se a service role key está sendo usada corretamente
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 [SUPABASE] Cliente inicializado com SERVICE_ROLE_KEY');
  console.log('🔧 [SUPABASE] Service role key deve bypassar RLS automaticamente');
}

// Teste de conexão
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Erro ao conectar com Supabase:', error.message);
      return false;
    }

    console.log('✅ Conexão com Supabase estabelecida com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com Supabase:', error);
    return false;
  }
}

// Tipos para o banco de dados (básico por enquanto)
export interface CallSession {
  id: string;
  consultation_id?: string | null;
  session_type: 'presencial' | 'online';
  started_at: string;
  ended_at?: string;
  // Estado opcional da sessão para permitir atualizações (e.g., 'ended')
  status?: string;
  participants: Record<string, any>;
  consent: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Utterance {
  id: string;
  session_id: string;
  speaker: 'doctor' | 'patient' | 'system';
  speaker_id?: string | null; // ✅ Nome real do médico/paciente
  doctor_name?: string | null; // ✅ Nome do médico para busca/filtro
  start_ms: number;
  end_ms: number;
  text: string;
  is_final: boolean;
  confidence?: number;
  created_at: string;
}

export interface Suggestion {
  id: string;
  session_id: string;
  utterance_id?: string;
  // Expandir tipos suportados para alinhar com AISuggestion
  type: 'question' | 'insight' | 'warning' | 'protocol' | 'alert' | 'followup' | 'assessment';
  content: string;
  source?: string;
  confidence?: number;
  // Tornar prioridade obrigatória para alinhar com AISuggestion
  priority: 'low' | 'medium' | 'high' | 'critical';
  used: boolean;
  created_at: string;
}

// Helper para queries comuns
export const db = {
  // Sessões
  async createSession(data: Partial<CallSession>): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar sessão:', error);
      // Log assíncrono para não bloquear
      logError(`Erro ao criar sessão no banco`, 'error', null, { error: error.message, code: error.code });
      return null;
    }

    return session;
  },

  async getSession(id: string): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar sessão:', error);
      logError(`Erro ao buscar sessão no banco`, 'error', null, { sessionId: id, error: error.message, code: error.code });
      return null;
    }

    return session;
  },


  async getUtterancesBySession(sessionId: string): Promise<Utterance[]> {
    const { data: utterances, error } = await supabase
      .from('transcriptions_med')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar utterances:', error);
      logError(`Erro ao buscar utterances no banco`, 'error', null, { sessionId, error: error.message, code: error.code });
      return [];
    }

    return utterances || [];
  },

  // Mantemos apenas a versão com suporte a limite

  async updateSession(id: string, data: Partial<CallSession>): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar sessão:', error);
      logError(`Erro ao atualizar sessão no banco`, 'error', null, { sessionId: id, error: error.message, code: error.code });
      return false;
    }

    return true;
  },

  // Utterances
  async createUtterance(data: Partial<Utterance>): Promise<Utterance | null> {
    try {
      // ✅ Garantir que session_id é fornecido
      if (!data.session_id) {
        console.error('❌ [SAVE] session_id é obrigatório para salvar transcrição');
        return null;
      }

      // ✅ Verificar se session_id existe na tabela call_sessions (validar foreign key)
      const { data: callSession, error: sessionError } = await supabase
        .from('call_sessions')
        .select('id')
        .eq('id', data.session_id)
        .maybeSingle();

      if (sessionError) {
        console.error('❌ [SAVE] Erro ao verificar session_id:', sessionError);
      }

      // ✅ Se a sessão não existe, criar automaticamente para permitir salvar transcrições
      if (!callSession) {
        console.warn(`⚠️ [SAVE] session_id ${data.session_id} não encontrado em call_sessions. Criando sessão automaticamente...`);

        try {
          // Criar sessão básica para permitir salvar transcrições
          const { data: newSession, error: createError } = await supabase
            .from('call_sessions')
            .insert({
              id: data.session_id,
              session_type: 'presencial', // Tipo padrão
              status: 'active',
              started_at: new Date().toISOString(),
              participants: {}
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ [SAVE] Erro ao criar sessão automaticamente:', createError);
            // Continuar mesmo assim - pode ser problema de RLS ou permissões
          } else {
            console.log(`✅ [SAVE] Sessão criada automaticamente: ${data.session_id}`);
          }
        } catch (createErr) {
          console.error('❌ [SAVE] Erro ao criar sessão:', createErr);
          // Continuar mesmo assim
        }
      }

      // ✅ Mapear campos conforme schema da tabela transcriptions_med
      // ✅ VALIDAÇÃO: Se data.id não é um UUID válido, não incluir (deixar banco gerar)
      let validId: string | undefined = undefined;
      if (data.id) {
        // Verificar se é UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(data.id)) {
          validId = data.id;
        } else {
          console.warn(`⚠️ [SAVE] ID fornecido não é UUID válido: "${data.id}", deixando banco gerar`);
        }
      }

      const insertData: any = {
        id: validId, // UUID gerado pelo banco se não fornecido ou inválido
        session_id: data.session_id, // UUID obrigatório (foreign key para call_sessions)
        speaker: data.speaker || 'system', // 'doctor', 'patient' ou 'system'
        speaker_id: data.speaker_id || data.speaker || null, // ✅ Nome real do médico/paciente
        text: data.text || '',
        is_final: data.is_final !== undefined ? data.is_final : false,
        start_ms: data.start_ms || 0,
        end_ms: data.end_ms || null, // Opcional
        confidence: data.confidence !== undefined && data.confidence !== null
          ? Number(data.confidence)
          : null, // Opcional, numeric(4,3) - garantir que é número
        processing_status: 'completed', // 'pending', 'processing', 'completed', 'error'
        created_at: data.created_at || new Date().toISOString()
      };

      // ✅ Validar confidence está no range correto (0 a 1)
      if (insertData.confidence !== null && insertData.confidence !== undefined) {
        if (insertData.confidence < 0 || insertData.confidence > 1) {
          console.warn(`⚠️ [SAVE] Confidence fora do range (0-1): ${insertData.confidence}, ajustando...`);
          insertData.confidence = Math.max(0, Math.min(1, insertData.confidence));
        }
      }

      // ✅ Validar que text não está vazio
      if (!insertData.text || insertData.text.trim().length === 0) {
        console.warn('⚠️ [SAVE] Texto vazio, não salvando transcrição');
        return null;
      }

      //console.log(`💾 [SAVE] Tentando salvar transcrição:`, {
      //  session_id: insertData.session_id,
      //  speaker: insertData.speaker,
      //  text_length: insertData.text.length,
      //  start_ms: insertData.start_ms,
      //  end_ms: insertData.end_ms
      //});

      const { data: utterance, error } = await supabase
        .from('transcriptions_med')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [SAVE] Erro ao criar utterance no banco:', error);
        console.error('❌ [SAVE] Código do erro:', error.code);
        console.error('❌ [SAVE] Mensagem do erro:', error.message);
        console.error('❌ [SAVE] Detalhes do erro:', error.details);
        console.error('❌ [SAVE] Hint do erro:', error.hint);
        console.error('❌ [SAVE] Dados tentados:', {
          session_id: insertData.session_id,
          speaker: insertData.speaker,
          text: insertData.text?.substring(0, 50) + '...',
          start_ms: insertData.start_ms,
          end_ms: insertData.end_ms,
          confidence: insertData.confidence,
          is_final: insertData.is_final
        });
        return null;
      }

      console.log(`✅ [SAVE] Transcrição salva no banco (${insertData.speaker}):`, insertData.text?.substring(0, 50) + '...');
      return utterance;
    } catch (error) {
      console.error('❌ [SAVE] Erro ao criar utterance:', error);
      if (error instanceof Error) {
        console.error('❌ [SAVE] Stack trace:', error.stack);
      }
      return null;
    }
  },

  async getSessionUtterances(sessionId: string, limit = 50): Promise<Utterance[]> {
    const { data: utterances, error } = await supabase
      .from('transcriptions_med')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar utterances:', error);
      logError(`Erro ao buscar utterances da sessão`, 'error', null, { sessionId, limit, error: error.message, code: error.code });
      return [];
    }

    return utterances || [];
  },

  /**
   * Retorna transcrições como array de conversas (formato JSON)
   * Busca do array salvo em transcriptions_med.text (JSON)
   */
  async getSessionConversations(sessionId: string): Promise<any[]> {
    try {
      // ✅ Buscar o registro único de transcrição para esta sessão
      const { data: transcription, error } = await supabase
        .from('transcriptions_med')
        .select('text')
        .eq('session_id', sessionId)
        .eq('processing_status', 'completed') // ✅ Flag para identificar registro único
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar conversas:', error);
        logError(`Erro ao buscar conversas no banco`, 'error', null, { sessionId, error: error.message, code: error.code });
        return [];
      }

      if (!transcription || !transcription.text) {
        return [];
      }

      // ✅ Parse do JSON do campo text
      try {
        const conversations = JSON.parse(transcription.text);
        return Array.isArray(conversations) ? conversations : [];
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON de conversas:', parseError);
        logError(`Erro ao fazer parse do JSON de conversas`, 'error', null, { sessionId, error: parseError instanceof Error ? parseError.message : String(parseError) });
        return [];
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      logError(`Exceção ao buscar conversas`, 'error', null, { sessionId, error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  },

  // Suggestions
  async createSuggestion(data: Partial<Suggestion>): Promise<Suggestion | null> {
    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar sugestão:', error);
      logError(`Erro ao criar sugestão no banco`, 'error', null, { sessionId: data.session_id, type: data.type, error: error.message, code: error.code });
      return null;
    }

    return suggestion;
  },

  async getSessionSuggestions(sessionId: string): Promise<Suggestion[]> {
    const { data: suggestions, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar sugestões:', error);
      logError(`Erro ao buscar sugestões da sessão`, 'error', null, { sessionId, error: error.message, code: error.code });
      return [];
    }

    return suggestions || [];
  },

  async markSuggestionAsUsed(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('suggestions')
      .update({ used: true })
      .eq('id', id);

    if (error) {
      console.error('Erro ao marcar sugestão como usada:', error);
      logError(`Erro ao marcar sugestão como usada`, 'error', null, { suggestionId: id, error: error.message, code: error.code });
      return false;
    }

    return true;
  },

  // Consultations helpers
  async updateConsultation(id: string, data: any): Promise<boolean> {
    const { error } = await supabase
      .from('consultations')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Erro ao atualizar consulta:', error);
      logError(`Erro ao atualizar consulta no banco`, 'error', id, { error: error.message, code: error.code });
      return false;
    }
    return true;
  },

  async createTranscription(data: any): Promise<any | null> {
    const { data: row, error } = await supabase
      .from('transcriptions')
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar transcrição:', error);
      logError(`Erro ao criar transcrição no banco`, 'error', data.consultation_id || null, { error: error.message, code: error.code });
      return null;
    }
    return row;
  },

  async createDocument(data: any): Promise<any | null> {
    const { data: row, error } = await supabase
      .from('documents')
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error('Erro ao criar documento:', error);
      logError(`Erro ao criar documento no banco`, 'error', data.consultation_id || null, { error: error.message, code: error.code, title: data.title });
      return null;
    }
    return row;
  },

  // ==================== FUNÇÕES PARA WEBRTC ROOMS ====================

  /**
   * Busca médico pelo user_auth (Supabase Auth ID)
   */
  async getDoctorByAuth(userAuthId: string): Promise<any | null> {
    const { data: doctor, error } = await supabase
      .from('medicos')
      .select('*')
      .eq('user_auth', userAuthId)
      .single();

    if (error) {
      console.error('Erro ao buscar médico:', error);
      logError(`Erro ao buscar médico por userAuth`, 'error', null, { userAuthId, error: error.message, code: error.code });
      return null;
    }

    return doctor;
  },

  /**
   * Cria uma nova consulta
   */
  async createConsultation(data: {
    doctor_id: string;
    patient_id: string;
    patient_name: string;
    consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
    status?: string;
    patient_context?: string;
    env?: string;
    clinica_id?: string; // ✅ Campo clinica_id opcional
  }): Promise<any | null> {
    const now = new Date().toISOString();

    // ✅ Log para debug do ambiente
    console.log(`🏥 [CREATE-CONSULTATION] Environment: ${data.env || 'not_specified'} | Clinic: ${data.clinica_id || 'none'}`);

    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert({
        ...data,
        status: data.status || 'CREATED',
        consulta_inicio: now,
        created_at: now,
        updated_at: now,
        env: data.env, // ✅ Salvando campo env
        clinica_id: data.clinica_id // ✅ Salvando id da clínica
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar consulta:', error);
      logError(`Erro ao criar consulta no banco`, 'error', null, { doctorId: data.doctor_id, patientId: data.patient_id, error: error.message, code: error.code });
      return null;
    }

    return consultation;
  },

  /**
   * Busca o consultation_id (UUID da consulta) a partir do room_id
   * Útil para recuperar o ID da consulta quando não está disponível em memória
   */
  async getConsultationIdByRoomId(roomId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('call_sessions')
        .select('consultation_id')
        .eq('room_id', roomId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar consultation_id por roomId:', error);
        return null;
      }

      return data?.consultation_id || null;
    } catch (error) {
      console.error('Exceção ao buscar consultation_id por roomId:', error);
      return null;
    }
  },

  /**
   * Atualiza call_session com consultation_id
   */
  async updateCallSession(roomId: string, data: {
    consultation_id?: string;
    status?: string;
    ended_at?: string;
    metadata?: any;
    webrtc_active?: boolean;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId); // Buscar por room_id que é o roomId

    if (error) {
      console.error('Erro ao atualizar call_session:', error);
      logError(`Erro ao atualizar call_session`, 'error', data.consultation_id || null, { roomId, error: error.message, code: error.code });
      return false;
    }

    return true;
  },

  /**
   * Atualiza status de conexão WebRTC ativa
   */
  async setWebRTCActive(roomId: string, active: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({
        webrtc_active: active,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId);

    if (error) {
      console.error('Erro ao atualizar webrtc_active:', error);
      logError(`Erro ao atualizar webrtc_active`, 'error', null, { roomId, active, error: error.message, code: error.code });
      return false;
    }

    console.log(`✅ [WebRTC] Sala ${roomId} - webrtc_active = ${active}`);
    return true;
  },

  /**
   * Adiciona uma transcrição ao array de conversas em transcriptions_med
   * Salva tudo em um único registro, atualizando o array conforme novas transcrições chegam
   */
  async addTranscriptionToSession(sessionId: string, transcription: {
    speaker: 'doctor' | 'patient' | 'system';
    speaker_id: string;
    text: string;
    confidence?: number;
    start_ms?: number;
    end_ms?: number;
    doctor_name?: string; // ✅ Nome do médico para busca/filtro
  }): Promise<boolean> {
    try {
      // ✅ Verificar se Supabase está configurado
      if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ [ARRAY-SAVE] Supabase não configurado!');
        console.error('❌ [ARRAY-SAVE] SUPABASE_URL:', config.SUPABASE_URL ? '✅' : '❌');
        console.error('❌ [ARRAY-SAVE] SUPABASE_SERVICE_ROLE_KEY:', config.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
        console.error('❌ [ARRAY-SAVE] NODE_ENV:', process.env.NODE_ENV);
        return false;
      }

      // ✅ Log inicial para debug
      //console.log(`💾 [ARRAY-SAVE] Iniciando salvamento:`, {
      //  sessionId: sessionId,
      //  speaker: transcription.speaker,
      //  textLength: transcription.text?.length || 0,
      //  hasDoctorName: !!transcription.doctor_name,
      //  environment: process.env.NODE_ENV
      //});

      // ✅ Buscar se já existe um registro único para esta sessão
      // Usar processing_status = 'completed' como flag para identificar o registro único
      // ✅ IMPORTANTE: Buscar TODOS os registros da sessão primeiro para verificar se há duplicatas
      const { data: allTranscriptions, error: fetchAllError } = await supabase
        .from('transcriptions_med')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (fetchAllError && fetchAllError.code !== 'PGRST116') {
        console.error('❌ [ARRAY-SAVE] Erro ao buscar transcrições:', fetchAllError);
        if (fetchAllError.code === '42501') {
          console.error('❌ [ARRAY-SAVE] Erro de RLS detectado!');
          console.error('❌ [ARRAY-SAVE] Execute o script SQL: migrations/fix-rls-transcriptions-med.sql');
        }
        logError(`Erro ao buscar transcrições para adicionar ao array`, 'error', null, { sessionId, error: fetchAllError.message, code: fetchAllError.code });
        return false;
      }

      // ✅ Encontrar o registro com processing_status = 'completed' (registro único)
      let existingTranscription = allTranscriptions?.find((t: any) => t.processing_status === 'completed') || null;

      // ✅ Se há múltiplos registros, usar o mais recente com processing_status = 'completed'
      // Se não houver nenhum com 'completed', usar o mais recente e atualizar para 'completed'
      if (!existingTranscription && allTranscriptions && allTranscriptions.length > 0) {
        console.warn(`⚠️ [ARRAY-SAVE] Encontrados ${allTranscriptions.length} registros para sessão ${sessionId}, mas nenhum com processing_status='completed'`);
        console.warn(`⚠️ [ARRAY-SAVE] Usando o registro mais recente e atualizando para 'completed'`);
        // Ordenar por created_at descendente e pegar o mais recente
        existingTranscription = allTranscriptions.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
      }

      // ✅ Se há múltiplos registros com 'completed', usar o mais recente e marcar os outros
      if (allTranscriptions && allTranscriptions.filter((t: any) => t.processing_status === 'completed').length > 1) {
        console.warn(`⚠️ [ARRAY-SAVE] Múltiplos registros com processing_status='completed' encontrados!`);
        console.warn(`⚠️ [ARRAY-SAVE] Consolidando em um único registro...`);
        // Usar o mais recente
        const completedOnes = allTranscriptions.filter((t: any) => t.processing_status === 'completed');
        existingTranscription = completedOnes.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        // Marcar os outros como 'error' para não serem usados
        const otherIds = completedOnes.filter((t: any) => t.id !== existingTranscription.id).map((t: any) => t.id);
        if (otherIds.length > 0) {
          await supabase
            .from('transcriptions_med')
            .update({ processing_status: 'error' })
            .in('id', otherIds);
          console.log(`✅ [ARRAY-SAVE] ${otherIds.length} registros duplicados marcados como 'error'`);
        }
      }

      if (existingTranscription) {
        console.log(`✅ [ARRAY-SAVE] Registro existente encontrado: ${existingTranscription.id}`);
        console.log(`📊 [ARRAY-SAVE] Conversas atuais no registro:`, {
          existingId: existingTranscription.id,
          currentArraySize: existingTranscription.text ? JSON.parse(existingTranscription.text).length : 0
        });
      } else {
        console.log(`📝 [ARRAY-SAVE] Nenhum registro encontrado, criando novo para sessão: ${sessionId}`);
        console.log(`📝 [ARRAY-SAVE] Esta será a primeira transcrição desta sessão`);
      }

      // ✅ Validar que o texto não está vazio
      if (!transcription.text || transcription.text.trim().length === 0) {
        console.warn('⚠️ [ARRAY-SAVE] Texto vazio, não salvando transcrição');
        return false;
      }

      // ✅ Criar novo item de conversa simplificado (só speaker e text)
      const conversationItem = {
        speaker: transcription.speaker, // 'doctor' ou 'patient'
        text: transcription.text.trim() // Remover espaços extras
      };

      if (existingTranscription) {
        // ✅ Atualizar registro existente: adicionar ao array de conversas
        let conversations = [];
        try {
          const parsedText = existingTranscription.text || '[]';
          const parsed = JSON.parse(parsedText);
          // Garantir que é array
          if (Array.isArray(parsed)) {
            conversations = parsed;
          } else {
            console.warn('⚠️ [ARRAY-SAVE] Dados não são array, recriando...');
            conversations = [];
          }
        } catch (e) {
          console.warn('⚠️ [ARRAY-SAVE] Erro ao fazer parse do JSON, criando novo array:', e);
          conversations = [];
        }

        // Adicionar nova conversa ao array
        conversations.push(conversationItem);

        // ✅ Atualizar o registro único usando o ID específico
        // Se o nome do médico foi fornecido e ainda não está salvo, atualizar também
        const updateData: any = {
          text: JSON.stringify(conversations), // Array JSON simplificado no campo text
          end_ms: Date.now() // Atualizar timestamp de fim
        };

        // ✅ Se doctor_name foi fornecido e o registro não tem, atualizar
        if (transcription.doctor_name && !existingTranscription.doctor_name) {
          updateData.doctor_name = transcription.doctor_name;
        }

        const { data: updatedData, error: updateError } = await supabase
          .from('transcriptions_med')
          .update(updateData)
          .eq('id', existingTranscription.id) // ✅ Usar ID específico
          .select()
          .single();

        if (updateError) {
          console.error('❌ [ARRAY-SAVE] Erro ao atualizar transcrição:', updateError);
          console.error('❌ [ARRAY-SAVE] ID do registro:', existingTranscription.id);
          console.error('❌ [ARRAY-SAVE] Session ID:', sessionId);
          console.error('❌ [ARRAY-SAVE] Código:', updateError.code);
          console.error('❌ [ARRAY-SAVE] Mensagem:', updateError.message);
          console.error('❌ [ARRAY-SAVE] Detalhes:', updateError.details);
          console.error('❌ [ARRAY-SAVE] Hint:', updateError.hint);
          console.error('❌ [ARRAY-SAVE] Array size:', conversations.length);
          console.error('❌ [ARRAY-SAVE] Text length:', JSON.stringify(conversations).length);
          logError(`Erro ao atualizar array de transcrições`, 'error', null, {
            sessionId,
            recordId: existingTranscription.id,
            arraySize: conversations.length,
            error: updateError.message,
            code: updateError.code
          });
          return false;
        }

        if (!updatedData) {
          console.warn(`⚠️ [ARRAY-SAVE] Nenhum registro foi atualizado! ID: ${existingTranscription.id}`);
          return false;
        }

        console.log(`✅ [ARRAY-SAVE] Transcrição adicionada: [${transcription.speaker}] "${transcription.text.substring(0, 50)}..." (Total: ${conversations.length})`);
        return true;
      } else {
        // ✅ Criar novo registro único com array inicial simplificado
        const conversations = [conversationItem];

        // ✅ Determinar speaker principal (primeiro speaker da conversa)
        const mainSpeaker = transcription.speaker;
        const mainSpeakerId = transcription.speaker_id;

        // ✅ Buscar nome do médico se não foi fornecido
        let doctorName = transcription.doctor_name;
        if (!doctorName && mainSpeaker === 'doctor') {
          // Tentar buscar da call_sessions
          try {
            const { data: callSession } = await supabase
              .from('call_sessions')
              .select('participants, metadata')
              .eq('id', sessionId)
              .maybeSingle();

            if (callSession?.participants?.host) {
              doctorName = callSession.participants.host;
            } else if (callSession?.metadata?.doctorName) {
              doctorName = callSession.metadata.doctorName;
            }
          } catch (e) {
            console.warn('⚠️ [ARRAY-SAVE] Erro ao buscar nome do médico:', e);
          }
        }

        // ✅ Preparar dados para insert
        const insertData: any = {
          session_id: sessionId,
          speaker: mainSpeaker, // ✅ Usar o speaker real (doctor ou patient)
          speaker_id: mainSpeakerId || mainSpeaker, // ✅ Usar o nome real ou fallback
          text: JSON.stringify(conversations), // ✅ Array JSON simplificado no campo text
          is_final: true,
          start_ms: transcription.start_ms || Date.now(),
          end_ms: transcription.end_ms || Date.now(),
          confidence: transcription.confidence !== undefined && transcription.confidence !== null
            ? Number(transcription.confidence)
            : 0.95,
          processing_status: 'completed', // ✅ Flag para identificar registro único
          created_at: new Date().toISOString()
        };

        // ✅ Adicionar doctor_name apenas se fornecido (pode não existir a coluna ainda)
        // Tentar adicionar, mas não falhar se a coluna não existir
        if (doctorName) {
          try {
            insertData.doctor_name = doctorName;
          } catch (e) {
            console.warn('⚠️ [ARRAY-SAVE] Não foi possível adicionar doctor_name (coluna pode não existir)');
          }
        }

        console.log(`💾 [ARRAY-SAVE] Dados para insert:`, {
          session_id: insertData.session_id,
          speaker: insertData.speaker,
          speaker_id: insertData.speaker_id,
          hasDoctorName: !!insertData.doctor_name,
          textLength: insertData.text.length,
          conversationsCount: conversations.length
        });

        // ✅ Usar service role para bypassar RLS
        const { data: newTranscription, error: insertError } = await supabase
          .from('transcriptions_med')
          .insert(insertData)
          .select()
          .single();

        // ✅ Log detalhado se houver erro de RLS
        if (insertError && insertError.code === '42501') {
          console.error('❌ [ARRAY-SAVE] Erro de RLS ao inserir!');
          console.error('❌ [ARRAY-SAVE] Código: 42501 (Row Level Security violation)');
          console.error('❌ [ARRAY-SAVE] A service role key deveria bypassar RLS, mas não está funcionando');
          console.error('❌ [ARRAY-SAVE] Verifique:');
          console.error('   1. Se SUPABASE_SERVICE_ROLE_KEY está configurada corretamente no Google Cloud');
          console.error('   2. Se a service role key é válida no Supabase dashboard');
          console.error('   3. Execute o script SQL: migrations/fix-rls-transcriptions-med.sql');
          console.error('❌ [ARRAY-SAVE] Dados tentados:', {
            session_id: insertData.session_id,
            speaker: insertData.speaker,
            has_doctor_name: !!insertData.doctor_name
          });
          logError(`Erro de RLS ao inserir transcrição`, 'error', null, {
            sessionId,
            speaker: mainSpeaker,
            error: insertError.message,
            code: insertError.code,
            hint: 'Verificar configuração do SUPABASE_SERVICE_ROLE_KEY'
          });
        }

        if (insertError) {
          console.error('❌ [ARRAY-SAVE] Erro ao criar transcrição:', insertError);
          console.error('❌ [ARRAY-SAVE] Código:', insertError.code);
          console.error('❌ [ARRAY-SAVE] Mensagem:', insertError.message);
          console.error('❌ [ARRAY-SAVE] Detalhes:', insertError.details);
          console.error('❌ [ARRAY-SAVE] Hint:', insertError.hint);
          console.error('❌ [ARRAY-SAVE] Session ID:', sessionId);
          console.error('❌ [ARRAY-SAVE] Dados tentados:', {
            session_id: sessionId,
            speaker: mainSpeaker,
            speaker_id: mainSpeakerId,
            doctor_name: doctorName,
            text_length: JSON.stringify(conversations).length
          });
          // Log no banco apenas se não for erro de RLS (já logado acima)
          if (insertError.code !== '42501') {
            logError(`Erro ao criar registro de transcrição`, 'error', null, {
              sessionId,
              speaker: mainSpeaker,
              error: insertError.message,
              code: insertError.code
            });
          }

          // ✅ Se erro for de coluna não existe (doctor_name), tentar novamente sem ela
          if (insertError.code === '42703' && insertData.doctor_name) {
            console.log('🔄 [ARRAY-SAVE] Erro de coluna não existe, tentando novamente sem doctor_name...');
            const retryData = { ...insertData };
            delete retryData.doctor_name;

            const { data: retryTranscription, error: retryError } = await supabase
              .from('transcriptions_med')
              .insert(retryData)
              .select()
              .single();

            if (retryError) {
              console.error('❌ [ARRAY-SAVE] Erro ao criar mesmo sem doctor_name:', retryError);
              return false;
            }

            console.log(`✅ [ARRAY-SAVE] Registro criado sem doctor_name: ${retryTranscription.id}`);
            return true;
          }

          return false;
        }

        console.log(`✅ [ARRAY-SAVE] Registro único criado: [${mainSpeaker}] "${transcription.text.substring(0, 50)}..."`);
        return true;
      }
    } catch (error) {
      console.error('❌ [ARRAY-SAVE] Erro ao adicionar transcrição:', error);
      if (error instanceof Error) {
        console.error('❌ [ARRAY-SAVE] Stack:', error.stack);
      }
      logError(`Exceção ao adicionar transcrição ao array`, 'error', null, {
        sessionId,
        speaker: transcription.speaker,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  },

  /**
   * Cria call_session ao criar sala
   */
  async createCallSession(data: {
    room_id: string;
    room_name: string;
    session_type: string;
    participants: any;
    metadata?: any;
  }): Promise<any | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .insert({
        ...data,
        status: 'active',
        consent: true,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar call_session:', error);
      logError(`Erro ao criar call_session no banco`, 'error', null, { roomId: data.room_id, roomName: data.room_name, error: error.message, code: error.code });
      return null;
    }

    return session;
  },

  /**
   * Salva transcrição completa da consulta
   */
  async saveConsultationTranscription(data: {
    consultation_id: string;
    raw_text: string;
    language?: string;
    model_used?: string;
  }): Promise<any | null> {
    const { data: transcription, error } = await supabase
      .from('transcriptions')
      .insert({
        ...data,
        language: data.language || 'pt-BR',
        model_used: data.model_used || 'gpt-4o-mini-realtime-preview',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar transcrição:', error);
      logError(`Erro ao salvar transcrição da consulta no banco`, 'error', data.consultation_id, { error: error.message, code: error.code });
      return null;
    }

    return transcription;
  },

  // ==================== GRAVAÇÕES ====================

  /**
   * Salva metadados de gravação
   */
  async saveRecordingMetadata(data: {
    id: string;
    session_id: string;
    consultation_id?: string | null;
    room_id?: string;
    file_path: string;
    file_url?: string;
    file_size: number;
    duration_seconds?: number | null;
    mime_type: string;
    status: 'recording' | 'processing' | 'completed' | 'error';
    created_at: string;
  }): Promise<any | null> {
    const { data: recording, error } = await supabase
      .from('recordings')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Erro ao salvar metadados de gravação:', error);
      logError(`Erro ao salvar metadados de gravação`, 'error', data.consultation_id || null, {
        error: error.message,
        code: error.code,
        session_id: data.session_id
      });
      return null;
    }

    console.log('✅ [DB] Metadados de gravação salvos:', data.id);
    return recording;
  },

  /**
   * Atualiza URL de gravação na sessão
   */
  async updateSessionRecording(sessionId: string, recordingUrl: string): Promise<boolean> {
    const { error } = await supabase
      .from('call_sessions')
      .update({
        recording_url: recordingUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('❌ [DB] Erro ao atualizar recording_url na sessão:', error);
      logError(`Erro ao atualizar recording_url na sessão`, 'error', null, {
        error: error.message,
        code: error.code,
        session_id: sessionId
      });
      return false;
    }

    console.log('✅ [DB] Recording URL atualizada na sessão:', sessionId);
    return true;
  },

  /**
   * Busca gravação por ID
   */
  async getRecordingById(recordingId: string): Promise<any | null> {
    const { data: recording, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (error) {
      console.error('❌ [DB] Erro ao buscar gravação:', error);
      return null;
    }

    return recording;
  },

  /**
   * Lista gravações por sessão
   */
  async getRecordingsBySession(sessionId: string): Promise<any[]> {
    const { data: recordings, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [DB] Erro ao listar gravações por sessão:', error);
      return [];
    }

    return recordings || [];
  },

  /**
   * Lista gravações por consulta
   */
  async getRecordingsByConsultation(consultationId: string): Promise<any[]> {
    const { data: recordings, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('consultation_id', consultationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [DB] Erro ao listar gravações por consulta:', error);
      return [];
    }

    return recordings || [];
  },

  /**
   * Atualiza status de gravação
   */
  async updateRecordingStatus(recordingId: string, status: string, additionalData?: Record<string, any>): Promise<boolean> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const { error } = await supabase
      .from('recordings')
      .update(updateData)
      .eq('id', recordingId);

    if (error) {
      console.error('❌ [DB] Erro ao atualizar status da gravação:', error);
      return false;
    }

    return true;
  },

  /**
   * Remove gravação
   */
  async deleteRecording(recordingId: string): Promise<boolean> {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', recordingId);

    if (error) {
      console.error('❌ [DB] Erro ao remover gravação:', error);
      return false;
    }

    console.log('🗑️ [DB] Gravação removida:', recordingId);
    return true;
  },
};

// ==================== LOG DE ERROS ====================

/**
 * Interface para log de erros
 */
export interface LogErro {
  id?: number;
  created_at?: string;
  payload?: Record<string, any>;
  motivo: string;
  consulta_id?: string | null;
  tipo: 'error' | 'warning';
}

/**
 * Registra um erro ou warning na tabela log_erros
 * @param motivo Descrição do erro/warning
 * @param tipo Tipo: 'error' ou 'warning'
 * @param consultaId ID da consulta (opcional)
 * @param payload Dados adicionais em formato JSON (opcional)
 */
export async function logError(
  motivo: string,
  tipo: 'error' | 'warning' = 'error',
  consultaId?: string | null,
  payload?: Record<string, any>
): Promise<void> {
  try {
    const logData: Partial<LogErro> = {
      motivo,
      tipo,
      consulta_id: consultaId || null,
      payload: payload || undefined
    };

    const { error } = await supabase
      .from('log_erros')
      .insert(logData);

    if (error) {
      // Não logar recursivamente se der erro ao logar
      console.error('❌ [LOG_ERROS] Falha ao salvar log no banco:', error.message);
    } else {
      console.log(`📋 [LOG_ERROS] ${tipo.toUpperCase()} registrado: ${motivo.substring(0, 100)}...`);
    }
  } catch (err) {
    // Falha silenciosa para não quebrar o fluxo principal
    console.error('❌ [LOG_ERROS] Exceção ao salvar log:', err);
  }
}

/**
 * Versão simplificada para erros
 */
export async function logErrorSimple(
  motivo: string,
  consultaId?: string | null,
  payload?: Record<string, any>
): Promise<void> {
  return logError(motivo, 'error', consultaId, payload);
}

/**
 * Versão simplificada para warnings
 */
export async function logWarning(
  motivo: string,
  consultaId?: string | null,
  payload?: Record<string, any>
): Promise<void> {
  return logError(motivo, 'warning', consultaId, payload);
}

export default supabase;