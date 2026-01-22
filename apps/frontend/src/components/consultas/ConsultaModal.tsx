'use client';

import { useState, useEffect } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { X, Calendar, Clock, User, Phone, Video, Mic, FileText, Stethoscope, Pill, Download, Play } from 'lucide-react';

interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_context?: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  duration?: number;
  recording_url?: string;
  notes?: string;
  diagnosis?: string;
  treatment?: string;
  prescription?: string;
  next_appointment?: string;
  created_at: string;
  updated_at: string;
  patients?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    birth_date?: string;
    gender?: string;
    cpf?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    medical_history?: string;
    allergies?: string;
    current_medications?: string;
  };
  transcription?: {
    id: string;
    raw_text: string;
    summary?: string;
    key_points?: string[];
    diagnosis?: string;
    treatment?: string;
    observations?: string;
    confidence?: number;
    processing_time?: number;
    language?: string;
    model_used?: string;
    created_at: string;
  };
  audioFiles?: Array<{
    id: string;
    filename: string;
    original_name?: string;
    mime_type: string;
    size: number;
    duration?: number;
    storage_path: string;
    storage_bucket: string;
    is_processed: boolean;
    processing_status: string;
    uploaded_at: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    content?: string;
    type: string;
    format: string;
    storage_path?: string;
    storage_bucket?: string;
    created_at: string;
  }>;
}

interface ConsultaModalProps {
  consulta: Consultation;
  isOpen: boolean;
  onClose: () => void;
}

