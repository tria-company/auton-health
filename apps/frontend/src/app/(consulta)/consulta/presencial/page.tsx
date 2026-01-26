'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useRouter, useSearchParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { AlertCircle, CheckCircle, XCircle, Radio, AlertTriangle, ArrowLeft } from 'lucide-react';
import { DualMicrophoneControl } from '@/components/presencial/DualMicrophoneControl';
import { PresencialTranscription } from '@/components/presencial/PresencialTranscription';
import { usePresencialAudioCapture } from '@/hooks/usePresencialAudioCapture';
import { formatDuration } from '@/lib/audioUtils';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { supabase } from '@/lib/supabase';

import { TranscriptionSegment } from '@medcall/shared-types';

/*
interface Transcription {
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  sequence: number;
}
*/

function PresencialConsultationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const consultationId = searchParams.get('consultationId');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  const [doctorMicrophoneId, setDoctorMicrophoneId] = useState('');
  const [patientMicrophoneId, setPatientMicrophoneId] = useState('');

  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [duration, setDuration] = useState(0);

  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);

  // Estados para monitoramento de níveis de áudio durante setup
  const [doctorMicLevel, setDoctorMicLevel] = useState(0);
  const [patientMicLevel, setPatientMicLevel] = useState(0);
  const doctorStreamRef = useRef<MediaStream | null>(null);
  const patientStreamRef = useRef<MediaStream | null>(null);
  const doctorAnalyserRef = useRef<AnalyserNode | null>(null);
  const patientAnalyserRef = useRef<AnalyserNode | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hook de captura de áudio
  const {
    isRecording,
    startCapture,
    stopCapture,
    doctorLevel,
    patientLevel,
    pendingChunks
  } = usePresencialAudioCapture({
    socket,
    doctorMicrophoneId,
    patientMicrophoneId
  });

  // Monitorar níveis de áudio durante setup (antes de iniciar sessão)
  useEffect(() => {
    if (sessionStarted) {
      // Se a sessão já começou, usar os níveis do hook
      return;
    }

    const startLevelMonitoring = async () => {
      // Limpar streams anteriores
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      if (!doctorMicrophoneId || !patientMicrophoneId) {
        setDoctorMicLevel(0);
        setPatientMicLevel(0);
        return;
      }

      try {
        // Obter streams de áudio
        const doctorStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: doctorMicrophoneId ? { exact: doctorMicrophoneId } : undefined,
            echoCancellation: false, // Desabilitar para melhor detecção de nível
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        const patientStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: patientMicrophoneId ? { exact: patientMicrophoneId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        doctorStreamRef.current = doctorStream;
        patientStreamRef.current = patientStream;

        // Criar AudioContext e AnalyserNodes
        const audioContext = new AudioContext();
        const doctorSource = audioContext.createMediaStreamSource(doctorStream);
        const patientSource = audioContext.createMediaStreamSource(patientStream);

        const doctorAnalyser = audioContext.createAnalyser();
        const patientAnalyser = audioContext.createAnalyser();

        doctorAnalyser.fftSize = 256;
        patientAnalyser.fftSize = 256;

        doctorSource.connect(doctorAnalyser);
        patientSource.connect(patientAnalyser);

        doctorAnalyserRef.current = doctorAnalyser;
        patientAnalyserRef.current = patientAnalyser;

        // Função para calcular nível de volume
        const calculateVolumeLevel = (analyser: AnalyserNode): number => {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }

          const average = sum / bufferLength;
          return Math.min(average / 128, 1); // Normalizar para 0-1
        };

        // Atualizar níveis periodicamente
        levelIntervalRef.current = setInterval(() => {
          if (doctorAnalyserRef.current) {
            const level = calculateVolumeLevel(doctorAnalyserRef.current);
            setDoctorMicLevel(level);
          }

          if (patientAnalyserRef.current) {
            const level = calculateVolumeLevel(patientAnalyserRef.current);
            setPatientMicLevel(level);
          }
        }, 100);

      } catch (error) {
        console.error('Erro ao monitorar níveis de áudio:', error);
        setDoctorMicLevel(0);
        setPatientMicLevel(0);
      }
    };

    startLevelMonitoring();

    // Cleanup
    return () => {
      if (levelIntervalRef.current) {
        clearInterval(levelIntervalRef.current);
      }
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [doctorMicrophoneId, patientMicrophoneId, sessionStarted]);

  // Timer de duração
  useEffect(() => {
    if (!sessionStarted) return;

    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStarted]);

  // Conectar Socket.IO
  useEffect(() => {
    // Usar diretamente a URL do Realtime Service (WebSocket)
    let realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'ws://localhost:3002';

    // Socket.IO espera HTTP/HTTPS, não WS/WSS
    // Converter automaticamente
    if (realtimeUrl.startsWith('wss://')) {
      realtimeUrl = realtimeUrl.replace('wss://', 'https://');
    } else if (realtimeUrl.startsWith('ws://')) {
      realtimeUrl = realtimeUrl.replace('ws://', 'http://');
    }

    console.log('🔌 Conectando Socket.IO para:', realtimeUrl);

    const newSocket = io(realtimeUrl, {
      auth: {
        userName: 'Doctor',
        password: 'x'
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket conectado');
      setSocketConnected(true);
      setError(null); // Limpar erro ao conectar
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket desconectado:', reason);
      setSocketConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão Socket.IO:', error);
      setSocketConnected(false);
      setError(`Erro de conexão WebSocket: ${error.message}`);
    });

    // Receber transcrições
    newSocket.on('presencialTranscription', (data: any) => {
      console.log('📝 Nova transcrição:', data);
      // mapear para TranscriptionSegment
      const mappedData: TranscriptionSegment = {
        id: `seq-${data.sequence || Date.now()}`,
        text: data.text,
        speaker: data.speaker === 'doctor' ? 'MEDICO' : 'PACIENTE',
        timestamp: data.timestamp, // string iso
        confidence: 1.0, // placeholder
      };
      setTranscriptions(prev => [...prev, mappedData]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Buscar dados da consulta
  useEffect(() => {
    const loadConsultation = async () => {
      if (!consultationId) return;

      try {
        const response = await gatewayClient.get(`/consultations/${consultationId}`);
        if (response.success && response.patient_name) {
          setPatientName(response.patient_name);
        } else if (response.error) {
          console.error('Erro ao carregar consulta:', response.error);
          setError(response.error);
        }
      } catch (error) {
        console.error('Erro ao carregar consulta:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    };

    loadConsultation();

    // Buscar nome do médico
    const loadDoctor = async () => {
      try {
        // Buscar usuário autenticado
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.warn('Usuário não autenticado');
          return;
        }

        // Buscar dados do médico
        const { data: medico, error: medicoError } = await supabase
          .from('medicos')
          .select('*')
          .eq('user_auth', user.id)
          .single();

        if (!medicoError && medico) {
          setDoctorName(medico.name || 'Dr. Médico');
        }
      } catch (error) {
        console.error('Erro ao carregar médico:', error);
      }
    };

    loadDoctor();
  }, [consultationId]);

  const handleMicrophonesSelected = (doctorMic: string, patientMic: string) => {
    setDoctorMicrophoneId(doctorMic);
    setPatientMicrophoneId(patientMic);
  };

  const handleStartSession = async () => {
    if (!socket || !consultationId) {
      setError('Socket não conectado ou consulta não encontrada');
      return;
    }

    if (!doctorMicrophoneId || !patientMicrophoneId) {
      setError('Selecione os microfones');
      return;
    }

    try {
      // Iniciar sessão no backend
      socket.emit('startPresencialSession', {
        consultationId,
        doctorMicrophoneId,
        patientMicrophoneId
      }, async (response: any) => {
        if (response.success) {
          console.log('✅ Sessão iniciada:', response.sessionId);

          // IMPORTANTE: Setar sessionId ANTES de iniciar captura
          setSessionId(response.sessionId);
          setSessionStarted(true);

          // Parar streams de monitoramento de nível
          if (levelIntervalRef.current) {
            clearInterval(levelIntervalRef.current);
          }
          if (doctorStreamRef.current) {
            doctorStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            doctorStreamRef.current = null;
          }
          if (patientStreamRef.current) {
            patientStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            patientStreamRef.current = null;
          }

          // Aguardar um pouco para garantir que o estado foi atualizado
          await new Promise(resolve => setTimeout(resolve, 100));

          // Iniciar captura de áudio IMEDIATAMENTE com sessionId do callback
          console.log('🎬 Iniciando captura de áudio com sessionId:', response.sessionId);
          await startCapture(response.sessionId);
        } else {
          setError(response.error || 'Erro ao iniciar sessão');
        }
      });
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      setError('Erro ao iniciar sessão');
    }
  };

  const handleEndSession = async () => {
    if (!socket || !sessionId) return;

    // Parar captura
    stopCapture();

    // Finalizar sessão no backend
    socket.emit('endPresencialSession', {
      sessionId
    }, (response: any) => {
      if (response.success) {
        console.log('✅ Sessão finalizada');

        // Redirecionar para lista de consultas
        router.push('/consultas');
      } else {
        setError(response.error || 'Erro ao finalizar sessão');
      }
    });
  };

  if (!consultationId) {
    return (
      <div className="presencial-page">
        <div className="error-card">
          <XCircle className="error-icon" size={48} />
          <h2>Consulta não encontrada</h2>
          <p>ID da consulta não fornecido</p>
          <button onClick={() => router.push('/consultas')} className="btn btn-primary">
            <ArrowLeft size={18} />
            Voltar para Consultas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="presencial-page">
      <div className="page-header">
        <h1>Consulta Presencial</h1>
        <p>Paciente: {patientName || 'Carregando...'}</p>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!sessionStarted ? (
        // Setup: Seleção de microfones
        <div className="setup-container">
          <DualMicrophoneControl
            onMicrophonesSelected={handleMicrophonesSelected}
            disabled={!socketConnected}
            doctorLevel={doctorMicLevel}
            patientLevel={patientMicLevel}
          />

          <div className="actions">
            <button
              onClick={handleStartSession}
              disabled={!socketConnected || !doctorMicrophoneId || !patientMicrophoneId}
              className="btn btn-primary btn-lg"
            >
              {!socketConnected ? 'Conectando...' : 'Iniciar Consulta'}
            </button>

            <button
              onClick={() => router.push('/consultas')}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        // Consulta em andamento
        <div className="consultation-container">
          <div className="consultation-controls">
            <div className="status-bar">
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className="status-value recording">
                  <Radio className="recording-icon" size={16} />
                  Gravando
                </span>
              </div>

              <div className="status-item">
                <span className="status-label">Duração:</span>
                <span className="status-value">{formatDuration(duration)}</span>
              </div>

              <div className="status-item">
                <span className="status-label">Conexão:</span>
                <span className={`status-value ${socketConnected ? 'connected' : 'disconnected'}`}>
                  {socketConnected ? (
                    <>
                      <CheckCircle className="status-icon" size={16} />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="status-icon" size={16} />
                      Desconectado
                    </>
                  )}
                </span>
              </div>

              {pendingChunks > 0 && (
                <div className="status-item">
                  <span className="status-label">Buffer:</span>
                  <span className="status-value">{pendingChunks} chunks</span>
                </div>
              )}
            </div>

            <DualMicrophoneControl
              onMicrophonesSelected={handleMicrophonesSelected}
              disabled={true}
              doctorLevel={doctorLevel}
              patientLevel={patientLevel}
            />

            <div className="finish-button">
              <button
                onClick={() => setShowConfirmEndModal(true)}
                className="btn btn-danger btn-lg"
              >
                Finalizar Consulta
              </button>
            </div>
          </div>

          <div className="transcription-panel">
            <PresencialTranscription
              transcriptions={transcriptions}
              doctorName={doctorName}
              patientName={patientName}
            />
          </div>
        </div>
      )}

      {/* Modal de confirmação para finalizar consulta */}
      <ConfirmModal
        isOpen={showConfirmEndModal}
        onClose={() => setShowConfirmEndModal(false)}
        onConfirm={handleEndSession}
        title="Finalizar Consulta"
        message="Tem certeza que deseja finalizar esta consulta? Esta ação não pode ser desfeita. A gravação será encerrada e a consulta será concluída."
        confirmText="Sim, Finalizar"
        cancelText="Cancelar"
        variant="danger"
      />

      <style jsx>{`
        .presencial-page {
          min-height: 100vh;
          background: #EBF3F6;
          padding: 8px 20px 12px 20px;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        
        .page-header {
          text-align: center;
          color: #1B4266;
          margin-bottom: 4px;
          flex-shrink: 0;
        }
        
        .page-header h1 {
          font-size: 20px;
          margin: 0 0 2px 0;
          font-weight: 700;
          color: #1B4266;
        }
        
        .page-header p {
          font-size: 13px;
          color: #5B5B5B;
          font-weight: 500;
          margin: 0;
        }
        
        .page-header h1 {
          font-size: 32px;
          margin: 0 0 8px 0;
          font-weight: 700;
          color: #1B4266;
        }
        
        .page-header p {
          font-size: 18px;
          color: #5B5B5B;
          font-weight: 500;
        }
        
        .error-banner {
          background: #fee2e2;
          color: #b91c1c;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 500;
          border-left: 4px solid #dc2626;
        }
        
        .error-card {
          background: white;
          padding: 60px 40px;
          border-radius: 16px;
          text-align: center;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        
        .error-icon {
          color: #dc2626;
        }
        
        .error-card h2 {
          margin: 0;
        }
        
        .setup-container {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .actions {
          display: flex;
          gap: 16px;
          justify-content: center;
        }
        
        .consultation-wrapper {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .consultation-container {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          align-items: start;
        }
        
        .consultation-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: fit-content;
        }
        
        .status-bar {
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid #E5E7EB;
          flex-shrink: 0;
        }
        
        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          border-bottom: 1px solid #F3F4F6;
        }
        
        .status-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .status-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }
        
        .status-value {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        
        .status-value {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .status-icon {
          flex-shrink: 0;
        }
        
        .recording-icon {
          color: #dc2626;
        }
        
        .status-value.recording {
          color: #dc2626;
        }
        
        .status-value.connected {
          color: #10b981;
        }
        
        .status-value.connected .status-icon {
          color: #10b981;
        }
        
        .status-value.disconnected {
          color: #ef4444;
        }
        
        .status-value.disconnected .status-icon {
          color: #ef4444;
        }
        
        .transcription-panel {
          min-height: 600px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .finish-button {
          margin-top: auto;
          padding-top: 12px;
        }
        
        .btn {
          padding: 14px 28px;
          border: none;
          border-radius: 9px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .btn-lg {
          padding: 12px 24px;
          font-size: 16px;
          width: 100%;
          flex-shrink: 0;
        }
        
        .btn-primary {
          background: #1B4266;
          color: white;
          box-shadow: 0 2px 4px rgba(27, 66, 102, 0.2);
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #153350;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(27, 66, 102, 0.3);
        }
        
        .btn-secondary {
          background: white;
          color: #1B4266;
          border: 2px solid #1B4266;
        }
        
        .btn-secondary:hover {
          background: #F3F4F6;
        }
        
        .btn-danger {
          background: #dc2626;
          color: white;
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }
        
        .btn-danger:hover {
          background: #b91c1c;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }
        
        @media (max-width: 1024px) {
          .consultation-container {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          
          .consultation-controls {
            order: 2;
          }
          
          .transcription-panel {
            order: 1;
            max-height: 500px;
            min-height: 400px;
          }

          .finish-button {
            margin-top: 12px;
            padding-top: 0;
          }
        }
        
        @media (max-height: 800px) {
          .transcription-panel {
            max-height: calc(100vh - 200px);
            min-height: 400px;
          }
        }
      `}</style>
    </div>
  );
}

export default function PresencialConsultationPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PresencialConsultationContent />
    </Suspense>
  );
}
