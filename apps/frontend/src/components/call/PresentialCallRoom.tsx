'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Square, Play, Volume2, FileText, Brain, AlertCircle, ClipboardList, User, Calendar, Power, PowerOff, X } from 'lucide-react';
import { useAudioForker } from '@/hooks/useAudioForker';
import { CompletionModal } from './CompletionModal';
import io, { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

interface PresentialCallRoomProps {
  sessionId: string;
  consultationId: string;
  doctorMicId: string;
  patientMicId: string;
  patientName: string;
}

interface Utterance {
  id: string;
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  confidence: number;
}

interface Suggestion {
  id: string;
  type:
  | 'question'
  | 'protocol'
  | 'alert'
  | 'followup'
  | 'assessment'
  | 'insight'
  | 'warning'
  | 'diagnosis'
  | 'treatment'
  | 'note';
  content: string;
  confidence: number;
  timestamp: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  used?: boolean;
  used_at?: string;
  source?: string;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function PresentialCallRoom({
  sessionId,
  consultationId,
  doctorMicId,
  patientMicId,
  patientName
}: PresentialCallRoomProps) {
  const router = useRouter();
  const { showWarning } = useNotifications();
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsEnabled, setSuggestionsEnabled] = useState<boolean>(true);
  const [suggestionsPanelVisible, setSuggestionsPanelVisible] = useState<boolean>(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{ durationSeconds: number; suggestions: { total: number; used: number } } | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const transcriptionScrollRef = useRef<HTMLDivElement>(null);

  // Estados para dados da anamnese
  const [patientData, setPatientData] = useState({
    name: patientName,
    birthDate: '',
    age: '',
    gender: '',
    medicalHistory: '',
    currentMedications: '',
    allergies: ''
  });

  // 🛡️ PROTEÇÃO CONTRA DUPLICAÇÃO: Set para rastrear IDs já processados
  const processedUtteranceIds = useRef<Set<string>>(new Set());

  // Hook para captura de áudio dual
  const audioForker = useAudioForker({
    doctorMicId,
    patientMicId,
    onAudioData: useCallback((data: {
      channel: 'doctor' | 'patient';
      audioData: Float32Array;
      timestamp: number;
      sampleRate: number;
    }) => {
      // Enviar dados de áudio via WebSocket
      if (socket && connectionState.isConnected) {
        socket.emit(`presential:audio:${data.channel}`, {
          sessionId,
          audioData: Array.from(data.audioData), // Converter para array serializável
          timestamp: data.timestamp,
          sampleRate: data.sampleRate
        });
      }
    }, [socket, connectionState.isConnected, sessionId]),
    onError: useCallback((error: string) => {
      setConnectionState(prev => ({ ...prev, error }));
    }, [])
  });

  // Inicializar conexão WebSocket
  useEffect(() => {
    let socketInstance: Socket | null = null;

    const initializeWebSocket = () => {
      setConnectionState(prev => ({ ...prev, isConnecting: true }));

      // Socket.IO connects directly to realtime-service (not gateway)
      const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'ws://localhost:3002';
      let wsUrl = realtimeUrl;

      // Ensure WebSocket URL format
      if (realtimeUrl.startsWith('https://')) {
        wsUrl = realtimeUrl.replace('https://', 'wss://');
      } else if (realtimeUrl.startsWith('http://')) {
        wsUrl = realtimeUrl.replace('http://', 'ws://');
      }

      socketInstance = io(wsUrl, {
        transports: ['websocket'],
        timeout: 10000
      });

      socketInstance.on('connect', () => {
        console.log('✅ WebSocket conectado');
        console.log('🔗 URL do WebSocket:', wsUrl);
        setConnectionState({
          isConnected: true,
          isConnecting: false,
          error: null
        });

        // Entrar na sessão
        socketInstance!.emit('session:join', {
          sessionId,
          userId: 'doctor-current', // TODO: Pegar do contexto de auth
          role: 'doctor'
        });
      });

      socketInstance.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setConnectionState(prev => ({
          ...prev,
          isConnected: false
        }));
      });

      socketInstance.on('connect_error', (error) => {
        console.error('❌ Erro de conexão WebSocket:', error);
        setConnectionState({
          isConnected: false,
          isConnecting: false,
          error: `Erro de conexão: ${error.message}`
        });
      });

      // Handler para confirmação de entrada na sessão
      socketInstance.on('session:joined', (data) => {
        console.log('✅ Entrou na sessão:', data);
      });

      // ✅ NOVO: Handler para receber histórico de transcrições ao reconectar
      socketInstance.on('transcription:history', (data) => {
        console.log('📜 Histórico de transcrições recebido:', data);
        if (data.utterances && Array.isArray(data.utterances)) {
          // Converter formato do banco para formato do frontend
          const formattedUtterances = data.utterances.map((u: any) => ({
            id: u.id,
            speaker: u.speaker,
            text: u.text,
            timestamp: new Date(u.created_at || u.timestamp),
            confidence: u.confidence || 0,
            isFinal: u.is_final !== false
          }));

          // Adicionar IDs ao Set de processados para evitar duplicação
          formattedUtterances.forEach((u: any) => {
            processedUtteranceIds.current.add(u.id);
          });

          // Popular estado com histórico
          setUtterances(formattedUtterances);
          console.log(`✅ ${formattedUtterances.length} transcrições históricas carregadas`);
        } else {
          console.warn('⚠️ Dados de histórico sem utterances:', data);
        }
      });

      // Handlers para transcrição
      socketInstance.on('transcription:update', (data) => {
        console.log('📨 Frontend recebeu transcrição:', data);
        if (data.utterance) {
          // 🛡️ PROTEÇÃO CONTRA DUPLICAÇÃO: Verificar se ID já foi processado
          if (processedUtteranceIds.current.has(data.utterance.id)) {
            console.log('🛡️ Utterance duplicado bloqueado:', data.utterance.id);
            return;
          }

          // Marcar como processado ANTES de adicionar
          processedUtteranceIds.current.add(data.utterance.id);

          console.log('✅ Adicionando utterance à lista:', data.utterance);
          setUtterances(prev => [...prev, data.utterance]);

          // Limpeza periódica do Set (manter últimos 1000 IDs)
          if (processedUtteranceIds.current.size > 1000) {
            const idsArray = Array.from(processedUtteranceIds.current);
            processedUtteranceIds.current.clear();
            // Manter só os últimos 500 IDs
            idsArray.slice(-500).forEach(id => processedUtteranceIds.current.add(id));
          }
        } else {
          console.warn('⚠️ Dados de transcrição sem utterance:', data);
        }
      });

      // Handlers para sugestões de IA
      socketInstance.on('ai:suggestions', (data) => {
        console.log('🤖 Frontend recebeu sugestões de IA:', data);
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(prev => {
            // Evitar duplicatas baseado no ID
            const existingIds = new Set(prev.map(s => s.id));
            const newSuggestions = data.suggestions.filter((s: any) => !existingIds.has(s.id));
            return [...prev, ...newSuggestions];
          });
        }
      });

      socketInstance.on('ai:suggestion', (data) => {
        console.log('🤖 Frontend recebeu sugestão individual:', data);
        if (data.suggestion) {
          setSuggestions(prev => {
            // Evitar duplicatas
            const exists = prev.some(s => s.id === data.suggestion.id);
            if (!exists) {
              return [...prev, data.suggestion];
            }
            return prev;
          });
        }
      });

      socketInstance.on('ai:context_update', (data) => {
        console.log('🧠 Frontend recebeu atualização de contexto:', data);
        // Aqui você pode atualizar informações de contexto se necessário
      });

      socketInstance.on('ai:suggestion:used', (data) => {
        console.log('✅ Sugestão marcada como usada:', data);
        setSuggestions(prev =>
          prev.map(s =>
            s.id === data.suggestionId
              ? { ...s, used: true, used_at: data.timestamp }
              : s
          )
        );
      });

      socketInstance.on('suggestions:response', (data) => {
        console.log('📋 Frontend recebeu sugestões existentes:', data);
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      });

      // Handler para erros de sessão
      socketInstance.on('session:error', (data) => {
        setConnectionState(prev => ({
          ...prev,
          error: data.error.message
        }));
      });

      setSocket(socketInstance);
    };

    initializeWebSocket();

    // Cleanup ao desmontar ou re-executar
    return () => {
      if (socketInstance) {
        console.log('🧹 Limpando listeners WebSocket');
        socketInstance.emit('session:leave', {
          sessionId,
          userId: 'doctor-current'
        });
        socketInstance.disconnect();
        socketInstance = null;
      }

      // 🧹 Limpar IDs processados ao trocar de sessão
      processedUtteranceIds.current.clear();
    };
  }, [sessionId]);

  // Scroll automático quando novas transcrições chegam
  useEffect(() => {
    if (transcriptionScrollRef.current && utterances.length > 0) {
      transcriptionScrollRef.current.scrollTop = transcriptionScrollRef.current.scrollHeight;
    }
  }, [utterances]);

  // Simular extração automática de dados pela IA baseada nas transcrições
  useEffect(() => {
    if (utterances.length > 0) {
      // Simular processamento de IA para extrair dados do paciente
      const latestUtterance = utterances[utterances.length - 1];

      // Exemplo de extração automática (em produção, isso viria do backend)
      if (latestUtterance.text.toLowerCase().includes('nasci') || latestUtterance.text.toLowerCase().includes('nascimento')) {
        // Extrair data de nascimento (exemplo)
        const birthDateMatch = latestUtterance.text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{1,2}-\d{1,2})/);
        if (birthDateMatch) {
          setPatientData(prev => ({
            ...prev,
            birthDate: birthDateMatch[0]
          }));
        }
      }

      if (latestUtterance.text.toLowerCase().includes('anos') || latestUtterance.text.toLowerCase().includes('idade')) {
        // Extrair idade (exemplo)
        const ageMatch = latestUtterance.text.match(/(\d+)\s*anos?/);
        if (ageMatch) {
          setPatientData(prev => ({
            ...prev,
            age: ageMatch[1] + ' anos'
          }));
        }
      }
    }
  }, [utterances]);

  // Função para iniciar sessão
  const handleStartSession = useCallback(async () => {
    if (!audioForker.isSupported) {
      showWarning('Seu browser não suporta a captura de áudio necessária.', 'Navegador Incompatível');
      return;
    }

    try {
      await audioForker.startRecording();
      setSessionStartTime(new Date());

      // Notificar gateway sobre início da gravação
      if (socket && connectionState.isConnected) {
        socket.emit('presential:start_recording', {
          sessionId,
          consultationId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
    }
  }, [audioForker, socket, connectionState.isConnected, sessionId, consultationId]);

  // Função para parar sessão
  const handleStopSession = useCallback(() => {
    audioForker.stopRecording();
    setSessionStartTime(null);

    // Notificar gateway sobre fim da gravação (WebSocket)
    if (socket && connectionState.isConnected) {
      socket.emit('presential:stop_recording', {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }

    // Chamar endpoint HTTP para finalizar e consolidar a sessão
    const finalize = async () => {
      try {
        setIsFinalizing(true);
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';
        const baseUrl = gatewayUrl.replace(/^ws(s)?:\/\//, (_m) => (gatewayUrl.startsWith('wss') ? 'https://' : 'http://'));
        const url = `${baseUrl.replace(/\/$/, '')}/api/sessions/${sessionId}/complete`;
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Falha ao finalizar sessão: ${resp.status} ${errText}`);
        }
        const data = await resp.json();
        setCompletionSummary({ durationSeconds: data.durationSeconds, suggestions: data.suggestions });
        setIsCompleted(true);
        setShowCompletionModal(true);

        // Encerrar socket após finalizar
        if (socket) {
          socket.emit('session:leave', { sessionId, userId: 'doctor-current' });
          socket.disconnect();
          setSocket(null);
        }
      } catch (e) {
        console.error(e);
        setConnectionState(prev => ({ ...prev, error: e instanceof Error ? e.message : 'Erro ao finalizar sessão' }));
      } finally {
        setIsFinalizing(false);
      }
    };

    finalize();
  }, [audioForker, socket, connectionState.isConnected, sessionId]);

  // Função para marcar sugestão como usada
  const handleUseSuggestion = useCallback((suggestionId: string) => {
    if (socket && connectionState.isConnected) {
      socket.emit('suggestion:used', {
        suggestionId,
        sessionId,
        userId: 'doctor-current' // TODO: Pegar do contexto de auth
      });

      // Atualizar estado local imediatamente
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId
            ? { ...s, used: true, used_at: new Date().toISOString() }
            : s
        )
      );

      console.log(`✅ Sugestão ${suggestionId} marcada como usada`);
    }
  }, [socket, connectionState.isConnected, sessionId]);

  // Função para solicitar sugestões existentes
  const handleRequestSuggestions = useCallback(() => {
    if (socket && connectionState.isConnected) {
      socket.emit('suggestions:request', { sessionId });
      console.log('📋 Solicitando sugestões existentes...');
    }
  }, [socket, connectionState.isConnected, sessionId]);

  // Função para gerar novas sugestões manualmente
  const handleGenerateSuggestions = useCallback(() => {
    if (socket && connectionState.isConnected) {
      socket.emit('suggestions:generate', { sessionId, force: true });
      console.log('🤖 Gerando novas sugestões...');
    }
  }, [socket, connectionState.isConnected, sessionId]);

  // Função para redirecionar para consultas
  const handleRedirectToConsultations = useCallback(() => {
    // Redirecionar para /consultas com o ID da consulta como query param
    router.push(`/consultas?consultation=${consultationId}&modal=true`);
  }, [router, consultationId]);

  // Calcular duração da sessão
  const sessionDuration = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="presential-call-room">
      {/* Header da Sessão */}
      <div className="session-header">
        <div className="session-info">
          <h1>Consulta Presencial</h1>
          <p>Paciente: <strong>{patientName}</strong></p>
          {sessionStartTime && (
            <p>Duração: <strong>{formatDuration(sessionDuration)}</strong></p>
          )}
          {isCompleted && completionSummary && (
            <p>
              <strong>Finalizada</strong> • Duração: {formatDuration(completionSummary.durationSeconds)} • Sugestões usadas: {completionSummary.suggestions.used}/{completionSummary.suggestions.total}
            </p>
          )}
        </div>

        <div className="session-controls">
          <div className="audio-controls-header">
            <h3>
              <Volume2 className="w-5 h-5" />
              Controle de Áudio
            </h3>

            <div className="mic-controls-compact">
              <div className="mic-control-compact">
                <Mic className="w-4 h-4" />
                <span>Médico</span>
              </div>
              <div className="mic-control-compact">
                <Mic className="w-4 h-4" />
                <span>Paciente</span>
              </div>
            </div>
          </div>

          <div className="recording-control" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!audioForker.isRecording ? (
              <button
                onClick={handleStartSession}
                className="btn btn-primary btn-large"
                disabled={connectionState.isConnecting || !connectionState.isConnected}
              >
                <Play className="w-5 h-5" />
                Iniciar Gravação
              </button>
            ) : (
              <button
                onClick={handleStopSession}
                className="btn btn-danger btn-large"
                disabled={isFinalizing}
              >
                <Square className="w-5 h-5" />
                {isFinalizing ? 'Finalizando…' : 'Parar Gravação'}
              </button>
            )}

            {/* Botão para ativar/desativar sugestões de IA */}
            <button
              onClick={() => {
                setSuggestionsEnabled(!suggestionsEnabled);
                if (!suggestionsEnabled) {
                  setSuggestions([]);
                  setSuggestionsPanelVisible(true);
                } else {
                  setSuggestionsPanelVisible(false);
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                background: suggestionsEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                color: suggestionsEnabled ? '#16a34a' : '#6b7280',
                border: suggestionsEnabled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              title={suggestionsEnabled ? 'Desativar Sugestões de IA' : 'Ativar Sugestões de IA'}
            >
              {suggestionsEnabled ? (
                <>
                  <Brain size={16} style={{ color: '#16a34a' }} />
                  <span>Sugestões IA</span>
                </>
              ) : (
                <>
                  <Brain size={16} style={{ color: '#6b7280', opacity: 0.5 }} />
                  <span>Sugestões IA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status da Conexão */}
      {connectionState.error && (
        <div className="connection-error">
          <AlertCircle className="w-5 h-5" />
          <span>{connectionState.error}</span>
        </div>
      )}

      {connectionState.isConnecting && (
        <div className="connection-status">
          <div className="loading-spinner" />
          <span>Conectando ao servidor...</span>
        </div>
      )}

      {isFinalizing && (
        <div className="connection-status">
          <div className="loading-spinner" />
          <span>Finalizando consulta…</span>
        </div>
      )}

      {isCompleted && (
        <div className="connection-status success">
          <span>✅ Consulta finalizada e salva com sucesso.</span>
        </div>
      )}

      <div className="call-content">
        {/* Painel de Anamnese */}
        <div className="anamnese-panel">
          <h2>
            <ClipboardList className="w-5 h-5" />
            Anamnese
          </h2>

          <div className="anamnese-content">
            {/* Informações do Paciente */}
            <div className="patient-info-section">
              <h3>
                <User className="w-4 h-4" />
                Informações do Paciente
              </h3>

              <div className="patient-field">
                <label className="patient-field-label">Nome do Paciente</label>
                <div className="patient-field-value ai-generated">
                  {patientData.name}
                </div>
                <div className="ai-indicator">
                  <Brain className="w-3 h-3" />
                  Preenchido automaticamente
                </div>
              </div>

              <div className="patient-field">
                <label className="patient-field-label">Data de Nascimento</label>
                <div className={`patient-field-value ${!patientData.birthDate ? 'waiting' : 'ai-generated'}`}>
                  {patientData.birthDate || 'Aguardando transcrição...'}
                </div>
                {patientData.birthDate && (
                  <div className="ai-indicator">
                    <Brain className="w-3 h-3" />
                    Extraído pela IA
                  </div>
                )}
              </div>
            </div>

            {/* Status do Sistema */}
            <div className="patient-info-section">
              <h3>Status do Sistema</h3>
              <div className="system-status">
                <div className="status-item">
                  <span>WebSocket:</span>
                  <span className={`status ${connectionState.isConnected ? 'connected' : 'disconnected'}`}>
                    {connectionState.isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="status-item">
                  <span>Áudio:</span>
                  <span className={`status ${audioForker.isSupported ? 'supported' : 'unsupported'}`}>
                    {audioForker.isSupported ? 'Suportado' : 'Não Suportado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Painel de Transcrição */}
        <div className="transcription-panel">
          <h2>
            <FileText className="w-5 h-5" />
            Transcrição em Tempo Real
          </h2>

          <div className="transcription-content" ref={transcriptionScrollRef}>
            {utterances.length === 0 ? (
              <p className="no-transcription">
                {audioForker.isRecording
                  ? 'Aguardando fala...'
                  : 'Inicie a gravação para ver a transcrição'}
              </p>
            ) : (
              <div className="utterances-list">
                {utterances.map((utterance, index) => (
                  <div
                    key={`${utterance.id}-${index}`}
                    className={`utterance ${utterance.speaker}`}
                  >
                    <div className="utterance-header">
                      <span className="speaker">
                        {utterance.speaker === 'doctor' ? 'Médico' : 'Paciente'}
                      </span>
                      <span className="timestamp">
                        {new Date(utterance.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <span className="confidence">
                        {Math.round(utterance.confidence * 100)}%
                      </span>
                    </div>
                    <div className="utterance-text">
                      {utterance.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Painel de Sugestões de IA - Só aparece se estiver habilitado e visível */}
        {suggestionsEnabled && suggestionsPanelVisible && suggestions.length > 0 && (
          <div className="suggestions-panel">
            <div className="suggestions-header">
              <h2>
                <Brain className="w-5 h-5" />
                Sugestões de IA
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <span className="suggestions-count">{suggestions.length}</span>
                <button
                  onClick={() => setSuggestionsPanelVisible(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  title="Fechar painel de sugestões"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="suggestions-content">
              <div className="suggestions-list">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`suggestion ${suggestion.type} ${suggestion.used ? 'used' : ''}`}
                  >
                    <div className="suggestion-header">
                      <div className="suggestion-meta">
                        <span className="type">
                          {suggestion.type === 'question' && '❓ Pergunta'}
                          {suggestion.type === 'protocol' && '📋 Protocolo'}
                          {suggestion.type === 'alert' && '⚠️ Alerta'}
                          {suggestion.type === 'followup' && '🔄 Seguimento'}
                          {suggestion.type === 'assessment' && '🔍 Avaliação'}
                          {suggestion.type === 'insight' && '💡 Insight'}
                          {suggestion.type === 'warning' && '⚠️ Aviso'}
                        </span>
                        <span className={`priority priority-${suggestion.priority}`}>
                          {suggestion.priority === 'critical' && '🔴 Crítico'}
                          {suggestion.priority === 'high' && '🟠 Alto'}
                          {suggestion.priority === 'medium' && '🟡 Médio'}
                          {suggestion.priority === 'low' && '🟢 Baixo'}
                        </span>
                      </div>
                      <div className="suggestion-confidence">
                        {Math.round(suggestion.confidence * 100)}%
                      </div>
                    </div>

                    <div className="suggestion-text">
                      {suggestion.content}
                    </div>

                    {suggestion.source && (
                      <div className="suggestion-source">
                        📚 {suggestion.source}
                      </div>
                    )}

                    <div className="suggestion-actions">
                      {!suggestion.used ? (
                        <button
                          onClick={() => handleUseSuggestion(suggestion.id)}
                          className="btn btn-sm btn-primary"
                        >
                          ✅ Usar Sugestão
                        </button>
                      ) : (
                        <div className="suggestion-used">
                          ✅ Usada em {new Date(suggestion.used_at || '').toLocaleTimeString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Finalização */}
      {showCompletionModal && completionSummary && (
        <CompletionModal
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          consultationData={{
            sessionId,
            consultationId,
            patientName,
            durationSeconds: completionSummary.durationSeconds,
            suggestions: completionSummary.suggestions,
            utterances,
            usedSuggestions: suggestions.filter(s => s.used)
          }}
          onRedirectToConsultations={handleRedirectToConsultations}
        />
      )}
    </div>
  );
}