export function ConsultaModal({ consulta, isOpen, onClose }: ConsultaModalProps) {
  const [loading, setLoading] = useState(false);
  const [consultaDetails, setConsultaDetails] = useState<Consultation | null>(null);

  useEffect(() => {
    if (isOpen && consulta) {
      fetchConsultaDetails();
    }
  }, [isOpen, consulta.id]);

  const fetchConsultaDetails = async () => {
    try {
      setLoading(true);
      const response = await gatewayClient.get(`/consultations/${consulta.id}`);
      
      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }
      
      const data = response;
      setConsultaDetails(data.consultation);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'RECORDING': return 'status-recording';
      case 'PROCESSING': return 'status-processing';
      case 'ERROR': return 'status-error';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'status-created';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return 'Criada';
      case 'RECORDING': return 'Gravando';
      case 'PROCESSING': return 'Processando';
      case 'COMPLETED': return 'Concluída';
      case 'ERROR': return 'Erro';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const details = consultaDetails || consulta;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Detalhes da Consulta</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="loading-icon"></div>
            <span>Carregando detalhes...</span>
          </div>
        ) : (
          <div className="modal-body">
            {/* Informações Básicas */}
            <div className="modal-section">
              <h3 className="section-title">
                <Calendar className="w-5 h-5" />
                Informações da Consulta
              </h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Paciente:</span>
                  <span className="info-value">{details.patient_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tipo:</span>
                  <span className="info-value">
                    {details.consultation_type === 'PRESENCIAL' ? (
                      <><User className="w-4 h-4 inline mr-1" /> Presencial</>
                    ) : (
                      <><Video className="w-4 h-4 inline mr-1" /> Telemedicina</>
                    )}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className={`status-badge ${getStatusColor(details.status)}`}>
                    {getStatusText(details.status)}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Data/Hora:</span>
                  <span className="info-value">{formatDate(details.created_at)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Duração:</span>
                  <span className="info-value">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {formatDuration(details.duration)}
                  </span>
                </div>
                {details.next_appointment && (
                  <div className="info-item">
                    <span className="info-label">Próxima Consulta:</span>
                    <span className="info-value">{formatDate(details.next_appointment)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contexto do Paciente */}
            {details.patient_context && (
              <div className="modal-section">
                <h3 className="section-title">
                  <User className="w-5 h-5" />
                  Contexto do Paciente
                </h3>
                <div className="section-content">
                  <p>{details.patient_context}</p>
                </div>
              </div>
            )}

            {/* Informações do Paciente */}
            {details.patients && (
              <div className="modal-section">
                <h3 className="section-title">
                  <User className="w-5 h-5" />
                  Dados do Paciente
                </h3>
                <div className="info-grid">
                  {details.patients.email && (
                    <div className="info-item">
                      <span className="info-label">Email:</span>
                      <span className="info-value">{details.patients.email}</span>
                    </div>
                  )}
                  {details.patients.phone && (
                    <div className="info-item">
                      <span className="info-label">Telefone:</span>
                      <span className="info-value">{details.patients.phone}</span>
                    </div>
                  )}
                  {details.patients.birth_date && (
                    <div className="info-item">
                      <span className="info-label">Data de Nascimento:</span>
                      <span className="info-value">{formatDate(details.patients.birth_date)}</span>
                    </div>
                  )}
                  {details.patients.gender && (
                    <div className="info-item">
                      <span className="info-label">Gênero:</span>
                      <span className="info-value">{details.patients.gender}</span>
                    </div>
                  )}
                  {details.patients.cpf && (
                    <div className="info-item">
                      <span className="info-label">CPF:</span>
                      <span className="info-value">{details.patients.cpf}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transcrição */}
            {details.transcription && (
              <div className="modal-section">
                <h3 className="section-title">
                  <FileText className="w-5 h-5" />
                  Transcrição
                </h3>
                <div className="section-content">
                  {details.transcription.summary && (
                    <div className="transcription-summary">
                      <h4>Resumo:</h4>
                      <p>{details.transcription.summary}</p>
                    </div>
                  )}
                  
                  {details.transcription.key_points && details.transcription.key_points.length > 0 && (
                    <div className="key-points">
                      <h4>Pontos Principais:</h4>
                      <ul>
                        {details.transcription.key_points.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {details.transcription.raw_text && (
                    <div className="raw-transcription">
                      <h4>Transcrição Completa:</h4>
                      <p>{details.transcription.raw_text}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Diagnóstico e Tratamento */}
            {(details.diagnosis || details.treatment || details.prescription) && (
              <div className="modal-section">
                <h3 className="section-title">
                  <Stethoscope className="w-5 h-5" />
                  Diagnóstico e Tratamento
                </h3>
                <div className="section-content">
                  {details.diagnosis && (
                    <div className="medical-info">
                      <h4>Diagnóstico:</h4>
                      <p>{details.diagnosis}</p>
                    </div>
                  )}
                  
                  {details.treatment && (
                    <div className="medical-info">
                      <h4>Tratamento:</h4>
                      <p>{details.treatment}</p>
                    </div>
                  )}
                  
                  {details.prescription && (
                    <div className="medical-info">
                      <h4>Prescrição:</h4>
                      <p>{details.prescription}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notas */}
            {details.notes && (
              <div className="modal-section">
                <h3 className="section-title">
                  <FileText className="w-5 h-5" />
                  Notas
                </h3>
                <div className="section-content">
                  <p>{details.notes}</p>
                </div>
              </div>
            )}

            {/* Arquivos de Áudio */}
            {details.audioFiles && details.audioFiles.length > 0 && (
              <div className="modal-section">
                <h3 className="section-title">
                  <Mic className="w-5 h-5" />
                  Arquivos de Áudio
                </h3>
                <div className="audio-files">
                  {details.audioFiles.map((file) => (
                    <div key={file.id} className="audio-file">
                      <div className="file-info">
                        <span className="file-name">{file.original_name || file.filename}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                        {file.duration && (
                          <span className="file-duration">{formatDuration(file.duration)}</span>
                        )}
                      </div>
                      <div className="file-actions">
                        <button className="action-button" title="Reproduzir">
                          <Play className="w-4 h-4" />
                        </button>
                        <button className="action-button" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documentos */}
            {details.documents && details.documents.length > 0 && (
              <div className="modal-section">
                <h3 className="section-title">
                  <FileText className="w-5 h-5" />
                  Documentos
                </h3>
                <div className="documents">
                  {details.documents.map((doc) => (
                    <div key={doc.id} className="document">
                      <div className="document-info">
                        <span className="document-title">{doc.title}</span>
                        <span className="document-type">{doc.type}</span>
                      </div>
                      <div className="document-actions">
                        <button className="action-button" title="Visualizar">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button className="action-button" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
