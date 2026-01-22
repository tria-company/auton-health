'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Mic, Play, Settings, AlertCircle, User, CheckCircle, Volume2 } from 'lucide-react';
import { useMediaDevices } from '@/hooks/useMediaDevices';

function SetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  
  // Dados da consulta vindos da URL
  const consultationId = searchParams.get('consultationId');
  const patientId = searchParams.get('patientId');
  const initialPatientName = searchParams.get('patientName');

  const {
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    previewState,
    previewVideoRef,
    loadDevices,
    selectCamera,
    selectMicrophone,
    startPreview,
    stopPreview,
    getSelectedDevices
  } = useMediaDevices();

  useEffect(() => {
    if (initialPatientName) {
      setPatientName(decodeURIComponent(initialPatientName));
    }
  }, [initialPatientName]);

  // Verificar parâmetros obrigatórios
  useEffect(() => {
    if (!consultationId || !patientId) {
      setError('Parâmetros da consulta não encontrados');
      return;
    }
  }, [consultationId, patientId]);

  // Carregar dispositivos automaticamente
  useEffect(() => {
    loadDevices().catch((err) => {
      setError('Erro ao carregar dispositivos de mídia. Verifique as permissões.');
      console.error('Erro ao carregar dispositivos:', err);
    });
  }, [loadDevices]);

  // Iniciar preview automaticamente quando dispositivos estiverem selecionados
  useEffect(() => {
    if (selectedCamera && selectedMicrophone && !previewState.isPreviewActive) {
      startPreview().catch((err) => {
        console.error('Erro ao iniciar preview:', err);
      });
    }
  }, [selectedCamera, selectedMicrophone, previewState.isPreviewActive, startPreview]);

  const handleStartConsultation = async () => {
    if (!consultationId || !patientId || !selectedCamera || !selectedMicrophone) {
      setError('Selecione uma câmera e microfone antes de continuar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parar preview antes de criar a sessão
      stopPreview();

      // Criar sessão online no backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001'}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultation_id: consultationId,
          session_type: 'online',
          participants: {
            doctor: {
              id: 'doctor-current', // TODO: Pegar do contexto de auth
              name: 'Dr. Médico', // TODO: Pegar do contexto de auth
            },
            patient: {
              id: patientId,
              name: patientName,
            }
          },
          consent: true,
          metadata: {
            appointmentType: 'online',
            selectedDevices: getSelectedDevices()
          }
        }),
      });

      if (!response.success) {
        throw new Error('Falha ao criar sessão online');
      }

      const session = await response.json();
      console.log('Sessão online criada:', session);

      // Redirecionar para a página do médico com os dados da sessão
      const doctorParams = new URLSearchParams({
        sessionId: session.session.id,
        consultationId: consultationId,
        roomName: session.session.roomName,
        token: session.tokens.doctor, // Token do médico como 'token'
        patientToken: session.tokens.patient || '',
        livekitUrl: session.livekit?.url || process.env.NEXT_PUBLIC_LIVEKIT_URL || '',
        patientName: patientName,
        cameraId: selectedCamera,
        microphoneId: selectedMicrophone
      });

      router.push(`/consulta/online/doctor?${doctorParams.toString()}`);

    } catch (error) {
      console.error('Erro ao criar sessão online:', error);
      setError('Erro ao criar sessão online. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="error-page">
        <div className="page-content">
          <div className="page-header">
            <h1 className="page-title">Erro na Configuração</h1>
            <p className="page-subtitle">{error}</p>
          </div>
          <div className="form-card">
            <div className="form-actions">
              <button 
                onClick={() => router.push('/consulta/nova')}
                className="btn btn-primary"
              >
                Voltar para Nova Consulta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-page">
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Configurar Consulta Online</h1>
          <p className="page-subtitle">
            Configure sua câmera e microfone antes de iniciar a consulta com {patientName}
          </p>
        </div>

        <div className="setup-layout">
          {/* Preview da Câmera */}
          <div className="preview-section">
            <div className="form-card">
              <h3 className="form-section-title">
                <Camera className="form-section-icon" />
                Preview da Câmera
              </h3>
              
              <div className="video-preview">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="preview-video"
                />
                {!previewState.isPreviewActive && (
                  <div className="video-placeholder">
                    <Camera size={48} />
                    <p>Aguardando câmera...</p>
                  </div>
                )}
              </div>

              {/* Indicador de Áudio */}
              <div className="audio-indicator">
                <Volume2 size={16} />
                <div className="audio-level-bar">
                  <div 
                    className="audio-level-fill"
                    style={{ width: `${previewState.audioLevel}%` }}
                  />
                </div>
                <span className="audio-level-text">
                  {Math.round(previewState.audioLevel)}%
                </span>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="settings-section">
            {/* Seleção de Câmera */}
            <div className="form-card">
              <h3 className="form-section-title">
                <Camera className="form-section-icon" />
                Câmera
              </h3>
              
              <div className="device-selection">
                {cameras.length === 0 ? (
                  <div className="no-devices">
                    <AlertCircle size={20} />
                    <span>Nenhuma câmera encontrada</span>
                  </div>
                ) : (
                  <select 
                    value={selectedCamera || ''} 
                    onChange={(e) => selectCamera(e.target.value)}
                    className="device-select"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Seleção de Microfone */}
            <div className="form-card">
              <h3 className="form-section-title">
                <Mic className="form-section-icon" />
                Microfone
              </h3>
              
              <div className="device-selection">
                {microphones.length === 0 ? (
                  <div className="no-devices">
                    <AlertCircle size={20} />
                    <span>Nenhum microfone encontrado</span>
                  </div>
                ) : (
                  <select 
                    value={selectedMicrophone || ''} 
                    onChange={(e) => selectMicrophone(e.target.value)}
                    className="device-select"
                  >
                    {microphones.map((microphone) => (
                      <option key={microphone.deviceId} value={microphone.deviceId}>
                        {microphone.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Informações da Consulta */}
            <div className="form-card">
              <h3 className="form-section-title">
                <User className="form-section-icon" />
                Informações da Consulta
              </h3>
              
              <div className="consultation-info">
                <div className="info-item">
                  <span className="info-label">Paciente:</span>
                  <span className="info-value">{patientName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tipo:</span>
                  <span className="info-value">Consulta Online</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value status-ready">
                    <CheckCircle size={16} />
                    Pronto para iniciar
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Iniciar */}
            <div className="form-actions">
              <button
                onClick={handleStartConsultation}
                disabled={isLoading || !selectedCamera || !selectedMicrophone}
                className="btn btn-primary btn-large"
              >
                {isLoading ? (
                  <>
                    <div className="loading-icon" />
                    Criando Sessão...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Iniciar Consulta Online
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnlineSetupPage() {
  return (
    <Suspense fallback={<div />}> 
      <SetupInner />
    </Suspense>
  );
}
