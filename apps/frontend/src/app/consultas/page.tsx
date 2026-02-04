'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MoreVertical, Calendar, Video, User, AlertCircle, ArrowLeft,
  Clock, Phone, FileText, Stethoscope, Mic, Download, Play,
  Save, X, Sparkles, Edit, Plus, Trash2, Pencil, ArrowRight, Search,
  Dna, Brain, Apple, Pill, Dumbbell, Leaf, LogIn, Scale, Ruler, Droplet, FolderOpen, AlertTriangle, FileDown
} from 'lucide-react';
import Image from 'next/image';
import { StatusBadge, mapBackendStatus } from '../../components/StatusBadge';
import ExamesUploadSection from '../../components/ExamesUploadSection';
import SolutionsViewer from '../../components/solutions/SolutionsViewer';
import { getWebhookEndpoints, getWebhookHeaders } from '@/lib/webhook-config';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import { downloadSolutionsDocx } from '@/lib/solutionsToDocx';
import { fetchSolutionsFromGateway } from '@/lib/fetchSolutions';
import './consultas.css';
import '../../components/solutions/solutions.css';

// Tipos para exercícios físicos
interface ExercicioFisico {
  id: number;
  consulta_id: string;
  paciente_id: string;
  user_id?: string;
  thread_id?: string;
  tipo_treino?: string;
  grupo_muscular?: string;
  nome_exercicio?: string;
  series?: string;
  repeticoes?: string;
  descanso?: string;
  observacoes?: string;
  treino_atual?: number;
  proximo_treino?: number;
  ultimo_treino?: boolean;
  alertas_importantes?: string;
  nome_treino?: string;
  created_at?: string;
}

// Tipos para consultas da API
interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_context?: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'ERROR' | 'CANCELLED' | 'COMPLETED' | 'AGENDAMENTO';
  etapa?: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO';
  solucao_etapa?: 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA';
  duration?: number;
  recording_url?: string;
  notes?: string;
  diagnosis?: string;
  treatment?: string;
  patients?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    profile_pic?: string;
  };
  prescription?: string;
  next_appointment?: string;
  consulta_inicio?: string;
  consulta_fim?: string;
  created_at: string;
  updated_at: string;
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

interface ConsultationsResponse {
  consultations: Consultation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Tipos para dados de anamnese
interface AnamneseData {
  cadastro_prontuario: any;
  objetivos_queixas: any;
  historico_risco: any;
  observacao_clinica_lab: any;
  historia_vida: any;
  setenios_eventos: any;
  ambiente_contexto: any;
  sensacao_emocoes: any;
  preocupacoes_crencas: any;
  reino_miasma: any;
}

// Função para buscar consultas da API
async function fetchConsultations(
  page: number = 1,
  limit: number = 20,
  search: string = '',
  status: string = 'all',
  dateFilter?: { type: 'day' | 'week' | 'month', date: string }
): Promise<ConsultationsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  if (dateFilter) {
    params.append('dateFilter', dateFilter.type);
    params.append('date', dateFilter.date);
  }

  const queryParams: Record<string, string | number | boolean> = {};
  params.forEach((value, key) => {
    queryParams[key] = value;
  });

  const response = await gatewayClient.get<ConsultationsResponse>('/consultations', { queryParams });

  if (!response.success) {
    throw new Error(response.error || 'Erro ao buscar consultas');
  }

  return response;
}

// Função para buscar uma consulta específica
async function fetchConsultationById(id: string): Promise<any> {
  const response = await gatewayClient.get<any>(`/consultations/${id}`);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao buscar consulta');
  }

  return response;
}

// Função para atualizar uma consulta
async function updateConsultationData(id: string, data: any): Promise<any> {
  const response = await gatewayClient.patch<any>(`/consultations/${id}`, data);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao atualizar consulta');
  }

  return response;
}

// Função para deletar uma consulta
async function deleteConsultationData(id: string): Promise<any> {
  const response = await gatewayClient.delete<any>(`/consultations/${id}`);

  if (!response.success) {
    throw new Error(response.error || 'Erro ao deletar consulta');
  }

  return response;
}

// Componente de Seção Colapsável
function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Atualizar estado quando defaultOpen mudar (para suportar activeTab)
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="collapsible-section">
      <button
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="collapsible-title">{title}</span>
        <ArrowLeft
          className={`collapsible-icon ${isOpen ? 'open' : ''}`}
          style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(180deg)' }}
        />
      </button>
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

// Componente para renderizar campo de dados (agora editável)
function DataField({
  label,
  value,
  fieldPath,
  consultaId,
  onSave,
  onAIEdit,
  readOnly = false,
  hideActions = false
}: {
  label: string;
  value: any;
  fieldPath?: string;
  consultaId?: string;
  onSave?: (fieldPath: string, newValue: string, consultaId: string) => Promise<void>;
  onAIEdit?: (fieldPath: string, label: string) => void;
  readOnly?: boolean;
  /** Oculta botões Editar com IA e Editar manualmente (ex.: aba Síntese) */
  hideActions?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    if (!fieldPath || !consultaId || !onSave) return;
    setEditValue(String(value || ''));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!fieldPath || !consultaId || !onSave) return;

    if (editValue === String(value || '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fieldPath, editValue, consultaId);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      // Aqui você pode adicionar uma notificação de erro
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const renderValue = () => {
    // Função auxiliar para verificar se o valor é vazio/null
    const isEmptyValue = (val: any): boolean => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && (val.trim() === '' || val.toLowerCase() === 'null')) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    };

    // Se não houver valor ou for "null" como string: CSS .data-value-empty::before exibe "Não informado"
    if (isEmptyValue(value)) {
      return <p className="data-value data-value-empty"></p>;
    }

    // Se for array, renderizar lista
    if (Array.isArray(value)) {
      return (
        <ul className="data-list">
          {value.map((item, index) => {
            // Verificar se cada item do array também não é null
            const displayItem = isEmptyValue(item) ? 'Não informado' : String(item);
            return <li key={index}>{displayItem}</li>;
          })}
        </ul>
      );
    }

    // Converter para string e verificar se é "null"
    const stringValue = String(value);
    const displayValue = (stringValue.toLowerCase() === 'null' || stringValue.trim() === '')
      ? 'Não informado'
      : stringValue;

    // Se o texto contém quebras de linha, renderizar preservando as quebras
    if (displayValue.includes('\n')) {
      return (
        <div className="data-value">
          {displayValue.split('\n').map((line, idx) => (
            <div key={idx} style={{ marginBottom: idx < displayValue.split('\n').length - 1 ? '8px' : '0' }}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      );
    }

    // Renderizar valor normal
    return <p className="data-value">{displayValue}</p>;
  };

  return (
    <>
      <div className="data-field">
        <div className="data-field-header">
          <label className="data-label">{label}:</label>
          {!readOnly && !hideActions && (
            <div className="field-actions">
              {fieldPath && consultaId && onAIEdit && (
                <button
                  className="ai-button"
                  onClick={() => onAIEdit(fieldPath, label)}
                  title="Editar com IA"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
              {fieldPath && consultaId && onSave && (
                <button
                  className="edit-button"
                  onClick={handleEdit}
                  title="Editar campo manualmente"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        {renderValue()}
      </div>

      {isEditing && (
        <div className="edit-modal-overlay" onClick={handleCancel}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3 className="edit-modal-title">Editar: {label}</h3>
              <button
                className="edit-modal-close"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="edit-modal-body">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="edit-modal-input"
                placeholder="Digite o novo valor..."
                autoFocus
              />
            </div>
            <div className="edit-modal-actions">
              <button
                className="cancel-button"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                className="save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <div className="loading-spinner-small"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Componente para renderizar campo do cadastro de anamnese (a_cadastro_anamnese)
function CadastroDataField({
  label,
  value,
  fieldName,
  onSave,
  readOnly = false
}: {
  label: string;
  value: any;
  fieldName: string;
  onSave: (fieldName: string, newValue: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setEditValue(String(value || ''));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue === String(value || '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fieldName, editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar campo do cadastro:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const renderValue = () => {
    const isEmpty = !value || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      return <p className="data-value data-value-empty"></p>;
    }

    if (Array.isArray(value)) {
      return (
        <ul className="data-list">
          {value.map((item, index) => (
            <li key={index}>{typeof item === 'object' ? JSON.stringify(item) : item}</li>
          ))}
        </ul>
      );
    }

    return <p className="data-value">{String(value)}</p>;
  };

  return (
    <div className="data-field">
      <div className="data-field-header">
        <label className="data-label">{label}:</label>
        {!readOnly && !isEditing && (
          <button
            className="edit-button-small"
            onClick={handleEdit}
            title="Editar campo"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="edit-field">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="edit-input"
            rows={3}
            placeholder="Digite o novo valor..."
          />
          <div className="edit-actions">
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <div className="loading-spinner-small"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              className="cancel-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        renderValue()
      )}
    </div>
  );
}

// Tipos para mensagens do chat
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Componente da seção de Anamnese
function AnamneseSection({
  consultaId,
  patientId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange,
  readOnly = false,
  consultaStatus,
  consultaEtapa,
  renderViewSolutionsButton,
  activeTab
}: {
  consultaId: string;
  patientId?: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
  readOnly?: boolean;
  consultaStatus?: string;
  consultaEtapa?: string;
  renderViewSolutionsButton?: () => JSX.Element;
  activeTab?: string;
}) {
  console.log('🔍 [AnamneseSection] Componente renderizado com consultaId:', consultaId, 'patientId:', patientId);

  const [anamneseData, setAnamneseData] = useState<AnamneseData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  //console.log('🔍 AnamneseSection readOnly:', readOnly);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sinteseAnalitica, setSinteseAnalitica] = useState<any>(null);
  const [loadingSintese, setLoadingSintese] = useState(false);
  const [cadastroAnamnese, setCadastroAnamnese] = useState<any>(null);
  const [loadingCadastro, setLoadingCadastro] = useState(false);

  // Função para selecionar campo para edição com IA
  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  // Função para salvar campo editado
  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // 1. Atualizar no Gateway
      const response = await gatewayClient.post(`/anamnese/${consultaId}/update-field`, {
        [fieldPath]: newValue,
      });

      if (!response.success) {
        throw new Error(response.error || "Erro na requisição");
      }

      const result = response;

      // Obter dados da resposta da API
      console.log('📦 Dados retornados pela API:', result);

      // 2. Fazer requisição para o webhook
      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();

      const webhookResponse = await fetch(webhookEndpoints.edicaoAnamnese, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({
          fieldPath,
          value: newValue,
          consultaId,
          origem: 'manual',
        }),
      });

      if (!webhookResponse.ok) {
        console.warn('Webhook falhou, mas campo foi salvo no Gateway');
      }

      // 3. Atualizar o estado local usando os dados da API
      if (result.success && result.data) {
        console.log('🔄 Atualizando interface com dados da API:', result.data);

        // Determinar qual seção da anamnese atualizar baseado no fieldPath
        const pathParts = fieldPath.split('.');
        const tableName = pathParts[0];

        // Mapear nome da tabela para a chave do estado
        const stateKeyMap: { [key: string]: string } = {
          'a_cadastro_prontuario': 'cadastro_prontuario',
          'a_objetivos_queixas': 'objetivos_queixas',
          'a_historico_risco': 'historico_risco',
          'a_observacao_clinica_lab_2': 'observacao_clinica_lab',
          'a_historia_vida': 'historia_vida',
          'a_setenios_eventos': 'setenios_eventos',
          'a_ambiente_contexto': 'ambiente_contexto',
          'a_sensacao_emocoes': 'sensacao_emocoes',
          'a_preocupacoes_crencas': 'preocupacoes_crencas',
          'a_reino_miasma': 'reino_miasma',
        };

        const stateKey = stateKeyMap[tableName];
        if (stateKey && anamneseData) {
          // Atualizar a seção específica com os dados completos da API
          setAnamneseData(prev => ({
            ...prev!,
            [stateKey]: result.data
          }));
          console.log('✅ Interface atualizada com dados da API');
        } else if (tableName === 'a_sintese_analitica') {
          // Se for síntese analítica, atualizar o estado específico
          fetchSinteseAnalitica();
          console.log('✅ Síntese analítica atualizada');
        } else {
          console.warn('⚠️ Não foi possível mapear a tabela para o estado:', tableName);
        }
      } else {
        console.warn('⚠️ Resposta da API não contém dados válidos:', result);
      }

    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const fetchAnamneseData = async () => {
    try {
      if (!consultaId) {
        console.warn('⚠️ consultaId é null, não carregando anamnese');
        return;
      }

      setLoadingDetails(true);
      setError(null);

      // Buscar dados de todas as tabelas de anamnese
      console.log('🔍 Buscando anamnese para consulta_id:', consultaId);
      const response = await gatewayClient.get<AnamneseData>(`/anamnese/${consultaId}`);

      console.log('📡 Status da resposta:', response.status);

      if (!response.success) {
        console.error('❌ Erro da API:', response.error);
        throw new Error(response.error || 'Erro ao carregar dados da anamnese');
      }

      const data = response;
      console.log('✅ Dados da anamnese recebidos:', data);
      console.log('🔍 Estrutura dos dados:', {
        type: typeof data,
        keys: Object.keys(data || {}),
        hasData: !!data
      });
      setAnamneseData(data);
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
    } catch (err) {
      console.error('❌ Erro ao carregar anamnese:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar anamnese');
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading em caso de erro
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchSinteseAnalitica = async () => {
    try {
      if (!consultaId) {
        console.warn('⚠️ consultaId é null, não carregando síntese analítica');
        setSinteseAnalitica(null);
        return;
      }

      setLoadingSintese(true);
      console.log('🔍 Carregando síntese analítica para consultaId:', consultaId);

      const response = await gatewayClient.get<any>(`/sintese-analitica/${consultaId}`);

      if (!response.success) {
        // Se não encontrar, retornar null (não é erro)
        if (response.status === 404) {
          console.log('ℹ️ Síntese analítica não encontrada (404)');
          setSinteseAnalitica(null);
          return;
        }
        throw new Error(response.error || 'Erro ao carregar síntese analítica');
      }

      const sintese = response.data || response;
      console.log('✅ Síntese analítica carregada:', sintese);
      setSinteseAnalitica(sintese);
    } catch (err) {
      console.error('❌ Erro ao carregar síntese analítica:', err);
      setSinteseAnalitica(null);
    } finally {
      setLoadingSintese(false);
    }
  };

  useEffect(() => {
    console.log('🔍 [AnamneseSection] useEffect disparado - consultaId:', consultaId);
    if (consultaId) {
      console.log('✅ [AnamneseSection] consultaId válido, chamando fetch...');
      fetchAnamneseData();
      fetchSinteseAnalitica();
    } else {
      console.warn('⚠️ [AnamneseSection] consultaId é null/undefined, não carregando dados');
    }
  }, [consultaId]);

  // Buscar dados do cadastro de anamnese quando tiver patientId
  useEffect(() => {
    if (patientId) {
      fetchCadastroAnamnese();
    }
  }, [patientId]);

  // Listener para recarregar dados de anamnese e síntese analítica quando a IA processar (edição na Análise)
  useEffect(() => {
    const handleAnamneseRefresh = () => {
      fetchAnamneseData();
      fetchSinteseAnalitica(); // Atualiza também a Síntese Analítica após edição com IA na tela de Análise
    };

    window.addEventListener('force-anamnese-refresh', handleAnamneseRefresh);

    return () => {
      window.removeEventListener('force-anamnese-refresh', handleAnamneseRefresh);
    };
  }, []);

  // Função para buscar dados do cadastro de anamnese (a_cadastro_anamnese)
  const fetchCadastroAnamnese = async () => {
    if (!patientId) return;

    try {
      setLoadingCadastro(true);
      console.log('🔍 Buscando cadastro anamnese para paciente_id:', patientId);

      const response = await gatewayClient.get<any>(`/cadastro-anamnese/${patientId}`);

      if (!response.success) {
        if (response.status === 404) {
          setCadastroAnamnese(null);
          return;
        }
        throw new Error('Erro ao buscar cadastro de anamnese');
      }

      const data = response.cadastro || response.data?.cadastro || response;  // Extrair cadastro
      console.log('✅ Dados do cadastro anamnese recebidos:', data);
      setCadastroAnamnese(data);
    } catch (err) {
      console.error('❌ Erro ao carregar cadastro anamnese:', err);
      setCadastroAnamnese(null);
    } finally {
      setLoadingCadastro(false);
    }
  };

  // Função para salvar campo do cadastro de anamnese
  const handleSaveCadastroField = async (fieldName: string, newValue: string) => {
    if (!patientId) return;

    try {
      const response = await gatewayClient.post(`/cadastro-anamnese/${patientId}`, {
        [fieldName]: newValue,
      });

      if (!response.success) {
        throw new Error(response.error || "Erro na requisição");
      }

      const result = response;
      console.log('✅ Campo do cadastro atualizado:', result);

      // Atualizar estado local
      if (result.success && result.cadastro) {
        setCadastroAnamnese(result.cadastro);
      }
    } catch (error) {
      console.error('Erro ao salvar campo do cadastro:', error);
      throw error;
    }
  };

  // Extrair dados (podem ser null) - sempre renderizar campos mesmo com erro
  const {
    cadastro_prontuario,
    objetivos_queixas,
    historico_risco,
    observacao_clinica_lab,
    historia_vida,
    setenios_eventos,
    ambiente_contexto,
    sensacao_emocoes,
    preocupacoes_crencas,
    reino_miasma
  } = anamneseData || {};

  // Mapear activeTab para o título da seção
  const getSectionTitle = (tab: string) => {
    const map: { [key: string]: string } = {
      'Síntese': 'Síntese',
      'Dados do Paciente': 'Dados do Paciente',
      'Objetivos e Queixas': 'Objetivos e Queixas',
      'Histórico de Risco': 'Histórico de Risco',
      'Observação Clínica e Laboratorial': 'Observação Clínica e Laboratorial',
      'História de vida': 'História de Vida',
      'Setênios e Eventos': 'Setênios e Eventos',
      'Ambiente e Contexto': 'Ambiente e Contexto',
      'Sensação e Emoções': 'Sensação e Emoções',
      'Preocupações e Crenças': 'Preocupações e Crenças',
      'Reino e Miasma': 'Reino e Miasma'
    };
    return map[tab] || tab;
  };

  const shouldShowSection = (sectionTitle: string): boolean => {
    if (!activeTab) {
      return true; // Se não há tab ativa, mostrar todas
    }
    const mappedTitle = getSectionTitle(activeTab);
    const shouldShow = mappedTitle === sectionTitle;
    return shouldShow;
  };

  // Mostrar loading apenas no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando anamnese...</p>
      </div>
    );
  }

  console.log('🔍 AnamneseSection - Renderizando com dados:', {
    loading,
    error,
    hasAnamneseData: !!anamneseData,
    anamneseDataKeys: anamneseData ? Object.keys(anamneseData) : []
  });

  return (
    <div className="anamnese-sections">
      {/* Alerta de erro discreto - não bloqueia a visualização */}
      {error && (
        <div className="anamnese-warning-banner">
          <AlertCircle className="w-5 h-5" />
          <div>
            <strong>Atenção:</strong> {error}. Os campos estão sendo exibidos vazios.
          </div>
        </div>
      )}

      {/* Síntese Analítica - Agora dentro do menu */}
      {shouldShowSection('Síntese') && sinteseAnalitica && (
        <CollapsibleSection title="Síntese Analítica" defaultOpen={activeTab === 'Síntese' || !activeTab}>
          <div className="anamnese-subsection">
            <DataField
              label="Síntese"
              value={sinteseAnalitica.sintese}
              fieldPath="a_sintese_analitica.sintese"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Três Linhas"
              value={sinteseAnalitica.tres_linhas}
              fieldPath="a_sintese_analitica.tres_linhas"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Eixo Causal Principal"
              value={sinteseAnalitica.eixo_causal_principal}
              fieldPath="a_sintese_analitica.eixo_causal_principal"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Perpetuadores"
              value={sinteseAnalitica.perpetuadores}
              fieldPath="a_sintese_analitica.perpetuadores"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Achados Críticos Urgentes"
              value={sinteseAnalitica.achados_criticos_urgentes}
              fieldPath="a_sintese_analitica.achados_criticos_urgentes"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Achados Críticos Importantes"
              value={sinteseAnalitica.achados_criticos_importantes}
              fieldPath="a_sintese_analitica.achados_criticos_importantes"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Psicoemocional"
              value={sinteseAnalitica.psicoemocional}
              fieldPath="a_sintese_analitica.psicoemocional"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Intervenção Imediata"
              value={sinteseAnalitica.intervencao_imediata}
              fieldPath="a_sintese_analitica.intervencao_imediata"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Próximas Etapas"
              value={sinteseAnalitica.proximas_etapas}
              fieldPath="a_sintese_analitica.proximas_etapas"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Exames Faltantes"
              value={sinteseAnalitica.exames_faltantes}
              fieldPath="a_sintese_analitica.exames_faltantes"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Encaminhar"
              value={sinteseAnalitica.encaminhar}
              fieldPath="a_sintese_analitica.encaminhar"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Pontos de Atenção"
              value={sinteseAnalitica.pontos_atencao}
              fieldPath="a_sintese_analitica.pontos_atencao"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <DataField
              label="Prognóstico"
              value={sinteseAnalitica.prognostico}
              fieldPath="a_sintese_analitica.prognostico"
              consultaId={consultaId}
              onSave={handleSaveField}
              onAIEdit={handleAIEdit}
              readOnly={readOnly}
              hideActions={true}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              {sinteseAnalitica.complexidade && (
                <div>
                  <h4 style={{ color: '#64748b', marginBottom: '4px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Complexidade</h4>
                  <p style={{ color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>{sinteseAnalitica.complexidade}</p>
                </div>
              )}
              {sinteseAnalitica.urgencia && (
                <div>
                  <h4 style={{ color: '#64748b', marginBottom: '4px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Urgência</h4>
                  <p style={{ color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>{sinteseAnalitica.urgencia}</p>
                </div>
              )}
              {sinteseAnalitica.prontidao_mudanca && (
                <div>
                  <h4 style={{ color: '#64748b', marginBottom: '4px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Prontidão para Mudança</h4>
                  <p style={{ color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>{sinteseAnalitica.prontidao_mudanca}</p>
                </div>
              )}
              {sinteseAnalitica.confiabilidade && (
                <div>
                  <h4 style={{ color: '#64748b', marginBottom: '4px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Confiabilidade</h4>
                  <p style={{ color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>{sinteseAnalitica.confiabilidade}</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Dados do Paciente - Cadastro Anamnese */}
      {shouldShowSection('Dados do Paciente') && (
        <CollapsibleSection title="Dados do Paciente" defaultOpen={true}>
          {loadingCadastro ? (
            <div className="anamnese-loading" style={{ padding: '20px', textAlign: 'center' }}>
              <div className="loading-spinner"></div>
              <p>Carregando dados do paciente...</p>
            </div>
          ) : cadastroAnamnese ? (
            <>
              <div className="anamnese-subsection">
                <h4>Identificação</h4>
                <CadastroDataField label="Nome Completo" value={cadastroAnamnese?.nome_completo} fieldName="nome_completo" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Data de Nascimento" value={cadastroAnamnese?.data_nascimento} fieldName="data_nascimento" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="CPF" value={cadastroAnamnese?.cpf} fieldName="cpf" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Estado Civil" value={cadastroAnamnese?.estado_civil} fieldName="estado_civil" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Email" value={cadastroAnamnese?.email} fieldName="email" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Profissão" value={cadastroAnamnese?.profissao} fieldName="profissao" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Gênero" value={cadastroAnamnese?.genero} fieldName="genero" onSave={handleSaveCadastroField} readOnly={readOnly} />
              </div>

              <div className="anamnese-subsection">
                <h4>Dados Físicos</h4>
                <CadastroDataField label="Altura" value={cadastroAnamnese?.altura} fieldName="altura" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Peso Atual" value={cadastroAnamnese?.peso_atual} fieldName="peso_atual" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Peso Antigo" value={cadastroAnamnese?.peso_antigo} fieldName="peso_antigo" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Peso Desejado" value={cadastroAnamnese?.peso_desejado} fieldName="peso_desejado" onSave={handleSaveCadastroField} readOnly={readOnly} />
              </div>

              <div className="anamnese-subsection">
                <h4>Objetivos e Atividade Física</h4>
                <CadastroDataField label="Objetivo Principal" value={cadastroAnamnese?.objetivo_principal} fieldName="objetivo_principal" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Pratica Atividade Física" value={cadastroAnamnese?.patrica_atividade_fisica} fieldName="patrica_atividade_fisica" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Frequência que Deseja Treinar" value={cadastroAnamnese?.frequencia_deseja_treinar} fieldName="frequencia_deseja_treinar" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Restrição de Movimento" value={cadastroAnamnese?.restricao_movimento} fieldName="restricao_movimento" onSave={handleSaveCadastroField} readOnly={readOnly} />
              </div>

              <div className="anamnese-subsection">
                <h4>Informações Adicionais</h4>
                <CadastroDataField label="Informações Importantes" value={cadastroAnamnese?.informacoes_importantes} fieldName="informacoes_importantes" onSave={handleSaveCadastroField} readOnly={readOnly} />
                <CadastroDataField label="Necessidade Energética Diária" value={cadastroAnamnese?.NecessidadeEnergeticaDiaria} fieldName="NecessidadeEnergeticaDiaria" onSave={handleSaveCadastroField} readOnly={readOnly} />
              </div>
            </>
          ) : (
            <div className="anamnese-subsection" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              <p>Nenhum dado de cadastro de anamnese encontrado para este paciente.</p>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Objetivos e Queixas */}
      {shouldShowSection('Objetivos e Queixas') && (
        <CollapsibleSection title="Objetivos e Queixas" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Saúde Geral Percebida</h4>
            <DataField label="Como Descreve a Saúde" value={objetivos_queixas?.saude_geral_percebida_como_descreve_saude} fieldPath="a_objetivos_queixas.saude_geral_percebida_como_descreve_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Define Bem-Estar" value={objetivos_queixas?.saude_geral_percebida_como_define_bem_estar} fieldPath="a_objetivos_queixas.saude_geral_percebida_como_define_bem_estar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avaliação da Saúde Emocional/Mental" value={objetivos_queixas?.saude_geral_percebida_avaliacao_saude_emocional_mental} fieldPath="a_objetivos_queixas.saude_geral_percebida_avaliacao_saude_emocional_mental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Queixas</h4>
            <DataField label="Queixa Principal" value={objetivos_queixas?.queixa_principal} fieldPath="a_objetivos_queixas.queixa_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sub-queixas" value={objetivos_queixas?.sub_queixas} fieldPath="a_objetivos_queixas.sub_queixas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Impacto das Queixas na Vida</h4>
            <DataField label="Como Afeta a Vida Diária" value={objetivos_queixas?.impacto_queixas_vida_como_afeta_vida_diaria} fieldPath="a_objetivos_queixas.impacto_queixas_vida_como_afeta_vida_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Limitações Causadas" value={objetivos_queixas?.impacto_queixas_vida_limitacoes_causadas} fieldPath="a_objetivos_queixas.impacto_queixas_vida_limitacoes_causadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Áreas Impactadas" value={objetivos_queixas?.impacto_queixas_vida_areas_impactadas} fieldPath="a_objetivos_queixas.impacto_queixas_vida_areas_impactadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Objetivos e Expectativas</h4>
            <DataField label="Problemas Deseja Resolver" value={objetivos_queixas?.problemas_deseja_resolver} fieldPath="a_objetivos_queixas.problemas_deseja_resolver" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativa Específica" value={objetivos_queixas?.expectativas_tratamento_expectativa_especifica} fieldPath="a_objetivos_queixas.expectativas_tratamento_expectativa_especifica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Buscou Tratamentos Similares" value={objetivos_queixas?.expectativas_tratamento_ja_buscou_tratamentos_similares} fieldPath="a_objetivos_queixas.expectativas_tratamento_ja_buscou_tratamentos_similares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tratamentos Anteriores" value={objetivos_queixas?.expectativas_tratamento_quais_tratamentos_anteriores} fieldPath="a_objetivos_queixas.expectativas_tratamento_quais_tratamentos_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Compreensão sobre a Causa</h4>
            <DataField label="Compreensão do Paciente" value={objetivos_queixas?.compreensao_sobre_causa_compreensao_paciente} fieldPath="a_objetivos_queixas.compreensao_sobre_causa_compreensao_paciente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos Influenciando" value={objetivos_queixas?.compreensao_sobre_causa_fatores_externos_influenciando} fieldPath="a_objetivos_queixas.compreensao_sobre_causa_fatores_externos_influenciando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Projeto de Vida</h4>
            <DataField label="Corporal" value={objetivos_queixas?.projeto_de_vida_corporal} fieldPath="a_objetivos_queixas.projeto_de_vida_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritual" value={objetivos_queixas?.projeto_de_vida_espiritual} fieldPath="a_objetivos_queixas.projeto_de_vida_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Familiar" value={objetivos_queixas?.projeto_de_vida_familiar} fieldPath="a_objetivos_queixas.projeto_de_vida_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profissional" value={objetivos_queixas?.projeto_de_vida_profissional} fieldPath="a_objetivos_queixas.projeto_de_vida_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sonhos" value={objetivos_queixas?.projeto_de_vida_sonhos} fieldPath="a_objetivos_queixas.projeto_de_vida_sonhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Motivação e Mudança</h4>
            <DataField label="Nível de Motivação" value={objetivos_queixas?.nivel_motivacao} fieldPath="a_objetivos_queixas.nivel_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Prontidão para Mudança" value={objetivos_queixas?.prontidao_para_mudanca} fieldPath="a_objetivos_queixas.prontidao_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mudanças Considera Necessárias" value={objetivos_queixas?.mudancas_considera_necessarias} fieldPath="a_objetivos_queixas.mudancas_considera_necessarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Histórico de Risco */}
      {shouldShowSection('Histórico de Risco') && (
        <CollapsibleSection title="Histórico de Risco" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Doenças Atuais e Passadas</h4>
            <DataField label="Doenças Atuais Confirmadas" value={historico_risco?.doencas_atuais_confirmadas} fieldPath="a_historico_risco.doencas_atuais_confirmadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Doenças na Infância/Adolescência" value={historico_risco?.doencas_infancia_adolescencia} fieldPath="a_historico_risco.doencas_infancia_adolescencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Antecedentes Familiares</h4>
            <DataField label="Pai" value={historico_risco?.antecedentes_familiares_pai} fieldPath="a_historico_risco.antecedentes_familiares_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mãe" value={historico_risco?.antecedentes_familiares_mae} fieldPath="a_historico_risco.antecedentes_familiares_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Irmãos" value={historico_risco?.antecedentes_familiares_irmaos} fieldPath="a_historico_risco.antecedentes_familiares_irmaos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Paternos" value={historico_risco?.antecedentes_familiares_avos_paternos} fieldPath="a_historico_risco.antecedentes_familiares_avos_paternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Avós Maternos" value={historico_risco?.antecedentes_familiares_avos_maternos} fieldPath="a_historico_risco.antecedentes_familiares_avos_maternos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Causas de Morte dos Avós" value={historico_risco?.antecedentes_familiares_causas_morte_avos} fieldPath="a_historico_risco.antecedentes_familiares_causas_morte_avos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Condições e Tratamentos</h4>
            <DataField label="Condições Genéticas Conhecidas" value={historico_risco?.condicoes_geneticas_conhecidas} fieldPath="a_historico_risco.condicoes_geneticas_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cirurgias/Procedimentos" value={historico_risco?.cirurgias_procedimentos} fieldPath="a_historico_risco.cirurgias_procedimentos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Atuais" value={historico_risco?.medicacoes_atuais} fieldPath="a_historico_risco.medicacoes_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Medicações Contínuas" value={historico_risco?.medicacoes_continuas} fieldPath="a_historico_risco.medicacoes_continuas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Já Usou Corticoides" value={historico_risco?.ja_usou_corticoides} fieldPath="a_historico_risco.ja_usou_corticoides" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Alergias e Exposições</h4>
            <DataField label="Alergias/Intolerâncias Conhecidas" value={historico_risco?.alergias_intolerancias_conhecidas} fieldPath="a_historico_risco.alergias_intolerancias_conhecidas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alergias/Intolerâncias Suspeitas" value={historico_risco?.alergias_intolerancias_suspeitas} fieldPath="a_historico_risco.alergias_intolerancias_suspeitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição Tóxica" value={historico_risco?.exposicao_toxica} fieldPath="a_historico_risco.exposicao_toxica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Histórico de Peso</h4>
            <DataField label="Variação ao Longo da Vida" value={historico_risco?.historico_peso_variacao_ao_longo_vida} fieldPath="a_historico_risco.historico_peso_variacao_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Máximo Atingido" value={historico_risco?.historico_peso_peso_maximo_atingido} fieldPath="a_historico_risco.historico_peso_peso_maximo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Peso Mínimo Atingido" value={historico_risco?.historico_peso_peso_minimo_atingido} fieldPath="a_historico_risco.historico_peso_peso_minimo_atingido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Tratamentos Anteriores</h4>
            <DataField label="Tentativas de Tratamento Anteriores" value={historico_risco?.tentativas_tratamento_anteriores} fieldPath="a_historico_risco.tentativas_tratamento_anteriores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Observação Clínica e Laboratorial */}
      {shouldShowSection('Observação Clínica e Laboratorial') && (
        <CollapsibleSection title="Observação Clínica e Laboratorial" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Sintomas e Padrões</h4>
            <DataField label="Quando os Sintomas Começaram" value={observacao_clinica_lab?.quando_sintomas_comecaram} fieldPath="a_observacao_clinica_lab_2.quando_sintomas_comecaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrão Temporal" value={observacao_clinica_lab?.ha_algum_padrao_temporal} fieldPath="a_observacao_clinica_lab_2.ha_algum_padrao_temporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos que Agravaram" value={observacao_clinica_lab?.eventos_que_agravaram} fieldPath="a_observacao_clinica_lab_2.eventos_que_agravaram" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade de Dor/Desconforto" value={observacao_clinica_lab?.intensidade_dor_desconforto} fieldPath="a_observacao_clinica_lab_2.intensidade_dor_desconforto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Energia Diária" value={observacao_clinica_lab?.nivel_energia_diaria} fieldPath="a_observacao_clinica_lab_2.nivel_energia_diaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Gastrointestinal</h4>
            <DataField label="Intestino" value={observacao_clinica_lab?.sistema_gastrointestinal_intestino} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_intestino" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hábito Intestinal" value={observacao_clinica_lab?.sistema_gastrointestinal_habito_intestinal} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_habito_intestinal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_disbiose} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Língua" value={observacao_clinica_lab?.sistema_gastrointestinal_lingua} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_lingua" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Digestão" value={observacao_clinica_lab?.sistema_gastrointestinal_digestao} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_digestao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gases" value={observacao_clinica_lab?.sistema_gastrointestinal_gases} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_gases" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita de Disbiose" value={observacao_clinica_lab?.sistema_gastrointestinal_suspeita_disbiose} fieldPath="a_observacao_clinica_lab_2.sistema_gastrointestinal_suspeita_disbiose" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Musculoesquelético</h4>
            <DataField label="Dores" value={observacao_clinica_lab?.sistema_musculoesqueletico_dores} fieldPath="a_observacao_clinica_lab_2.sistema_musculoesqueletico_dores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Localização" value={observacao_clinica_lab?.sistema_musculoesqueletico_localizacao} fieldPath="a_observacao_clinica_lab_2.sistema_musculoesqueletico_localizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Postura" value={observacao_clinica_lab?.sistema_musculoesqueletico_postura} fieldPath="a_observacao_clinica_lab_2.sistema_musculoesqueletico_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tônus Muscular" value={observacao_clinica_lab?.sistema_musculoesqueletico_tono_muscular} fieldPath="a_observacao_clinica_lab_2.sistema_musculoesqueletico_tono_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Mobilidade" value={observacao_clinica_lab?.sistema_musculoesqueletico_mobilidade} fieldPath="a_observacao_clinica_lab_2.sistema_musculoesqueletico_mobilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pele e Fâneros</h4>
            <DataField label="Pele" value={observacao_clinica_lab?.pele_faneros_pele} fieldPath="a_observacao_clinica_lab_2.pele_faneros_pele" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cabelo" value={observacao_clinica_lab?.pele_faneros_cabelo} fieldPath="a_observacao_clinica_lab_2.pele_faneros_cabelo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Unhas" value={observacao_clinica_lab?.pele_faneros_unhas} fieldPath="a_observacao_clinica_lab_2.pele_faneros_unhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hidratação" value={observacao_clinica_lab?.pele_faneros_hidratacao} fieldPath="a_observacao_clinica_lab_2.pele_faneros_hidratacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ingestão de Água (ml/dia)" value={observacao_clinica_lab?.pele_faneros_ingestao_agua_ml_dia} fieldPath="a_observacao_clinica_lab_2.pele_faneros_ingestao_agua_ml_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Neurológico/Mental</h4>
            <DataField label="Memória" value={observacao_clinica_lab?.sistema_neurologico_mental_memoria} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_memoria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Concentração" value={observacao_clinica_lab?.sistema_neurologico_mental_concentracao} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Qualidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_qualidade} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Latência do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_latencia} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_latencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Manutenção do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_manutencao} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_manutencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Profundidade do Sono" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_profundidade} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_profundidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Duração do Sono (horas)" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_duracao_horas} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_duracao_horas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Despertar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_despertar} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_despertar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda Quantas Vezes" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_quantas_vezes} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_acorda_quantas_vezes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acorda para Urinar" value={observacao_clinica_lab?.sistema_neurologico_mental_sono_acorda_para_urinar} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_sono_acorda_para_urinar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Energia" value={observacao_clinica_lab?.sistema_neurologico_mental_energia} fieldPath="a_observacao_clinica_lab_2.sistema_neurologico_mental_energia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Endócrino</h4>
            <h5>Tireoide</h5>
            <DataField label="TSH" value={observacao_clinica_lab?.sistema_endocrino_tireoide_tsh} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_tireoide_tsh" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Anti-TPO" value={observacao_clinica_lab?.sistema_endocrino_tireoide_anti_tpo} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_tireoide_anti_tpo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T3 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t3_livre} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_tireoide_t3_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="T4 Livre" value={observacao_clinica_lab?.sistema_endocrino_tireoide_t4_livre} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_tireoide_t4_livre" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suspeita" value={observacao_clinica_lab?.sistema_endocrino_tireoide_suspeita} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_tireoide_suspeita" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />

            <h5>Insulina</h5>
            <DataField label="Valor" value={observacao_clinica_lab?.sistema_endocrino_insulina_valor} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_insulina_valor" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Glicemia" value={observacao_clinica_lab?.sistema_endocrino_insulina_glicemia} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_insulina_glicemia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Hemoglobina Glicada" value={observacao_clinica_lab?.sistema_endocrino_insulina_hemoglobina_glicada} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_insulina_hemoglobina_glicada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="HOMA-IR" value={observacao_clinica_lab?.sistema_endocrino_insulina_homa_ir} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_insulina_homa_ir" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diagnóstico" value={observacao_clinica_lab?.sistema_endocrino_insulina_diagnostico} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_insulina_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />

            <h5>Outros Hormônios</h5>
            <DataField label="Cortisol" value={observacao_clinica_lab?.sistema_endocrino_cortisol} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_cortisol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estrogênio" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_estrogeno} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_hormonios_sexuais_estrogeno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Progesterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_progesterona} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_hormonios_sexuais_progesterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Testosterona" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_testosterona} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_hormonios_sexuais_testosterona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={observacao_clinica_lab?.sistema_endocrino_hormonios_sexuais_impacto} fieldPath="a_observacao_clinica_lab_2.sistema_endocrino_hormonios_sexuais_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Medidas Antropométricas</h4>
            <DataField label="Peso Atual" value={observacao_clinica_lab?.medidas_antropometricas_peso_atual} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_peso_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Altura" value={observacao_clinica_lab?.medidas_antropometricas_altura} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_altura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="IMC" value={observacao_clinica_lab?.medidas_antropometricas_imc} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_imc" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência da Cintura" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_cintura} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_circunferencias_cintura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Quadril" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_quadril} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_circunferencias_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Circunferência do Pescoço" value={observacao_clinica_lab?.medidas_antropometricas_circunferencias_pescoco} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_circunferencias_pescoco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relação Cintura/Quadril" value={observacao_clinica_lab?.medidas_antropometricas_relacao_cintura_quadril} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_relacao_cintura_quadril" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />

            <h5>Bioimpedância</h5>
            <DataField label="Gordura (%)" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_percentual} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_bioimpedancia_gordura_percentual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Massa Muscular" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_massa_muscular} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_bioimpedancia_massa_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Água Corporal" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_agua_corporal} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_bioimpedancia_agua_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_bioimpedancia_gordura_visceral} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_bioimpedancia_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />

            <DataField label="Gordura Visceral" value={observacao_clinica_lab?.medidas_antropometricas_gordura_visceral} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_gordura_visceral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Esteatose Hepática" value={observacao_clinica_lab?.medidas_antropometricas_esteatose_hepatica} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_esteatose_hepatica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pressão Arterial" value={observacao_clinica_lab?.medidas_antropometricas_pressao_arterial} fieldPath="a_observacao_clinica_lab_2.medidas_antropometricas_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sinais Vitais Relatados</h4>
            <DataField label="Disposição ao Acordar" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_acordar} fieldPath="a_observacao_clinica_lab_2.sinais_vitais_relatados_disposicao_ao_acordar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Disposição ao Longo do Dia" value={observacao_clinica_lab?.sinais_vitais_relatados_disposicao_ao_longo_dia} fieldPath="a_observacao_clinica_lab_2.sinais_vitais_relatados_disposicao_ao_longo_dia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Libido" value={observacao_clinica_lab?.sinais_vitais_relatados_libido} fieldPath="a_observacao_clinica_lab_2.sinais_vitais_relatados_libido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Regulação Térmica" value={observacao_clinica_lab?.sinais_vitais_relatados_regulacao_termica} fieldPath="a_observacao_clinica_lab_2.sinais_vitais_relatados_regulacao_termica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos Alimentares</h4>
            <DataField label="Recordatório 24h" value={observacao_clinica_lab?.habitos_alimentares_recordatorio_24h} fieldPath="a_observacao_clinica_lab_2.habitos_alimentares_recordatorio_24h" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência de Ultraprocessados" value={observacao_clinica_lab?.habitos_alimentares_frequencia_ultraprocessados} fieldPath="a_observacao_clinica_lab_2.habitos_alimentares_frequencia_ultraprocessados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Horários das Refeições" value={observacao_clinica_lab?.habitos_alimentares_horarios_refeicoes} fieldPath="a_observacao_clinica_lab_2.habitos_alimentares_horarios_refeicoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Come Assistindo TV/Trabalhando" value={observacao_clinica_lab?.habitos_alimentares_come_assistindo_tv_trabalhando} fieldPath="a_observacao_clinica_lab_2.habitos_alimentares_come_assistindo_tv_trabalhando" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* História de Vida */}
      {shouldShowSection('História de Vida') && (
        <CollapsibleSection title="História de vida" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Narrativa e Eventos</h4>
            <DataField label="Síntese da Narrativa" value={historia_vida?.narrativa_sintese} fieldPath="a_historia_vida.narrativa_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Eventos de Vida Marcantes" value={historia_vida?.eventos_vida_marcantes} fieldPath="a_historia_vida.eventos_vida_marcantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo/Trauma" value={historia_vida?.episodios_estresse_extremo_trauma} fieldPath="a_historia_vida.episodios_estresse_extremo_trauma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Trilha do Conflito</h4>
            <DataField label="Concepção/Gestação" value={historia_vida?.trilha_do_conflito_concepcao_gestacao} fieldPath="a_historia_vida.trilha_do_conflito_concepcao_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="0-7 anos" value={historia_vida?.trilha_do_conflito_0_7_anos} fieldPath="a_historia_vida.trilha_do_conflito_0_7_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="7-14 anos" value={historia_vida?.trilha_do_conflito_7_14_anos} fieldPath="a_historia_vida.trilha_do_conflito_7_14_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="14-21 anos" value={historia_vida?.trilha_do_conflito_14_21_anos} fieldPath="a_historia_vida.trilha_do_conflito_14_21_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="21-28 anos" value={historia_vida?.trilha_do_conflito_21_28_anos} fieldPath="a_historia_vida.trilha_do_conflito_21_28_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="28+ anos" value={historia_vida?.trilha_do_conflito_28_mais_anos} fieldPath="a_historia_vida.trilha_do_conflito_28_mais_anos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Padrões e Traumas</h4>
            <DataField label="Pontos Traumáticos" value={historia_vida?.pontos_traumaticos} fieldPath="a_historia_vida.pontos_traumaticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões Repetitivos" value={historia_vida?.padroes_repetitivos} fieldPath="a_historia_vida.padroes_repetitivos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe na Gestação" value={historia_vida?.saude_mae_gestacao} fieldPath="a_historia_vida.saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Traços/Comportamentos Repetitivos" value={historia_vida?.tracos_comportamentos_repetitivos_ao_longo_vida} fieldPath="a_historia_vida.tracos_comportamentos_repetitivos_ao_longo_vida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Superação e Identidade</h4>
            <DataField label="Experiência de Virada" value={historia_vida?.experiencia_considera_virada} fieldPath="a_historia_vida.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Identifica com Superação ou Defesa" value={historia_vida?.identifica_com_superacao_ou_defesa} fieldPath="a_historia_vida.identifica_com_superacao_ou_defesa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Conexão com Identidade e Propósito" value={historia_vida?.conexao_identidade_proposito} fieldPath="a_historia_vida.conexao_identidade_proposito" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Algo da Infância que Lembra com Emoção Intensa" value={historia_vida?.algo_infancia_lembra_com_emocao_intensa} fieldPath="a_historia_vida.algo_infancia_lembra_com_emocao_intensa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

        </CollapsibleSection>
      )}

      {/* Setênios e Eventos */}
      {shouldShowSection('Setênios e Eventos') && (
        <CollapsibleSection title="Setênios e Eventos" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Concepção e Gestação</h4>
            <DataField label="Planejamento" value={setenios_eventos?.concepcao_gestacao_planejamento} fieldPath="a_setenios_eventos.concepcao_gestacao_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ambiente Gestacional" value={setenios_eventos?.concepcao_gestacao_ambiente_gestacional} fieldPath="a_setenios_eventos.concepcao_gestacao_ambiente_gestacional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Saúde da Mãe" value={setenios_eventos?.concepcao_gestacao_saude_mae_gestacao} fieldPath="a_setenios_eventos.concepcao_gestacao_saude_mae_gestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Parto" value={setenios_eventos?.concepcao_gestacao_parto} fieldPath="a_setenios_eventos.concepcao_gestacao_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Houve Trauma de Parto" value={setenios_eventos?.concepcao_gestacao_houve_trauma_parto} fieldPath="a_setenios_eventos.concepcao_gestacao_houve_trauma_parto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Foi Desejada/Planejada" value={setenios_eventos?.concepcao_gestacao_foi_desejada_planejada} fieldPath="a_setenios_eventos.concepcao_gestacao_foi_desejada_planejada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.concepcao_gestacao_impacto} fieldPath="a_setenios_eventos.concepcao_gestacao_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Primeiro Setênio (0-7 anos)</h4>
            <DataField label="Ambiente" value={setenios_eventos?.primeiro_setenio_0_7_ambiente} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_ambiente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Pai" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_pai} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_pai" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Figuras Parentais - Mãe" value={setenios_eventos?.primeiro_setenio_0_7_figuras_parentais_mae} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_figuras_parentais_mae" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aprendizados" value={setenios_eventos?.primeiro_setenio_0_7_aprendizados} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_aprendizados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Trauma Central" value={setenios_eventos?.primeiro_setenio_0_7_trauma_central} fieldPath="a_setenios_eventos.primeiro_setenio_0_7_trauma_central" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Segundo Setênio (7-14 anos)</h4>
            <DataField label="Eventos" value={setenios_eventos?.segundo_setenio_7_14_eventos} fieldPath="a_setenios_eventos.segundo_setenio_7_14_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Desenvolvimento" value={setenios_eventos?.segundo_setenio_7_14_desenvolvimento} fieldPath="a_setenios_eventos.segundo_setenio_7_14_desenvolvimento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Corpo Físico" value={setenios_eventos?.segundo_setenio_7_14_corpo_fisico} fieldPath="a_setenios_eventos.segundo_setenio_7_14_corpo_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Impacto" value={setenios_eventos?.segundo_setenio_7_14_impacto} fieldPath="a_setenios_eventos.segundo_setenio_7_14_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Terceiro Setênio (14-21 anos)</h4>
            <DataField label="Escolhas" value={setenios_eventos?.terceiro_setenio_14_21_escolhas} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_escolhas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Motivação" value={setenios_eventos?.terceiro_setenio_14_21_motivacao} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_motivacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Cumeeira da Casa" value={setenios_eventos?.terceiro_setenio_14_21_cumeeira_da_casa} fieldPath="a_setenios_eventos.terceiro_setenio_14_21_cumeeira_da_casa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Quarto Setênio (21-28 anos)</h4>
            <DataField label="Eventos Significativos" value={setenios_eventos?.quarto_setenio_21_28_eventos_significativos} fieldPath="a_setenios_eventos.quarto_setenio_21_28_eventos_significativos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Formação Profissional" value={setenios_eventos?.quarto_setenio_21_28_formacao_profissional} fieldPath="a_setenios_eventos.quarto_setenio_21_28_formacao_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Decênios (28-40+ anos)</h4>
            <DataField label="Climatério/Menopausa" value={setenios_eventos?.decenios_28_40_mais_climaterio_menopausa} fieldPath="a_setenios_eventos.decenios_28_40_mais_climaterio_menopausa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pausas Hormonais" value={setenios_eventos?.decenios_28_40_mais_pausas_hormonais} fieldPath="a_setenios_eventos.decenios_28_40_mais_pausas_hormonais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Acumulação" value={setenios_eventos?.decenios_28_40_mais_acumulacao} fieldPath="a_setenios_eventos.decenios_28_40_mais_acumulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Estado Atual" value={setenios_eventos?.decenios_28_40_mais_estado_atual} fieldPath="a_setenios_eventos.decenios_28_40_mais_estado_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Episódios de Estresse Extremo" value={setenios_eventos?.decenios_28_40_mais_episodios_estresse_extremo} fieldPath="a_setenios_eventos.decenios_28_40_mais_episodios_estresse_extremo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Gerais</h4>
            <DataField label="Eventos Críticos Identificados" value={setenios_eventos?.eventos_criticos_identificados} fieldPath="a_setenios_eventos.eventos_criticos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Experiência de Virada" value={setenios_eventos?.experiencia_considera_virada} fieldPath="a_setenios_eventos.experiencia_considera_virada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diferenças Sazonais/Climáticas nos Sintomas" value={setenios_eventos?.diferencas_sazonais_climaticas_sintomas} fieldPath="a_setenios_eventos.diferencas_sazonais_climaticas_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Ambiente e Contexto */}
      {shouldShowSection('Ambiente e Contexto') && (
        <CollapsibleSection title="Ambiente e Contexto" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Contexto Familiar</h4>
            <DataField label="Estado Civil" value={ambiente_contexto?.contexto_familiar_estado_civil} fieldPath="a_ambiente_contexto.contexto_familiar_estado_civil" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Filhos" value={ambiente_contexto?.contexto_familiar_filhos} fieldPath="a_ambiente_contexto.contexto_familiar_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Dinâmica Familiar" value={ambiente_contexto?.contexto_familiar_dinamica_familiar} fieldPath="a_ambiente_contexto.contexto_familiar_dinamica_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Suporte Familiar" value={ambiente_contexto?.contexto_familiar_suporte_familiar} fieldPath="a_ambiente_contexto.contexto_familiar_suporte_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Relacionamento Conjugal" value={ambiente_contexto?.contexto_familiar_relacionamento_conjugal} fieldPath="a_ambiente_contexto.contexto_familiar_relacionamento_conjugal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Divisão de Tarefas Domésticas" value={ambiente_contexto?.contexto_familiar_divisao_tarefas_domesticas} fieldPath="a_ambiente_contexto.contexto_familiar_divisao_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Vida Sexual Ativa" value={ambiente_contexto?.contexto_familiar_vida_sexual_ativa} fieldPath="a_ambiente_contexto.contexto_familiar_vida_sexual_ativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Diálogo sobre Sobrecarga" value={ambiente_contexto?.contexto_familiar_dialogo_sobre_sobrecarga} fieldPath="a_ambiente_contexto.contexto_familiar_dialogo_sobre_sobrecarga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Contexto Profissional</h4>
            <DataField label="Área" value={ambiente_contexto?.contexto_profissional_area} fieldPath="a_ambiente_contexto.contexto_profissional_area" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Carga Horária" value={ambiente_contexto?.contexto_profissional_carga_horaria} fieldPath="a_ambiente_contexto.contexto_profissional_carga_horaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Estresse" value={ambiente_contexto?.contexto_profissional_nivel_estresse} fieldPath="a_ambiente_contexto.contexto_profissional_nivel_estresse" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Satisfação" value={ambiente_contexto?.contexto_profissional_satisfacao} fieldPath="a_ambiente_contexto.contexto_profissional_satisfacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ambiente Físico</h4>
            <DataField label="Sedentarismo" value={ambiente_contexto?.ambiente_fisico_sedentarismo} fieldPath="a_ambiente_contexto.ambiente_fisico_sedentarismo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exposição ao Sol" value={ambiente_contexto?.ambiente_fisico_exposicao_sol} fieldPath="a_ambiente_contexto.ambiente_fisico_exposicao_sol" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Pratica Atividade Física" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_pratica} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_pratica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tipo de Atividade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tipo} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Frequência" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_frequencia} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_intensidade} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem Acompanhamento Profissional" value={ambiente_contexto?.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona} fieldPath="a_ambiente_contexto.ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Hábitos de Vida</h4>
            <DataField label="Sono" value={ambiente_contexto?.habitos_vida_sono} fieldPath="a_ambiente_contexto.habitos_vida_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Alimentação" value={ambiente_contexto?.habitos_vida_alimentacao} fieldPath="a_ambiente_contexto.habitos_vida_alimentacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Lazer" value={ambiente_contexto?.habitos_vida_lazer} fieldPath="a_ambiente_contexto.habitos_vida_lazer" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Espiritualidade" value={ambiente_contexto?.habitos_vida_espiritualidade} fieldPath="a_ambiente_contexto.habitos_vida_espiritualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Suporte Social</h4>
            <DataField label="Tem Rede de Apoio" value={ambiente_contexto?.suporte_social_tem_rede_apoio} fieldPath="a_ambiente_contexto.suporte_social_tem_rede_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Participa de Grupos Sociais" value={ambiente_contexto?.suporte_social_participa_grupos_sociais} fieldPath="a_ambiente_contexto.suporte_social_participa_grupos_sociais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Tem com Quem Desabafar" value={ambiente_contexto?.suporte_social_tem_com_quem_desabafar} fieldPath="a_ambiente_contexto.suporte_social_tem_com_quem_desabafar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Fatores de Risco</h4>
            <DataField label="Fatores Estressores" value={ambiente_contexto?.fatores_estressores} fieldPath="a_ambiente_contexto.fatores_estressores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Fatores Externos à Saúde" value={ambiente_contexto?.fatores_externos_saude} fieldPath="a_ambiente_contexto.fatores_externos_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Sensação e Emoções */}
      {shouldShowSection('Sensação e Emoções') && (
        <CollapsibleSection title="Sensação e Emoções" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Emoções e Sensações</h4>
            <DataField label="Emoções Predominantes" value={sensacao_emocoes?.emocoes_predominantes} fieldPath="a_sensacao_emocoes.emocoes_predominantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Sensações Corporais" value={sensacao_emocoes?.sensacoes_corporais} fieldPath="a_sensacao_emocoes.sensacoes_corporais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Palavras-chave Emocionais" value={sensacao_emocoes?.palavras_chave_emocionais} fieldPath="a_sensacao_emocoes.palavras_chave_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Intensidade Emocional" value={sensacao_emocoes?.intensidade_emocional} fieldPath="a_sensacao_emocoes.intensidade_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Gatilhos Emocionais</h4>
            <DataField label="Consegue Identificar Gatilhos" value={sensacao_emocoes?.consegue_identificar_gatilhos_emocionais} fieldPath="a_sensacao_emocoes.consegue_identificar_gatilhos_emocionais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Gatilhos Identificados" value={sensacao_emocoes?.gatilhos_identificados} fieldPath="a_sensacao_emocoes.gatilhos_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Regulação Emocional</h4>
            <DataField label="Capacidade de Regulação" value={sensacao_emocoes?.regulacao_emocional_capacidade_regulacao} fieldPath="a_sensacao_emocoes.regulacao_emocional_capacidade_regulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Forma de Expressão" value={sensacao_emocoes?.regulacao_emocional_forma_expressao} fieldPath="a_sensacao_emocoes.regulacao_emocional_forma_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Como Gerencia Estresse/Ansiedade" value={sensacao_emocoes?.regulacao_emocional_como_gerencia_estresse_ansiedade} fieldPath="a_sensacao_emocoes.regulacao_emocional_como_gerencia_estresse_ansiedade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Memória Afetiva" value={sensacao_emocoes?.memoria_afetiva} fieldPath="a_sensacao_emocoes.memoria_afetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sensações Específicas do Reino</h4>
            <DataField label="Usa Palavras Como" value={sensacao_emocoes?.sensacoes_especificas_reino_usa_palavras_como} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_usa_palavras_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={sensacao_emocoes?.sensacoes_especificas_reino_descreve_sensacoes_como} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Padrões de Discurso" value={sensacao_emocoes?.sensacoes_especificas_reino_padroes_discurso} fieldPath="a_sensacao_emocoes.sensacoes_especificas_reino_padroes_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Conexão Corpo-Mente</h4>
            <DataField label="Percebe Manifestações Corporais das Emoções" value={sensacao_emocoes?.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes} fieldPath="a_sensacao_emocoes.conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Exemplos" value={sensacao_emocoes?.conexao_corpo_mente_exemplos} fieldPath="a_sensacao_emocoes.conexao_corpo_mente_exemplos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Preocupações e Crenças */}
      {shouldShowSection('Preocupações e Crenças') && (
        <CollapsibleSection title="Preocupações e Crenças" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Percepção do Problema</h4>
            <DataField label="Como Percebe o Problema" value={preocupacoes_crencas?.como_percebe_problema} fieldPath="a_preocupacoes_crencas.como_percebe_problema" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Compreensão sobre Causa dos Sintomas" value={preocupacoes_crencas?.compreensao_sobre_causa_sintomas} fieldPath="a_preocupacoes_crencas.compreensao_sobre_causa_sintomas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Crenças e Preocupações</h4>
            <DataField label="Crenças Limitantes" value={preocupacoes_crencas?.crencas_limitantes} fieldPath="a_preocupacoes_crencas.crencas_limitantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Explícitas" value={preocupacoes_crencas?.preocupacoes_explicitas} fieldPath="a_preocupacoes_crencas.preocupacoes_explicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Preocupações Implícitas" value={preocupacoes_crencas?.preocupacoes_implicitas} fieldPath="a_preocupacoes_crencas.preocupacoes_implicitas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Ganhos Secundários" value={preocupacoes_crencas?.ganhos_secundarios} fieldPath="a_preocupacoes_crencas.ganhos_secundarios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Resistências Possíveis" value={preocupacoes_crencas?.resistencias_possiveis} fieldPath="a_preocupacoes_crencas.resistencias_possiveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Expectativas e Insight</h4>
            <DataField label="Condições Genéticas na Família" value={preocupacoes_crencas?.condicoes_geneticas_familia} fieldPath="a_preocupacoes_crencas.condicoes_geneticas_familia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Expectativas Irrealistas" value={preocupacoes_crencas?.expectativas_irrealistas} fieldPath="a_preocupacoes_crencas.expectativas_irrealistas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Nível de Insight/Autoconsciência" value={preocupacoes_crencas?.nivel_insight_autoconsciencia} fieldPath="a_preocupacoes_crencas.nivel_insight_autoconsciencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abertura para Mudança" value={preocupacoes_crencas?.abertura_para_mudanca} fieldPath="a_preocupacoes_crencas.abertura_para_mudanca" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Barreiras e Desafios</h4>
            <DataField label="Barreiras Percebidas ao Tratamento" value={preocupacoes_crencas?.barreiras_percebidas_tratamento} fieldPath="a_preocupacoes_crencas.barreiras_percebidas_tratamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Aspectos do Plano que Parecem Desafiadores" value={preocupacoes_crencas?.aspectos_plano_parecem_desafiadores} fieldPath="a_preocupacoes_crencas.aspectos_plano_parecem_desafiadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}

      {/* Reino e Miasma */}
      {shouldShowSection('Reino e Miasma') && (
        <CollapsibleSection title="Reino e Miasma" defaultOpen={true}>
          <div className="anamnese-subsection">
            <h4>Reino Predominante</h4>
            <DataField label="Reino Predominante" value={reino_miasma?.reino_predominante} fieldPath="a_reino_miasma.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Justificativa do Reino" value={reino_miasma?.justificativa_reino} fieldPath="a_reino_miasma.justificativa_reino" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Características Identificadas" value={reino_miasma?.caracteristicas_identificadas} fieldPath="a_reino_miasma.caracteristicas_identificadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Miasma</h4>
            <DataField label="Miasma Principal" value={reino_miasma?.miasma_principal} fieldPath="a_reino_miasma.miasma_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Justificativa do Miasma" value={reino_miasma?.justificativa_miasma} fieldPath="a_reino_miasma.justificativa_miasma" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Análise Miasma - Energia" value={reino_miasma?.analise_miasma_energia} fieldPath="a_reino_miasma.analise_miasma_energia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Análise Miasma - Luta" value={reino_miasma?.analise_miasma_luta} fieldPath="a_reino_miasma.analise_miasma_luta" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Análise Detalhada - Reino Animal</h4>
            <DataField label="Palavras Usadas" value={reino_miasma?.analise_detalhada_reino_animal_palavras_usadas} fieldPath="a_reino_miasma.analise_detalhada_reino_animal_palavras_usadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Descreve Sensações Como" value={reino_miasma?.analise_detalhada_reino_animal_descreve_sensacoes_como} fieldPath="a_reino_miasma.analise_detalhada_reino_animal_descreve_sensacoes_como" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Implicações Terapêuticas</h4>
            <DataField label="Comunicação" value={reino_miasma?.implicacoes_terapeuticas_comunicacao} fieldPath="a_reino_miasma.implicacoes_terapeuticas_comunicacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Abordagem" value={reino_miasma?.implicacoes_terapeuticas_abordagem} fieldPath="a_reino_miasma.implicacoes_terapeuticas_abordagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
            <DataField label="Outras Terapias Alinhadas" value={reino_miasma?.implicacoes_terapeuticas_outras_terapias_alinhadas} fieldPath="a_reino_miasma.implicacoes_terapeuticas_outras_terapias_alinhadas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Comportamentais</h4>
            <DataField label="Padrão de Discurso" value={reino_miasma?.padrao_discurso} fieldPath="a_reino_miasma.padrao_discurso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} readOnly={readOnly} />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// Componente da seção de Diagnóstico
function DiagnosticoSection({
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange,
  activeTab
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
  activeTab?: string;
}) {
  const [diagnosticoData, setDiagnosticoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnosticoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadDiagnosticoData();
    };

    window.addEventListener('diagnostico-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('diagnostico-data-refresh', handleRefresh);
    };
  }, []);

  const loadDiagnosticoData = async () => {
    try {
      setLoadingDetails(true);
      console.log('🔍 Carregando dados de diagnóstico para consulta:', consultaId);
      const response = await gatewayClient.get(`/diagnostico/${consultaId}`);
      console.log('📡 Response status:', response.status);
      if (response.success) {
        const data = response;
        console.log('✅ Dados de diagnóstico carregados:', data);
        console.log('🔍 Estrutura dos dados de diagnóstico:', {
          type: typeof data,
          keys: Object.keys(data || {}),
          hasData: !!data
        });
        setDiagnosticoData(data);
        setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading
      } else {
        const errorData = await response.text();
        setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading mesmo em caso de erro
      }
    } catch (error) {
      // Erro ao carregar dados
      setLoading(false); // ✅ CORREÇÃO: Atualizar estado loading em caso de erro
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase
      const response = await gatewayClient.post(`/diagnostico/${consultaId}/update-field`, {
        fieldPath,
        value: newValue
      });

      if (!response.success) throw new Error('Erro ao atualizar campo no Supabase');

      // Depois, notificar o webhook (opcional, para processamento adicional)
      try {
        const webhookEndpoints = getWebhookEndpoints();

        await gatewayClient.post('/ai/edit', {
          webhookUrl: webhookEndpoints.edicaoDiagnostico,
          origem: 'MANUAL',
          fieldPath,
          texto: newValue,
          consultaId
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }

      // Recarregar dados após salvar
      await loadDiagnosticoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    onFieldSelect(fieldPath, label);
  };

  if (loading) {
    console.log('🔍 DiagnosticoSection - Mostrando loading...');
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de diagnóstico...</p>
      </div>
    );
  }

  const {
    estado_geral,
    estado_mental,
    estado_fisiologico,
    diagnostico_principal,
    integracao_diagnostica,
    habitos_vida
  } = diagnosticoData || {};

  console.log('🔍 DiagnosticoSection - dados recebidos:', diagnosticoData);
  console.log('🔍 DiagnosticoSection - Renderizando componente com dados:', {
    loading,
    hasDiagnosticoData: !!diagnosticoData,
    diagnosticoDataKeys: diagnosticoData ? Object.keys(diagnosticoData) : [],
    diagnostico_principal: !!diagnostico_principal,
    estado_geral: !!estado_geral,
    estado_mental: !!estado_mental,
    estado_fisiologico: !!estado_fisiologico,
    integracao_diagnostica: !!integracao_diagnostica,
    habitos_vida: !!habitos_vida
  });

  // Verificar se há dados em alguma seção
  const hasAnyData = diagnostico_principal || estado_geral || estado_mental ||
    estado_fisiologico || integracao_diagnostica || habitos_vida;

  // Função para mapear nomes de tabs para títulos de seções
  const getSectionTitle = (tab: string): string => {
    const map: { [key: string]: string } = {
      'Diagnóstico Principal': '1. Diagnóstico Principal',
      'Estado Geral': '2. Estado Geral',
      'Estado Mental': '3. Estado Mental',
      'Estado Fisiológico': '4. Estado Fisiológico (Resumo - devido ao volume de campos)',
      'Integração Diagnóstica': '5. Integração Diagnóstica',
      'Hábitos de Vida': '6. Hábitos de Vida (Resumo dos 5 Pilares)'
    };
    return map[tab] || tab;
  };

  const shouldShowSection = (sectionTitle: string): boolean => {
    if (!activeTab) {
      return true; // Se não há tab ativa, mostrar todas
    }
    const mappedTitle = getSectionTitle(activeTab);
    const shouldShow = mappedTitle === sectionTitle;
    console.log('🔍 [Diagnóstico] shouldShowSection:', { activeTab, sectionTitle, mappedTitle, shouldShow });
    return shouldShow;
  };

  console.log('🔍 [Diagnóstico] Renderizando com:', {
    activeTab,
    hasAnyData,
    loading,
    diagnostico_principal: !!diagnostico_principal,
    estado_geral: !!estado_geral,
    estado_mental: !!estado_mental,
    estado_fisiologico: !!estado_fisiologico,
    integracao_diagnostica: !!integracao_diagnostica,
    habitos_vida: !!habitos_vida
  });

  return (
    <div className="anamnese-sections">
      {/* ==================== DIAGNÓSTICO PRINCIPAL ==================== */}
      {shouldShowSection('1. Diagnóstico Principal') && (
        <CollapsibleSection title="1. Diagnóstico Principal" defaultOpen={activeTab === 'Diagnóstico Principal' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>CID e Diagnósticos</h4>
            <DataField label="CID Principal." value={diagnostico_principal?.cid_principal} fieldPath="d_diagnostico_principal.cid_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Diagnósticos Associados (CID)" value={diagnostico_principal?.diagnosticos_associados_cid} fieldPath="d_diagnostico_principal.diagnosticos_associados_cid" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Avaliação Diagnóstica Sistemática (ADS)</h4>
            <DataField label="Síntese" value={diagnostico_principal?.ads_sintese} fieldPath="d_diagnostico_principal.ads_sintese" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Biológico" value={diagnostico_principal?.ads_biologico} fieldPath="d_diagnostico_principal.ads_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Psicológico" value={diagnostico_principal?.ads_psicologico} fieldPath="d_diagnostico_principal.ads_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Emocional" value={diagnostico_principal?.ads_emocional} fieldPath="d_diagnostico_principal.ads_emocional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Social" value={diagnostico_principal?.ads_social} fieldPath="d_diagnostico_principal.ads_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Espiritual" value={diagnostico_principal?.ads_espiritual} fieldPath="d_diagnostico_principal.ads_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Trilha Causal Sintética" value={diagnostico_principal?.ads_trilha_causal_sintetica} fieldPath="d_diagnostico_principal.ads_trilha_causal_sintetica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tipo de Síndrome" value={diagnostico_principal?.ads_tipo_sindrome} fieldPath="d_diagnostico_principal.ads_tipo_sindrome" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Gravidade</h4>
            <DataField label="Nível de Gravidade" value={diagnostico_principal?.grav_nivel} fieldPath="d_diagnostico_principal.grav_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Justificativa" value={diagnostico_principal?.grav_justificativa} fieldPath="d_diagnostico_principal.grav_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Janela de Intervenção" value={diagnostico_principal?.grav_janela_intervencao} fieldPath="d_diagnostico_principal.grav_janela_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Risco Iminente" value={diagnostico_principal?.grav_risco_iminente} fieldPath="d_diagnostico_principal.grav_risco_iminente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Homeopatia</h4>
            <DataField label="Reino Predominante" value={diagnostico_principal?.reino_predominante} fieldPath="d_diagnostico_principal.reino_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Características do Reino" value={diagnostico_principal?.reino_caracteristicas} fieldPath="d_diagnostico_principal.reino_caracteristicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Medicamento Principal" value={diagnostico_principal?.homeo_medicamento_principal} fieldPath="d_diagnostico_principal.homeo_medicamento_principal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Justificativa" value={diagnostico_principal?.homeo_justificativa} fieldPath="d_diagnostico_principal.homeo_justificativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Potência Inicial" value={diagnostico_principal?.homeo_potencia_inicial} fieldPath="d_diagnostico_principal.homeo_potencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Frequência" value={diagnostico_principal?.homeo_frequencia} fieldPath="d_diagnostico_principal.homeo_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Medicamentos Complementares" value={diagnostico_principal?.medicamentos_complementares} fieldPath="d_diagnostico_principal.medicamentos_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Florais de Bach</h4>
            <DataField label="Florais Indicados" value={diagnostico_principal?.florais_bach_indicados} fieldPath="d_diagnostico_principal.florais_bach_indicados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fórmula Floral Sugerida" value={diagnostico_principal?.formula_floral_sugerida} fieldPath="d_diagnostico_principal.formula_floral_sugerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Prognóstico</h4>
            <DataField label="Fatores Favoráveis" value={diagnostico_principal?.prognostico_fatores_favoraveis} fieldPath="d_diagnostico_principal.prognostico_fatores_favoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fatores Desfavoráveis" value={diagnostico_principal?.prognostico_fatores_desfavoraveis} fieldPath="d_diagnostico_principal.prognostico_fatores_desfavoraveis" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Probabilidade de Sucesso (Adesão Total)" value={diagnostico_principal?.prob_sucesso_adesao_total} fieldPath="d_diagnostico_principal.prob_sucesso_adesao_total" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Probabilidade de Sucesso (Adesão Parcial)" value={diagnostico_principal?.prob_sucesso_adesao_parcial} fieldPath="d_diagnostico_principal.prob_sucesso_adesao_parcial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Probabilidade de Sucesso (Sem Adesão)" value={diagnostico_principal?.prob_sucesso_sem_adesao} fieldPath="d_diagnostico_principal.prob_sucesso_sem_adesao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Alertas</h4>
            <DataField label="Alertas Críticos" value={diagnostico_principal?.alertas_criticos} fieldPath="d_diagnostico_principal.alertas_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== ESTADO GERAL ==================== */}
      {shouldShowSection('2. Estado Geral') && (
        <CollapsibleSection title="2. Estado Geral" defaultOpen={activeTab === 'Estado Geral' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>Avaliação Global</h4>
            <DataField label="Estado Geral" value={estado_geral?.avaliacao_estado} fieldPath="d_estado_geral.avaliacao_estado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score de Vitalidade" value={estado_geral?.avaliacao_score_vitalidade} fieldPath="d_estado_geral.avaliacao_score_vitalidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tendência" value={estado_geral?.avaliacao_tendencia} fieldPath="d_estado_geral.avaliacao_tendencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Reserva Fisiológica" value={estado_geral?.avaliacao_reserva_fisiologica} fieldPath="d_estado_geral.avaliacao_reserva_fisiologica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Energia Vital</h4>
            <DataField label="Nível" value={estado_geral?.energia_vital_nivel} fieldPath="d_estado_geral.energia_vital_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Descrição" value={estado_geral?.energia_vital_descricao} fieldPath="d_estado_geral.energia_vital_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Manifestação" value={estado_geral?.energia_vital_manifestacao} fieldPath="d_estado_geral.energia_vital_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Impacto" value={estado_geral?.energia_vital_impacto} fieldPath="d_estado_geral.energia_vital_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Adaptação ao Stress</h4>
            <DataField label="Nível" value={estado_geral?.adapt_stress_nivel} fieldPath="d_estado_geral.adapt_stress_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Descrição" value={estado_geral?.adapt_stress_descricao} fieldPath="d_estado_geral.adapt_stress_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Reserva Adaptativa" value={estado_geral?.adapt_stress_reserva_adaptativa} fieldPath="d_estado_geral.adapt_stress_reserva_adaptativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Manifestação" value={estado_geral?.adapt_stress_manifestacao} fieldPath="d_estado_geral.adapt_stress_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Resiliência</h4>
            <DataField label="Nível" value={estado_geral?.resiliencia_nivel} fieldPath="d_estado_geral.resiliencia_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Descrição" value={estado_geral?.resiliencia_descricao} fieldPath="d_estado_geral.resiliencia_descricao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Elasticidade" value={estado_geral?.resiliencia_elasticidade} fieldPath="d_estado_geral.resiliencia_elasticidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tempo de Recuperação" value={estado_geral?.resiliencia_tempo_recuperacao} fieldPath="d_estado_geral.resiliencia_tempo_recuperacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observação Clínica</h4>
            <DataField label="Fácies" value={estado_geral?.obs_facies} fieldPath="d_estado_geral.obs_facies" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Postura" value={estado_geral?.obs_postura} fieldPath="d_estado_geral.obs_postura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Marcha" value={estado_geral?.obs_marcha} fieldPath="d_estado_geral.obs_marcha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tonus Muscular" value={estado_geral?.obs_tonus_muscular} fieldPath="d_estado_geral.obs_tonus_muscular" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Aparência Geral" value={estado_geral?.obs_aparencia_geral} fieldPath="d_estado_geral.obs_aparencia_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Contato Visual" value={estado_geral?.obs_contato_visual} fieldPath="d_estado_geral.obs_contato_visual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Voz" value={estado_geral?.obs_voz} fieldPath="d_estado_geral.obs_voz" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Atividades de Vida Diária (AVD)</h4>
            <DataField label="Autocuidado Básico" value={estado_geral?.avd_autocuidado_basico} fieldPath="d_estado_geral.avd_autocuidado_basico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Trabalho Profissional" value={estado_geral?.avd_trabalho_profissional} fieldPath="d_estado_geral.avd_trabalho_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Cuidado com Filhos" value={estado_geral?.avd_cuidado_filhos} fieldPath="d_estado_geral.avd_cuidado_filhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tarefas Domésticas" value={estado_geral?.avd_tarefas_domesticas} fieldPath="d_estado_geral.avd_tarefas_domesticas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Lazer e Social" value={estado_geral?.avd_lazer_social} fieldPath="d_estado_geral.avd_lazer_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Autocuidado Ampliado" value={estado_geral?.avd_autocuidado_ampliado} fieldPath="d_estado_geral.avd_autocuidado_ampliado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Funcionalidade e Qualidade de Vida</h4>
            <DataField label="Score Karnofsky" value={estado_geral?.funcionalidade_score_karnofsky} fieldPath="d_estado_geral.funcionalidade_score_karnofsky" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Limitações Funcionais Específicas" value={estado_geral?.limitacoes_funcionais_especificas} fieldPath="d_estado_geral.limitacoes_funcionais_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Score Geral" value={estado_geral?.whoqol_score_geral} fieldPath="d_estado_geral.whoqol_score_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Físico" value={estado_geral?.whoqol_fisico} fieldPath="d_estado_geral.whoqol_fisico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Psicológico" value={estado_geral?.whoqol_psicologico} fieldPath="d_estado_geral.whoqol_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Social" value={estado_geral?.whoqol_social} fieldPath="d_estado_geral.whoqol_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Ambiental" value={estado_geral?.whoqol_ambiental} fieldPath="d_estado_geral.whoqol_ambiental" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="WHOQOL Espiritual" value={estado_geral?.whoqol_espiritual} fieldPath="d_estado_geral.whoqol_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Satisfação com a Vida Global" value={estado_geral?.whoqol_satisfacao_vida_global} fieldPath="d_estado_geral.whoqol_satisfacao_vida_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sinais de Alerta e Evolução</h4>
            <DataField label="Sinais de Alerta de Deterioração" value={estado_geral?.sinais_alerta_deterioracao} fieldPath="d_estado_geral.sinais_alerta_deterioracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="10 Anos Atrás" value={estado_geral?.evo_10_anos_atras} fieldPath="d_estado_geral.evo_10_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="5 Anos Atrás" value={estado_geral?.evo_5_anos_atras} fieldPath="d_estado_geral.evo_5_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="3 Anos Atrás" value={estado_geral?.evo_3_anos_atras} fieldPath="d_estado_geral.evo_3_anos_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="1 Ano Atrás" value={estado_geral?.evo_1_ano_atras} fieldPath="d_estado_geral.evo_1_ano_atras" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Atual" value={estado_geral?.evo_atual} fieldPath="d_estado_geral.evo_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Projeção 6 Meses (Sem Intervenção)" value={estado_geral?.projecao_6_meses_sem_intervencao} fieldPath="d_estado_geral.projecao_6_meses_sem_intervencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Impacto nos Diferentes Âmbitos</h4>
            <DataField label="Profissional" value={estado_geral?.impacto_profissional} fieldPath="d_estado_geral.impacto_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Familiar" value={estado_geral?.impacto_familiar} fieldPath="d_estado_geral.impacto_familiar" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Social" value={estado_geral?.impacto_social} fieldPath="d_estado_geral.impacto_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Pessoal" value={estado_geral?.impacto_pessoal} fieldPath="d_estado_geral.impacto_pessoal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Saúde" value={estado_geral?.impacto_saude} fieldPath="d_estado_geral.impacto_saude" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}

      {/* ====================ESTADO MENTAL ==================== */}
      {shouldShowSection('3. Estado Mental') && (
        <CollapsibleSection title="3. Estado Mental" defaultOpen={activeTab === 'Estado Mental' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>Memória</h4>
            <DataField label="Curto Prazo" value={estado_mental?.memoria_curto_prazo} fieldPath="d_estado_mental.memoria_curto_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Longo Prazo" value={estado_mental?.memoria_longo_prazo} fieldPath="d_estado_mental.memoria_longo_prazo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="De Trabalho" value={estado_mental?.memoria_de_trabalho} fieldPath="d_estado_mental.memoria_de_trabalho" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tipo de Falha" value={estado_mental?.memoria_tipo_falha} fieldPath="d_estado_mental.memoria_tipo_falha" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Impacto Funcional" value={estado_mental?.memoria_impacto_funcional} fieldPath="d_estado_mental.memoria_impacto_funcional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={estado_mental?.memoria_score} fieldPath="d_estado_mental.memoria_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Atenção</h4>
            <DataField label="Sustentada" value={estado_mental?.atencao_sustentada} fieldPath="d_estado_mental.atencao_sustentada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Seletiva" value={estado_mental?.atencao_seletiva} fieldPath="d_estado_mental.atencao_seletiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Alternada" value={estado_mental?.atencao_alternada} fieldPath="d_estado_mental.atencao_alternada" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Dividida" value={estado_mental?.atencao_dividida} fieldPath="d_estado_mental.atencao_dividida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Manifestação" value={estado_mental?.atencao_manifestacao} fieldPath="d_estado_mental.atencao_manifestacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={estado_mental?.atencao_score} fieldPath="d_estado_mental.atencao_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Funções Executivas</h4>
            <DataField label="Planejamento" value={estado_mental?.exec_planejamento} fieldPath="d_estado_mental.exec_planejamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Organização" value={estado_mental?.exec_organizacao} fieldPath="d_estado_mental.exec_organizacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Iniciativa" value={estado_mental?.exec_iniciativa} fieldPath="d_estado_mental.exec_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tomada de Decisão" value={estado_mental?.exec_tomada_decisao} fieldPath="d_estado_mental.exec_tomada_decisao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Flexibilidade Cognitiva" value={estado_mental?.exec_flexibilidade_cognitiva} fieldPath="d_estado_mental.exec_flexibilidade_cognitiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Controle Inibitório" value={estado_mental?.exec_controle_inibitorio} fieldPath="d_estado_mental.exec_controle_inibitorio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={estado_mental?.exec_score} fieldPath="d_estado_mental.exec_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Outras Funções Cognitivas</h4>
            <DataField label="Velocidade de Processamento" value={estado_mental?.velocidade_processamento} fieldPath="d_estado_mental.velocidade_processamento" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Linguagem" value={estado_mental?.linguagem} fieldPath="d_estado_mental.linguagem" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Humor e Afeto</h4>
            <DataField label="Tipo de Humor" value={estado_mental?.humor_tipo} fieldPath="d_estado_mental.humor_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intensidade" value={estado_mental?.humor_intensidade} fieldPath="d_estado_mental.humor_intensidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Variabilidade" value={estado_mental?.humor_variabilidade} fieldPath="d_estado_mental.humor_variabilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Reatividade" value={estado_mental?.humor_reatividade} fieldPath="d_estado_mental.humor_reatividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Padrão Diurno" value={estado_mental?.humor_diurno} fieldPath="d_estado_mental.humor_diurno" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Expressão do Afeto" value={estado_mental?.afeto_expressao} fieldPath="d_estado_mental.afeto_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Congruência do Afeto" value={estado_mental?.afeto_congruencia} fieldPath="d_estado_mental.afeto_congruencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Modulação do Afeto" value={estado_mental?.afeto_modulacao} fieldPath="d_estado_mental.afeto_modulacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ansiedade</h4>
            <DataField label="Nível" value={estado_mental?.ansiedade_nivel} fieldPath="d_estado_mental.ansiedade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tipo Predominante" value={estado_mental?.ansiedade_tipo_predominante} fieldPath="d_estado_mental.ansiedade_tipo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Manifestações Físicas" value={estado_mental?.ansiedade_manifestacoes_fisicas} fieldPath="d_estado_mental.ansiedade_manifestacoes_fisicas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Manifestações Cognitivas" value={estado_mental?.ansiedade_manifestacoes_cognitivas} fieldPath="d_estado_mental.ansiedade_manifestacoes_cognitivas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score GAD-7 Estimado" value={estado_mental?.ansiedade_score_gad7_estimado} fieldPath="d_estado_mental.ansiedade_score_gad7_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>PHQ-9 (Depressão)</h4>
            <DataField label="Humor Deprimido" value={estado_mental?.phq9_humor_deprimido} fieldPath="d_estado_mental.phq9_humor_deprimido" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Anedonia" value={estado_mental?.phq9_anedonia} fieldPath="d_estado_mental.phq9_anedonia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Alteração de Apetite" value={estado_mental?.phq9_alteracao_apetite} fieldPath="d_estado_mental.phq9_alteracao_apetite" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Alteração de Sono" value={estado_mental?.phq9_alteracao_sono} fieldPath="d_estado_mental.phq9_alteracao_sono" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fadiga" value={estado_mental?.phq9_fadiga} fieldPath="d_estado_mental.phq9_fadiga" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Culpa/Inutilidade" value={estado_mental?.phq9_culpa_inutilidade} fieldPath="d_estado_mental.phq9_culpa_inutilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Dificuldade de Concentração" value={estado_mental?.phq9_dificuldade_concentracao} fieldPath="d_estado_mental.phq9_dificuldade_concentracao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Agitação/Retardo" value={estado_mental?.phq9_agitacao_retardo} fieldPath="d_estado_mental.phq9_agitacao_retardo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Pensamentos de Morte/Suicídio" value={estado_mental?.phq9_pensamentos_morte_suicidio} fieldPath="d_estado_mental.phq9_pensamentos_morte_suicidio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score PHQ-9 Estimado" value={estado_mental?.phq9_score_estimado} fieldPath="d_estado_mental.phq9_score_estimado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Irritabilidade</h4>
            <DataField label="Nível" value={estado_mental?.irritabilidade_nivel} fieldPath="d_estado_mental.irritabilidade_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Frequência" value={estado_mental?.irritabilidade_frequencia} fieldPath="d_estado_mental.irritabilidade_frequencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Gatilhos" value={estado_mental?.irritabilidade_gatilhos} fieldPath="d_estado_mental.irritabilidade_gatilhos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Expressão" value={estado_mental?.irritabilidade_expressao} fieldPath="d_estado_mental.irritabilidade_expressao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Controle" value={estado_mental?.irritabilidade_controle} fieldPath="d_estado_mental.irritabilidade_controle" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Autoestima e Autopercepção</h4>
            <DataField label="Autoestima Global" value={estado_mental?.autoestima_global} fieldPath="d_estado_mental.autoestima_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Autopercepção" value={estado_mental?.autopercepcao} fieldPath="d_estado_mental.autopercepcao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Autoimagem Corporal" value={estado_mental?.autoimagem_corporal} fieldPath="d_estado_mental.autoimagem_corporal" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Autoeficácia" value={estado_mental?.autoeficacia} fieldPath="d_estado_mental.autoeficacia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Autocompaixão" value={estado_mental?.autocompaixao} fieldPath="d_estado_mental.autocompaixao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pensamento</h4>
            <DataField label="Conteúdo Predominante" value={estado_mental?.pensamento_conteudo_predominante} fieldPath="d_estado_mental.pensamento_conteudo_predominante" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Processo" value={estado_mental?.pensamento_processo} fieldPath="d_estado_mental.pensamento_processo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Velocidade" value={estado_mental?.pensamento_velocidade} fieldPath="d_estado_mental.pensamento_velocidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Distorções Cognitivas (Beck)" value={estado_mental?.distorcoes_cognitivas_beck} fieldPath="d_estado_mental.distorcoes_cognitivas_beck" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Regulação Emocional</h4>
            <DataField label="Estratégias Atuais" value={estado_mental?.reg_estrategias_atuais} fieldPath="d_estado_mental.reg_estrategias_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Efetividade" value={estado_mental?.reg_efetividade} fieldPath="d_estado_mental.reg_efetividade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Flexibilidade" value={estado_mental?.reg_flexibilidade} fieldPath="d_estado_mental.reg_flexibilidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Motivação</h4>
            <DataField label="Nível Geral" value={estado_mental?.motiv_nivel_geral} fieldPath="d_estado_mental.motiv_nivel_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tipo" value={estado_mental?.motiv_tipo} fieldPath="d_estado_mental.motiv_tipo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Iniciativa" value={estado_mental?.motiv_iniciativa} fieldPath="d_estado_mental.motiv_iniciativa" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Persistência" value={estado_mental?.motiv_persistencia} fieldPath="d_estado_mental.motiv_persistencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Procrastinação" value={estado_mental?.motiv_procrastinacao} fieldPath="d_estado_mental.motiv_procrastinacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Perspectiva Temporal</h4>
            <DataField label="Passado" value={estado_mental?.tempo_passado} fieldPath="d_estado_mental.tempo_passado" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Presente" value={estado_mental?.tempo_presente} fieldPath="d_estado_mental.tempo_presente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Futuro" value={estado_mental?.tempo_futuro} fieldPath="d_estado_mental.tempo_futuro" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Risco de Suicídio</h4>
            <DataField label="Nível de Risco" value={estado_mental?.risco_nivel} fieldPath="d_estado_mental.risco_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ideação" value={estado_mental?.risco_ideacao} fieldPath="d_estado_mental.risco_ideacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intenção" value={estado_mental?.risco_intencao} fieldPath="d_estado_mental.risco_intencao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Plano" value={estado_mental?.risco_plano} fieldPath="d_estado_mental.risco_plano" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Comportamento Recente" value={estado_mental?.risco_comportamento_recente} fieldPath="d_estado_mental.risco_comportamento_recente" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tentativas Prévias" value={estado_mental?.risco_tentativas_previas} fieldPath="d_estado_mental.risco_tentativas_previas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fatores de Risco" value={estado_mental?.risco_fatores_risco} fieldPath="d_estado_mental.risco_fatores_risco" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fatores de Proteção" value={estado_mental?.risco_fatores_protecao} fieldPath="d_estado_mental.risco_fatores_protecao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ação Requerida" value={estado_mental?.risco_acao_requerida} fieldPath="d_estado_mental.risco_acao_requerida" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Diagnósticos e Intervenções</h4>
            <DataField label="Diagnósticos Mentais DSM-5 Sugeridos" value={estado_mental?.diagnosticos_mentais_dsm5_sugeridos} fieldPath="d_estado_mental.diagnosticos_mentais_dsm5_sugeridos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intervenção: Psicoterapia" value={estado_mental?.intervencao_psicoterapia} fieldPath="d_estado_mental.intervencao_psicoterapia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Frequência Inicial" value={estado_mental?.intervencao_frequencia_inicial} fieldPath="d_estado_mental.intervencao_frequencia_inicial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intervenção: Psiquiatria" value={estado_mental?.intervencao_psiquiatria} fieldPath="d_estado_mental.intervencao_psiquiatria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Grupos de Apoio" value={estado_mental?.intervencao_grupos_apoio} fieldPath="d_estado_mental.intervencao_grupos_apoio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Técnicas Complementares" value={estado_mental?.intervencao_tecnicas_complementares} fieldPath="d_estado_mental.intervencao_tecnicas_complementares" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== ESTADO FISIOLÓGICO ==================== */}
      {shouldShowSection('4. Estado Fisiológico (Resumo - devido ao volume de campos)') && (
        <CollapsibleSection title="4. Estado Fisiológico (Resumo - devido ao volume de campos)" defaultOpen={activeTab === 'Estado Fisiológico' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>Sistema Endócrino - Tireoide</h4>
            <DataField label="Status" value={estado_fisiologico?.end_tireo_status} fieldPath="d_estado_fisiologico.end_tireo_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Diagnóstico" value={estado_fisiologico?.end_tireo_diagnostico} fieldPath="d_estado_fisiologico.end_tireo_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_tireo_acao_terapeutica} fieldPath="d_estado_fisiologico.end_tireo_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Endócrino - Insulina/Glicose</h4>
            <DataField label="Status" value={estado_fisiologico?.end_insgl_status} fieldPath="d_estado_fisiologico.end_insgl_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Diagnóstico" value={estado_fisiologico?.end_insgl_diagnostico} fieldPath="d_estado_fisiologico.end_insgl_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ação Terapêutica" value={estado_fisiologico?.end_insgl_acao_terapeutica} fieldPath="d_estado_fisiologico.end_insgl_acao_terapeutica" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Gastrointestinal - Intestino</h4>
            <DataField label="Status" value={estado_fisiologico?.gi_int_status} fieldPath="d_estado_fisiologico.gi_int_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Diagnóstico" value={estado_fisiologico?.gi_int_diagnostico} fieldPath="d_estado_fisiologico.gi_int_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ação Prioritária" value={estado_fisiologico?.gi_int_acao_prioritaria} fieldPath="d_estado_fisiologico.gi_int_acao_prioritaria" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Sistema Cardiovascular</h4>
            <DataField label="Status" value={estado_fisiologico?.cv_status} fieldPath="d_estado_fisiologico.cv_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Pressão Arterial" value={estado_fisiologico?.cv_pressao_arterial} fieldPath="d_estado_fisiologico.cv_pressao_arterial" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Ação" value={estado_fisiologico?.cv_acao} fieldPath="d_estado_fisiologico.cv_acao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Inflamação e Estresse Oxidativo</h4>
            <DataField label="Nível de Inflamação Sistêmica" value={estado_fisiologico?.infl_sist_nivel} fieldPath="d_estado_fisiologico.infl_sist_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Causas" value={estado_fisiologico?.infl_sist_causas} fieldPath="d_estado_fisiologico.infl_sist_causas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Nível de Estresse Oxidativo" value={estado_fisiologico?.oxi_nivel} fieldPath="d_estado_fisiologico.oxi_nivel" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Exames Necessários</h4>
            <DataField label="Urgente (0-15 dias)" value={estado_fisiologico?.exames_urgente_0_15_dias} fieldPath="d_estado_fisiologico.exames_urgente_0_15_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Alta Prioridade (30 dias)" value={estado_fisiologico?.exames_alta_prioridade_30_dias} fieldPath="d_estado_fisiologico.exames_alta_prioridade_30_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Média Prioridade (60-90 dias)" value={estado_fisiologico?.exames_media_prioridade_60_90_dias} fieldPath="d_estado_fisiologico.exames_media_prioridade_60_90_dias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== INTEGRAÇÃO DIAGNÓSTICA ==================== */}
      {shouldShowSection('5. Integração Diagnóstica') && (
        <CollapsibleSection title="5. Integração Diagnóstica" defaultOpen={activeTab === 'Integração Diagnóstica' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>Diagnóstico Integrado</h4>
            <DataField label="Título do Diagnóstico" value={integracao_diagnostica?.diagnostico_titulo} fieldPath="d_agente_integracao_diagnostica.diagnostico_titulo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="CID Primário" value={integracao_diagnostica?.diagnostico_cid_primario} fieldPath="d_agente_integracao_diagnostica.diagnostico_cid_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="CIDs Associados" value={integracao_diagnostica?.diagnostico_cids_associados} fieldPath="d_agente_integracao_diagnostica.diagnostico_cids_associados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Síntese Executiva" value={integracao_diagnostica?.diagnostico_sintese_executiva} fieldPath="d_agente_integracao_diagnostica.diagnostico_sintese_executiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Metáfora da Casa (Fundação, Colunas, Cumeeira)</h4>
            <DataField label="Fundação - Status" value={integracao_diagnostica?.fundacao_status} fieldPath="d_agente_integracao_diagnostica.fundacao_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fundação - Eventos" value={integracao_diagnostica?.fundacao_eventos} fieldPath="d_agente_integracao_diagnostica.fundacao_eventos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Colunas - Status" value={integracao_diagnostica?.colunas_status} fieldPath="d_agente_integracao_diagnostica.colunas_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Cumeeira - Status" value={integracao_diagnostica?.cumeeira_status} fieldPath="d_agente_integracao_diagnostica.cumeeira_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Colapso - Status" value={integracao_diagnostica?.colapso_status} fieldPath="d_agente_integracao_diagnostica.colapso_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Diagnósticos Específicos</h4>
            <DataField label="Biológico Primário" value={integracao_diagnostica?.diagnostico_biologico_primario} fieldPath="d_agente_integracao_diagnostica.diagnostico_biologico_primario" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Psicológico DSM-5" value={integracao_diagnostica?.diagnostico_psicologico_dsm5} fieldPath="d_agente_integracao_diagnostica.diagnostico_psicologico_dsm5" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Psicossomático - Interpretação" value={integracao_diagnostica?.diagnostico_psicossomatico_interpretacao} fieldPath="d_agente_integracao_diagnostica.diagnostico_psicossomatico_interpretacao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Biopsicossocial</h4>
            <DataField label="Biológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_biologico} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_biologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Psicológico" value={integracao_diagnostica?.diagnostico_biopsicossocial_psicologico} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_psicologico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Social" value={integracao_diagnostica?.diagnostico_biopsicossocial_social} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_social" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Espiritual" value={integracao_diagnostica?.diagnostico_biopsicossocial_espiritual} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_espiritual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Conclusão" value={integracao_diagnostica?.diagnostico_biopsicossocial_conclusao} fieldPath="d_agente_integracao_diagnostica.diagnostico_biopsicossocial_conclusao" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Janela Terapêutica</h4>
            <DataField label="Status" value={integracao_diagnostica?.janela_terapeutica_status} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Tempo Crítico" value={integracao_diagnostica?.janela_terapeutica_tempo_critico} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_tempo_critico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Urgência" value={integracao_diagnostica?.janela_terapeutica_urgencia} fieldPath="d_agente_integracao_diagnostica.janela_terapeutica_urgencia" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Prognóstico</h4>
            <DataField label="Sem Intervenção - 3 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_3m} fieldPath="d_agente_integracao_diagnostica.prognostico_sem_intervencao_3m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Sem Intervenção - 12 meses" value={integracao_diagnostica?.prognostico_sem_intervencao_12m} fieldPath="d_agente_integracao_diagnostica.prognostico_sem_intervencao_12m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Com Intervenção - 1 mês" value={integracao_diagnostica?.prognostico_com_intervencao_1m} fieldPath="d_agente_integracao_diagnostica.prognostico_com_intervencao_1m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Com Intervenção - 6 meses" value={integracao_diagnostica?.prognostico_com_intervencao_6m} fieldPath="d_agente_integracao_diagnostica.prognostico_com_intervencao_6m" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fatores de Sucesso" value={integracao_diagnostica?.prognostico_fatores_sucesso} fieldPath="d_agente_integracao_diagnostica.prognostico_fatores_sucesso" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Estratégia Terapêutica por Fases</h4>
            <DataField label="Fase 1 - Objetivo" value={integracao_diagnostica?.fase1_objetivo} fieldPath="d_agente_integracao_diagnostica.fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fase 1 - Ações Específicas" value={integracao_diagnostica?.fase1_acoes_especificas} fieldPath="d_agente_integracao_diagnostica.fase1_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fase 2 - Objetivo" value={integracao_diagnostica?.fase2_objetivo} fieldPath="d_agente_integracao_diagnostica.fase2_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fase 2 - Ações Específicas" value={integracao_diagnostica?.fase2_acoes_especificas} fieldPath="d_agente_integracao_diagnostica.fase2_acoes_especificas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fase 3 - Objetivo" value={integracao_diagnostica?.fase3_objetivo} fieldPath="d_agente_integracao_diagnostica.fase3_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fase 4 - Objetivo" value={integracao_diagnostica?.fase4_objetivo} fieldPath="d_agente_integracao_diagnostica.fase4_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Equipe Multiprofissional</h4>
            <DataField label="Core (Obrigatórios)" value={integracao_diagnostica?.equipe_core_obrigatorios} fieldPath="d_agente_integracao_diagnostica.equipe_core_obrigatorios" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Suporte (Importantes)" value={integracao_diagnostica?.equipe_suporte_importantes} fieldPath="d_agente_integracao_diagnostica.equipe_suporte_importantes" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Complementares" value={integracao_diagnostica?.equipe_complementares_potencializadores} fieldPath="d_agente_integracao_diagnostica.equipe_complementares_potencializadores" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Observações Importantes</h4>
            <DataField label="Contradições e Paradoxos" value={integracao_diagnostica?.contradicoes_paradoxos} fieldPath="d_agente_integracao_diagnostica.contradicoes_paradoxos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Principais Bloqueios para Cura" value={integracao_diagnostica?.principais_bloqueios_para_cura} fieldPath="d_agente_integracao_diagnostica.principais_bloqueios_para_cura" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Chaves Terapêuticas Prioritárias" value={integracao_diagnostica?.chaves_terapeuticas_prioritarias} fieldPath="d_agente_integracao_diagnostica.chaves_terapeuticas_prioritarias" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Alertas Críticos da Equipe" value={integracao_diagnostica?.alertas_equipe_criticos} fieldPath="d_agente_integracao_diagnostica.alertas_equipe_criticos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Nível de Confiança no Diagnóstico" value={integracao_diagnostica?.nivel_confianca_diagnostico} fieldPath="d_agente_integracao_diagnostica.nivel_confianca_diagnostico" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}

      {/* ==================== HÁBITOS DE VIDA ==================== */}
      {shouldShowSection('6. Hábitos de Vida (Resumo dos 5 Pilares)') && (
        <CollapsibleSection title="6. Hábitos de Vida (Resumo dos 5 Pilares)" defaultOpen={activeTab === 'Hábitos de Vida' || !activeTab}>
          <div className="anamnese-subsection">
            <h4>Pilar 1 - Alimentação</h4>
            <DataField label="Status Global" value={habitos_vida?.pilar1_alimentacao_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score de Qualidade" value={habitos_vida?.pilar1_alimentacao_score_qualidade} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_score_qualidade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Problemas Identificados" value={habitos_vida?.pilar1_alimentacao_problemas_identificados} fieldPath="d_agente_habitos_vida_sistemica.pilar1_alimentacao_problemas_identificados" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intervenção Requerida" value={habitos_vida?.pilar1_intervencao_requerida_nutricional} fieldPath="d_agente_habitos_vida_sistemica.pilar1_intervencao_requerida_nutricional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pilar 2 - Atividade Física</h4>
            <DataField label="Status Global" value={habitos_vida?.pilar2_atividade_fisica_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar2_atividade_fisica_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={habitos_vida?.pilar2_atividade_fisica_score} fieldPath="d_agente_habitos_vida_sistemica.pilar2_atividade_fisica_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Padrão de Prática" value={habitos_vida?.pilar2_padrao_pratica_exercicio} fieldPath="d_agente_habitos_vida_sistemica.pilar2_padrao_pratica_exercicio" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Prescrição Fase 1" value={habitos_vida?.pilar2_prescricao_fase1_objetivo} fieldPath="d_agente_habitos_vida_sistemica.pilar2_prescricao_fase1_objetivo" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pilar 3 - Sono</h4>
            <DataField label="Status Global" value={habitos_vida?.pilar3_sono_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar3_sono_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={habitos_vida?.pilar3_sono_score} fieldPath="d_agente_habitos_vida_sistemica.pilar3_sono_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Qualidade Subjetiva" value={habitos_vida?.pilar3_padrao_qualidade_subjetiva} fieldPath="d_agente_habitos_vida_sistemica.pilar3_padrao_qualidade_subjetiva" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Intervenção Prioridade" value={habitos_vida?.pilar3_intervencao_prioridade} fieldPath="d_agente_habitos_vida_sistemica.pilar3_intervencao_prioridade" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pilar 4 - Gestão de Stress</h4>
            <DataField label="Status Global" value={habitos_vida?.pilar4_stress_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={habitos_vida?.pilar4_stress_score} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Nível Atual" value={habitos_vida?.pilar4_stress_nivel_atual} fieldPath="d_agente_habitos_vida_sistemica.pilar4_stress_nivel_atual" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Fontes de Stress" value={habitos_vida?.pilar4_fontes_stress_profissional} fieldPath="d_agente_habitos_vida_sistemica.pilar4_fontes_stress_profissional" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Pilar 5 - Espiritualidade</h4>
            <DataField label="Status Global" value={habitos_vida?.pilar5_espiritualidade_status_global} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_status_global" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Score" value={habitos_vida?.pilar5_espiritualidade_score} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_score" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Práticas Atuais" value={habitos_vida?.pilar5_espiritualidade_praticas_atuais} fieldPath="d_agente_habitos_vida_sistemica.pilar5_espiritualidade_praticas_atuais" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Ritmo Circadiano</h4>
            <DataField label="Status" value={habitos_vida?.ritmo_circadiano_status} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_status" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Problemas" value={habitos_vida?.ritmo_circadiano_problemas} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_problemas" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Impacto" value={habitos_vida?.ritmo_circadiano_impacto} fieldPath="d_agente_habitos_vida_sistemica.ritmo_circadiano_impacto" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>

          <div className="anamnese-subsection">
            <h4>Resumo e Prioridades</h4>
            <DataField label="Score Geral de Hábitos de Vida" value={habitos_vida?.score_habitos_vida_geral} fieldPath="d_agente_habitos_vida_sistemica.score_habitos_vida_geral" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
            <DataField label="Prioridades de Intervenção" value={habitos_vida?.prioridades_intervencao_habitos} fieldPath="d_agente_habitos_vida_sistemica.prioridades_intervencao_habitos" consultaId={consultaId} onSave={handleSaveField} onAIEdit={handleAIEdit} />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// Interface para Higiene e Sono
interface HigieneSono {
  horario_dormir_recomendado: string;
  horario_acordar_recomendado: string;
  duracao_alvo: string;
  janela_sono_semana: string;
  janela_sono_fds: string;
  consistencia_horario: string;
  rotina_pre_sono: string[];
  gatilhos_evitar: string[];
  progressao_ajuste: string;
  observacoes_clinicas: string;
}

// Interface para Padrão Mental/Emocional
interface OrientacaoTransformacao {
  nome: string;
  passo: number;
  como_fazer: string;
  o_que_fazer: string;
  porque_funciona: string;
}

interface PadraoItem {
  padrao: string;
  categorias: string[];
  prioridade: number;
  areas_impacto: string[];
  origem_estimada: {
    periodo: string;
    contexto_provavel: string;
  };
  conexoes_padroes: {
    raiz_de: string[];
    explicacao: string;
    alimentado_por: string[];
    relacionado_com: string[];
  };
  manifestacoes_atuais: string[];
  orientacoes_transformacao: OrientacaoTransformacao[];
}

// Componente da seção de Solução Livro da Vida
function MentalidadeSection({
  consultaId,
  selectedField,
  chatMessages,
  isTyping,
  chatInput,
  onFieldSelect,
  onSendMessage,
  onChatInputChange
}: {
  consultaId: string;
  selectedField: { fieldPath: string; label: string } | null;
  chatMessages: ChatMessage[];
  isTyping: boolean;
  chatInput: string;
  onFieldSelect: (fieldPath: string, label: string) => void;
  onSendMessage: () => void;
  onChatInputChange: (value: string) => void;
}) {
  const { showError } = useNotifications();

  // Estados para carregamento dinâmico
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados ao montar o componente
  useEffect(() => {
    loadMentalidadeData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadMentalidadeData();
    };

    window.addEventListener('mentalidade-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('mentalidade-data-refresh', handleRefresh);
    };
  }, []);

  const loadMentalidadeData = async () => {
    try {
      setLoadingDetails(true);
      setError(null);

      console.log('🔍 [FRONTEND-LTV] Carregando dados de mentalidade para consulta:', consultaId);

      const response = await gatewayClient.get(`/solucao-mentalidade/${consultaId}`);

      console.log('📡 [FRONTEND-LTV] Response status:', response.status);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar dados de mentalidade');
      }

      const data = response;
      console.log('✅ [FRONTEND-LTV] Dados recebidos:', data);

      if (data.mentalidade_data) {
        setLivroVidaData({
          resumo_executivo: data.mentalidade_data.resumo_executivo || '',
          higiene_sono: data.mentalidade_data.higiene_sono || mockData.higiene_sono,
          padrao_01: data.mentalidade_data.padrao_01 || null,
          padrao_02: data.mentalidade_data.padrao_02 || null,
          padrao_03: data.mentalidade_data.padrao_03 || null,
          padrao_04: data.mentalidade_data.padrao_04 || null,
          padrao_05: data.mentalidade_data.padrao_05 || null,
          padrao_06: data.mentalidade_data.padrao_06 || null,
          padrao_07: data.mentalidade_data.padrao_07 || null,
          padrao_08: data.mentalidade_data.padrao_08 || null,
          padrao_09: data.mentalidade_data.padrao_09 || null,
          padrao_10: data.mentalidade_data.padrao_10 || null
        });
      }
      setLoading(false);
    } catch (err) {
      console.error('❌ [FRONTEND-LTV] Erro ao carregar mentalidade:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar mentalidade');
      setLoading(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Dados mockados como fallback (mantido para compatibilidade)
  const mockData: any = {
    resumo_executivo: "Lucas, após análise profunda de sua trajetória, foram identificados 8 padrões mentais, emocionais e relacionais centrais que mantêm seu quadro de fadiga crônica, autocrítica severa e dificuldade de avançar para uma vida plena. Os padrões raiz principais são: 'Crença de Inadequação Pessoal (Não sou suficiente)', 'Padrão de Hiperalerta/Vigília Crônica', 'Autocrítica Severa e Perfeccionismo', e 'Procrastinação Autoprotetora'. Estes padrões, originados em experiências gestacionais e familiares marcadas por insegurança e conflito, desencadeiam sentimentos de fracasso, insegurança existencial e bloqueios ao prazer e à autocompaixão.\n\nA boa notícia é que, com empenho genuíno e aplicação consistente das orientações integradas aqui propostas, é plenamente possível reverter este ciclo e construir uma Nova Vida Extraordinária. Transformar padrões tão antigos exige coragem, método e perseverança, mas cada passo dado na direção certa gera efeito dominó positivo em múltiplas áreas da sua vida. O caminho é profundo, mas absolutamente viável: você não está preso ao seu passado, e sim pronto para ressignificá-lo. Com a sequência estratégica sugerida, a restauração da energia vital, do prazer e do sentido de viver será não apenas possível, mas provável.",
    higiene_sono: {
      horario_dormir_recomendado: "23:00",
      horario_acordar_recomendado: "07:00",
      duracao_alvo: "8h",
      janela_sono_semana: "23:00-07:00",
      janela_sono_fds: "23:00-07:00",
      consistencia_horario: "Variação máxima ±30min entre semana e fins de semana",
      rotina_pre_sono: [
        "22:00 - Desligar telas e luz branca",
        "22:20 - Banho morno ou técnica respiratória/mindfulness",
        "22:40 - Leitura leve com luz tênue",
        "23:00 - Deitar no horário combinado"
      ],
      gatilhos_evitar: [
        "Cafeína após 16h",
        "Exercício intenso noturno (após 20h)",
        "Telas ou reuniões após 21h",
        "Refeições pesadas após 20h"
      ],
      progressao_ajuste: "Reduzir horário de dormir 15 minutos a cada 3 dias até atingir 23:00 sem perda do despertar fixo às 07:00.",
      observacoes_clinicas: "Sono cronicamente curto e superficial, mente ativa e jet-lag social moderado (>1h2min). Prioridade máxima para saúde neurocognitiva e metabólica. Impacto de olheiras, fadiga e desempenho oscilante exige ajuste imediato na rotina."
    },
    padrao_01: {
      padrao: "Crença de Inadequação Pessoal ('Não sou suficiente')",
      categorias: ["crença_limitante"],
      prioridade: 1,
      areas_impacto: ["autoestima", "identidade", "bem_estar_emocional", "relacionamentos", "carreira", "propósito", "qualidade_vida"],
      origem_estimada: {
        periodo: "Gestação e Primeira Infância (0-7 anos)",
        contexto_provavel: "Possivelmente desenvolvida durante a gestação e primeiros anos de vida, em ambiente marcado por insegurança materna, amargura e conflitos conjugais. A internalização do estado de alerta e a ausência de validação emocional materna podem ter gerado uma autoimagem de insuficiência e desvalor. Originalmente, esse padrão serviu como tentativa de garantir amor e aceitação pela performance e vigilância. Tornou-se limitante ao bloquear a autoconfiança e alimentar ciclos de autossabotagem e perfeccionismo."
      },
      conexoes_padroes: {
        raiz_de: ["Autocrítica Severa e Perfeccionismo", "Procrastinação Autoprotetora", "Medo de Fracasso e Desesperança", "Bloqueio à Autocompaixão", "Desconexão de Propósito e Prazer"],
        explicacao: "A crença de inadequação pessoal é alimentada pelo estado crônico de hiperalerta, que reforça a sensação de nunca ser suficiente. Ela é raiz de padrões como autocrítica, perfeccionismo, procrastinação, medo de fracasso e bloqueio ao prazer, pois a percepção central de insuficiência gera necessidade constante de provar valor e evita o risco de exposição ao erro. Relaciona-se com a crença de que só é seguro ser aceito mediante desempenho (segurança condicional).",
        alimentado_por: ["Padrão de Hiperalerta/Vigília Crônica"],
        relacionado_com: ["Padrão de Segurança Condicional"]
      },
      manifestacoes_atuais: [
        "Pensamento recorrente: 'Não sou suficiente, não estou me esforçando o bastante'",
        "Dificuldade de aceitar elogios, desqualificando conquistas",
        "Sensação crônica de fracasso ao não cumprir metas diárias",
        "Medo intenso de depender dos pais, visto como fracasso existencial",
        "Evita iniciar projetos por antecipar que não será capaz",
        "Vincula valor pessoal a desempenho e produtividade"
      ],
      orientacoes_transformacao: [
        {
          nome: "Consciência e Mapeamento dos Pensamentos de Inadequação",
          passo: 1,
          como_fazer: "Mantenha um caderno ao lado da cama e anote, ao acordar e ao longo do dia, situações que despertam o pensamento 'não sou suficiente'. Escreva a situação, o pensamento exato e a emoção sentida (escala 0-10). Não tente mudar nada ainda, apenas observe e documente. Repita diariamente para mapear padrões de gatilho.",
          o_que_fazer: "Registrar, durante 7 dias, cada vez que pensamentos de insuficiência ou autodepreciação surgirem.",
          porque_funciona: "Tornar consciente o padrão automático ativa o córtex pré-frontal, interrompendo o ciclo inconsciente de autossabotagem. Segundo a TCC e neuroplasticidade, o primeiro passo para mudar uma crença é identificá-la em tempo real, criando distanciamento e possibilidade de escolha."
        },
        {
          nome: "Questionamento Socrático e Desafio com Evidências",
          passo: 2,
          como_fazer: "Para cada pensamento de insuficiência registrado, responda: (1) Qual a evidência real de que sou insuficiente? (2) Que exemplos concretos tenho de competência/superação? (3) Como eu falaria com um amigo nessa situação? (4) O que mudou desde a infância? Escreva as respostas e releia diariamente.",
          o_que_fazer: "Desafiar ativamente a crença de insuficiência usando perguntas estruturadas.",
          porque_funciona: "O questionamento socrático, base da TCC, ajuda a enfraquecer crenças disfuncionais ao confrontar distorções cognitivas, promovendo reestruturação neural e maior autoconfiança."
        }
      ]
    },
    padrao_02: {
      padrao: "Padrão de Hiperalerta/Vigília Crônica",
      categorias: ["padrão_mental_negativo", "trauma_não_processado"],
      prioridade: 2,
      areas_impacto: ["saúde_física", "saúde_mental", "bem_estar_emocional", "autoestima", "relacionamentos", "qualidade_vida"],
      origem_estimada: {
        periodo: "Gestação e Primeira Infância (0-7 anos)",
        contexto_provavel: "Provavelmente instalado intrauterinamente, devido ao estado de alerta, amargura e insegurança materna gerados pela infidelidade paterna. O padrão foi reforçado por um lar tenso, onde emoções negativas eram projetadas nos filhos. Inicialmente, serviu para proteger Lucas de sentir-se vulnerável ou exposto a traições e ameaças. Tornou-se limitante ao impedir relaxamento, prazer e recuperação energética, cristalizando-se em insônia, fadiga e sensação de ameaça constante."
      },
      conexoes_padroes: {
        raiz_de: ["Crença de Inadequação Pessoal ('Não sou suficiente')", "Autocrítica Severa e Perfeccionismo", "Procrastinação Autoprotetora", "Medo de Fracasso e Desesperança"],
        explicacao: "O hiperalerta é a base fisiológica e emocional que alimenta a crença de insuficiência, pois mantém o sistema nervoso em estado de ameaça, dificultando o descanso e a autopercepção positiva. Ele gera fadiga, insônia e impede a restauração do prazer, alimentando autocrítica e procrastinação. Relaciona-se com o bloqueio à autocompaixão, pois dificulta o relaxamento necessário para o autocuidado.",
        alimentado_por: [],
        relacionado_com: ["Bloqueio à Autocompaixão"]
      },
      manifestacoes_atuais: [
        "Sono superficial e não restaurador, sensação de fadiga ao acordar",
        "Dificuldade de relaxar mesmo fora de situações de risco",
        "Tensão corporal persistente (ombros, mandíbula, peito)",
        "Pensamentos de vigilância: 'Preciso estar sempre alerta para não ser pego de surpresa'",
        "Sensação de perigo iminente ao tentar relaxar ou se permitir prazer",
        "Dificuldade de confiar em processos de descanso e recuperação"
      ],
      orientacoes_transformacao: [
        {
          nome: "Reconhecimento do Estado de Alerta",
          passo: 1,
          como_fazer: "Ao acordar e em momentos de tensão, pause e observe: onde está a tensão no corpo? Que pensamentos surgem? Nomeie: 'Estou em estado de alerta'. Anote no caderno e observe padrões de ativação. Repita 3-4 vezes ao dia.",
          o_que_fazer: "Identificar e nomear o estado de hiperalerta no corpo e na mente ao longo do dia.",
          porque_funciona: "A autoconsciência corporal e emocional é o primeiro passo para regular o sistema nervoso. A nomeação ativa o córtex pré-frontal, reduzindo a dominância do sistema límbico e preparando para intervenções de regulação."
        }
      ]
    },
    padrao_03: null,
    padrao_04: null,
    padrao_05: null,
    padrao_06: null,
    padrao_07: null,
    padrao_08: null,
    padrao_09: null,
    padrao_10: null
  };

  // Parsear os dados mockados - os padrões 03-08 vêm do JSON fornecido
  const parsePadrao = (jsonString: string | null): PadraoItem | null => {
    if (!jsonString) return null;
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) as PadraoItem : jsonString;
    } catch {
      return null;
    }
  };

  // Dados parseados dos padrões 03-08 do exemplo fornecido
  const padrao03Data = parsePadrao("{\"padrao\": \"Autocrítica Severa e Perfeccionismo\", \"categorias\": [\"padrão_mental_negativo\", \"padrão_emocional\"], \"prioridade\": 3, \"areas_impacto\": [\"autoestima\", \"saúde_mental\", \"carreira\", \"relacionamentos\", \"bem_estar_emocional\", \"qualidade_vida\"], \"origem_estimada\": {\"periodo\": \"Infância e Adolescência (5-18 anos)\", \"contexto_provavel\": \"Provavelmente reforçado pela convivência com uma mãe crítica, insatisfeita e controladora, e por um ambiente familiar onde o amor parecia condicional ao desempenho. Originalmente, a autocrítica e o perfeccionismo serviram para evitar críticas externas e conquistar aceitação. Tornaram-se limitantes ao gerar paralisia, procrastinação e sofrimento emocional intenso.\"}, \"conexoes_padroes\": {\"raiz_de\": [\"Procrastinação Autoprotetora\", \"Bloqueio à Autocompaixão\"], \"explicacao\": \"A autocrítica e o perfeccionismo são consequências diretas da crença de insuficiência e do hiperalerta, pois buscam garantir segurança por meio do controle absoluto. Eles alimentam a procrastinação (medo de errar paralisa) e bloqueiam a autocompaixão (autoexigência impede acolhimento). Relacionam-se com o medo de fracasso, pois o erro é visto como ameaça existencial.\", \"alimentado_por\": [\"Crença de Inadequação Pessoal ('Não sou suficiente')\", \"Padrão de Hiperalerta/Vigília Crônica\"], \"relacionado_com\": [\"Medo de Fracasso e Desesperança\"]}, \"manifestacoes_atuais\": [\"Diálogo interno brutal: 'Você é um fracasso', 'Nunca faz o suficiente'\", \"Revisão obsessiva de tarefas, nunca satisfeito com o resultado\", \"Dificuldade de iniciar projetos por medo de não atingir o ideal\", \"Desqualificação de conquistas ('Foi só sorte, qualquer um faria melhor')\", \"Sentimento de culpa e vergonha ao descansar ou se permitir prazer\", \"Comparação constante com outros, sempre se sentindo abaixo\"], \"orientacoes_transformacao\": [{\"nome\": \"Identificação e Registro da Voz Crítica\", \"passo\": 1, \"como_fazer\": \"Durante 7 dias, sempre que notar autocrítica, escreva a frase exata e o contexto. Exemplo: 'Após errar em tarefa X, pensei: sou incompetente'. Mapeie padrões e horários mais frequentes.\", \"o_que_fazer\": \"Observar e anotar frases autocríticas recorrentes ao longo do dia.\", \"porque_funciona\": \"O registro consciente da voz crítica cria distanciamento e reduz a fusão com o crítico interno, base do trabalho de IFS e CFT.\"}, {\"nome\": \"Diálogo com o Crítico Interno (Cadeira Vazia/IFS)\", \"passo\": 2, \"como_fazer\": \"Sente-se em frente a uma cadeira vazia e imagine que nela está seu crítico interno. Pergunte: 'O que você está tentando proteger em mim?'. Depois, troque de lugar e responda como o crítico. Em seguida, acolha essa parte e proponha uma nova forma de proteção baseada em encorajamento, não ataque.\", \"o_que_fazer\": \"Dialogar ativamente com a parte autocrítica, buscando entender sua intenção e oferecer uma alternativa compassiva.\", \"porque_funciona\": \"O diálogo interno, validado por IFS e Gestalt, permite integrar partes internas e transformar o crítico em aliado, promovendo autocompaixão e redução do perfeccionismo.\"}, {\"nome\": \"Experimentos Comportamentais de 'Bom o Suficiente'\", \"passo\": 3, \"como_fazer\": \"Escolha uma tarefa simples (ex: responder e-mails, arrumar a cama) e faça-a com o objetivo de terminar, não de perfeição. Observe o desconforto e registre o que aconteceu: houve consequências negativas reais? Repita com tarefas progressivamente mais desafiadoras.\", \"o_que_fazer\": \"Executar tarefas intencionalmente sem buscar perfeição, aceitando erros como parte do processo.\", \"porque_funciona\": \"A exposição comportamental, central na TCC, prova ao cérebro que o erro não é fatal, reduzindo o medo de fracasso e flexibilizando padrões rígidos.\"}]}");

  const padrao04Data = parsePadrao("{\"padrao\": \"Procrastinação Autoprotetora\", \"categorias\": [\"padrão_mental_negativo\", \"padrão_emocional\"], \"prioridade\": 4, \"areas_impacto\": [\"carreira\", \"autoestima\", \"saúde_mental\", \"bem_estar_emocional\", \"propósito\", \"qualidade_vida\"], \"origem_estimada\": {\"periodo\": \"Adolescência e Vida Adulta Jovem (14-26 anos)\", \"contexto_provavel\": \"Provavelmente reforçada pela pressão excessiva para desempenho e pelo medo de fracassar ou decepcionar figuras parentais. A procrastinação surgiu como defesa para evitar a dor do fracasso e a autocrítica. Tornou-se limitante ao bloquear a iniciativa e reforçar a sensação de incapacidade e estagnação.\"}, \"conexoes_padroes\": {\"raiz_de\": [\"Medo de Fracasso e Desesperança\"], \"explicacao\": \"A procrastinação é alimentada pela crença de insuficiência e pelo perfeccionismo, pois o medo de errar paralisa a ação. Ela se torna raiz do medo de fracasso, pois quanto mais se posterga, maior a sensação de impotência e desesperança.\", \"alimentado_por\": [\"Crença de Inadequação Pessoal ('Não sou suficiente')\", \"Autocrítica Severa e Perfeccionismo\"], \"relacionado_com\": []}, \"manifestacoes_atuais\": [\"Dificuldade extrema de iniciar tarefas, especialmente pela manhã\", \"Sensação de paralisia ao pensar em metas grandes\", \"Uso de distrações para evitar enfrentar desafios (celular, redes sociais)\", \"Culpa intensa após adiar tarefas importantes\", \"Sensação de tempo perdido e angústia com o 'contador regressivo'\"], \"orientacoes_transformacao\": [{\"nome\": \"Quebra de Tarefas e Microcompromissos\", \"passo\": 1, \"como_fazer\": \"Pegue uma meta (ex: exercício matinal) e divida em passos micro (ex: apenas levantar, vestir roupa de treino, sair do quarto). Estabeleça o compromisso de realizar apenas o primeiro passo por dia. Após cumprir, decida se continua. Registre cada microvitória.\", \"o_que_fazer\": \"Dividir grandes metas em pequenas ações concretas e assumir compromissos mínimos diários.\", \"porque_funciona\": \"A ação mínima reduz a sobrecarga do perfeccionismo e ativa o circuito de recompensa do cérebro, tornando mais provável a continuidade. O método é validado por TCC, ACT e neurociência motivacional.\"}, {\"nome\": \"Ação Comprometida Mesmo com Desconforto (ACT)\", \"passo\": 2, \"como_fazer\": \"Antes de uma tarefa, pergunte: 'Isso está alinhado com quem desejo ser?'. Se sim, dê o primeiro passo, mesmo que pequeno, e observe o desconforto sem tentar eliminá-lo. Anote após: 'O que aprendi ao agir mesmo inseguro?'.\", \"o_que_fazer\": \"Agir apesar da dúvida ou desconforto, focando nos valores pessoais e não no resultado imediato.\", \"porque_funciona\": \"A ACT ensina que a ação orientada por valores, mesmo com medo ou desconforto, amplia a autoconfiança e reduz o domínio da procrastinação sobre a vida.\"}]}");

  const padrao05Data = parsePadrao("{\"padrao\": \"Medo de Fracasso e Desesperança\", \"categorias\": [\"crença_limitante\", \"padrão_mental_negativo\"], \"prioridade\": 5, \"areas_impacto\": [\"autoestima\", \"carreira\", \"propósito\", \"bem_estar_emocional\", \"qualidade_vida\"], \"origem_estimada\": {\"periodo\": \"Infância, Adolescência e Vida Adulta Jovem (5-26 anos)\", \"contexto_provavel\": \"Pode ter se consolidado após experiências repetidas de crítica, frustração de expectativas e internalização da narrativa familiar de que falhar é inaceitável. Inicialmente, serviu como proteção para evitar novas decepções. Tornou-se limitante ao bloquear a iniciativa e gerar sensação de impotência crônica.\"}, \"conexoes_padroes\": {\"raiz_de\": [], \"explicacao\": \"O medo de fracasso é alimentado pela crença de insuficiência e reforçado pela procrastinação. Relaciona-se com a autocrítica e o perfeccionismo, pois cada erro é visto como confirmação da inadequação. Não é raiz de outros padrões, mas perpetua o ciclo de estagnação.\", \"alimentado_por\": [\"Crença de Inadequação Pessoal ('Não sou suficiente')\", \"Procrastinação Autoprotetora\"], \"relacionado_com\": [\"Autocrítica Severa e Perfeccionismo\"]}, \"manifestacoes_atuais\": [\"Ansiedade intensa diante de metas e avaliações\", \"Evitação de desafios por antecipar decepção\", \"Desesperança sobre a possibilidade de mudança\", \"Sensação de que qualquer insucesso é fracasso total\", \"Dificuldade de celebrar avanços, foco no que falta\"], \"orientacoes_transformacao\": [{\"nome\": \"Ressignificação do Fracasso e Exposição Gradual\", \"passo\": 1, \"como_fazer\": \"Escolha tarefas onde o risco de erro é baixo e execute-as sem buscar perfeição. Ao errar, registre o que realmente aconteceu versus o que temia. Dialogue internamente: 'O que posso aprender com isso?'. Repita o processo, aumentando gradualmente a complexidade das tarefas.\", \"o_que_fazer\": \"Redefinir fracasso como parte do processo de crescimento e se expor gradualmente a pequenas falhas seguras.\", \"porque_funciona\": \"A exposição gradual e a ressignificação do erro (TCC, PNL) reduzem o medo paralisante e ensinam o cérebro que falhar não é catastrófico, ampliando a zona de conforto e a resiliência.\"}]}");

  const padrao06Data = parsePadrao("{\"padrao\": \"Bloqueio à Autocompaixão\", \"categorias\": [\"padrão_emocional\"], \"prioridade\": 6, \"areas_impacto\": [\"autoestima\", \"saúde_mental\", \"bem_estar_emocional\", \"relacionamentos\", \"qualidade_vida\"], \"origem_estimada\": {\"periodo\": \"Infância e Adolescência (5-18 anos)\", \"contexto_provavel\": \"Provavelmente desenvolvido em ambiente onde a autocrítica era modelo e o autocuidado visto como fraqueza ou preguiça. Originalmente, serviu para tentar evitar críticas externas e buscar aprovação. Tornou-se limitante ao bloquear o acesso ao acolhimento interno e dificultar o enfrentamento de desafios.\"}, \"conexoes_padroes\": {\"raiz_de\": [], \"explicacao\": \"O bloqueio à autocompaixão é alimentado pela autocrítica e pelo estado de alerta, pois o autocuidado é visto como ameaça à sobrevivência. Relaciona-se com a crença de insuficiência, pois dificulta a aceitação de imperfeições e vulnerabilidades.\", \"alimentado_por\": [\"Autocrítica Severa e Perfeccionismo\", \"Padrão de Hiperalerta/Vigília Crônica\"], \"relacionado_com\": [\"Crença de Inadequação Pessoal ('Não sou suficiente')\"]}, \"manifestacoes_atuais\": [\"Dificuldade de se perdoar por erros e falhas\", \"Incapacidade de acolher emoções difíceis sem julgamento\", \"Sensação de que autocuidado é 'fraqueza'\", \"Autoexigência rígida mesmo em momentos de sofrimento\", \"Resistência a receber apoio ou carinho de outros\"], \"orientacoes_transformacao\": [{\"nome\": \"Prática Estruturada de Autocompaixão\", \"passo\": 1, \"como_fazer\": \"Use áudios de práticas de autocompaixão (Kristin Neff) ou escreva cartas para si mesmo em momentos de sofrimento, usando frases como: 'Está tudo bem não ser perfeito', 'Todos erram, inclusive eu'. Repita diariamente, especialmente após situações de autocrítica.\", \"o_que_fazer\": \"Dedicar diariamente 10 minutos para exercícios guiados de autocompaixão.\", \"porque_funciona\": \"A prática regular de autocompaixão ativa redes cerebrais de autocuidado e reduz a ativação do sistema de ameaça, promovendo maior resiliência emocional e flexibilidade diante de desafios.\"}]}");

  const padrao07Data = parsePadrao("{\"padrao\": \"Padrão de Segurança Condicional ('Preciso ter desempenho para ter segurança')\", \"categorias\": [\"crença_limitante\"], \"prioridade\": 7, \"areas_impacto\": [\"autoestima\", \"identidade\", \"carreira\", \"propósito\", \"bem_estar_emocional\"], \"origem_estimada\": {\"periodo\": \"Infância e Adolescência (5-18 anos)\", \"contexto_provavel\": \"Provavelmente internalizado a partir do modelo familiar onde o valor era condicionado ao desempenho, especialmente na figura paterna como provedor. Serviu para criar uma ilusão de controle e evitar rejeição. Tornou-se limitante ao gerar ansiedade crônica, medo de relaxar e dependência do reconhecimento externo.\"}, \"conexoes_padroes\": {\"raiz_de\": [\"Desconexão de Propósito e Prazer\"], \"explicacao\": \"A crença de segurança condicional reforça a necessidade de desempenho para sentir-se seguro, alimentando a desconexão de propósito e prazer, pois bloqueia a motivação intrínseca. É alimentada pela crença de insuficiência, pois só ao 'provar' valor sente-se digno de segurança.\", \"alimentado_por\": [\"Crença de Inadequação Pessoal ('Não sou suficiente')\"], \"relacionado_com\": []}, \"manifestacoes_atuais\": [\"Sensação de que só merece descanso após atingir metas altas\", \"Ansiedade intensa quando não está produzindo ou performando\", \"Vincula autoestima a resultados externos\", \"Dificuldade de relaxar ou se permitir lazer sem culpa\"], \"orientacoes_transformacao\": [{\"nome\": \"Redefinição de Valor Pessoal e Segurança\", \"passo\": 1, \"como_fazer\": \"Liste 5 momentos em que recebeu carinho, respeito ou apoio apenas por ser quem é, não por resultados. Releia essas situações diariamente e escreva como se sentiu. Reforce a ideia: 'Meu valor não depende do que faço, mas de quem sou'.\", \"o_que_fazer\": \"Refletir e escrever sobre situações em que se sentiu seguro ou valorizado sem depender de desempenho.\", \"porque_funciona\": \"A repetição de experiências de valor incondicional reforça novas redes neurais de autoestima e reduz a dependência do reconhecimento externo, promovendo motivação autêntica.\"}]}");

  const padrao08Data = parsePadrao("{\"padrao\": \"Desconexão de Propósito e Prazer\", \"categorias\": [\"bloqueio_desenvolvimento_espiritual\", \"padrão_emocional\"], \"prioridade\": 8, \"areas_impacto\": [\"propósito\", \"desenvolvimento_espiritual\", \"bem_estar_emocional\", \"qualidade_vida\"], \"origem_estimada\": {\"periodo\": \"Vida Adulta Jovem (21-26 anos)\", \"contexto_provavel\": \"Possivelmente emergiu como consequência do ciclo de autocrítica, hiperalerta e segurança condicional, bloqueando o acesso ao prazer e ao sentido existencial autêntico. Inicialmente, serviu como defesa contra frustrações profundas. Tornou-se limitante ao gerar vazio existencial, desânimo e dificuldade de se engajar com a vida de forma plena.\"}, \"conexoes_padroes\": {\"raiz_de\": [], \"explicacao\": \"A desconexão de propósito e prazer é alimentada pela crença de valor condicional e insuficiência, que esvaziam a motivação intrínseca e bloqueiam o acesso ao prazer. Relaciona-se com a procrastinação, pois o vazio existencial dificulta o engajamento em ações significativas.\", \"alimentado_por\": [\"Padrão de Segurança Condicional ('Preciso ter desempenho para ter segurança')\", \"Crença de Inadequação Pessoal ('Não sou suficiente')\"], \"relacionado_com\": [\"Procrastinação Autoprotetora\"]}, \"manifestacoes_atuais\": [\"Sensação de vazio e falta de sentido mesmo com metas claras\", \"Dificuldade de sentir prazer mesmo em atividades antes prazerosas\", \"Desânimo persistente e falta de motivação autêntica\", \"Busca por sentido apenas no desempenho e conquistas externas\"], \"orientacoes_transformacao\": [{\"nome\": \"Exploração de Propósito Autêntico (Ikigai/Logoterapia)\", \"passo\": 1, \"como_fazer\": \"Responda por escrito: (1) O que me dá alegria genuína, mesmo sem reconhecimento? (2) O que eu faria se não precisasse provar nada a ninguém? (3) Como posso contribuir para o mundo com meus dons únicos? Faça um mapa Ikigai (o que amo, sei fazer, o mundo precisa, posso ser pago) e reflita sobre ações possíveis.\", \"o_que_fazer\": \"Dedicar tempo semanal para investigar valores, paixões e contribuições além do desempenho.\", \"porque_funciona\": \"A investigação ativa do propósito (Logoterapia, Ikigai) reconecta a motivação intrínseca, amplia o sentido existencial e reduz o vazio gerado por padrões de desempenho condicional.\"}, {\"nome\": \"Práticas de Gratidão e Mindfulness Prazeroso\", \"passo\": 2, \"como_fazer\": \"Todos os dias, registre 3 experiências prazerosas ou motivos de gratidão, por menores que sejam. Pratique mindfulness durante essas experiências, focando nas sensações corporais prazerosas sem julgamento ou cobrança de resultado.\", \"o_que_fazer\": \"Cultivar diariamente a atenção ao prazer e à gratidão para reabilitar o sistema de recompensa natural.\", \"porque_funciona\": \"A prática de gratidão e mindfulness prazeroso ativa as redes cerebrais de recompensa e prazer, recondicionando o cérebro a buscar e valorizar pequenas alegrias, base para reconstrução do sentido de vida.\"}]}");

  // @ts-ignore - mockData will be replaced by dynamic data from API
  const [livroVidaData, setLivroVidaData] = useState<{
    resumo_executivo: string;
    higiene_sono: HigieneSono;
    padrao_01: PadraoItem | null;
    padrao_02: PadraoItem | null;
    padrao_03: PadraoItem | null;
    padrao_04: PadraoItem | null;
    padrao_05: PadraoItem | null;
    padrao_06: PadraoItem | null;
    padrao_07: PadraoItem | null;
    padrao_08: PadraoItem | null;
    padrao_09: PadraoItem | null;
    padrao_10: PadraoItem | null;
  }>({
    resumo_executivo: mockData.resumo_executivo,
    higiene_sono: mockData.higiene_sono,
    padrao_01: mockData.padrao_01,
    padrao_02: mockData.padrao_02,
    padrao_03: padrao03Data,
    padrao_04: padrao04Data,
    padrao_05: padrao05Data,
    padrao_06: padrao06Data,
    padrao_07: padrao07Data,
    padrao_08: padrao08Data,
    padrao_09: null,
    padrao_10: null
  });

  // Estados para edição (mantidos temporariamente para compatibilidade com renderEditableField)
  const [editingField, setEditingField] = useState<{
    type: 'resumo' | 'higiene_sono' | 'padrao';
    padraoNum?: number;
    fieldPath?: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Função para salvar campo editado
  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Atualizar no Gateway
      const response = await gatewayClient.post(`/solucao-mentalidade/${consultaId}/update-field`, {
        fieldPath,
        value: newValue,
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarregar dados após salvar
      await loadMentalidadeData();
    } catch (error) {
      console.error('❌ Erro ao salvar campo:', error);
      showError('Erro ao salvar alteração. Tente novamente.', 'Erro');
      throw error;
    }
  };

  // Função para editar com IA
  const handleAIEdit = (fieldPath: string, label: string) => {
    if (onFieldSelect) {
      onFieldSelect(fieldPath, label);
    }
  };

  // Função auxiliar para formatar valor para DataField
  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Função auxiliar para obter valor de campo aninhado (mantida para compatibilidade durante refatoração)
  const getNestedValue = (obj: any, path: string): any => {
    if (path.includes('.')) {
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return null;
        }
        // Verificar se é um índice de array
        const arrayIndex = parseInt(part);
        if (!isNaN(arrayIndex) && Array.isArray(current)) {
          current = current[arrayIndex];
        } else if (typeof current === 'object') {
          current = current[part];
        } else {
          return null;
        }
      }
      return current;
    }
    return obj ? obj[path] : null;
  };

  // Função para iniciar edição
  const handleStartEdit = (type: 'resumo' | 'higiene_sono' | 'padrao', padraoNum?: number, fieldPath?: string) => {
    setEditingField({ type, padraoNum, fieldPath });
    if (type === 'resumo') {
      setEditValue(livroVidaData.resumo_executivo);
    } else if (type === 'higiene_sono' && fieldPath) {
      const value = getNestedValue(livroVidaData.higiene_sono, fieldPath);
      setEditValue(value === null || value === undefined ? '' :
        typeof value === 'string' ? value :
          Array.isArray(value) ? value.join('\n') :
            JSON.stringify(value, null, 2));
    } else if (padraoNum && fieldPath) {
      const padrao = livroVidaData[`padrao_${String(padraoNum).padStart(2, '0')}` as keyof typeof livroVidaData] as PadraoItem | null;
      if (padrao) {
        const value = getNestedValue(padrao, fieldPath);
        setEditValue(value === null || value === undefined ? '' :
          typeof value === 'string' ? value :
            typeof value === 'number' ? value.toString() :
              Array.isArray(value) ? value.join('\n') :
                JSON.stringify(value, null, 2));
      }
    }
  };

  // Função para definir valor em campo aninhado
  const setNestedValue = (obj: any, path: string, value: any): void => {
    if (path.includes('.')) {
      // @ts-ignore
      const parts = path.split('.');
      const lastPart = parts.pop()!;
      let current = obj;
      for (const part of parts) {
        // Verificar se é um índice de array
        const arrayIndex = parseInt(part);
        if (!isNaN(arrayIndex)) {
          if (!Array.isArray(current)) {
            current = [];
          }
          if (!current[arrayIndex]) {
            current[arrayIndex] = {};
          }
          current = current[arrayIndex];
        } else {
          if (!current[part] || (typeof current[part] !== 'object' && !Array.isArray(current[part]))) {
            current[part] = {};
          }
          current = current[part];
        }
      }
      // Verificar se o último parte é um número (índice de array)
      const lastArrayIndex = parseInt(lastPart);
      if (!isNaN(lastArrayIndex) && Array.isArray(current)) {
        current[lastArrayIndex] = value;
      } else {
        current[lastPart] = value;
      }
    } else {
      obj[path] = value;
    }
  };

  // Função para salvar edição
  const handleSaveEdit = async () => {
    if (!editingField) return;

    try {
      setLoadingDetails(true);

      const newData = { ...livroVidaData };
      let fieldName = '';
      let valueToSave: any = editValue;

      if (editingField.type === 'resumo') {
        fieldName = 'resumo_executivo';
        valueToSave = editValue;
        newData.resumo_executivo = editValue;
      } else if (editingField.type === 'higiene_sono' && editingField.fieldPath) {
        fieldName = 'higiene_sono';
        const fieldPath = editingField.fieldPath;
        let finalValue: any = editValue;

        // Verificar se o campo original era array
        const originalValue = getNestedValue(newData.higiene_sono, fieldPath);
        if (Array.isArray(originalValue)) {
          finalValue = editValue.split('\n').filter(line => line.trim());
        }

        setNestedValue(newData.higiene_sono, fieldPath, finalValue);
        valueToSave = newData.higiene_sono;
      } else if (editingField.padraoNum && editingField.fieldPath) {
        const padraoNum = editingField.padraoNum;
        fieldName = `padrao_${String(padraoNum).padStart(2, '0')}`;
        const padraoKey = fieldName as keyof typeof newData;
        const padrao = { ...(newData[padraoKey] as PadraoItem) };

        if (padrao) {
          const fieldPath = editingField.fieldPath;
          let finalValue: any = editValue;

          // Verificar se o campo original era array
          const originalValue = getNestedValue(padrao, fieldPath);
          if (Array.isArray(originalValue)) {
            finalValue = editValue.split('\n').filter(line => line.trim());
          } else if (typeof originalValue === 'number') {
            finalValue = parseFloat(editValue) || 0;
          }

          setNestedValue(padrao, fieldPath, finalValue);
          (newData as any)[padraoKey] = padrao;
          valueToSave = padrao;
        }
      }

      // Atualizar estado local primeiro (UX responsivo)
      setLivroVidaData(newData);
      setEditingField(null);
      setEditValue('');

      // Salvar no Gateway
      console.log('💾 [FRONTEND-LTV] Salvando campo:', { fieldName, valueToSave });

      const response = await gatewayClient.post(`/solucao-mentalidade/${consultaId}/update-field`, {
        fieldPath: `mentalidade_data.${fieldName}`,
        value: valueToSave
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar alteração');
      }

      console.log('✅ [FRONTEND-LTV] Campo salvo com sucesso no banco');

    } catch (error) {
      console.error('❌ [FRONTEND-LTV] Erro ao salvar campo:', error);
      showError('Erro ao salvar alteração. Tente novamente.', 'Erro');

      // Recarregar dados para sincronizar com o banco
      await loadMentalidadeData();
    } finally {
      setLoadingDetails(false);
    }
  };

  // Função para cancelar edição
  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // Função para renderizar campo editável
  const renderEditableField = (
    label: string,
    value: string | string[] | object | null,
    type: 'resumo' | 'higiene_sono' | 'padrao',
    padraoNum?: number,
    fieldPath?: string
  ) => {
    const isEditing = editingField?.type === type &&
      editingField?.padraoNum === padraoNum &&
      editingField?.fieldPath === fieldPath;

    // Função auxiliar para verificar se o valor é vazio/null
    const isEmptyValue = (val: any): boolean => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && (val.trim() === '' || val.toLowerCase() === 'null')) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    };

    let displayValue: string;
    if (isEmptyValue(value)) {
      displayValue = 'Não informado';
    } else if (Array.isArray(value)) {
      // Filtrar valores null/vazios do array e substituir por "Não informado"
      displayValue = value.map(item => isEmptyValue(item) ? 'Não informado' : String(item)).join(', ');
    } else if (typeof value === 'object') {
      displayValue = JSON.stringify(value, null, 2);
    } else {
      const stringValue = String(value);
      displayValue = (stringValue.toLowerCase() === 'null' || stringValue.trim() === '')
        ? 'Não informado'
        : stringValue;
    }

    if (isEditing) {
      return (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{label}</label>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            disabled={loadingDetails}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              opacity: loadingDetails ? 0.6 : 1
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={handleSaveEdit}
              disabled={loadingDetails}
              style={{
                padding: '8px 16px',
                background: loadingDetails ? '#9ca3af' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingDetails ? 'not-allowed' : 'pointer',
                opacity: loadingDetails ? 0.7 : 1
              }}
            >
              {loadingDetails ? (
                <>
                  <div className="loading-spinner-small" style={{ display: 'inline-block', marginRight: '5px' }}></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 inline mr-1" />
                  Salvar
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={loadingDetails}
              style={{
                padding: '8px 16px',
                background: loadingDetails ? '#9ca3af' : '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingDetails ? 'not-allowed' : 'pointer',
                opacity: loadingDetails ? 0.7 : 1
              }}
            >
              <X className="w-4 h-4 inline mr-1" />
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    // Construir o fieldPath completo para o webhook
    let fullFieldPath = '';
    if (type === 'resumo') {
      fullFieldPath = 'mentalidade_data.resumo_executivo';
    } else if (type === 'higiene_sono' && fieldPath) {
      fullFieldPath = `mentalidade_data.higiene_sono.${fieldPath}`;
    } else if (type === 'padrao' && padraoNum && fieldPath) {
      fullFieldPath = `mentalidade_data.padrao_${String(padraoNum).padStart(2, '0')}.${fieldPath}`;
    }

    return (
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{label}</label>
          <div style={{
            padding: '10px',
            background: '#f9f9f9',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {displayValue}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '25px' }}>
          {onFieldSelect && fullFieldPath && (
            <button
              onClick={() => onFieldSelect(fullFieldPath, label)}
              style={{
                padding: '5px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#666'
              }}
              title="Editar com IA"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleStartEdit(type, padraoNum, fieldPath)}
            style={{
              padding: '5px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#666'
            }}
            title="Editar manualmente"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Função para renderizar seção de Higiene e Sono usando DataField
  const renderHigieneSono = () => {
    const higieneSono = livroVidaData.higiene_sono;

    return (
      <CollapsibleSection title="Higiene e Sono" defaultOpen={true}>
        <div className="anamnese-subsection">
          <h4>Horários Recomendados</h4>
          <DataField
            label="Horário de Dormir Recomendado"
            value={formatValueForDataField(higieneSono.horario_dormir_recomendado)}
            fieldPath="mentalidade_data.higiene_sono.horario_dormir_recomendado"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Horário de Acordar Recomendado"
            value={formatValueForDataField(higieneSono.horario_acordar_recomendado)}
            fieldPath="mentalidade_data.higiene_sono.horario_acordar_recomendado"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Duração Alvo"
            value={formatValueForDataField(higieneSono.duracao_alvo)}
            fieldPath="mentalidade_data.higiene_sono.duracao_alvo"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Janelas de Sono</h4>
          <DataField
            label="Janela de Sono - Semana"
            value={formatValueForDataField(higieneSono.janela_sono_semana)}
            fieldPath="mentalidade_data.higiene_sono.janela_sono_semana"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Janela de Sono - Fins de Semana"
            value={formatValueForDataField(higieneSono.janela_sono_fds)}
            fieldPath="mentalidade_data.higiene_sono.janela_sono_fds"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Consistência de Horário"
            value={formatValueForDataField(higieneSono.consistencia_horario)}
            fieldPath="mentalidade_data.higiene_sono.consistencia_horario"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Rotina Pré-Sono</h4>
          <DataField
            label="Rotina Pré-Sono"
            value={formatValueForDataField(higieneSono.rotina_pre_sono)}
            fieldPath="mentalidade_data.higiene_sono.rotina_pre_sono"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Gatilhos a Evitar</h4>
          <DataField
            label="Gatilhos a Evitar"
            value={formatValueForDataField(higieneSono.gatilhos_evitar)}
            fieldPath="mentalidade_data.higiene_sono.gatilhos_evitar"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Progressão e Ajustes</h4>
          <DataField
            label="Progressão de Ajuste"
            value={formatValueForDataField(higieneSono.progressao_ajuste)}
            fieldPath="mentalidade_data.higiene_sono.progressao_ajuste"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Observações Clínicas</h4>
          <DataField
            label="Observações Clínicas"
            value={formatValueForDataField(higieneSono.observacoes_clinicas)}
            fieldPath="mentalidade_data.higiene_sono.observacoes_clinicas"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>
      </CollapsibleSection>
    );
  };

  // Função para renderizar um padrão usando DataField
  const renderPadrao = (padrao: PadraoItem | null, numero: number) => {
    if (!padrao) {
      return (
        <CollapsibleSection title={`Padrão ${numero}`} defaultOpen={false}>
          <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum padrão cadastrado</p>
        </CollapsibleSection>
      );
    }

    const padraoKey = `padrao_${String(numero).padStart(2, '0')}`;
    const baseFieldPath = `mentalidade_data.${padraoKey}`;

    return (
      <CollapsibleSection title={`Padrão ${numero}: ${padrao.padrao}`} defaultOpen={numero <= 2}>
        <div className="anamnese-subsection">
          <h4>Informações Básicas</h4>
          <DataField
            label="Padrão"
            value={formatValueForDataField(padrao.padrao)}
            fieldPath={`${baseFieldPath}.padrao`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Categorias"
            value={formatValueForDataField(padrao.categorias)}
            fieldPath={`${baseFieldPath}.categorias`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Prioridade"
            value={formatValueForDataField(padrao.prioridade)}
            fieldPath={`${baseFieldPath}.prioridade`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Áreas de Impacto"
            value={formatValueForDataField(padrao.areas_impacto)}
            fieldPath={`${baseFieldPath}.areas_impacto`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Origem Estimada</h4>
          <DataField
            label="Período"
            value={formatValueForDataField(padrao.origem_estimada?.periodo)}
            fieldPath={`${baseFieldPath}.origem_estimada.periodo`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Contexto Provável"
            value={formatValueForDataField(padrao.origem_estimada?.contexto_provavel)}
            fieldPath={`${baseFieldPath}.origem_estimada.contexto_provavel`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Conexões com Outros Padrões</h4>
          <DataField
            label="Raiz de"
            value={formatValueForDataField(padrao.conexoes_padroes?.raiz_de)}
            fieldPath={`${baseFieldPath}.conexoes_padroes.raiz_de`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Explicação"
            value={formatValueForDataField(padrao.conexoes_padroes?.explicacao)}
            fieldPath={`${baseFieldPath}.conexoes_padroes.explicacao`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Alimentado por"
            value={formatValueForDataField(padrao.conexoes_padroes?.alimentado_por)}
            fieldPath={`${baseFieldPath}.conexoes_padroes.alimentado_por`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
          <DataField
            label="Relacionado com"
            value={formatValueForDataField(padrao.conexoes_padroes?.relacionado_com)}
            fieldPath={`${baseFieldPath}.conexoes_padroes.relacionado_com`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Manifestações Atuais</h4>
          <DataField
            label="Manifestações"
            value={formatValueForDataField(padrao.manifestacoes_atuais)}
            fieldPath={`${baseFieldPath}.manifestacoes_atuais`}
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>

        <div className="anamnese-subsection">
          <h4>Orientações de Transformação</h4>
          {padrao.orientacoes_transformacao?.map((orientacao, idx) => (
            <div key={idx} className="anamnese-subsection" style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
              <h5 style={{ marginBottom: '10px' }}>{orientacao.nome} (Passo {orientacao.passo})</h5>
              <DataField
                label="Nome"
                value={formatValueForDataField(orientacao.nome)}
                fieldPath={`${baseFieldPath}.orientacoes_transformacao.${idx}.nome`}
                consultaId={consultaId}
                onSave={handleSaveField}
                onAIEdit={handleAIEdit}
              />
              <DataField
                label="Passo"
                value={formatValueForDataField(orientacao.passo)}
                fieldPath={`${baseFieldPath}.orientacoes_transformacao.${idx}.passo`}
                consultaId={consultaId}
                onSave={handleSaveField}
                onAIEdit={handleAIEdit}
              />
              <DataField
                label="Como Fazer"
                value={formatValueForDataField(orientacao.como_fazer)}
                fieldPath={`${baseFieldPath}.orientacoes_transformacao.${idx}.como_fazer`}
                consultaId={consultaId}
                onSave={handleSaveField}
                onAIEdit={handleAIEdit}
              />
              <DataField
                label="O Que Fazer"
                value={formatValueForDataField(orientacao.o_que_fazer)}
                fieldPath={`${baseFieldPath}.orientacoes_transformacao.${idx}.o_que_fazer`}
                consultaId={consultaId}
                onSave={handleSaveField}
                onAIEdit={handleAIEdit}
              />
              <DataField
                label="Por Que Funciona"
                value={formatValueForDataField(orientacao.porque_funciona)}
                fieldPath={`${baseFieldPath}.orientacoes_transformacao.${idx}.porque_funciona`}
                consultaId={consultaId}
                onSave={handleSaveField}
                onAIEdit={handleAIEdit}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  };

  // Mostrar loading no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados do Livro da Vida...</p>
      </div>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="anamnese-error">
        <p style={{ color: '#f44336' }}>❌ {error}</p>
        <button
          onClick={loadMentalidadeData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!livroVidaData) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados do Livro da Vida...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-sections">
      {/* Resumo Executivo */}
      <CollapsibleSection title="Resumo Executivo" defaultOpen={true}>
        <div className="anamnese-subsection">
          <DataField
            label="Resumo Executivo"
            value={livroVidaData.resumo_executivo}
            fieldPath="mentalidade_data.resumo_executivo"
            consultaId={consultaId}
            onSave={handleSaveField}
            onAIEdit={handleAIEdit}
          />
        </div>
      </CollapsibleSection>

      {/* Higiene e Sono */}
      {renderHigieneSono()}

      {/* Padrões */}
      {renderPadrao(livroVidaData.padrao_01, 1)}
      {renderPadrao(livroVidaData.padrao_02, 2)}
      {renderPadrao(livroVidaData.padrao_03, 3)}
      {renderPadrao(livroVidaData.padrao_04, 4)}
      {renderPadrao(livroVidaData.padrao_05, 5)}
      {renderPadrao(livroVidaData.padrao_06, 6)}
      {renderPadrao(livroVidaData.padrao_07, 7)}
      {renderPadrao(livroVidaData.padrao_08, 8)}
      {renderPadrao(livroVidaData.padrao_09, 9)}
      {renderPadrao(livroVidaData.padrao_10, 10)}
    </div>
  );
}

// Componente da seção de Solução Suplementação
// Interface para itens de suplementação
interface SuplementacaoItem {
  nome: string;
  objetivo: string;
  dosagem: string;
  horario: string;
  inicio: string;
  termino: string;
}

function SuplemementacaoSection({
  consultaId
}: {
  consultaId: string;
}) {
  const { showError } = useNotifications();

  const [suplementacaoData, setSuplementacaoData] = useState<{
    suplementos: SuplementacaoItem[];
    fitoterapicos: SuplementacaoItem[];
    homeopatia: SuplementacaoItem[];
    florais_bach: SuplementacaoItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Carregar dados ao montar o componente
  useEffect(() => {
    loadSuplementacaoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadSuplementacaoData();
    };

    window.addEventListener('suplementacao-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('suplementacao-data-refresh', handleRefresh);
    };
  }, []);

  const loadSuplementacaoData = async () => {
    try {
      setLoadingDetails(true);
      setError(null);

      console.log('🔍 Carregando dados de suplementação para consulta:', consultaId);

      const response = await gatewayClient.get(`/solucao-suplementacao/${consultaId}`);

      console.log('📡 Response status:', response.status);

      if (!response.success) {
        console.error('❌ Erro na resposta:', response.error);
        throw new Error(response.error || 'Erro ao carregar dados de suplementação');
      }

      const data = response;
      console.log('✅ Dados de suplementação recebidos:', data);
      console.log('📊 Estrutura suplementacao_data:', {
        hasData: !!data.suplementacao_data,
        suplementos: data.suplementacao_data?.suplementos?.length || 0,
        fitoterapicos: data.suplementacao_data?.fitoterapicos?.length || 0,
        homeopatia: data.suplementacao_data?.homeopatia?.length || 0,
        florais_bach: data.suplementacao_data?.florais_bach?.length || 0
      });

      setSuplementacaoData(data.suplementacao_data);
      setLoading(false);
    } catch (err) {
      console.error('❌ Erro ao carregar suplementação:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar suplementação');
      setLoading(false);
    } finally {
      setLoadingDetails(false);
    }
  };


  // Mostrar loading no primeiro carregamento
  if (loading && !error) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de suplementação...</p>
      </div>
    );
  }

  // Mostrar erro se houver
  if (error) {
    return (
      <div className="anamnese-error">
        <p style={{ color: '#f44336' }}>❌ {error}</p>
        <button
          onClick={loadSuplementacaoData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Se não houver dados, mostrar mensagem
  if (!suplementacaoData) {
    return (
      <div className="anamnese-sections">
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Nenhum dado de suplementação encontrado para esta consulta.
        </p>
      </div>
    );
  }

  const handleAIEdit = (fieldPath: string, label: string) => {
    console.log('Edição com IA:', fieldPath, label);
  };

  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Função para renderizar categoria usando DataField
  const renderCategoryTable = (
    title: string,
    category: 'suplementos' | 'fitoterapicos' | 'homeopatia' | 'florais_bach',
    items: SuplementacaoItem[]
  ) => {
    if (items.length === 0) {
      return (
        <CollapsibleSection title={title} defaultOpen={true}>
          <p style={{ color: '#666', fontStyle: 'italic', padding: '20px' }}>Nenhum item cadastrado</p>
        </CollapsibleSection>
      );
    }

    return (
      <CollapsibleSection title={title} defaultOpen={true}>
        <div className="anamnese-subsection">
          {items.map((item, index) => (
            <div key={index} style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                Item {index + 1}
              </h4>
              <div className="anamnese-subsection">
                <DataField
                  label="Nome"
                  value={formatValueForDataField(item.nome)}
                  fieldPath={`suplementacao_data.${category}.${index}.nome`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'nome',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
                <DataField
                  label="Objetivo"
                  value={formatValueForDataField(item.objetivo)}
                  fieldPath={`suplementacao_data.${category}.${index}.objetivo`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'objetivo',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
                <DataField
                  label="Dosagem"
                  value={formatValueForDataField(item.dosagem)}
                  fieldPath={`suplementacao_data.${category}.${index}.dosagem`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'dosagem',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
                <DataField
                  label="Horário"
                  value={formatValueForDataField(item.horario)}
                  fieldPath={`suplementacao_data.${category}.${index}.horario`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'horario',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
                <DataField
                  label="Início"
                  value={formatValueForDataField(item.inicio)}
                  fieldPath={`suplementacao_data.${category}.${index}.inicio`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'inicio',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
                <DataField
                  label="Término"
                  value={formatValueForDataField(item.termino)}
                  fieldPath={`suplementacao_data.${category}.${index}.termino`}
                  consultaId={consultaId}
                  onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                    const response = await gatewayClient.post(`/solucao-suplementacao/${consultaId}/update-field`, {
                      category,
                      index,
                      field: 'termino',
                      value: newValue
                    });
                    if (response.success) {
                      await loadSuplementacaoData();
                    }
                  }}
                  onAIEdit={handleAIEdit}
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    );
  };

  return (
    <div className="anamnese-sections">
      {renderCategoryTable("1. Suplementos", "suplementos", suplementacaoData.suplementos)}
      {renderCategoryTable("2. Fitoterápicos", "fitoterapicos", suplementacaoData.fitoterapicos)}
      {renderCategoryTable("3. Homeopatia", "homeopatia", suplementacaoData.homeopatia)}
      {renderCategoryTable("4. Florais de Bach", "florais_bach", suplementacaoData.florais_bach)}
    </div>
  );
}

// Componente da seção de Solução Alimentação
function AlimentacaoSection({
  consultaId
}: {
  consultaId: string;
}) {
  const { showError } = useNotifications();

  const [alimentacaoData, setAlimentacaoData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlimentacaoData();
  }, [consultaId]);

  // Listener para recarregar dados quando a IA processar
  useEffect(() => {
    const handleRefresh = () => {
      loadAlimentacaoData();
    };

    window.addEventListener('alimentacao-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('alimentacao-data-refresh', handleRefresh);
    };
  }, []);

  const loadAlimentacaoData = async () => {
    try {
      setLoadingDetails(true);
      console.log('🔍 [FRONTEND] Carregando dados de alimentação para consulta:', consultaId);

      const response = await gatewayClient.get(`/alimentacao/${consultaId}`);

      console.log('📡 [FRONTEND] Response status:', response.status);

      if (response.success) {
        const data = response;
        console.log('✅ [FRONTEND] Dados recebidos:', data);
        console.log('📊 [FRONTEND] Estrutura alimentacao_data:', {
          cafe_da_manha: data.alimentacao_data?.cafe_da_manha?.length || 0,
          almoco: data.alimentacao_data?.almoco?.length || 0,
          cafe_da_tarde: data.alimentacao_data?.cafe_da_tarde?.length || 0,
          jantar: data.alimentacao_data?.jantar?.length || 0
        });

        setAlimentacaoData(data.alimentacao_data);
      } else {
        console.error('❌ [FRONTEND] Erro na resposta:', response.error);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Erro ao carregar dados de Alimentação:', error);
    } finally {
      setLoadingDetails(false);
      setLoading(false);
    }
  };

  const handleSaveField = async (fieldPath: string, newValue: string, consultaId: string) => {
    try {
      // Primeiro, atualizar diretamente no Supabase via gateway
      const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
        fieldPath,
        value: newValue
      });

      if (!response.success) throw new Error(response.error || 'Erro ao atualizar campo no Supabase');

      // Depois, notificar o webhook
      try {
        const webhookEndpoints = getWebhookEndpoints();
        const webhookHeaders = getWebhookHeaders();

        await fetch(webhookEndpoints.edicaoSolucao, {
          method: 'POST',
          headers: webhookHeaders,
          body: JSON.stringify({
            origem: 'MANUAL',
            fieldPath,
            texto: newValue,
            consultaId,
            solucao_etapa: 'ALIMENTACAO'
          }),
        });
      } catch (webhookError) {
        console.warn('Aviso: Webhook não pôde ser notificado, mas dados foram salvos:', webhookError);
      }

      // Recarregar dados após salvar
      await loadAlimentacaoData();
    } catch (error) {
      console.error('Erro ao salvar campo:', error);
      throw error;
    }
  };

  const handleAIEdit = (fieldPath: string, label: string) => {
    // Esta função será implementada se necessário para edição com IA
    console.log('Edição com IA:', fieldPath, label);
  };

  const formatValueForDataField = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.filter(item => item !== null && item !== undefined).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };


  console.log('🔍 [FRONTEND] AlimentacaoSection - Estado atual:', {
    loading,
    hasData: !!alimentacaoData,
    dataStructure: alimentacaoData ? Object.keys(alimentacaoData) : []
  });

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando dados de alimentação...</p>
      </div>
    );
  }

  if (!alimentacaoData) {
    return (
      <div className="anamnese-sections">
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Nenhum dado de alimentação encontrado para esta consulta.
        </p>
      </div>
    );
  }

  const refeicoes = [
    { key: 'cafe_da_manha', label: 'Café da Manhã' },
    { key: 'almoco', label: 'Almoço' },
    { key: 'cafe_da_tarde', label: 'Café da Tarde' },
    { key: 'jantar', label: 'Jantar' }
  ];

  const getRefeicaoData = (refeicaoKey: string) => {
    if (!alimentacaoData) {
      console.log('⚠️ [FRONTEND] alimentacaoData não existe');
      return [];
    }

    // Retornar os dados diretamente da propriedade da refeição
    const dados = alimentacaoData[refeicaoKey as keyof typeof alimentacaoData] || [];

    console.log(`📋 [FRONTEND] Dados para ${refeicaoKey}:`, dados.length, 'itens');

    return Array.isArray(dados) ? dados : [];
  };

  return (
    <div className="anamnese-sections">
      {refeicoes.map((refeicao) => {
        const items = getRefeicaoData(refeicao.key);

        return (
          <CollapsibleSection key={refeicao.key} title={refeicao.label} defaultOpen={true}>
            {items.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', padding: '20px' }}>
                Nenhum item adicionado
              </p>
            ) : (
              <div className="anamnese-subsection">
                {items.map((item: any, index: number) => (
                  <div key={item.id || index} style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                      Item {index + 1}
                    </h4>
                    <div className="anamnese-subsection">
                      <DataField
                        label="Alimento"
                        value={formatValueForDataField(item.alimento)}
                        fieldPath={`alimentacao_data.${refeicao.key}.${index}.alimento`}
                        consultaId={consultaId}
                        onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                          // Atualizar item específico
                          const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
                            refeicao: refeicao.key,
                            index: index,
                            alimento: newValue,
                            tipo: item.tipo,
                            gramatura: item.gramatura,
                            kcal: item.kcal
                          });
                          if (response.success) {
                            await loadAlimentacaoData();
                          }
                        }}
                        onAIEdit={handleAIEdit}
                      />
                      <DataField
                        label="Tipo"
                        value={formatValueForDataField(item.tipo)}
                        fieldPath={`alimentacao_data.${refeicao.key}.${index}.tipo`}
                        consultaId={consultaId}
                        onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                          const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
                            refeicao: refeicao.key,
                            index: index,
                            alimento: item.alimento,
                            tipo: newValue,
                            gramatura: item.gramatura,
                            kcal: item.kcal
                          });
                          if (response.success) {
                            await loadAlimentacaoData();
                          }
                        }}
                        onAIEdit={handleAIEdit}
                      />
                      <DataField
                        label="Gramatura"
                        value={formatValueForDataField(item.gramatura)}
                        fieldPath={`alimentacao_data.${refeicao.key}.${index}.gramatura`}
                        consultaId={consultaId}
                        onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                          const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
                            refeicao: refeicao.key,
                            index: index,
                            alimento: item.alimento,
                            tipo: item.tipo,
                            gramatura: newValue,
                            kcal: item.kcal
                          });
                          if (response.success) {
                            await loadAlimentacaoData();
                          }
                        }}
                        onAIEdit={handleAIEdit}
                      />
                      <DataField
                        label="Kcal"
                        value={formatValueForDataField(item.kcal)}
                        fieldPath={`alimentacao_data.${refeicao.key}.${index}.kcal`}
                        consultaId={consultaId}
                        onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                          const response = await gatewayClient.post(`/alimentacao/${consultaId}/update-field`, {
                            refeicao: refeicao.key,
                            index: index,
                            alimento: item.alimento,
                            tipo: item.tipo,
                            gramatura: item.gramatura,
                            kcal: newValue
                          });
                          if (response.success) {
                            await loadAlimentacaoData();
                          }
                        }}
                        onAIEdit={handleAIEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

// Componente da seção de Exames com dados do paciente
function ExamesSection({
  consultaDetails,
  consultaId,
  onBack
}: {
  consultaDetails: Consultation;
  consultaId: string;
  onBack: () => void;
}) {
  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (consulta: Consultation) => {
    // Tentar usar duration primeiro (em segundos)
    let durationInSeconds: number | null = null;

    // 1. Tentar campo duration (em segundos)
    if (consulta.duration && consulta.duration > 0) {
      durationInSeconds = consulta.duration;
    }
    // 2. Tentar campo duracao (pode estar em minutos)
    else if ((consulta as any).duracao && (consulta as any).duracao > 0) {
      // Se duracao está em minutos, converter para segundos
      const duracaoMinutos = Number((consulta as any).duracao);
      if (duracaoMinutos > 0 && duracaoMinutos < 1440) { // Máximo 24 horas em minutos
        durationInSeconds = Math.floor(duracaoMinutos * 60);
      }
    }
    // 3. Calcular a partir de consulta_inicio e consulta_fim
    else if (consulta.consulta_inicio && consulta.consulta_fim) {
      try {
        const inicio = new Date(consulta.consulta_inicio);
        const fim = new Date(consulta.consulta_fim);

        // Validar se as datas são válidas
        if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
          const diffMs = fim.getTime() - inicio.getTime();
          durationInSeconds = Math.floor(diffMs / 1000);

          // Validar se a duração é positiva e razoável (menos de 24 horas)
          if (durationInSeconds < 0 || durationInSeconds > 86400) {
            durationInSeconds = null;
          }
        }
      } catch (error) {
        console.error('Erro ao calcular duração:', error);
        durationInSeconds = null;
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'Criada';
      case 'AGENDAMENTO':
        return 'Agendada';
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALIDATION':
        return 'Validação';
      case 'VALID_ANAMNESE':
        return 'Validação Análise';
      case 'VALID_DIAGNOSTICO':
        return 'Diagnóstico Validado';
      case 'VALID_SOLUCAO':
        return 'Solução Validada';
      case 'COMPLETED':
        return 'Concluída';
      case 'ERROR':
        return 'Erro';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  // Avatar do paciente
  const patientsData = Array.isArray(consultaDetails.patients)
    ? consultaDetails.patients[0]
    : consultaDetails.patients;
  const patientAvatar = patientsData?.profile_pic || null;
  const patientInitials = (consultaDetails.patient_name || 'P')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="consultation-details-overview-container">
      {/* Header com botão voltar */}
      <div className="consultation-details-overview-header">
        <button
          className="back-button"
          onClick={onBack}
          style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="consultation-details-overview-title">Exames</h1>
      </div>

      {/* Cards de informações da consulta no topo */}
      <div className="consultation-details-cards-row">
        {/* Card Paciente */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-avatar">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={60}
                height={60}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder">
                {patientInitials}
              </div>
            )}
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Paciente</div>
            <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            {patientsData?.phone && (
              <div className="consultation-details-card-phone">{patientsData.phone}</div>
            )}
          </div>
        </div>

        {/* Card Data/Hora */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Calendar size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Data / Hora</div>
            <div className="consultation-details-card-value">
              {consultaDetails.consulta_inicio
                ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                : formatDateOnly(consultaDetails.created_at)}
            </div>
          </div>
        </div>

        {/* Card Tipo */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <FileText size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Tipo</div>
            <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
          </div>
        </div>

        {/* Card Duração */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Clock size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Duração</div>
            <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
          </div>
        </div>

        {/* Card Status */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <User size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Status</div>
            <div className="consultation-details-card-value">
              {getStatusLabel(consultaDetails.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Exames */}
      <div style={{ marginTop: '32px' }}>
        <ExamesUploadSection
          consultaId={consultaId}
          patientId={consultaDetails.patient_id}
          consultaStatus={consultaDetails.status}
          consultaEtapa={consultaDetails.etapa}
        />
      </div>
    </div>
  );
}

// Componente da tela intermediária de detalhes da consulta
function ConsultationDetailsOverview({
  consultaDetails,
  patientId,
  onNavigateToSection,
  onBack,
  hasAnamneseData,
  hasDiagnosticoData,
  hasSolucaoData
}: {
  consultaDetails: Consultation;
  patientId?: string;
  onNavigateToSection: (section: 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCOES' | 'EXAMES') => void;
  onBack: () => void;
  hasAnamneseData: () => boolean;
  hasDiagnosticoData: () => boolean;
  hasSolucaoData: () => boolean;
}) {
  const [patientData, setPatientData] = useState<any>(null);
  const [loadingPatientData, setLoadingPatientData] = useState(false);

  // Função para calcular idade
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null;
    try {
      const today = new Date();
      const birth = new Date(birthDate);

      // Verificar se a data é válida
      if (isNaN(birth.getTime())) {
        console.warn('⚠️ Data de nascimento inválida:', birthDate);
        return null;
      }

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      // Verificar se a idade é válida (não negativa e não muito grande)
      if (age < 0 || age > 150) {
        console.warn('⚠️ Idade calculada inválida:', age, 'para data:', birthDate);
        return null;
      }

      return age;
    } catch (error) {
      console.error('❌ Erro ao calcular idade:', error, 'para data:', birthDate);
      return null;
    }
  };

  // Buscar dados do paciente
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) {
        console.log('⚠️ ConsultationDetailsOverview: patientId não fornecido');
        return;
      }

      try {
        setLoadingPatientData(true);
        console.log('🔍 ConsultationDetailsOverview: Buscando dados do paciente:', patientId);
        const response = await gatewayClient.get(`/cadastro-anamnese/${patientId}`);

        if (response.success) {
          const data = response.cadastro || response.data?.cadastro || response;  // Extrair cadastro
          console.log('✅ ConsultationDetailsOverview: Dados do paciente recebidos:', data);
          console.log('✅ ConsultationDetailsOverview: data_nascimento:', data?.data_nascimento);
          console.log('✅ ConsultationDetailsOverview: idade:', data?.idade);
          console.log('✅ ConsultationDetailsOverview: tipo_saguineo:', data?.tipo_saguineo);
          console.log('✅ ConsultationDetailsOverview: tipo_sanguineo (variante):', data?.tipo_sanguineo);
          console.log('✅ ConsultationDetailsOverview: tipo_sangue (variante):', data?.tipo_sangue);
          setPatientData(data);
        } else {
          console.warn('⚠️ ConsultationDetailsOverview: Erro ao buscar dados do paciente:', response.status);
          setPatientData(null);
        }
      } catch (error) {
        console.error('❌ ConsultationDetailsOverview: Erro ao buscar dados do paciente:', error);
        setPatientData(null);
      } finally {
        setLoadingPatientData(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (consulta: Consultation) => {
    // Tentar usar duration primeiro (em segundos)
    let durationInSeconds: number | null = null;

    // 1. Tentar campo duration (em segundos)
    if (consulta.duration && consulta.duration > 0) {
      durationInSeconds = consulta.duration;
    }
    // 2. Tentar campo duracao (pode estar em minutos)
    else if ((consulta as any).duracao && (consulta as any).duracao > 0) {
      // Se duracao está em minutos, converter para segundos
      const duracaoMinutos = Number((consulta as any).duracao);
      if (duracaoMinutos > 0 && duracaoMinutos < 1440) { // Máximo 24 horas em minutos
        durationInSeconds = Math.floor(duracaoMinutos * 60);
      }
    }
    // 3. Calcular a partir de consulta_inicio e consulta_fim
    else if (consulta.consulta_inicio && consulta.consulta_fim) {
      try {
        const inicio = new Date(consulta.consulta_inicio);
        const fim = new Date(consulta.consulta_fim);

        // Validar se as datas são válidas
        if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
          const diffMs = fim.getTime() - inicio.getTime();
          durationInSeconds = Math.floor(diffMs / 1000);

          // Validar se a duração é positiva e razoável (menos de 24 horas)
          if (durationInSeconds < 0 || durationInSeconds > 86400) {
            durationInSeconds = null;
          }
        }
      } catch (error) {
        console.error('Erro ao calcular duração:', error);
        durationInSeconds = null;
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'Criada';
      case 'AGENDAMENTO':
        return 'Agendada';
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALIDATION':
        return 'Validação';
      case 'VALID_ANAMNESE':
        return 'Validação Análise';
      case 'VALID_DIAGNOSTICO':
        return 'Diagnóstico Validado';
      case 'VALID_SOLUCAO':
        return 'Solução Validada';
      case 'COMPLETED':
        return 'Concluída';
      case 'ERROR':
        return 'Erro';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getPatientAge = () => {
    // Prioridade 1: usar campo idade da anamnese se existir
    if (patientData?.idade) {
      const idade = typeof patientData.idade === 'string'
        ? parseInt(patientData.idade.trim(), 10)
        : patientData.idade;
      if (!isNaN(idade) && idade > 0 && idade <= 150) {
        return idade;
      }
    }
    // Prioridade 2: calcular a partir de data_nascimento
    if (patientData?.data_nascimento) {
      const age = calculateAge(patientData.data_nascimento);
      // Verificar se a idade é válida (não é NaN)
      if (age !== null && !isNaN(age) && age >= 0) {
        return age;
      }
    }
    // Tentar buscar de outras fontes ou retornar null para mostrar card vazio
    return null;
  };

  const getPatientWeight = () => {
    return patientData?.peso_atual || null;
  };

  const getPatientHeight = () => {
    const altura = patientData?.altura;
    if (!altura) return null;
    // Se altura já está formatada (contém "m"), retornar como está
    if (typeof altura === 'string' && altura.includes('m')) {
      return altura;
    }
    // Se for número, formatar
    if (typeof altura === 'number') {
      return `${altura.toString().replace('.', ',')} m`;
    }
    // Se for string numérica, formatar
    if (typeof altura === 'string') {
      const num = parseFloat(altura);
      if (!isNaN(num)) {
        return `${num.toString().replace('.', ',')} m`;
      }
    }
    return altura;
  };

  const getPatientBloodType = () => {
    // Prioridade: usar tipo_saguineo (com 'g') da anamnese - nome correto da coluna no banco
    // Também verificar variações comuns caso ainda existam
    return patientData?.tipo_saguineo || patientData?.tipo_sanguineo || patientData?.tipo_sangue || null;
  };

  const patientAge = getPatientAge();
  const patientWeight = getPatientWeight();
  const patientHeight = getPatientHeight();
  const patientBloodType = getPatientBloodType();

  // Avatar do paciente - verificar se patients é array ou objeto
  const patientsData = Array.isArray(consultaDetails.patients)
    ? consultaDetails.patients[0]
    : consultaDetails.patients;
  console.log('🔍 ConsultationDetailsOverview: patientsData:', patientsData);
  const patientAvatar = patientsData?.profile_pic || null;
  console.log('🔍 ConsultationDetailsOverview: patientAvatar:', patientAvatar);
  const patientInitials = (consultaDetails.patient_name || 'P')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="consultation-details-overview-container">
      {/* Header com botão voltar */}
      <div className="consultation-details-overview-header">
        <button
          className="back-button"
          onClick={onBack}
          style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="consultation-details-overview-title">Detalhes da Consulta</h1>
      </div>

      {/* Cards de informações da consulta no topo */}
      <div className="consultation-details-cards-row">
        {/* Card Paciente */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-avatar">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={60}
                height={60}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder">
                {patientInitials}
              </div>
            )}
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Paciente</div>
            <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            {patientsData?.phone && (
              <div className="consultation-details-card-phone">{patientsData.phone}</div>
            )}
          </div>
        </div>

        {/* Card Data/Hora */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Calendar size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Data / Hora</div>
            <div className="consultation-details-card-value">
              {consultaDetails.consulta_inicio
                ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                : formatDateOnly(consultaDetails.created_at)}
            </div>
          </div>
        </div>

        {/* Card Tipo */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <FileText size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Tipo</div>
            <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
          </div>
        </div>

        {/* Card Duração */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <Clock size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Duração</div>
            <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
          </div>
        </div>

        {/* Card Status */}
        <div className="consultation-details-info-card">
          <div className="consultation-details-card-icon-wrapper">
            <User size={20} />
          </div>
          <div className="consultation-details-card-content">
            <div className="consultation-details-card-label">Status</div>
            <div className="consultation-details-card-value">
              {getStatusLabel(consultaDetails.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de detalhes do paciente e ações */}
      <div className="consultation-details-main-content">
        {/* Card esquerdo - Detalhes do Paciente */}
        <div className="consultation-details-patient-card">
          <div className="consultation-details-patient-avatar-large">
            {patientAvatar ? (
              <Image
                src={patientAvatar}
                alt={consultaDetails.patient_name}
                width={155}
                height={155}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
                unoptimized
              />
            ) : (
              <div className="consultation-details-avatar-placeholder-large">
                {patientInitials}
              </div>
            )}
          </div>

          {loadingPatientData ? (
            <div className="consultation-details-loading">Carregando dados do paciente...</div>
          ) : (
            <div className="consultation-details-patient-data-grid">
              {/* Idade */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Clock size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Idade</div>
                  <div className="consultation-details-data-value">
                    {patientAge !== null ? `${patientAge} anos` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Peso */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Scale size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Peso</div>
                  <div className="consultation-details-data-value">
                    {patientWeight ? `${patientWeight} kg` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Altura */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Ruler size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Altura</div>
                  <div className="consultation-details-data-value">
                    {patientHeight || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tipo Sanguíneo */}
              <div className="consultation-details-patient-data-item">
                <div className="consultation-details-data-icon">
                  <Droplet size={24} />
                </div>
                <div className="consultation-details-data-content">
                  <div className="consultation-details-data-label">Tipo sanguíneo</div>
                  <div className="consultation-details-data-value">
                    {patientBloodType || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card direito - Ações */}
        <div className="consultation-details-actions-card">
          <div className="consultation-details-actions-icon">
            <FolderOpen size={84} style={{ color: '#1B4266' }} />
          </div>

          <div className="consultation-details-actions-buttons">
            {/* Botão Análise */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('ANAMNESE')}
            >
              <Plus size={18} />
              <span>Análise</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Diagnóstico */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('DIAGNOSTICO')}
              disabled={!hasDiagnosticoData()}
              style={{
                opacity: !hasDiagnosticoData() ? 0.5 : 1,
                cursor: !hasDiagnosticoData() ? 'not-allowed' : 'pointer'
              }}
            >
              <Plus size={18} />
              <span>Diagnóstico</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Soluções */}
            <button
              className="consultation-details-action-button consultation-details-action-button-primary"
              onClick={() => onNavigateToSection('SOLUCOES')}
              disabled={!hasSolucaoData()}
              style={{
                opacity: !hasSolucaoData() ? 0.5 : 1,
                cursor: !hasSolucaoData() ? 'not-allowed' : 'pointer'
              }}
            >
              <Plus size={18} />
              <span>Soluções</span>
              <ArrowRight size={18} />
            </button>

            {/* Botão Exames */}
            <button
              className="consultation-details-action-button consultation-details-action-button-outline"
              onClick={() => onNavigateToSection('EXAMES')}
            >
              <Plus size={18} />
              <span>Exames</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsultasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultaId = searchParams.get('consulta_id');
  const sectionParam = searchParams.get('section');
  const { showError, showSuccess, showWarning } = useNotifications();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const [cssLoaded, setCssLoaded] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilterType, setDateFilterType] = useState<'day' | 'week' | 'month' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const isInitialMount = useRef(true);

  // Estados para visualização de detalhes
  const [consultaDetails, setConsultaDetails] = useState<Consultation | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSolutionsViewer, setShowSolutionsViewer] = useState(false);
  const [forceRender, setForceRender] = useState(0); // Para forçar re-render

  const [selectedSection, setSelectedSection] = useState<'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCOES' | 'EXAMES' | null>(null);
  const [forceShowSolutionSelection, setForceShowSolutionSelection] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  // Função para voltar para a tela de seleção de soluções
  const handleBackToSolutionSelection = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Limpa a solucao_etapa para mostrar a tela de seleção de soluções
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: null
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Forçar mostrar a tela de seleção de soluções
      setForceShowSolutionSelection(true);
      setSelectedSection(null);

      // Recarregar detalhes da consulta para atualizar a tela
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao voltar para seleção de soluções:', error);
      showError('Erro ao voltar para seleção de soluções. Tente novamente.', 'Erro');
      // Mesmo em caso de erro, tentar forçar a tela de seleção
      setForceShowSolutionSelection(true);
      setSelectedSection(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Baixar todas as soluções em DOCX (tela "Selecionar Solução")
  const handleDownloadAllDocx = async () => {
    const effectiveConsultaId = consultaId || consultaDetails?.id || null;
    if (!effectiveConsultaId) return;
    setDownloadingDocx(true);
    try {
      const solutions = await fetchSolutionsFromGateway(effectiveConsultaId);
      await downloadSolutionsDocx(solutions, `solucoes-consulta-${effectiveConsultaId.slice(0, 8)}.docx`);
    } catch (err) {
      console.error('Erro ao gerar DOCX:', err);
      showError('Erro ao gerar documento. Tente novamente.', 'Erro');
    } finally {
      setDownloadingDocx(false);
    }
  };

  // Função para navegar para a solução anterior
  const handleNavigateToPreviousSolution = async () => {
    if (!consultaId || !consultaDetails?.solucao_etapa) return;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    if (currentIndex <= 0) return; // Já está na primeira

    const previousSolution = solutionOrder[currentIndex - 1];

    try {
      setIsSaving(true);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: previousSolution
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao navegar para solução anterior:', error);
      showError('Erro ao navegar para solução anterior. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para navegar para a próxima solução
  const handleNavigateToNextSolution = async () => {
    if (!consultaId || !consultaDetails?.solucao_etapa) return;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    if (currentIndex >= solutionOrder.length - 1) return; // Já está na última

    const nextSolution = solutionOrder[currentIndex + 1];

    try {
      setIsSaving(true);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: nextSolution
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao navegar para próxima solução:', error);
      showError('Erro ao navegar para próxima solução. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função helper para renderizar botões de navegação entre soluções
  const renderSolutionNavigationButtons = () => {
    if (!consultaDetails?.solucao_etapa) return null;

    const solutionOrder: Array<'MENTALIDADE' | 'SUPLEMENTACAO' | 'ALIMENTACAO' | 'ATIVIDADE_FISICA'> = [
      'MENTALIDADE',
      'SUPLEMENTACAO',
      'ALIMENTACAO',
      'ATIVIDADE_FISICA'
    ];

    const solutionNames: Record<string, string> = {
      'MENTALIDADE': 'Livro da Vida',
      'SUPLEMENTACAO': 'Suplementação',
      'ALIMENTACAO': 'Alimentação',
      'ATIVIDADE_FISICA': 'Atividade Física'
    };

    const currentIndex = solutionOrder.indexOf(consultaDetails.solucao_etapa);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < solutionOrder.length - 1;

    if (!hasPrevious && !hasNext) return null;

    return (
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginLeft: 'auto'
      }}>
        {hasPrevious && (
          <button
            onClick={handleNavigateToPreviousSolution}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>
        )}
        {hasNext && (
          <button
            onClick={handleNavigateToNextSolution}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#1B4266',
              border: '1px solid #1B4266',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#153350';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.background = '#1B4266';
              }
            }}
          >
            Próxima
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Função helper para renderizar o botão "Ver Todas as Soluções"
  const renderViewSolutionsButton = () => (
    <button
      className="view-solutions-button"
      onClick={handleBackToSolutionSelection}
      disabled={isSaving}
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: isSaving ? '#9ca3af' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isSaving ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (!isSaving) {
          e.currentTarget.style.background = '#2563eb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSaving) {
          e.currentTarget.style.background = '#3b82f6';
        }
      }}
    >
      <FileText className="w-4 h-4" />
      {isSaving ? 'Carregando...' : 'Ver Todas as Soluções'}
    </button>
  );

  // Estados para chat com IA
  const [selectedField, setSelectedField] = useState<{ fieldPath: string; label: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);

  // Estado para controlar a tab ativa na Anamnese
  const [activeAnamneseTab, setActiveAnamneseTab] = useState<string>('Dados do Paciente');

  // Estado para controlar a tab ativa no Diagnóstico (undefined = mostrar todas)
  const [activeDiagnosticoTab, setActiveDiagnosticoTab] = useState<string | undefined>(undefined);

  // Estado para salvar alterações
  const [isSaving, setIsSaving] = useState(false);

  // Estados para ATIVIDADE_FISICA
  const [atividadeFisicaData, setAtividadeFisicaData] = useState<ExercicioFisico[]>([]);
  const [loadingAtividadeFisica, setLoadingAtividadeFisica] = useState(false);
  const [editingExercicio, setEditingExercicio] = useState<{ id: number, field: string } | null>(null);

  // Estado para autocomplete de exercícios
  const [exercicioSuggestions, setExercicioSuggestions] = useState<Array<{ id: number, atividade: string, grupo_muscular: string }>>([]);

  // Estado para alterações pendentes (não salvas)
  const [pendingChanges, setPendingChanges] = useState<Record<number, Partial<ExercicioFisico>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState<Consultation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para modal de edição de agendamento
  const [showEditAgendamentoModal, setShowEditAgendamentoModal] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Consultation | null>(null);
  const [editAgendamentoForm, setEditAgendamentoForm] = useState({
    date: '',
    time: '',
    type: 'TELEMEDICINA' as 'PRESENCIAL' | 'TELEMEDICINA'
  });
  const [isSavingAgendamento, setIsSavingAgendamento] = useState(false);

  // Estados para modal de confirmação de avanço de etapa
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAction, setAdvanceAction] = useState<(() => Promise<void>) | null>(null);
  const [advanceMessage, setAdvanceMessage] = useState<string>('');

  // Estado para verificar se anamnese está preenchida
  const [anamnesePreenchida, setAnamnesePreenchida] = useState<boolean | null>(null);

  // Função para verificar se anamnese está preenchida (definida aqui para ser usada nos useEffects)
  const checkAnamnesePreenchida = useCallback(async (patientId: string): Promise<boolean> => {
    try {
      console.log('🔍 Verificando anamnese para paciente:', patientId);
      const response = await gatewayClient.get(`/patients/${patientId}`);
      if (!response.success) {
        console.error('❌ Erro ao buscar dados do paciente:', response.status);
        return false;
      }
      const data = response;
      const patient = data.patient || data;
      const isPreenchida = patient?.anamnese?.status === 'preenchida';
      console.log('📋 Status da anamnese:', {
        pacienteId: patientId,
        temAnamnese: !!patient?.anamnese,
        status: patient?.anamnese?.status,
        isPreenchida
      });
      return isPreenchida;
    } catch (error) {
      console.error('❌ Erro ao verificar anamnese:', error);
      return false;
    }
  }, []);

  // Função para selecionar campo para edição com IA
  const handleFieldSelect = (fieldPath: string, label: string) => {
    setSelectedField({ fieldPath, label });
    setChatMessages([]); // Limpa o chat anterior
    setShowAIChat(true); // Abre o chat automaticamente quando um campo é selecionado
  };

  // ID da consulta: URL (?consulta_id=) ou detalhes carregados (consultaDetails.id)
  const effectiveConsultaId = consultaId || consultaDetails?.id || null;

  // Função para enviar mensagem para IA
  const handleSendAIMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    // Validar seleção e consulta; dar feedback e limpar input para o usuário não ficar com a mensagem presa
    if (!selectedField || !effectiveConsultaId) {
      setChatInput('');
      const msg: ChatMessage = {
        role: 'assistant',
        content: !effectiveConsultaId
          ? 'Nenhuma consulta selecionada. Selecione uma consulta na lista para abrir os detalhes e editar com IA.'
          : 'Selecione um campo (clique em "Editar com IA" no campo desejado) antes de enviar.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, msg]);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    // Adiciona mensagem do usuário no chat e limpa o campo imediatamente para a mensagem não ficar presa
    setChatMessages(prev => [...prev, userMessage]);
    const messageText = trimmed;
    setChatInput('');
    setIsTyping(true);

    try {
      // Determinar qual endpoint usar baseado no fieldPath
      const isDiagnostico = selectedField.fieldPath.startsWith('diagnostico_principal') ||
        selectedField.fieldPath.startsWith('estado_geral') ||
        selectedField.fieldPath.startsWith('estado_mental') ||
        selectedField.fieldPath.startsWith('estado_fisiologico') ||
        selectedField.fieldPath.startsWith('integracao_diagnostica') ||
        selectedField.fieldPath.startsWith('habitos_vida');

      // ✅ FIX: Verificar TODAS as etapas de solução para usar o webhook correto
      const isSolucaoMentalidade = selectedField.fieldPath.startsWith('mentalidade_data') ||
        selectedField.fieldPath.startsWith('livro_vida');
      const isSolucaoSuplemementacao = selectedField.fieldPath.startsWith('suplementacao_data') ||
        selectedField.fieldPath.startsWith('suplementacao');
      const isSolucaoAlimentacao = selectedField.fieldPath.startsWith('alimentacao_data') ||
        selectedField.fieldPath.startsWith('alimentacao');
      const isSolucaoAtividadeFisica = selectedField.fieldPath.startsWith('atividade_fisica') ||
        selectedField.fieldPath.startsWith('exercicio');

      // Qualquer campo de solução usa o webhook de edição de solução
      const isSolucao = isSolucaoMentalidade || isSolucaoSuplemementacao ||
        isSolucaoAlimentacao || isSolucaoAtividadeFisica;

      const webhookEndpoints = getWebhookEndpoints();
      const webhookHeaders = getWebhookHeaders();

      // Cada tipo de edição vai para seu webhook específico:
      // - Soluções (todas as etapas): edicaoSolucao
      // - Diagnóstico: edicaoDiagnostico
      // - Análise/Anamnese: edicaoAnamnese
      const webhookUrl = isSolucao
        ? webhookEndpoints.edicaoSolucao
        : isDiagnostico
          ? webhookEndpoints.edicaoDiagnostico
          : webhookEndpoints.edicaoAnamnese; // Inclui tela de Análise (a_sintese_analitica.*)

      const requestBody: any = {
        origem: 'IA',
        fieldPath: selectedField.fieldPath,
        texto: messageText,
        consultaId: effectiveConsultaId,
      };

      // Adicionar solucao_etapa se for etapa de solução
      if (isSolucaoMentalidade) {
        requestBody.solucao_etapa = 'MENTALIDADE';
      } else if (isSolucaoSuplemementacao) {
        requestBody.solucao_etapa = 'SUPLEMENTACAO';
      } else if (isSolucaoAlimentacao) {
        requestBody.solucao_etapa = 'ALIMENTACAO';
      } else if (isSolucaoAtividadeFisica) {
        requestBody.solucao_etapa = 'ATIVIDADE_FISICA';
      }

      console.log('✅ [FIXED] Enviando para webhook:', requestBody);
      console.log('🔗 [FIXED] URL:', webhookUrl);

      // Faz requisição para nossa API interna (que chama o webhook)
      console.log('📤 Fazendo requisição para /ai/edit...');
      const response = await gatewayClient.post('/ai/edit', {
        ...requestBody,
        webhookUrl: webhookUrl
      });

      console.log('📥 Resposta recebida do Gateway:', response);

      console.log('Success?', response.success);

      if (!response.success) {
        console.error('Response not OK:', response.error);
        // Se for erro 500, pode ser problema no webhook, mas ainda mostramos a resposta
        if (response.warning) {
          throw new Error(response.message || 'Webhook de IA não disponível');
        }
        throw new Error('Erro ao comunicar com a IA');
      }

      // O gatewayClient já parseia a resposta JSON automaticamente
      const data = response;

      // A API retorna { success: true, result: "string_json" }
      // Precisamos extrair o result e fazer parse
      let webhookResponse = data.result || data;

      // Tentar parsear se for string JSON
      let parsedData;
      if (typeof webhookResponse === 'string') {
        try {
          parsedData = JSON.parse(webhookResponse);
        } catch (e) {
          // Se não conseguir fazer parse, usar a string diretamente
          parsedData = webhookResponse;
        }
      } else {
        parsedData = webhookResponse;
      }

      // Pega a resposta da IA - lidando com diferentes formatos
      let aiResponse = 'Não foi possível obter resposta da IA';

      if (Array.isArray(parsedData) && parsedData.length > 0) {
        // Formato esperado: [{"response": "texto"}]
        const firstItem = parsedData[0];
        if (firstItem && firstItem.response) {
          aiResponse = firstItem.response;
        } else if (firstItem && firstItem.message) {
          aiResponse = firstItem.message;
        } else if (firstItem && firstItem.text) {
          aiResponse = firstItem.text;
        } else if (firstItem && firstItem.answer) {
          aiResponse = firstItem.answer;
        }
      } else if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        // Se não é array, pode ser um objeto com diferentes campos
        if (parsedData.response) {
          aiResponse = parsedData.response;
        } else if (parsedData.text) {
          aiResponse = parsedData.text;
        } else if (parsedData.answer) {
          aiResponse = parsedData.answer;
        } else if (parsedData.message) {
          if (parsedData.message.includes('Workflow iniciado') || parsedData.message.includes('Processing')) {
            aiResponse = 'Workflow iniciado com sucesso. Processando sua solicitação...';
          } else {
            aiResponse = parsedData.message;
          }
        }
      } else if (typeof parsedData === 'string') {
        // Se ainda é string, usar diretamente
        aiResponse = parsedData;
      }

      //console.log('🎯 Campo usado para resposta:', usedField);
      //console.log('💬 Resposta final da IA:', aiResponse);

      // Adiciona resposta da IA no chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Recarregar dados após processamento da IA (com delay para dar tempo do processamento)
      setTimeout(async () => {
        try {
          // Se for um campo de diagnóstico, recarregar dados de diagnóstico
          const isDiagnostico = selectedField.fieldPath.startsWith('diagnostico_principal') ||
            selectedField.fieldPath.startsWith('estado_geral') ||
            selectedField.fieldPath.startsWith('estado_mental') ||
            selectedField.fieldPath.startsWith('estado_fisiologico') ||
            selectedField.fieldPath.startsWith('integracao_diagnostica') ||
            selectedField.fieldPath.startsWith('habitos_vida');

          if (isDiagnostico) {
            // Trigger refresh of diagnostico data by updating a state that triggers useEffect
            window.dispatchEvent(new CustomEvent('diagnostico-data-refresh'));
          } else {
            // Se for anamnese, recarregar dados de anamnese
            //console.log('🔍 DEBUG [REFERENCIA] Recarregando dados de anamnese após resposta da IA');
            window.dispatchEvent(new CustomEvent('anamnese-data-refresh'));
          }
        } catch (refreshError) {
          console.warn('Erro ao recarregar dados após IA:', refreshError);
        }
      }, 2000); // 2 segundos de delay

    } catch (error) {
      console.error('Erro ao enviar mensagem para IA:', error);

      // Adiciona mensagem de erro
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Carregar consultas só depois que dashboard e CSS estiverem carregados
  // Este useEffect é para mudanças de página e carregamento inicial
  useEffect(() => {
    const executeLoad = async () => {
      if (!consultaId && dashboardLoaded && cssLoaded) {
        // Se for mudança de página (não primeira renderização), não mostra loading
        const showLoading = isInitialMount.current;
        await loadConsultations(showLoading);
      }
    };

    executeLoad();
  }, [currentPage, consultaId, dashboardLoaded, cssLoaded]);

  // Buscar consultas quando filtros mudarem (com debounce)
  useEffect(() => {
    // Ignorar a primeira renderização (já foi feita busca no useEffect inicial)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Não fazer busca se ainda não carregou dashboard/CSS ou se estiver em detalhes
    if (!dashboardLoaded || !cssLoaded || consultaId) {
      return;
    }

    // Debounce de 1 segundo para evitar muitas requisições enquanto o usuário digita
    const timeoutId = setTimeout(() => {
      loadConsultations(false); // Não mostra loading durante busca com filtros
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  // Verificar se o dashboard está completamente carregado
  useEffect(() => {
    const checkDashboardLoaded = () => {
      // Verificar se elementos críticos do dashboard estão presentes e estilizados
      const sidebar = document.querySelector('.sidebar');
      const header = document.querySelector('.header');
      const mainContent = document.querySelector('.main-content');

      if (sidebar && header && mainContent) {
        // Verificar se os elementos têm estilos aplicados
        const sidebarStyles = window.getComputedStyle(sidebar);
        const headerStyles = window.getComputedStyle(header);

        const sidebarHasStyles = sidebarStyles.width !== 'auto' && sidebarStyles.width !== '0px';
        const headerHasStyles = headerStyles.height !== 'auto' && headerStyles.height !== '0px';

        if (sidebarHasStyles && headerHasStyles) {
          setDashboardLoaded(true);
          return true;
        }
      }

      return false;
    };

    // Verificar imediatamente
    if (checkDashboardLoaded()) return;

    // Verificar com intervalos menores para ser mais responsivo
    const checkInterval = setInterval(() => {
      if (checkDashboardLoaded()) {
        clearInterval(checkInterval);
      }
    }, 50);

    // Timeout de segurança - marcar como carregado após 2 segundos
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!dashboardLoaded) {
        setDashboardLoaded(true);
      }
    }, 2000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  // Verificar CSS (só depois que dashboard estiver carregado)
  useEffect(() => {
    if (!dashboardLoaded) return; // Aguardar dashboard carregar primeiro

    // Verificação rápida do CSS
    const checkCssLoaded = () => {
      const testElement = document.createElement('div');
      testElement.className = 'consultas-container';
      testElement.style.visibility = 'hidden';
      testElement.style.position = 'absolute';
      testElement.style.top = '-9999px';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      const hasStyles = computedStyle.padding !== '' || computedStyle.margin !== '';

      document.body.removeChild(testElement);

      if (hasStyles) {
        setCssLoaded(true);
      }
    };

    // Verificar imediatamente
    checkCssLoaded();

    // Fallback rápido: marcar como carregado após 500ms
    const fallbackTimer = setTimeout(() => {
      if (!cssLoaded) {
        setCssLoaded(true);
      }
    }, 500);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [dashboardLoaded]);

  // Função para carregar lista de consultas
  const loadConsultations = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const dateFilter = dateFilterType && selectedDate ? { type: dateFilterType, date: selectedDate } : undefined;
      const response = await fetchConsultations(currentPage, 20, searchTerm, statusFilter, dateFilter);

      // Atualizar apenas se houver mudanças (evita re-renders desnecessários)
      setConsultations(prev => {
        // Comparar IDs e status para detectar mudanças
        const hasChanges = prev.length !== response.consultations.length ||
          prev.some((oldConsultation, index) => {
            const newConsultation = response.consultations[index];
            if (!newConsultation) return true;
            return oldConsultation.id !== newConsultation.id ||
              oldConsultation.status !== newConsultation.status ||
              oldConsultation.etapa !== newConsultation.etapa ||
              oldConsultation.updated_at !== newConsultation.updated_at;
          });

        if (hasChanges) {
          return response.consultations;
        }
        return prev;
      });

      setTotalPages(response.pagination.totalPages);
      setTotalConsultations(response.pagination.total);
    } catch (err) {
      console.error('❌ [loadConsultations] ERRO:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [currentPage, searchTerm, statusFilter, dateFilterType, selectedDate]);

  // Efeito para cancelar automaticamente consultas de Telemedicina expiradas
  useEffect(() => {
    // Só executar se houver consultas carregadas
    if (!consultations || consultations.length === 0) return;

    const cancelExpiredConsultations = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Identificar consultas expiradas (Telemedicina, Agendamento, Data < Hoje)
      const expiredConsultations = consultations.filter(consultation => {
        if (consultation.consultation_type !== 'TELEMEDICINA') return false;
        if (consultation.status !== 'AGENDAMENTO') return false;
        if (!consultation.consulta_inicio) return false;

        const consultationDate = new Date(consultation.consulta_inicio);
        const cDay = new Date(consultationDate);
        cDay.setHours(0, 0, 0, 0);

        // Se a data da consulta for estritamente menor que hoje (ontem ou antes)
        return cDay < today;
      });

      if (expiredConsultations.length > 0) {
        console.log(`🧹 [AUTO-CANCEL] Encontradas ${expiredConsultations.length} consultas expiradas. Iniciando cancelamento...`);

        let updatedIds: string[] = [];

        // Processar cancelamentos
        await Promise.all(expiredConsultations.map(async (consultation) => {
          try {
            const response = await gatewayClient.patch(`/consultations/${consultation.id}`, {
              status: 'CANCELLED'
            });

            // Verificar sucesso da resposta (seja via propriedade success ou status 200)
            if (response && (response.success || response.status === 'CANCELLED' || response.consultation)) {
              console.log(`✅ [AUTO-CANCEL] Consulta ${consultation.id} cancelada com sucesso.`);
              updatedIds.push(consultation.id);
            }
          } catch (err) {
            console.error(`❌ [AUTO-CANCEL] Erro ao cancelar consulta ${consultation.id}:`, err);
          }
        }));

        // Se houve atualizações, refletir no estado local para evitar loop e atualizar UI
        if (updatedIds.length > 0) {
          setConsultations(prev => prev.map(c =>
            updatedIds.includes(c.id) ? { ...c, status: 'CANCELLED' } : c
          ));
          console.log(`🔄 [AUTO-CANCEL] Estado local atualizado para ${updatedIds.length} consultas.`);
        }
      }
    };

    cancelExpiredConsultations();
  }, [consultations]);

  // Carregar lista de consultas inicialmente
  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  // Polling automático para atualizar lista de consultas (especialmente status)
  useEffect(() => {
    // Só fazer polling na lista se não houver consulta específica aberta
    if (consultaId) return;

    // Verificar se há consultas em processamento na lista atual
    const hasProcessingConsultations = consultations.some(c =>
      ['PROCESSING', 'RECORDING'].includes(c.status)
    );

    // Se há consultas processando, fazer polling mais frequente
    const pollingInterval = hasProcessingConsultations ? 5000 : 15000; // 5s se processando, 15s caso contrário

    const intervalId = setInterval(async () => {
      try {
        await loadConsultations(false); // Modo silencioso para não mostrar loading
      } catch (error) {
        // Erro silencioso - não mostrar ao usuário
      }
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [consultations, consultaId, loadConsultations]); // Re-executar quando consultas mudarem ou consultaId mudar

  // Carregar detalhes quando houver consulta_id na URL
  useEffect(() => {
    console.log('🔄 useEffect consultaId mudou:', consultaId);
    if (consultaId) {
      console.log('📥 Carregando detalhes da consulta:', consultaId);
      fetchConsultaDetails(consultaId);
      // Resetar o estado do visualizador de soluções quando mudar de consulta
      setShowSolutionsViewer(false);
      // Se houver parâmetro section=anamnese na URL, abrir diretamente a seção de anamnese
      if (sectionParam === 'anamnese') {
        setSelectedSection('ANAMNESE');
      } else {
        // Resetar selectedSection quando mudar de consulta (a menos que tenha section param)
        setSelectedSection(null);
      }
    } else {
      console.log('❌ Nenhuma consulta selecionada, limpando detalhes');
      setConsultaDetails(null);
      setSelectedSection(null);
    }
  }, [consultaId, sectionParam]);

  // Verificar status da anamnese quando consulta for carregada ou quando entrar na seção de diagnóstico
  useEffect(() => {
    const verifyAnamneseStatus = async () => {
      if (!consultaDetails?.patient_id) {
        setAnamnesePreenchida(null);
        return;
      }

      // Se já tem solução, não precisa verificar
      if (consultaDetails.status === 'VALID_SOLUCAO' ||
        consultaDetails.status === 'COMPLETED' ||
        consultaDetails.etapa === 'SOLUCAO') {
        setAnamnesePreenchida(null);
        return;
      }

      // Verificar quando entrar na seção de diagnóstico
      if (selectedSection === 'DIAGNOSTICO') {
        const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
        setAnamnesePreenchida(isPreenchida);
      }
    };

    verifyAnamneseStatus();
  }, [consultaDetails?.patient_id, consultaDetails?.status, consultaDetails?.etapa, selectedSection, checkAnamnesePreenchida]);

  // Verificar status inicial quando a consulta for carregada (apenas uma vez)
  const hasCheckedInitialRef = useRef<string | null>(null);
  useEffect(() => {
    const verifyInitialStatus = async () => {
      if (!consultaDetails?.patient_id) {
        hasCheckedInitialRef.current = null;
        return;
      }

      // Se já verificamos para este paciente, não verificar novamente
      if (hasCheckedInitialRef.current === consultaDetails.patient_id) {
        return;
      }

      // Se já tem solução, não precisa verificar
      if (consultaDetails.status === 'VALID_SOLUCAO' ||
        consultaDetails.status === 'COMPLETED' ||
        consultaDetails.etapa === 'SOLUCAO') {
        return;
      }

      // Verificar quando a consulta for carregada pela primeira vez
      hasCheckedInitialRef.current = consultaDetails.patient_id;
      const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
      setAnamnesePreenchida(isPreenchida);
    };

    verifyInitialStatus();
  }, [consultaDetails?.patient_id, consultaDetails?.status, consultaDetails?.etapa, checkAnamnesePreenchida]);

  // Efeito para definir selectedSection automaticamente apenas quando houver parâmetro section=anamnese na URL
  // Não deve definir automaticamente baseado no status da consulta - deve mostrar a tela de overview primeiro
  useEffect(() => {
    if (!consultaDetails) return;

    // Apenas definir selectedSection como 'ANAMNESE' se houver o parâmetro section=anamnese na URL
    // Isso permite que o usuário clique no botão "Acessar Anamnese" e vá direto para a anamnese
    // Mas quando abre a consulta normalmente, mostra a tela de overview primeiro
    if (sectionParam === 'anamnese' && selectedSection !== 'ANAMNESE') {
      setSelectedSection('ANAMNESE');
    }
  }, [consultaDetails, selectedSection, sectionParam]);

  // Polling automático para atualizar status da consulta (SEMPRE ativo quando há consulta aberta)
  // Ref para controlar se devemos parar o polling (ex: erro 401)
  const pollingActiveRef = useRef(true);

  useEffect(() => {
    if (!consultaId) return;

    // Resetar flag de polling ativo quando consultaId mudar
    pollingActiveRef.current = true;

    // Determinar intervalo baseado no status atual
    const getPollingInterval = (currentStatus: string | null) => {
      if (!currentStatus) return 5000; // Default: 5 segundos

      // Status que mudam frequentemente: polling mais rápido
      if (['PROCESSING', 'RECORDING'].includes(currentStatus)) {
        return 3000; // 3 segundos
      }
      // Status estáveis: polling menos frequente
      if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(currentStatus)) {
        return 60000; // 60 segundos (reduzido - status estável não precisa de polling frequente)
      }
      // Status intermediários
      return 5000; // 5 segundos
    };

    const currentStatus = consultaDetails?.status || null;
    const pollingInterval = getPollingInterval(currentStatus);

    const intervalId = setInterval(async () => {
      // ✅ CORREÇÃO: Verificar se polling ainda está ativo antes de fazer requisição
      if (!pollingActiveRef.current) {
        console.log('⏹️ Polling desativado, ignorando requisição');
        clearInterval(intervalId);
        return;
      }

      try {
        // Buscar dados diretamente da API (com cache busting para garantir dados frescos)
        const response = await gatewayClient.get(`/consultations/${consultaId}?t=${Date.now()}`);

        // ✅ CORREÇÃO: Se erro 401 (não autenticado), parar polling imediatamente
        if (response.status === 401) {
          console.warn('⚠️ Sessão expirada - parando polling de consultas');
          pollingActiveRef.current = false;
          clearInterval(intervalId);
          // Não redirecionar automaticamente - deixar o usuário saber que precisa fazer login
          return;
        }

        // ✅ CORREÇÃO: Se erro 403 ou 404, parar polling (consulta não existe ou sem permissão)
        if (response.status === 403 || response.status === 404) {
          console.warn(`⚠️ Consulta não acessível (${response.status}) - parando polling`);
          pollingActiveRef.current = false;
          clearInterval(intervalId);
          return;
        }

        if (response.success) {
          const data = response;
          const newConsultation = data.consultation;

          if (!newConsultation) {
            return;
          }

          const newStatus = newConsultation.status;
          const newEtapa = newConsultation.etapa;
          const newSolucaoEtapa = newConsultation.solucao_etapa;
          const newUpdatedAt = newConsultation.updated_at;

          // Comparar com os dados atuais (usar consultaDetails do estado, não a variável local)
          // Isso garante que sempre comparamos com o estado mais recente
          setConsultaDetails(prev => {
            if (!prev) {
              return newConsultation;
            }

            // Verificar mudanças em campos importantes
            const statusChanged = prev.status !== newStatus;
            const etapaChanged = prev.etapa !== newEtapa;
            const solucaoEtapaChanged = prev.solucao_etapa !== newSolucaoEtapa;
            const updatedAtChanged = prev.updated_at !== newUpdatedAt;

            // Se QUALQUER campo importante mudou, atualizar
            if (statusChanged || etapaChanged || solucaoEtapaChanged || updatedAtChanged) {
              return newConsultation;
            }

            // Nenhuma mudança detectada
            return prev; // Retornar o mesmo objeto para evitar re-render desnecessário
          });
        }
      } catch (error) {
        // Erro de rede - pode continuar tentando, mas logar para debug
        console.warn('⚠️ Erro no polling de consulta:', error);
      }
    }, pollingInterval);

    // Cleanup: parar polling quando componente desmontar ou consulta mudar
    return () => {
      clearInterval(intervalId);
    };
  }, [consultaId, consultaDetails?.status]); // Re-executar quando consultaId ou status mudar

  // Carregar dados de atividade física quando a etapa for ATIVIDADE_FISICA
  useEffect(() => {
    if (consultaId && consultaDetails?.solucao_etapa === 'ATIVIDADE_FISICA') {
      loadAtividadeFisicaData();
    }
  }, [consultaId, consultaDetails?.solucao_etapa]);

  // Listener para recarregar dados de anamnese quando a IA processar
  useEffect(() => {
    const handleAnamneseRefresh = () => {
      console.log('🔍 DEBUG [REFERENCIA] Evento de refresh de anamnese recebido');
      // Disparar evento para o componente AnamneseSection
      window.dispatchEvent(new CustomEvent('force-anamnese-refresh'));
    };

    window.addEventListener('anamnese-data-refresh', handleAnamneseRefresh);

    return () => {
      window.removeEventListener('anamnese-data-refresh', handleAnamneseRefresh);
    };
  }, []);

  const loadAtividadeFisicaData = async () => {
    if (!consultaId) return;

    try {
      setLoadingAtividadeFisica(true);
      console.log('🔍 DEBUG [REFERENCIA] Iniciando carregamento de dados de atividade física para consulta:', consultaId);

      const response = await gatewayClient.get(`/atividade-fisica/${consultaId}`);
      console.log('🔍 DEBUG [REFERENCIA] Resposta da API:', response.status);

      if (response.success) {
        const data = response;
        console.log('🔍 DEBUG [REFERENCIA] Dados recebidos da API:', data);
        const exercicios = data.atividade_fisica_data || [];
        console.log('🔍 DEBUG [REFERENCIA] Exercícios para setar:', exercicios.length, 'exercícios');
        setAtividadeFisicaData(exercicios);
        console.log('🔍 DEBUG [REFERENCIA] Estado atividadeFisicaData atualizado');
      } else {
        console.error('❌ Erro na resposta da API:', response.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados de Atividade Física:', error);
    } finally {
      setLoadingAtividadeFisica(false);
    }
  };

  // Função para buscar exercícios da lista
  const searchExercicios = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setExercicioSuggestions([]);
      return;
    }

    try {
      const response = await gatewayClient.get(`/lista-exercicios-fisicos?search=${encodeURIComponent(searchTerm)}`);
      if (response.success) {
        const data = response;
        setExercicioSuggestions(data.exercicios || []);
      } else {
        setExercicioSuggestions([]);
      }
    } catch (error) {
      setExercicioSuggestions([]);
    }
  };

  // Função para atualizar exercício LOCALMENTE (sem salvar no banco)
  const handleUpdateExercicioLocal = (id: number, field: string, newValue: string) => {
    // Atualizar o estado local
    setAtividadeFisicaData(prev => prev.map(ex =>
      ex.id === id ? { ...ex, [field]: newValue } : ex
    ));

    // Registrar a alteração pendente
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: newValue }
    }));

    setHasUnsavedChanges(true);
    setEditingExercicio(null);
  };

  // Função para SALVAR TODAS as alterações no banco
  const handleSaveAllChanges = async () => {
    if (!consultaId || Object.keys(pendingChanges).length === 0) return;

    try {
      setIsSaving(true);

      // Salvar cada alteração pendente
      for (const [exercicioId, changes] of Object.entries(pendingChanges)) {
        for (const [field, value] of Object.entries(changes)) {
          const response = await gatewayClient.post(`/atividade-fisica/${consultaId}/update-field`, {
            id: Number(exercicioId),
            field,
            value
          });

          if (!response.success) throw new Error(`Erro ao atualizar ${field}`);
        }
      }

      // Notificar webhook via proxy (evita CORS)
      try {
        await gatewayClient.post('/webhook/proxy', {
          endpoint: 'edicaoSolucao',
          payload: {
            origem: 'MANUAL',
            fieldPath: 's_exercicios_fisicos',
            texto: 'Múltiplas alterações salvas',
            consultaId,
            solucao_etapa: 'ATIVIDADE_FISICA'
          }
        });
      } catch (webhookError) {
        console.warn('Webhook não notificado:', webhookError);
      }

      // Limpar alterações pendentes
      setPendingChanges({});
      setHasUnsavedChanges(false);

      // Mostrar sucesso (você pode adicionar um toast aqui)
      //alert('Alterações salvas com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      // Usar sistema de notificações ao invés de alert
      // showError será usado se disponível, senão apenas console.error
      console.error('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função antiga mantida para compatibilidade (não usada mais)
  const handleSaveExercicio = async (id: number, field: string, newValue: string) => {
    handleUpdateExercicioLocal(id, field, newValue);
  };

  // Função para selecionar solução
  const handleSelectSolucao = async (solucaoEtapa: 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA') => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      console.log('🔍 [handleSelectSolucao] Iniciando seleção de solução:', solucaoEtapa);

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: solucaoEtapa,
        etapa: 'SOLUCAO',
        status: 'VALID_SOLUCAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      console.log('✅ [handleSelectSolucao] Consulta atualizada com sucesso');

      // Resetar estados que podem interferir
      setForceShowSolutionSelection(false);
      // NÃO resetar selectedSection aqui - deixar null para que renderConsultationContent determine o que mostrar
      // Mas garantir que não vá para a tela intermediária quando há solução selecionada
      setSelectedSection(null);

      // Aguardar um pouco antes de recarregar para garantir que o banco foi atualizado
      await new Promise(resolve => setTimeout(resolve, 200));

      // Recarregar detalhes da consulta
      console.log('🔄 [handleSelectSolucao] Recarregando detalhes da consulta...');
      await fetchConsultaDetails(consultaId);

      console.log('✅ [handleSelectSolucao] Detalhes recarregados');
    } catch (error) {
      console.error('❌ [handleSelectSolucao] Erro ao selecionar solução:', error);
      showError('Erro ao selecionar solução. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAtividadeFisicaAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Limpa a solucao_etapa para mostrar a tela de seleção
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: null
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarregar detalhes da consulta
      await fetchConsultaDetails(consultaId);

    } catch (error) {
      console.error('Erro ao salvar e continuar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchConsultaDetails = async (id: string, silent = false) => {
    try {
      console.log('🔍 [fetchConsultaDetails] INICIANDO para ID:', id);
      if (!silent) {
        setLoadingDetails(true);
      }
      setError(null);
      const response = await gatewayClient.get(`/consultations/${id}`);
      console.log('📡 [fetchConsultaDetails] Response recebido:', response.success ? 'SUCESSO' : 'ERRO');

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      const data = response.data || response;
      const newConsultation = data.consultation || data;

      // Logs para debug de consulta_inicio, consulta_fim e duration
      console.log('📅 Dados da consulta recebidos (duração):', {
        duration: newConsultation?.duration,
        duracao: (newConsultation as any)?.duracao,
        consulta_inicio: newConsultation?.consulta_inicio,
        consulta_fim: newConsultation?.consulta_fim,
        created_at: newConsultation?.created_at,
        todas_as_colunas_consulta: Object.keys(newConsultation || {}).filter(k =>
          k.toLowerCase().includes('consulta') ||
          k.toLowerCase().includes('inicio') ||
          k.toLowerCase().includes('fim') ||
          k.toLowerCase().includes('start') ||
          k.toLowerCase().includes('end') ||
          k.toLowerCase().includes('duration') ||
          k.toLowerCase().includes('duracao')
        )
      });

      // Log específico para debug de soluções
      console.log('🔍 [fetchConsultaDetails] Dados recebidos:', {
        status: newConsultation?.status,
        etapa: newConsultation?.etapa,
        solucao_etapa: newConsultation?.solucao_etapa
      });

      // Atualizar consulta e forçar re-render
      setConsultaDetails(newConsultation);
      setForceRender(prev => prev + 1);
      console.log('✅ [fetchConsultaDetails] setConsultaDetails EXECUTADO!');
    } catch (err) {
      console.error('❌ [fetchConsultaDetails] ERRO:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes da consulta');
    } finally {
      if (!silent) {
        setLoadingDetails(false);
      }
    }
  };

  const handleConsultationClick = (consultation: Consultation) => {
    console.log('🖱️ Clicando na consulta:', consultation.id, consultation.patient_name);
    fetchConsultaDetails(consultation.id);
  };

  const handleBackToList = () => {
    // Limpar state
    setConsultaDetails(null);
    setSelectedSection(null);
  };

  // Função para editar consulta
  const handleEditConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta

    // Se for agendamento, abre o modal de edição
    if (consultation.status === 'AGENDAMENTO') {
      // Determinar data/hora do agendamento
      const dateTime = consultation.consulta_inicio
        ? new Date(consultation.consulta_inicio)
        : new Date(consultation.created_at);

      const dateStr = dateTime.toISOString().split('T')[0];
      const timeStr = dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      setEditAgendamentoForm({
        date: dateStr,
        time: timeStr,
        type: consultation.consultation_type
      });
      setEditingAgendamento(consultation);
      setShowEditAgendamentoModal(true);
    } else {
      // Para outras consultas, abre os detalhes
      router.push(`/consultas?consulta_id=${consultation.id}`);
    }
  };

  // Função para fechar modal de edição de agendamento
  const handleCloseEditAgendamentoModal = () => {
    setShowEditAgendamentoModal(false);
    setEditingAgendamento(null);
    setEditAgendamentoForm({ date: '', time: '', type: 'TELEMEDICINA' });
  };

  // Função para salvar edição de agendamento
  const handleSaveAgendamentoEdit = async () => {
    if (!editingAgendamento) return;

    setIsSavingAgendamento(true);
    try {
      // Criar datetime combinando data e hora
      const [year, month, day] = editAgendamentoForm.date.split('-').map(Number);
      const [hours, minutes] = editAgendamentoForm.time.split(':').map(Number);
      const consultaInicio = new Date(year, month - 1, day, hours, minutes).toISOString();

      const response = await gatewayClient.patch(`/consultations/${editingAgendamento.id}`, {
        consulta_inicio: consultaInicio,
        consultation_type: editAgendamentoForm.type
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Atualizar lista local
      setConsultations(prev => prev.map(c => {
        if (c.id === editingAgendamento.id) {
          return {
            ...c,
            consulta_inicio: consultaInicio,
            consultation_type: editAgendamentoForm.type
          };
        }
        return c;
      }));

      showSuccess('Agendamento atualizado com sucesso!', 'Sucesso');
      handleCloseEditAgendamentoModal();
    } catch (error: any) {
      console.error('Erro ao atualizar agendamento:', error);
      showError(error.message || 'Erro ao atualizar agendamento', 'Erro');
    } finally {
      setIsSavingAgendamento(false);
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const handleDeleteConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta
    setConsultationToDelete(consultation);
    setShowDeleteModal(true);
  };

  // Função para confirmar exclusão da consulta
  const confirmDeleteConsultation = async () => {
    if (!consultationToDelete) return;

    setIsDeleting(true);
    try {
      const response = await gatewayClient.delete(`/consultations/${consultationToDelete.id}`);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Atualiza a lista removendo a consulta excluída
      setConsultations(prev => prev.filter(c => c.id !== consultationToDelete.id));
      setTotalConsultations(prev => prev - 1);

      // Fecha o modal
      setShowDeleteModal(false);
      setConsultationToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir consulta:', err);
      showError('Erro ao excluir consulta. Por favor, tente novamente.', 'Erro');
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para cancelar exclusão
  const cancelDeleteConsultation = () => {
    setShowDeleteModal(false);
    setConsultationToDelete(null);
  };

  // Função para entrar em uma consulta agendada
  const handleEnterConsultation = (e: React.MouseEvent, consultation: Consultation) => {
    e.stopPropagation(); // Previne a abertura da consulta

    // Redirecionar para a página de nova consulta com os dados do agendamento
    // Isso permite que a consulta seja iniciada com Socket.IO e WebRTC
    router.push(`/consulta/nova?agendamento_id=${consultation.id}&patient_id=${consultation.patient_id}&patient_name=${encodeURIComponent(consultation.patient_name)}&consultation_type=${consultation.consultation_type}`);
  };

  // Função para salvar alterações da ANAMNESE e mudar para próxima etapa (DIAGNOSTICO SENDO PROCESSADO)
  const handleSaveAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);

      // Verificar se já existe diagnóstico gerado - se sim, apenas avançar sem reprocessar
      const shouldGenerate = !hasDiagnosticoData();

      // Atualiza a etapa da consulta para DIAGNOSTICO
      // Se os dados já existem, apenas atualiza a etapa sem alterar o status
      const updateData: any = {
        etapa: 'DIAGNOSTICO'
      };

      // Só altera o status se precisar gerar (não se já existe)
      if (shouldGenerate) {
        updateData.status = 'PROCESSING';
      }

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, updateData);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Disparar webhook apenas se precisar gerar (não se já existe)
      if (shouldGenerate) {
        try {
          const webhookEndpoints = getWebhookEndpoints();
          const webhookHeaders = getWebhookHeaders();

          await fetch(webhookEndpoints.diagnosticoPrincipal, {
            method: 'POST',
            headers: webhookHeaders,
            body: JSON.stringify({
              consultaId: consultaDetails.id,
              medicoId: consultaDetails.doctor_id,
              pacienteId: consultaDetails.patient_id
            }),
          });
          console.log('✅ Webhook de diagnóstico disparado com sucesso');
        } catch (webhookError) {
          console.warn('⚠️ Webhook de diagnóstico falhou, mas consulta foi atualizada:', webhookError);
        }
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);

      // Navegar automaticamente para a seção de Diagnóstico
      setSelectedSection('DIAGNOSTICO');

      // Mensagem de sucesso apropriada
      if (shouldGenerate) {
        showSuccess('Diagnóstico em processamento!', 'Sucesso');
      } else {
        showSuccess('Avançando para Diagnóstico...', 'Sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para solicitar confirmação antes de avançar
  const requestAdvanceConfirmation = (action: () => Promise<void>, message: string) => {
    setAdvanceAction(() => action);
    setAdvanceMessage(message);
    setShowAdvanceModal(true);
  };

  // Função para confirmar avanço de etapa
  const confirmAdvance = async () => {
    if (advanceAction) {
      setShowAdvanceModal(false);
      await advanceAction();
      setAdvanceAction(null);
      setAdvanceMessage('');
    }
  };

  // Função para cancelar avanço
  const cancelAdvance = () => {
    setShowAdvanceModal(false);
    setAdvanceAction(null);
    setAdvanceMessage('');
  };

  // Função para salvar alterações do DIAGNÓSTICO e mudar para etapa de SOLUÇÃO
  const handleSaveDiagnosticoAndContinue = async () => {
    if (!consultaId || !consultaDetails) return;

    try {
      setIsSaving(true);

      // Verificar se já existe solução gerada - se sim, apenas avançar sem reprocessar
      const shouldGenerate = !hasSolucaoData();

      // Se precisar gerar solução, verificar se anamnese está preenchida
      if (shouldGenerate && consultaDetails.patient_id) {
        const isAnamnesePreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
        setAnamnesePreenchida(isAnamnesePreenchida);

        if (!isAnamnesePreenchida) {
          showWarning(
            'A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.',
            'Anamnese Não Preenchida'
          );
          setIsSaving(false);
          return;
        }
      }

      // Atualiza a etapa da consulta para SOLUCAO sem definir solucao_etapa (mostra tela de seleção)
      // Se os dados já existem, apenas atualiza a etapa sem alterar o status
      const updateData: any = {
        etapa: 'SOLUCAO',
        solucao_etapa: null
      };

      // Só altera o status se precisar gerar (não se já existe)
      if (shouldGenerate) {
        updateData.status = 'PROCESSING';
      }

      const response = await gatewayClient.patch(`/consultations/${consultaId}`, updateData);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Disparar webhook apenas se precisar gerar (não se já existe)
      if (shouldGenerate) {
        try {
          const webhookEndpoints = getWebhookEndpoints();
          const webhookHeaders = getWebhookHeaders();

          await fetch(webhookEndpoints.edicaoLivroDaVida, {
            method: 'POST',
            headers: webhookHeaders,
            body: JSON.stringify({
              consultaId: consultaDetails.id,
              medicoId: consultaDetails.doctor_id,
              pacienteId: consultaDetails.patient_id
            }),
          });
          console.log('✅ Webhook de solução disparado com sucesso');
        } catch (webhookError) {
          console.warn('⚠️ Webhook de solução falhou, mas consulta foi atualizada:', webhookError);
        }
      }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);

      // Navegar automaticamente para a tela de seleção de soluções
      setForceShowSolutionSelection(true);
      setSelectedSection(null);

      // Mensagem de sucesso apropriada
      if (shouldGenerate) {
        showSuccess('Solução em processamento!', 'Sucesso');
      } else {
        showSuccess('Avançando para Solução...', 'Sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };


  // Função para salvar alterações do Livro da Vida e mudar para ALIMENTACAO
  const handleSaveMentalidadeAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para ALIMENTACAO (NOTA: Pulando para SUPLEMENTACAO)
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'SUPLEMENTACAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do ALIMENTACAO e mudar para SUPLEMENTACAO
  const handleSaveAlimentacaoAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para SUPLEMENTACAO
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'SUPLEMENTACAO'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para salvar alterações do SUPLEMENTACAO e mudar para ATIVIDADE_FISICA
  const handleSaveSuplemementacaoAndContinue = async () => {
    if (!consultaId) return;

    try {
      setIsSaving(true);

      // Atualiza a solucao_etapa para ATIVIDADE_FISICA
      const response = await gatewayClient.patch(`/consultations/${consultaId}`, {
        solucao_etapa: 'ATIVIDADE_FISICA'
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Recarrega os dados da consulta
      await fetchConsultaDetails(consultaId);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      showError('Erro ao salvar alterações. Tente novamente.', 'Erro');
    } finally {
      setIsSaving(false);
    }
  };

  // Funções de formatação para lista
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = dateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoje, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === -1) {
      return 'Ontem, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Funções de formatação para detalhes
  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatConsultaHorario = (consulta: Consultation) => {
    if (consulta.consulta_inicio && consulta.consulta_fim) {
      const data = formatDateOnly(consulta.consulta_inicio);
      const inicio = formatTime(consulta.consulta_inicio);
      const fim = formatTime(consulta.consulta_fim);
      return `${data} ${inicio} - ${fim}`;
    } else if (consulta.consulta_inicio) {
      const data = formatDateOnly(consulta.consulta_inicio);
      const inicio = formatTime(consulta.consulta_inicio);
      return `${data} ${inicio}`;
    } else {
      return formatFullDate(consulta.created_at);
    }
  };

  const formatDuration = (input?: number | Consultation) => {
    if (!input) return 'N/A';

    let durationInSeconds: number | null = null;

    if (typeof input === 'number') {
      durationInSeconds = input;
    } else {
      // 1. Tentar campo duration (em segundos)
      if (input.duration && input.duration > 0) {
        durationInSeconds = input.duration;
      }
      // 2. Tentar campo duracao (pode estar em minutos)
      else if ((input as any).duracao && (input as any).duracao > 0) {
        const duracaoMinutos = Number((input as any).duracao);
        if (duracaoMinutos > 0 && duracaoMinutos < 1440) {
          durationInSeconds = Math.floor(duracaoMinutos * 60);
        }
      }
      // 3. Calcular a partir de consulta_inicio e consulta_fim
      else if (input.consulta_inicio && input.consulta_fim) {
        try {
          const inicio = new Date(input.consulta_inicio);
          const fim = new Date(input.consulta_fim);
          if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
          }
        } catch (error) {
          console.error('Erro ao calcular duração no formatDuration global:', error);
        }
      }
    }

    if (!durationInSeconds || durationInSeconds <= 0) {
      return 'N/A';
    }

    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const secs = durationInSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes} min`;
    } else {
      return `${secs}s`;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'RECORDING': return 'status-recording';
      case 'PROCESSING': return 'status-processing';
      case 'VALIDATION': return 'status-processing';
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
      case 'VALIDATION': return 'Validação';
      case 'COMPLETED': return 'Concluída';
      case 'ERROR': return 'Erro';
      case 'CANCELLED': return 'Cancelada';
      default: return status;
    }
  };

  const mapConsultationType = (type: string) => {
    return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
  };

  const getTypeIcon = (type: string) => {
    return type === 'TELEMEDICINA' ? <Video className="type-icon" /> : <User className="type-icon" />;
  };

  const generateAvatar = (name: string, profilePic?: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const colorIndex = name.length % colors.length;

    if (profilePic) {
      return (
        <div className="patient-avatar">
          <img
            src={profilePic}
            alt={name}
            className="avatar-image"
            onError={(e) => {
              // Se a imagem falhar ao carregar, substituir por placeholder
              const target = e.target as HTMLImageElement;
              const parent = target.parentElement;
              if (parent) {
                // Limpar completamente o conteúdo
                parent.innerHTML = '';
                // Aplicar todas as classes CSS necessárias
                parent.className = 'avatar-placeholder';
                // Aplicar estilo de fundo correto
                parent.style.background = '#1B4266';
                parent.style.width = '48px';
                parent.style.height = '48px';
                parent.style.borderRadius = '50%';
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
                parent.style.fontSize = '15px';
                parent.style.fontWeight = '700';
                parent.style.color = 'white';
                parent.style.flexShrink = '0';
                parent.style.position = 'relative';
                parent.style.boxShadow = '0 4px 12px rgba(27, 66, 102, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)';
                parent.style.transition = 'all 0.3s ease';
                parent.style.isolation = 'isolate';
                // Adicionar o texto
                parent.textContent = initials;
              }
            }}
          />
        </div>
      );
    }

    return (
      <div
        className="avatar-placeholder"
        style={{ background: '#1B4266' }}
      >
        {initials}
      </div>
    );
  };

  // Renderizar loading único - aguardar apenas dashboard, CSS e loadingDetails
  if (!dashboardLoaded || !cssLoaded || loadingDetails) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f9fafb',
        color: '#1f2937',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #1B4266',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
            Carregando...
          </p>
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  // Renderizar erro
  if (error) {
    return (
      <div className="consultas-container">
        <div className="consultas-header">
          <h1 className="consultas-title">
            {consultaId ? 'Detalhes da Consulta' : 'Lista de Consultas'}
          </h1>
        </div>
        <div className="error-container">
          <AlertCircle className="error-icon" />
          <h3>{consultaId ? 'Erro ao carregar detalhes' : 'Erro ao carregar consultas'}</h3>
          <p>{error}</p>
          <button
            className="retry-button"
            onClick={() => consultaId ? fetchConsultaDetails(consultaId) : loadConsultations(true)}
          >
            Tentar novamente
          </button>
          {consultaId && (
            <button
              className="back-button"
              onClick={handleBackToList}
              style={{ marginTop: '10px' }}
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
              Voltar para lista
            </button>
          )}
        </div>
      </div>
    );
  }


  // Funções auxiliares para verificar se há dados disponíveis
  // Anamnese sempre está acessível (primeira etapa)
  const hasAnamneseData = (): boolean => {
    return true; // Anamnese sempre acessível
  };

  // Verifica se há dados de anamnese validados (para texto do botão)
  const hasValidAnamneseData = (): boolean => {
    if (!consultaDetails) return false;
    return consultaDetails.status === 'VALID_ANAMNESE' ||
      (consultaDetails.status === 'VALIDATION' && consultaDetails.etapa === 'ANAMNESE') ||
      consultaDetails.etapa === 'DIAGNOSTICO' ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'VALID_DIAGNOSTICO' ||
      consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  const hasDiagnosticoData = (): boolean => {
    if (!consultaDetails) return false;
    return consultaDetails.status === 'VALID_DIAGNOSTICO' ||
      (consultaDetails.status === 'VALIDATION' && consultaDetails.etapa === 'DIAGNOSTICO') ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  // Verifica se há dados de solução disponíveis (só acessível quando solução já foi gerada)
  const hasSolucaoData = (): boolean => {
    if (!consultaDetails) return false;
    // Solução acessível APENAS quando solução já foi gerada/validada
    return consultaDetails.status === 'VALID_SOLUCAO' ||
      consultaDetails.etapa === 'SOLUCAO' ||
      consultaDetails.status === 'COMPLETED';
  };

  // Função para renderizar o conteúdo baseado no status e etapa
  const renderConsultationContent = (): 'ANAMNESE' | 'DIAGNOSTICO' | 'SOLUCAO_MENTALIDADE' | 'SOLUCAO_SUPLEMENTACAO' | 'SOLUCAO_ALIMENTACAO' | 'SOLUCAO_ATIVIDADE_FISICA' | 'SELECT_SOLUCAO' | JSX.Element | null => {
    if (!consultaDetails) return null;

    // 🔍 DEBUG: Log do status e etapa da consulta
    console.log('🔍 DEBUG renderConsultationContent:', {
      status: consultaDetails.status,
      etapa: consultaDetails.etapa,
      solucao_etapa: consultaDetails.solucao_etapa
    });

    // STATUS = PROCESSING
    if (consultaDetails.status === 'PROCESSING') {
      // Definir mensagens baseadas na etapa
      let titulo = 'Processando Consulta';
      let descricao = 'As informações da consulta estão sendo processadas';

      if (consultaDetails.etapa === 'DIAGNOSTICO') {
        titulo = 'Processando Diagnóstico';
        descricao = 'As informações do diagnóstico estão sendo processadas';
      }
      if (consultaDetails.etapa === 'SOLUCAO') {
        titulo = 'Processando Solução';
        descricao = 'As informações da solução estão sendo processadas';
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid #f0f0f0',
          textAlign: 'center',
          minHeight: '400px'
        }}>
          <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
          <h2 style={{ marginBottom: '10px', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{titulo}</h2>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>{descricao}</p>
        </div>
      );
    }

    // STATUS = COMPLETED
    if (consultaDetails.status === 'COMPLETED') {
      return (
        <div className="modal-overlay">
          <div className="modal-content completion-modal-content">
            <Sparkles className="completion-icon" />
            <h2 className="completion-title">
              Processamento Concluído
            </h2>
            <p className="completion-message">
              A consulta foi processada com sucesso. <br />
              A tela de visualização completa será implementada em breve.
            </p>
            <button
              onClick={handleBackToList}
              className="btn-completion-back"
            >
              Voltar para lista
            </button>
          </div>
        </div>
      );
    }

    // STATUS = VALID_ANAMNESE
    if (consultaDetails.status === 'VALID_ANAMNESE') {
      // Retorna a tela atual de anamnese (será renderizado depois)
      return 'ANAMNESE';
    }

    // STATUS = VALID_DIAGNOSTICO
    if (consultaDetails.status === 'VALID_DIAGNOSTICO') {
      // Retorna a tela de diagnóstico (será renderizado depois)
      return 'DIAGNOSTICO';
    }

    // STATUS = VALID_SOLUCAO
    if (consultaDetails.status === 'VALID_SOLUCAO') {
      console.log('🔍 [renderConsultationContent] STATUS = VALID_SOLUCAO, solucao_etapa:', consultaDetails.solucao_etapa);

      // Se for MENTALIDADE, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'MENTALIDADE') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_MENTALIDADE');
        return 'SOLUCAO_MENTALIDADE';
      }

      // Se for SUPLEMENTACAO, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'SUPLEMENTACAO') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_SUPLEMENTACAO');
        return 'SOLUCAO_SUPLEMENTACAO';
      }

      // Se for ALIMENTACAO, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'ALIMENTACAO') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_ALIMENTACAO');
        return 'SOLUCAO_ALIMENTACAO';
      }

      // Se for ATIVIDADE_FISICA, retornar a tela de edição completa
      if (consultaDetails.solucao_etapa === 'ATIVIDADE_FISICA') {
        console.log('✅ [renderConsultationContent] Retornando SOLUCAO_ATIVIDADE_FISICA');
        return 'SOLUCAO_ATIVIDADE_FISICA';
      }

      // Se não tiver solucao_etapa definida, mostrar tela de seleção
      console.log('⚠️ [renderConsultationContent] solucao_etapa não definida, retornando SELECT_SOLUCAO');
      return 'SELECT_SOLUCAO';
    }

    // STATUS = VALIDATION (mantido para compatibilidade)
    if (consultaDetails.status === 'VALIDATION') {
      // ETAPA = ANAMNESE
      if (consultaDetails.etapa === 'ANAMNESE') {
        // Retorna a tela atual de anamnese (será renderizado depois)
        return 'ANAMNESE';
      }

      // ETAPA = DIAGNOSTICO
      if (consultaDetails.etapa === 'DIAGNOSTICO') {
        // Retorna a tela de diagnóstico (será renderizado depois)
        //console.log('🔍 renderConsultationContent - Retornando DIAGNOSTICO para consulta:', consultaDetails.id);
        return 'DIAGNOSTICO';
      }

      // ETAPA = SOLUCAO
      if (consultaDetails.etapa === 'SOLUCAO') {
        // Se não houver solucao_etapa definida, mostrar tela de seleção
        if (!consultaDetails.solucao_etapa) {
          return 'SELECT_SOLUCAO';
        }

        // Se for MENTALIDADE, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'MENTALIDADE') {
          return 'SOLUCAO_MENTALIDADE';
        }

        // Se for SUPLEMENTACAO, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'SUPLEMENTACAO') {
          return 'SOLUCAO_SUPLEMENTACAO';
        }

        // Se for ALIMENTACAO, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'ALIMENTACAO') {
          return 'SOLUCAO_ALIMENTACAO';
        }

        // Se for ATIVIDADE_FISICA, retornar a tela de edição completa
        if (consultaDetails.solucao_etapa === 'ATIVIDADE_FISICA') {
          console.log('🔍 DEBUG [REFERENCIA] Solução etapa é ATIVIDADE_FISICA, retornando SOLUCAO_ATIVIDADE_FISICA');
          return 'SOLUCAO_ATIVIDADE_FISICA';
        }

      }
    }

    // Retorna ANAMNESE como padrão para outros casos
    return 'ANAMNESE';
  };

  // Renderizar detalhes da consulta (forceRender usado para garantir re-render)
  console.log(`🎯 [RENDER #${forceRender}]`, consultaDetails ? `Detalhes: ${consultaDetails.id}` : 'Lista de consultas');
  if (consultaDetails) {
    console.log('✅ [RENDER] RENDERIZANDO DETALHES! Status:', consultaDetails.status);
    // Se showSolutionsViewer for true, renderiza o visualizador de soluções
    if (showSolutionsViewer) {
      return (
        <SolutionsViewer
          consultaId={consultaId!}
          onBack={() => setShowSolutionsViewer(false)}
          onSolutionSelect={(solutionType) => {
            // Mapear o tipo de solução para a etapa correspondente
            const solutionMapping: Record<string, string> = {
              'mentalidade': 'MENTALIDADE',
              'alimentacao': 'ALIMENTACAO',
              'suplementacao': 'SUPLEMENTACAO',
              'exercicios': 'ATIVIDADE_FISICA'
            };

            const etapa = solutionMapping[solutionType] as 'MENTALIDADE' | 'ALIMENTACAO' | 'SUPLEMENTACAO' | 'ATIVIDADE_FISICA' | undefined;
            if (etapa) {
              // Atualizar a consulta com a etapa selecionada
              handleSelectSolucao(etapa);
              // Voltar para a tela principal
              setShowSolutionsViewer(false);
            }
          }}
        />
      );
    }

    // Se forceShowSolutionSelection for true, renderizar a tela de seleção de soluções diretamente
    if (forceShowSolutionSelection) {
      // Renderizar a tela de seleção de soluções diretamente, sem depender do renderConsultationContent
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button
              className="back-button"
              onClick={() => {
                setForceShowSolutionSelection(false);
                setSelectedSection(null);
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title">Selecionar Solução</h1>
          </div>

          <div style={{
            padding: '40px 20px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '40px'
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '12px'
              }}>
                Escolha uma das soluções para continuar:
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: 0
              }}>
                Selecione a solução que deseja implementar para este paciente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="download-docx-button selecionar-solucao-docx-btn"
                  onClick={handleDownloadAllDocx}
                  disabled={downloadingDocx}
                  title="Baixar todas as soluções em um documento Word editável (DOCX)"
                >
                  <FileDown className="w-5 h-5" />
                  {downloadingDocx ? 'Gerando...' : 'Baixar todas em DOCX'}
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginTop: '40px'
            }}>
              {/* Livro da Vida */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em MENTALIDADE');
                  handleSelectSolucao('MENTALIDADE');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Livro da Vida</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Transformação Mental e Emocional</p>
              </div>

              {/* Alimentação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ALIMENTACAO');
                  handleSelectSolucao('ALIMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(16, 185, 129, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Alimentação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Plano Nutricional Personalizado</p>
              </div>

              {/* Suplementação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em SUPLEMENTACAO');
                  handleSelectSolucao('SUPLEMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Suplementação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Protocolo de Suplementos</p>
              </div>

              {/* Atividade Física */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ATIVIDADE_FISICA');
                  handleSelectSolucao('ATIVIDADE_FISICA');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#f59e0b';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(245, 158, 11, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5h11l-1 7h-9l1-7z"></path>
                    <path d="M9.5 6.5V4.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v2"></path>
                    <path d="M12 13.5v5"></path>
                    <path d="M8 16.5h8"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Atividade Física</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Programa de Exercícios</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se o status for PROCESSING, mostrar a tela de processamento
    if (consultaDetails.status === 'PROCESSING') {
      const contentType = renderConsultationContent();
      if (typeof contentType !== 'string' && contentType !== null) {
        // Se retornou JSX (tela de processamento), renderizar
        return (
          <div className="consultas-container consultas-details-container">
            <div className="consultas-header">
              <button
                className="back-button"
                onClick={handleBackToList}
                style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <h1 className="consultas-title">Processando</h1>
            </div>
            <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
              {contentType}
            </div>
          </div>
        );
      }
    }

    // Se selectedSection for null e não há solução selecionada, mostrar a tela intermediária
    // Se há uma solução selecionada (solucao_etapa), renderConsultationContent vai determinar qual tela mostrar
    // A tela intermediária (overview) só aparece quando não há solução selecionada E selectedSection é null
    if (selectedSection === null && !forceShowSolutionSelection && !consultaDetails.solucao_etapa) {
      return (
        <ConsultationDetailsOverview
          consultaDetails={consultaDetails}
          patientId={consultaDetails.patient_id}
          hasAnamneseData={hasAnamneseData}
          hasDiagnosticoData={hasDiagnosticoData}
          hasSolucaoData={hasSolucaoData}
          onNavigateToSection={(section) => {
            if (section === 'ANAMNESE') {
              // Anamnese sempre acessível (primeira etapa)
              setSelectedSection('ANAMNESE');
            } else if (section === 'DIAGNOSTICO') {
              // Verificar se há dados de diagnóstico antes de permitir acesso
              if (hasDiagnosticoData()) {
                setSelectedSection('DIAGNOSTICO');
              }
            } else if (section === 'SOLUCOES') {
              // Verificar se há dados de solução antes de permitir acesso
              if (hasSolucaoData()) {
                // Para soluções, forçar a renderização da tela de seleção de soluções imediatamente
                setForceShowSolutionSelection(true);
                setSelectedSection(null);
                setShowSolutionsViewer(false);
              } else {
                // Se não houver dados, não permitir acesso
                return;
              }
              // Atualizar a consulta em background para garantir que solucao_etapa seja null
              // Mas não esperar por isso para renderizar a tela
              if (consultaId) {
                gatewayClient.patch(`/consultations/${consultaId}`, { solucao_etapa: null })
                  .then(() => {
                    fetchConsultaDetails(consultaId, true); // silent = true para não mostrar loading
                  }).catch((error) => {
                    console.error('Erro ao atualizar solucao_etapa:', error);
                  });
              }
            } else if (section === 'EXAMES') {
              setSelectedSection('EXAMES');
            }
          }}
          onBack={handleBackToList}
        />
      );
    }

    // Se selectedSection for 'ANAMNESE', renderizar a seção de anamnese diretamente
    if (selectedSection === 'ANAMNESE') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      // Renderizar a tela de anamnese completa com botão flutuante e sidebar de chat
      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header">
            <button
              className="back-button"
              onClick={() => {
                setSelectedSection(null);
                // Remover o parâmetro section da URL se existir
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('section');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title">Detalhes da Consulta - Anamnese</h1>
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <StatusBadge status={mapBackendStatus(consultaDetails.status)} />
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Tabs com Navegação */}
          <div className="anamnese-tabs-container">
            <div className="anamnese-tabs">
              {[
                'Síntese',
                'Dados do Paciente',
                'Objetivos e Queixas',
                'Histórico de Risco',
                'Observação Clínica e Laboratorial',
                'História de vida',
                'Setênios e Eventos',
                'Ambiente e Contexto',
                'Sensação e Emoções',
                'Preocupações e Crenças',
                'Reino e Miasma'
              ].map((tab) => (
                <button
                  key={tab}
                  className={`anamnese-tab ${activeAnamneseTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveAnamneseTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Botão Avançar para Diagnóstico - Movido para o topo */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 0', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const message = hasDiagnosticoData()
                  ? 'Avançar para a etapa de Diagnóstico?'
                  : 'Você está prestes a avançar para a etapa de Diagnóstico. Esta ação iniciará o processamento do diagnóstico integrativo. Deseja continuar?';
                requestAdvanceConfirmation(handleSaveAndContinue, message);
              }}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: isSaving ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {hasValidAnamneseData() ? 'Avançar para Diagnóstico' : 'Gerar Diagnóstico'}
                </>
              )}
            </button>
          </div>

          {/* Conteúdo da Anamnese */}
          <div className="anamnese-content-wrapper">
            <AnamneseSection
              consultaId={consultaDetails?.id || consultaId || ''}
              patientId={consultaDetails?.patient_id}
              selectedField={selectedField}
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              onFieldSelect={handleFieldSelect}
              onSendMessage={handleSendAIMessage}
              onChatInputChange={setChatInput}
              readOnly={false}
              consultaStatus={consultaDetails?.status}
              consultaEtapa={consultaDetails?.etapa}
              activeTab={activeAnamneseTab}
            />
          </div>


          {/* Botão Flutuante de IA */}
          <button
            className="ai-float-button"
            onClick={() => setShowAIChat(!showAIChat)}
            title="Abrir Assistente de IA"
          >
            <Sparkles className="w-6 h-6" />
          </button>

          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Diagnóstico</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo da anamnese para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              {selectedField && (
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder="Descreva como deseja editar este campo..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAIMessage();
                      }
                    }}
                    rows={3}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleSendAIMessage}
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Sparkles className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Overlay para fechar o sidebar ao clicar fora */}
          {showAIChat && (
            <div className="ai-chat-overlay" onClick={() => setShowAIChat(false)}></div>
          )}

          {/* Modal de Confirmação de Avanço de Etapa */}
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Se selectedSection for 'DIAGNOSTICO', renderizar a seção de diagnóstico
    if (selectedSection === 'DIAGNOSTICO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      // Renderizar a tela de diagnóstico completa com botão flutuante e sidebar de chat
      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header">
            <button
              className="back-button"
              onClick={() => {
                setSelectedSection(null);
                // Remover o parâmetro section da URL se existir
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('section');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title">Detalhes da Consulta - Diagnóstico</h1>
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <StatusBadge status={mapBackendStatus(consultaDetails.status)} />
                </div>
              </div>
            </div>
          </div>

          {/* Menu de Tabs do Diagnóstico */}
          <div className="anamnese-tabs-container">
            <div className="anamnese-tabs">
              {[
                'Diagnóstico Principal',
                'Estado Geral',
                'Estado Mental',
                'Estado Fisiológico',
                'Integração Diagnóstica',
                'Hábitos de Vida'
              ].map((tab) => (
                <button
                  key={tab}
                  className={`anamnese-tab ${activeDiagnosticoTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveDiagnosticoTab(activeDiagnosticoTab === tab ? undefined : tab)}
                  title={activeDiagnosticoTab === tab ? 'Clique para mostrar todas as seções' : `Clique para ver apenas: ${tab}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Botão Avançar para Solução - Abaixo do menu */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 0', marginBottom: '20px', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {!hasSolucaoData() && anamnesePreenchida === false && (
              <div style={{
                padding: '12px 16px',
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: '8px',
                color: '#92400E',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                width: '100%',
                maxWidth: '600px'
              }}>
                <AlertTriangle size={18} />
                <span style={{ flex: 1 }}>A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.</span>
                <button
                  onClick={async () => {
                    if (consultaDetails?.patient_id) {
                      const isPreenchida = await checkAnamnesePreenchida(consultaDetails.patient_id);
                      setAnamnesePreenchida(isPreenchida);
                      if (isPreenchida) {
                        showSuccess('Anamnese verificada! O botão foi liberado.', 'Anamnese Verificada');
                      } else {
                        showWarning('A anamnese ainda não foi preenchida.', 'Anamnese Pendente');
                      }
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}
                  title="Verificar novamente"
                >
                  Verificar Novamente
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Se anamnese não estiver preenchida e precisar gerar, bloquear
                if (!hasSolucaoData() && anamnesePreenchida === false) {
                  showWarning(
                    'A anamnese do paciente não foi preenchida. Por favor, envie a anamnese inicial para o paciente na tela de Pacientes antes de gerar a solução.',
                    'Anamnese Não Preenchida'
                  );
                  return;
                }
                const message = hasSolucaoData()
                  ? 'Avançar para a etapa de Solução?'
                  : 'Você está prestes a avançar para a etapa de Solução. Esta ação iniciará o processamento da solução integrativa. Deseja continuar?';
                requestAdvanceConfirmation(handleSaveDiagnosticoAndContinue, message);
              }}
              disabled={isSaving || (!hasSolucaoData() && anamnesePreenchida === false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: (isSaving || (!hasSolucaoData() && anamnesePreenchida === false)) ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: (isSaving || (!hasSolucaoData() && anamnesePreenchida === false)) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving) {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              {isSaving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {hasSolucaoData() ? 'Avançar para Solução' : 'Gerar Solução'}
                </>
              )}
            </button>
          </div>

          {/* Conteúdo do Diagnóstico */}
          <div className="anamnese-content-wrapper">
            <DiagnosticoSection
              consultaId={consultaDetails?.id || consultaId || ''}
              selectedField={selectedField}
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              onFieldSelect={handleFieldSelect}
              onSendMessage={handleSendAIMessage}
              onChatInputChange={setChatInput}
              activeTab={activeDiagnosticoTab}
            />
          </div>

          {/* Botão Flutuante de IA */}
          <button
            className="ai-float-button"
            onClick={() => setShowAIChat(!showAIChat)}
            title="Abrir Assistente de IA"
          >
            <Sparkles className="w-6 h-6" />
          </button>

          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Diagnóstico</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo do diagnóstico para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              {selectedField && (
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder="Descreva como deseja editar este campo..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAIMessage();
                      }
                    }}
                    rows={3}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleSendAIMessage}
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Sparkles className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Overlay para fechar o sidebar ao clicar fora */}
          {showAIChat && (
            <div className="ai-chat-overlay" onClick={() => setShowAIChat(false)}></div>
          )}

          {/* Modal de Confirmação de Avanço de Etapa */}
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Se selectedSection for 'EXAMES', renderizar a seção de exames
    if (selectedSection === 'EXAMES') {
      if (!consultaDetails || !consultaId) {
        return (
          <div className="consultas-container consultas-details-container">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <div className="loading-spinner"></div>
            </div>
          </div>
        );
      }
      return (
        <ExamesSection
          consultaDetails={consultaDetails}
          consultaId={consultaId}
          onBack={() => setSelectedSection(null)}
        />
      );
    }

    console.log('🔄 [RENDER] Chamando renderConsultationContent()...');
    const contentType = renderConsultationContent();
    console.log('✅ [RENDER] renderConsultationContent retornou:', contentType);

    // Se renderConsultationContent retornar 'ANAMNESE', definir selectedSection como 'ANAMNESE'
    // e retornar null para que o componente re-renderize com a nova tela
    if (contentType === 'ANAMNESE') {
      if ((selectedSection as string) !== 'ANAMNESE') {
        // Usar useEffect para evitar problemas de renderização
        // Mas como estamos dentro do render, vamos usar um efeito via requestAnimationFrame
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => {
            setSelectedSection('ANAMNESE');
          });
        }
        // Retornar um loading temporário enquanto o estado é atualizado
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <div className="loading-spinner"></div>
          </div>
        );
      }
    }

    // Se for SELECT_SOLUCAO, renderiza a tela de seleção de soluções
    if (typeof contentType === 'string' && contentType === 'SELECT_SOLUCAO') {
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button
              className="back-button"
              onClick={handleBackToList}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title">Selecionar Solução</h1>
          </div>

          <div style={{
            padding: '40px 20px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '40px'
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '12px'
              }}>
                Escolha uma das soluções para continuar:
              </h2>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                margin: 0
              }}>
                Selecione a solução que deseja implementar para este paciente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="download-docx-button selecionar-solucao-docx-btn"
                  onClick={handleDownloadAllDocx}
                  disabled={downloadingDocx}
                  title="Baixar todas as soluções em um documento Word editável (DOCX)"
                >
                  <FileDown className="w-5 h-5" />
                  {downloadingDocx ? 'Gerando...' : 'Baixar todas em DOCX'}
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginTop: '40px'
            }}>
              {/* Livro da Vida */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em MENTALIDADE');
                  handleSelectSolucao('MENTALIDADE');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Livro da Vida</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Transformação Mental e Emocional</p>
              </div>

              {/* Alimentação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ALIMENTACAO');
                  handleSelectSolucao('ALIMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"></path>
                    <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Alimentação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Plano Nutricional Personalizado</p>
              </div>

              {/* Suplementação */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em SUPLEMENTACAO');
                  handleSelectSolucao('SUPLEMENTACAO');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="18" height="12" rx="2"></rect>
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path>
                    <line x1="12" y1="14" x2="12" y2="14.01"></line>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Suplementação</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Protocolo de Suplementos</p>
              </div>

              {/* Atividade Física */}
              <div
                className="solucao-card"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSaving) return;
                  console.log('🖱️ [SOLUCAO CARD] Clicou em ATIVIDADE_FISICA');
                  handleSelectSolucao('ATIVIDADE_FISICA');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                  border: '2px solid #e5e7eb',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isSaving ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
                  }
                }}
              >
                <div className="solucao-icon" style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 6.5h11l-1 7h-9l1-7z"></path>
                    <path d="M9.5 6.5V4.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v2"></path>
                    <path d="M12 13.5v5"></path>
                    <path d="M8 16.5h8"></path>
                  </svg>
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px',
                  margin: 0
                }}>Atividade Física</h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: 0
                }}>Programa de Exercícios</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for DIAGNOSTICO, renderiza a tela de diagnóstico
    if (typeof contentType === 'string' && contentType === 'DIAGNOSTICO') {
      //console.log('🔍 Renderizando tela de DIAGNOSTICO para consulta:', consultaId);
      return (
        <>
          <div className="consultas-container consultas-details-container">
            <div className="consultas-header">
              <button
                className="back-button"
                onClick={handleBackToList}
                style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <h1 className="consultas-title">Diagnóstico</h1>
            </div>

            {/* Informações da Consulta - Card no Topo */}
            <div className="consultation-info-card">
              <div className="consultation-info-grid">
                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Paciente</span>
                    <span className="info-value">{consultaDetails.patient_name}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Data/Hora Início</span>
                    <span className="info-value">
                      {consultaDetails.consulta_inicio
                        ? `${formatDateOnly(consultaDetails.consulta_inicio)} ${formatTime(consultaDetails.consulta_inicio)}`
                        : formatFullDate(consultaDetails.created_at)}
                    </span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Data/Hora Fim</span>
                    <span className="info-value">
                      {(() => {
                        console.log('🔍 Renderizando Data/Hora Fim:', {
                          consulta_fim: consultaDetails.consulta_fim,
                          existe: !!consultaDetails.consulta_fim
                        });
                        return consultaDetails.consulta_fim
                          ? `${formatDateOnly(consultaDetails.consulta_fim)} ${formatTime(consultaDetails.consulta_fim)}`
                          : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    {consultaDetails.consultation_type === 'PRESENCIAL' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                  </div>
                  <div className="info-content">
                    <span className="info-label">Tipo</span>
                    <span className="info-value">{mapConsultationType(consultaDetails.consultation_type)}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Duração</span>
                    <span className="info-value">{formatDuration(consultaDetails)}</span>
                  </div>
                </div>

                <div className="info-block">
                  <div className="info-icon-wrapper status-icon">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="info-content">
                    <span className="info-label">Status</span>
                    <StatusBadge
                      status={mapBackendStatus(consultaDetails.status)}
                      size="md"
                      showIcon={true}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Anamnese (Consulta) - Movida para o topo para melhor visibilidade */}
            <div className="anamnese-container" style={{
              marginTop: '24px',
              marginBottom: '32px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e5e7eb'
            }}>
              <div className="anamnese-header" style={{
                padding: '20px 24px',
                borderBottom: '2px solid #1B4266',
                background: 'linear-gradient(135deg, #fef7ed 0%, #fff7ed 100%)'
              }}>
                <h2 style={{
                  margin: 0,
                  color: '#1B4266',
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <FileText className="w-6 h-6" style={{ color: '#1B4266' }} />
                  Anamnese da Consulta
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  color: '#6b7280',
                  fontSize: '14px',
                  fontWeight: '400'
                }}>
                  Informações coletadas durante a consulta
                </p>
              </div>
              <div className="anamnese-content" style={{ padding: '24px' }}>
                <AnamneseSection
                  consultaId={consultaDetails?.id || consultaId || ''}
                  selectedField={null}
                  chatMessages={[]}
                  isTyping={false}
                  chatInput=""
                  onFieldSelect={() => { }}
                  onSendMessage={() => { }}
                  onChatInputChange={() => { }}
                  readOnly={true}
                  renderViewSolutionsButton={renderViewSolutionsButton}
                />
              </div>
            </div>

            <div className="details-two-column-layout">
              {/* Coluna Esquerda - Chat com IA */}
              <div className="chat-column">
                <div className="chat-container">
                  <div className="chat-header">
                    <h3>Chat com IA - Assistente de Diagnóstico</h3>
                    {selectedField && (
                      <p className="chat-field-indicator">
                        <Sparkles className="w-4 h-4 inline mr-1" />
                        Editando: <strong>{selectedField.label}</strong>
                      </p>
                    )}
                  </div>

                  <div className="chat-messages">
                    {!selectedField ? (
                      <div className="chat-empty-state">
                        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-center">
                          Selecione um campo do diagnóstico clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
                        </p>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="chat-empty-state">
                        <p className="text-gray-500 text-center">
                          Digite uma mensagem para começar a conversa sobre <strong>{selectedField.label}</strong>
                        </p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={message.role === 'user' ? 'message user-message' : 'message ai-message'}
                          >
                            <div className={message.role === 'user' ? 'message-avatar user-avatar' : 'message-avatar ai-avatar'}>
                              {message.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                            </div>
                            <div className="message-content">
                              <p>{message.content}</p>
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="message ai-message">
                            <div className="message-avatar ai-avatar">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="message-content">
                              <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="chat-input-area">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Digite sua mensagem..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendAIMessage()}
                      disabled={!selectedField || isTyping}
                    />
                    <button
                      className="chat-send-button"
                      onClick={handleSendAIMessage}
                      disabled={!selectedField || !chatInput.trim() || isTyping}
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Coluna Direita - Diagnóstico + Anamnese (somente leitura) */}
              <div className="anamnese-column">
                <div className="anamnese-container">
                  <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Diagnóstico Integrativo</h2>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        requestAdvanceConfirmation(
                          handleSaveDiagnosticoAndContinue,
                          'Você está prestes a avançar para a etapa de Solução. Esta ação iniciará o processamento da solução integrativa. Deseja continuar?'
                        );
                      }}
                      disabled={isSaving}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: isSaving ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = '#059669';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = '#10b981';
                        }
                      }}
                    >
                      {isSaving ? (
                        <>
                          <div className="loading-spinner-small"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Avançar
                        </>
                      )}
                    </button>
                  </div>

                  {/* Menu de Tabs do Diagnóstico */}
                  <div className="anamnese-tabs-container">
                    <div className="anamnese-tabs">
                      {[
                        'Diagnóstico Principal',
                        'Estado Geral',
                        'Estado Mental',
                        'Estado Fisiológico',
                        'Integração Diagnóstica',
                        'Hábitos de Vida'
                      ].map((tab) => (
                        <button
                          key={tab}
                          className={`anamnese-tab ${activeDiagnosticoTab === tab ? 'active' : ''}`}
                          onClick={() => setActiveDiagnosticoTab(activeDiagnosticoTab === tab ? undefined : tab)}
                          title={activeDiagnosticoTab === tab ? 'Clique para mostrar todas as seções' : `Clique para ver apenas: ${tab}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="anamnese-content">
                    <DiagnosticoSection
                      consultaId={consultaDetails?.id || consultaId || ''}
                      selectedField={selectedField}
                      chatMessages={chatMessages}
                      isTyping={isTyping}
                      chatInput={chatInput}
                      onFieldSelect={handleFieldSelect}
                      onSendMessage={handleSendAIMessage}
                      onChatInputChange={setChatInput}
                      activeTab={activeDiagnosticoTab}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {showAdvanceModal && (
            <div className="modal-overlay" onClick={cancelAdvance}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                  <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <h3 className="modal-title">Avançar para Próxima Etapa</h3>
                </div>

                <div className="modal-body">
                  <p className="modal-text" style={{ marginBottom: '15px' }}>
                    {advanceMessage}
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    className="modal-button cancel-button"
                    onClick={cancelAdvance}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="modal-button"
                    onClick={confirmAdvance}
                    disabled={isSaving}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Avançar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }

    // Se for SOLUCAO_MENTALIDADE, renderiza a tela de Livro da Vida
    if (contentType === 'SOLUCAO_MENTALIDADE') {
      // Funções auxiliares para formatação (mesmas da Anamnese)
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        // Tentar usar duration primeiro
        let durationInSeconds: number | null = null;

        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        }
        // Se não tiver duration, calcular a partir de consulta_inicio e consulta_fim
        else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);

            // Validar se a duração é positiva e razoável (menos de 24 horas)
            if (durationInSeconds < 0 || durationInSeconds > 86400) {
              durationInSeconds = null;
            }
          } catch (error) {
            console.error('Erro ao calcular duração:', error);
            durationInSeconds = null;
          }
        }

        if (!durationInSeconds || durationInSeconds <= 0) {
          return 'N/A';
        }

        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);

        if (hours > 0) {
          return `${hours}h ${minutes}min`;
        }
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      const getStatusText = (status: string) => {
        switch (status) {
          case 'CREATED': return 'Criada';
          case 'RECORDING': return 'Gravando';
          case 'PROCESSING': return 'Processando';
          case 'VALIDATION': return 'Validação';
          case 'VALID_SOLUCAO': return 'Validação Solução';
          case 'COMPLETED': return 'Concluída';
          case 'ERROR': return 'Erro';
          case 'CANCELLED': return 'Cancelada';
          default: return status;
        }
      };

      // Avatar do paciente
      const patientsData = Array.isArray(consultaDetails.patients)
        ? consultaDetails.patients[0]
        : consultaDetails.patients;
      const patientAvatar = patientsData?.profile_pic || null;
      const patientInitials = (consultaDetails.patient_name || 'P')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return (
        <div className="consultas-container consultas-details-container anamnese-page-container">
          <div className="consultation-details-overview-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultation-details-overview-title" style={{ flex: 1 }}>Detalhes da Consulta - Livro da Vida</h1>
            {renderSolutionNavigationButtons()}
          </div>

          {/* Cards de Informação no Topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-avatar">
                {patientAvatar ? (
                  <Image
                    src={patientAvatar}
                    alt={consultaDetails.patient_name}
                    width={60}
                    height={60}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <div className="consultation-details-avatar-placeholder">
                    {patientInitials}
                  </div>
                )}
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
                {patientsData?.phone && (
                  <div className="consultation-details-card-phone">{patientsData.phone}</div>
                )}
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  <span className={`status-badge status-success status-badge-md status-badge-default`} style={{ '--status-bg': '#d1fae5', '--status-text': '#065f46', '--status-border': '#10b981' } as React.CSSProperties}>
                    <FileText className="status-icon" size={14} />
                    <span className="status-text">{getStatusText(consultaDetails.status)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="anamnese-content-wrapper">
            <div className="anamnese-sections">
              <MentalidadeSection
                consultaId={consultaId || ''}
                selectedField={selectedField}
                chatMessages={chatMessages}
                isTyping={isTyping}
                chatInput={chatInput}
                onFieldSelect={handleFieldSelect}
                onSendMessage={handleSendAIMessage}
                onChatInputChange={setChatInput}
              />
            </div>
          </div>

          {/* Botão Flutuante de IA */}
          <button
            className="ai-float-button"
            onClick={() => setShowAIChat(!showAIChat)}
            title="Abrir Assistente de IA"
          >
            <Sparkles className="w-6 h-6" />
          </button>

          {/* Sidebar de Chat com IA */}
          <div className={`ai-chat-sidebar ${showAIChat ? 'open' : ''}`}>
            <div className="chat-container">
              <div className="chat-header">
                <div>
                  <h3>Chat com IA - Assistente de Livro da Vida</h3>
                  {selectedField && (
                    <p className="chat-field-indicator">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Editando: <strong>{selectedField.label}</strong>
                    </p>
                  )}
                </div>
                <button
                  className="chat-close-button"
                  onClick={() => setShowAIChat(false)}
                  title="Fechar chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-welcome">
                    <Sparkles className="w-8 h-8" style={{ color: '#1B4266', marginBottom: '12px' }} />
                    <p>Selecione um campo do Livro da Vida para editar com IA</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-time">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="chat-input-container">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Digite sua mensagem..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendAIMessage()}
                  disabled={!selectedField || isTyping}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendAIMessage}
                  disabled={!selectedField || !chatInput.trim() || isTyping}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_SUPLEMENTACAO, renderiza a tela de Suplementação
    if (contentType === 'SOLUCAO_SUPLEMENTACAO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Suplementação</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="anamnese-container">
            <div className="anamnese-header">
              <h2>Protocolo de Suplementação</h2>
            </div>


            <div className="anamnese-content">
              <SuplemementacaoSection
                consultaId={consultaDetails?.id || consultaId || ''}
              />
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_ATIVIDADE_FISICA, renderiza a tela de Atividade Física
    if (contentType === 'SOLUCAO_ATIVIDADE_FISICA') {
      console.log('🔍 DEBUG [REFERENCIA] Renderizando tela SOLUCAO_ATIVIDADE_FISICA - consultaDetails:', consultaDetails);
      console.log('🔍 DEBUG [REFERENCIA] atividadeFisicaData length:', atividadeFisicaData.length);

      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Atividade Física</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="anamnese-container">
            <div className="anamnese-header">
              <h2>Protocolo de Atividade Física</h2>
            </div>

            <div className="anamnese-content">
              {loadingAtividadeFisica ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Carregando exercícios físicos...</p>
                </div>
              ) : (
                <div className="atividade-fisica-container">
                  <div className="anamnese-sections">
                    {atividadeFisicaData.length === 0 ? (
                      <div className="no-data" style={{ padding: '40px', width: '100%' }}>
                        <FileText className="w-16 h-16" style={{ color: '#6366f1', marginBottom: '20px' }} />
                        <h3>Nenhum exercício encontrado</h3>
                        <p>Não há exercícios físicos cadastrados para este paciente.</p>
                      </div>
                    ) : (
                      <>
                        {/* Agrupar exercícios por nome_treino */}
                        {Object.entries(
                          atividadeFisicaData.reduce((acc, exercicio) => {
                            const treino = exercicio.nome_treino || 'Treino Sem Nome';
                            if (!acc[treino]) {
                              acc[treino] = [];
                            }
                            acc[treino].push(exercicio);
                            return acc;
                          }, {} as Record<string, ExercicioFisico[]>)
                        ).map(([nomeTreino, exercicios]: [string, ExercicioFisico[]]) => (
                          <CollapsibleSection key={nomeTreino} title={nomeTreino} defaultOpen={true}>
                            <div className="anamnese-subsection">
                              {exercicios.map((exercicio: ExercicioFisico) => (
                                <div key={exercicio.id} style={{ marginBottom: '16px' }}>
                                  <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {exercicio.nome_exercicio || 'Exercício Sem Nome'}
                                  </h4>
                                  <div className="anamnese-subsection">
                                    <DataField
                                      label="Nome do Exercício"
                                      value={exercicio.nome_exercicio || ''}
                                      fieldPath={`exercicios.${exercicio.id}.nome_exercicio`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'nome_exercicio', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Tipo de Treino"
                                      value={exercicio.tipo_treino || ''}
                                      fieldPath={`exercicios.${exercicio.id}.tipo_treino`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'tipo_treino', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Grupo Muscular"
                                      value={exercicio.grupo_muscular || ''}
                                      fieldPath={`exercicios.${exercicio.id}.grupo_muscular`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'grupo_muscular', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Séries"
                                      value={exercicio.series || ''}
                                      fieldPath={`exercicios.${exercicio.id}.series`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'series', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Repetições"
                                      value={exercicio.repeticoes || ''}
                                      fieldPath={`exercicios.${exercicio.id}.repeticoes`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'repeticoes', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Descanso"
                                      value={exercicio.descanso || ''}
                                      fieldPath={`exercicios.${exercicio.id}.descanso`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'descanso', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Treino Atual"
                                      value={exercicio.treino_atual ? String(exercicio.treino_atual) : ''}
                                      fieldPath={`exercicios.${exercicio.id}.treino_atual`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'treino_atual', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Próximo Treino"
                                      value={exercicio.proximo_treino ? String(exercicio.proximo_treino) : ''}
                                      fieldPath={`exercicios.${exercicio.id}.proximo_treino`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'proximo_treino', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Último Treino"
                                      value={exercicio.ultimo_treino ? 'Sim' : 'Não'}
                                      fieldPath={`exercicios.${exercicio.id}.ultimo_treino`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'ultimo_treino', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Alertas Importantes"
                                      value={exercicio.alertas_importantes || ''}
                                      fieldPath={`exercicios.${exercicio.id}.alertas_importantes`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'alertas_importantes', newValue);
                                      }}
                                    />
                                    <DataField
                                      label="Observações"
                                      value={exercicio.observacoes || ''}
                                      fieldPath={`exercicios.${exercicio.id}.observacoes`}
                                      consultaId={consultaDetails?.id || consultaId || ''}
                                      onSave={async (fieldPath: string, newValue: string, consultaId: string) => {
                                        await handleSaveExercicio(exercicio.id, 'observacoes', newValue);
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleSection>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Se for SOLUCAO_ALIMENTACAO, renderiza a tela de Alimentação
    if (contentType === 'SOLUCAO_ALIMENTACAO') {
      // Funções auxiliares para formatação
      const formatDateOnly = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      };

      const formatDuration = (consulta: Consultation) => {
        let durationInSeconds: number | null = null;
        if (consulta.duration && consulta.duration > 0) {
          durationInSeconds = consulta.duration;
        } else if (consulta.consulta_inicio && consulta.consulta_fim) {
          try {
            const inicio = new Date(consulta.consulta_inicio);
            const fim = new Date(consulta.consulta_fim);
            const diffMs = fim.getTime() - inicio.getTime();
            durationInSeconds = Math.floor(diffMs / 1000);
            if (durationInSeconds < 0 || durationInSeconds > 86400) durationInSeconds = null;
          } catch (error) { durationInSeconds = null; }
        }
        if (!durationInSeconds || durationInSeconds <= 0) return 'N/A';
        const hours = Math.floor(durationInSeconds / 3600);
        const minutes = Math.floor((durationInSeconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${minutes} min`;
      };

      const mapConsultationType = (type: string) => {
        return type === 'TELEMEDICINA' ? 'Telemedicina' : 'Presencial';
      };

      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              className="back-button"
              onClick={handleBackToSolutionSelection}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title" style={{ flex: 1 }}>Solução - Alimentação</h1>
            {renderSolutionNavigationButtons()}
            {renderViewSolutionsButton && renderViewSolutionsButton()}
          </div>

          {/* Cards de informações da consulta no topo */}
          <div className="consultation-details-cards-row">
            {/* Card Paciente */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Paciente</div>
                <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
              </div>
            </div>

            {/* Card Data/Hora */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Data / Hora</div>
                <div className="consultation-details-card-value">
                  {consultaDetails.consulta_inicio
                    ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                    : formatDateOnly(consultaDetails.created_at)}
                </div>
              </div>
            </div>

            {/* Card Tipo */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <FileText size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Tipo</div>
                <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
              </div>
            </div>

            {/* Card Duração */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Duração</div>
                <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
              </div>
            </div>

            {/* Card Status */}
            <div className="consultation-details-info-card">
              <div className="consultation-details-card-icon-wrapper">
                <User size={20} />
              </div>
              <div className="consultation-details-card-content">
                <div className="consultation-details-card-label">Status</div>
                <div className="consultation-details-card-value">
                  {(() => {
                    const statusMap: { [key: string]: string } = {
                      'AGENDAMENTO': 'Agendamento',
                      'EM_ANDAMENTO': 'Em Andamento',
                      'PROCESSING': 'Processamento',
                      'VALIDATION': 'Validação',
                      'FINALIZADA': 'Finalizada',
                      'CANCELADA': 'Cancelada',
                      'RECORDING': 'Gravando',
                      'VALID_SOLUCAO': 'Solução Válida'
                    };
                    return statusMap[consultaDetails.status] || consultaDetails.status;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Única - Alimentação */}
          <div className="single-column-layout">
            <div className="anamnese-column">
              <div className="anamnese-container">
                <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Protocolo de Alimentação</h2>
                  <button
                    onClick={handleSaveAlimentacaoAndContinue}
                    disabled={isSaving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      background: isSaving ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSaving) {
                        e.currentTarget.style.background = '#059669';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSaving) {
                        e.currentTarget.style.background = '#10b981';
                      }
                    }}
                  >
                    {isSaving ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Próximo
                      </>
                    )}
                  </button>
                </div>

                <div className="anamnese-content">
                  <AlimentacaoSection
                    consultaId={consultaDetails?.id || consultaId || ''}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Quando renderConsultationContent retorna 'ANAMNESE' mas selectedSection é null,
    // devemos mostrar a tela de overview (não a tela antiga de anamnese)
    // A tela de overview já foi renderizada acima quando selectedSection === null
    // Então não precisamos fazer nada aqui quando contentType === 'ANAMNESE' && selectedSection === null

    // Se renderConsultationContent retornou 'ANAMNESE' mas selectedSection é null,
    // devemos mostrar a tela de overview (que já foi renderizada acima)
    // Não renderizar a tela antiga quando selectedSection é null
    if (contentType === 'ANAMNESE' && selectedSection === null) {
      // A tela de overview já foi renderizada na condição acima
      // Retornar null para evitar renderizar a tela antiga
      return null;
    }

    // Se for um modal (não ANAMNESE, não DIAGNOSTICO, não SOLUCAO_MENTALIDADE, não SOLUCAO_SUPLEMENTACAO, não SOLUCAO_ALIMENTACAO, não SOLUCAO_ATIVIDADE_FISICA e não SELECT_SOLUCAO), renderiza só o modal
    if (typeof contentType !== 'string' || (contentType !== 'ANAMNESE' && contentType !== 'DIAGNOSTICO' && contentType !== 'SOLUCAO_MENTALIDADE' && contentType !== 'SOLUCAO_SUPLEMENTACAO' && contentType !== 'SOLUCAO_ALIMENTACAO' && contentType !== 'SOLUCAO_ATIVIDADE_FISICA' && contentType !== 'SELECT_SOLUCAO')) {
      return (
        <div className="consultas-container consultas-details-container">
          <div className="consultas-header">
            <button
              className="back-button"
              onClick={handleBackToList}
              style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <h1 className="consultas-title">Detalhes da Consulta</h1>
          </div>

          {typeof contentType !== 'string' ? contentType : null}
        </div>
      );
    }

    // Renderiza a tela de ANAMNESE completa (TELA ANTIGA - só será renderizada se selectedSection === 'ANAMNESE' mas a nova tela não foi selecionada)
    // Esta tela antiga não deve mais ser usada - a nova tela será renderizada quando selectedSection === 'ANAMNESE'
    return (
      <div className="consultas-container consultas-details-container">
        <div className="consultas-header">
          <button
            className="back-button"
            onClick={() => {
              if (selectedSection) {
                setSelectedSection(null);
              } else {
                handleBackToList();
              }
            }}
            style={{ marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="consultas-title">Detalhes da Consulta</h1>
        </div>

        {/* Cards de informações da consulta no topo */}
        <div className="consultation-details-cards-row">
          {/* Card Paciente */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <User size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Paciente</div>
              <div className="consultation-details-card-value" style={{ fontWeight: 700 }}>{consultaDetails.patient_name}</div>
            </div>
          </div>

          {/* Card Data/Hora */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <Calendar size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Data / Hora</div>
              <div className="consultation-details-card-value">
                {consultaDetails.consulta_inicio
                  ? `${formatDateOnly(consultaDetails.consulta_inicio)}, ${formatTime(consultaDetails.consulta_inicio)}`
                  : formatDateOnly(consultaDetails.created_at)}
              </div>
            </div>
          </div>

          {/* Card Tipo */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <FileText size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Tipo</div>
              <div className="consultation-details-card-value">{mapConsultationType(consultaDetails.consultation_type)}</div>
            </div>
          </div>

          {/* Card Duração */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <Clock size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Duração</div>
              <div className="consultation-details-card-value">{formatDuration(consultaDetails)}</div>
            </div>
          </div>

          {/* Card Status */}
          <div className="consultation-details-info-card">
            <div className="consultation-details-card-icon-wrapper">
              <User size={20} />
            </div>
            <div className="consultation-details-card-content">
              <div className="consultation-details-card-label">Status</div>
              <div className="consultation-details-card-value">
                {(() => {
                  const statusMap: { [key: string]: string } = {
                    'AGENDAMENTO': 'Agendamento',
                    'EM_ANDAMENTO': 'Em Andamento',
                    'PROCESSING': 'Processamento',
                    'VALIDATION': 'Validação',
                    'FINALIZADA': 'Finalizada',
                    'CANCELADA': 'Cancelada',
                    'RECORDING': 'Gravando',
                    'VALID_SOLUCAO': 'Solução Válida'
                  };
                  return statusMap[consultaDetails.status] || consultaDetails.status;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="details-two-column-layout">
          {/* Coluna Esquerda - Chat com IA */}
          <div className="chat-column">
            <div className="chat-container">
              <div className="chat-header">
                <h3>Chat com IA - Assistente de Anamnese</h3>
                {selectedField && (
                  <p className="chat-field-indicator">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Editando: <strong>{selectedField.label}</strong>
                  </p>
                )}
              </div>

              <div className="chat-messages">
                {!selectedField ? (
                  <div className="chat-empty-state">
                    <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-center">
                      Selecione um campo da anamnese clicando no ícone <Sparkles className="w-4 h-4 inline" /> para começar a editar com IA
                    </p>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <p className="text-gray-500 text-center">
                      Digite uma mensagem para começar a conversa sobre <strong>{selectedField.label}</strong>
                    </p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={message.role === 'user' ? 'message user-message' : 'message ai-message'}
                      >
                        <div className={message.role === 'user' ? 'message-avatar user-avatar' : 'message-avatar ai-avatar'}>
                          {message.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <div className="message-content">
                          <p>{message.content}</p>
                        </div>
                      </div>
                    ))}

                    {isTyping && (
                      <div className="message ai-message">
                        <div className="message-avatar ai-avatar">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="message-content">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  placeholder={selectedField ? "Digite sua mensagem..." : "Selecione um campo para começar"}
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAIMessage();
                    }
                  }}
                  disabled={!selectedField || isTyping}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendAIMessage}
                  disabled={!selectedField || !chatInput.trim() || isTyping}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita - Anamnese */}
          <div className="anamnese-column">
            <div className="anamnese-container">
              <div className="anamnese-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Anamnese Integrativa - Identificação e Avaliação Inicial</h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    requestAdvanceConfirmation(
                      handleSaveAndContinue,
                      'Você está prestes a avançar para a etapa de Diagnóstico. Esta ação iniciará o processamento do diagnóstico integrativo. Deseja continuar?'
                    );
                  }}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: isSaving ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSaving) {
                      e.currentTarget.style.background = '#059669';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSaving) {
                      e.currentTarget.style.background = '#10b981';
                    }
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Avançar
                    </>
                  )}
                </button>
              </div>

              <div className="anamnese-content">
                <AnamneseSection
                  consultaId={consultaDetails?.id || consultaId || ''}
                  patientId={consultaDetails?.patient_id}
                  selectedField={selectedField}
                  chatMessages={chatMessages}
                  isTyping={isTyping}
                  chatInput={chatInput}
                  onFieldSelect={handleFieldSelect}
                  onSendMessage={handleSendAIMessage}
                  onChatInputChange={setChatInput}
                  consultaStatus={consultaDetails?.status}
                  consultaEtapa={consultaDetails?.etapa}
                  renderViewSolutionsButton={renderViewSolutionsButton}
                />
              </div>
            </div>
          </div>
        </div>
        {showAdvanceModal && (
          <div className="modal-overlay" onClick={cancelAdvance}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                  <ArrowRight className="w-6 h-6" />
                </div>
                <h3 className="modal-title">Avançar para Próxima Etapa</h3>
              </div>

              <div className="modal-body">
                <p className="modal-text" style={{ marginBottom: '15px' }}>
                  {advanceMessage}
                </p>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-button cancel-button"
                  onClick={cancelAdvance}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  className="modal-button"
                  onClick={confirmAdvance}
                  disabled={isSaving}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Avançar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Renderizar lista de consultas
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <div className="consultas-header-content">
          <div>
            <h1 className="consultas-title">Lista de Consulta</h1>
            <div className="consultas-stats-badge">
              <span>{totalConsultations} consultas encontradas</span>
            </div>
          </div>
          <button
            className="btn-new-consultation"
            onClick={() => router.push('/consulta/nova')}
          >
            <Plus className="btn-icon" />
            Nova consulta
          </button>
        </div>
      </div>

      {/* Filtros de Busca */}
      <div className="filters-section" style={{
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div className="search-container" style={{
          position: 'relative',
          flex: 1,
          maxWidth: '400px'
        }}>
          <Search className="search-icon" size={20} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af',
            pointerEvents: 'none',
            zIndex: 1
          }} />
          <input
            type="text"
            placeholder="Buscar consultas..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="search-input"
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              color: '#111827',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1B4266';
              e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
          }}
          className="status-filter"
          style={{
            padding: '12px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#111827',
            cursor: 'pointer',
            minWidth: '180px',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1B4266';
            e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e5e7eb';
            e.target.style.boxShadow = 'none';
          }}
        >
          <option value="all">Todos os status</option>
          <option value="CREATED">Criada</option>
          <option value="RECORDING">Gravando</option>
          <option value="PROCESSING">Processando</option>
          <option value="VALIDATION">Validação</option>
          <option value="COMPLETED">Concluída</option>
          <option value="ERROR">Erro</option>
          <option value="CANCELLED">Cancelada</option>
        </select>

        {/* Filtro de Data */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          minWidth: '280px'
        }}>
          <select
            value={dateFilterType || ''}
            onChange={(e) => {
              const type = e.target.value as 'day' | 'week' | 'month' | '';
              setDateFilterType(type || null);
              if (!type) {
                setSelectedDate('');
              } else if (!selectedDate) {
                // Se não há data selecionada, usar data atual
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }
            }}
            style={{
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              color: '#111827',
              cursor: 'pointer',
              minWidth: '120px',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#1B4266';
              e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value="">Sem filtro de data</option>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>

          {dateFilterType && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '12px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                color: '#111827',
                cursor: 'pointer',
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1B4266';
                e.target.style.boxShadow = '0 0 0 3px rgba(27, 66, 102, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          )}

          {dateFilterType && (
            <button
              onClick={() => {
                setDateFilterType(null);
                setSelectedDate('');
              }}
              style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
              title="Limpar filtro de data"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="consultas-table-container">
        <div className="consultas-table">
          {/* Header da tabela */}
          <div className="table-header">
            <div className="header-cell patient-header">Paciente</div>
            <div className="table-header-divider"></div>
            <div className="header-cell date-header">Data</div>
            <div className="table-header-divider"></div>
            <div className="header-cell type-header">Tipo</div>
            <div className="table-header-divider"></div>
            <div className="header-cell status-header">Status</div>
            <div className="table-header-divider"></div>
            <div className="header-cell actions-header">Ações</div>
          </div>

          {/* Linhas da tabela */}
          <div className="table-body">
            {consultations.length === 0 ? (
              <div className="empty-state">
                <Calendar className="empty-icon" />
                <h3>Nenhuma consulta encontrada</h3>
                <p>Você ainda não possui consultas cadastradas.</p>
              </div>
            ) : (
              consultations.map((consultation) => (
                <div
                  key={consultation.id}
                  className="table-row"
                  onClick={() => handleConsultationClick(consultation)}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    className="table-cell patient-cell"
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <div
                      className="patient-info"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        gap: '12px'
                      }}
                    >
                      {generateAvatar(consultation.patient_name, consultation.patients?.profile_pic)}
                      <div
                        className="patient-details"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          textAlign: 'left'
                        }}
                      >
                        <div
                          className="patient-name"
                          style={{
                            textAlign: 'left',
                            alignSelf: 'center',
                            width: '100%'
                          }}
                        >
                          {consultation.patient_name}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell date-cell">
                    {formatDate(consultation.created_at)}
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell type-cell">
                    <div className="consultation-type">
                      {getTypeIcon(consultation.consultation_type)}
                      <span>{mapConsultationType(consultation.consultation_type)}</span>
                    </div>
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell status-cell">
                    <StatusBadge
                      status={mapBackendStatus(consultation.status)}
                      size="md"
                      showIcon={true}
                      variant={consultation.status === 'RECORDING' || consultation.status === 'PROCESSING' || consultation.status === 'VALIDATION' ? 'outlined' : 'default'}
                    />
                  </div>
                  <div className="table-row-divider"></div>
                  <div className="table-cell actions-cell">
                    <div className="action-buttons">
                      {/* Botão Entrar na Consulta (apenas para agendamentos) */}
                      {consultation.status === 'AGENDAMENTO' && (
                        (() => {
                          const isTelemedicina = consultation.consultation_type === 'TELEMEDICINA';

                          // Verificar se a consulta já expirou (apenas para Telemedicina)
                          let isExpired = false;
                          if (isTelemedicina && consultation.consulta_inicio) {
                            const consultaDate = new Date(consultation.consulta_inicio);
                            const now = new Date();

                            // Zerar horas para comparar apenas a data (considera expirado se for dia anterior)
                            // OU se usuário quiser hora exata: "se já tiver passado a data"
                            // Interpretação: Se o dia JÁ PASSOU. (Ontem não pode, hoje pode mesmo se atrasado).
                            // Se fosse hora exata, seria muito rígido.
                            // Mas "passado a data" pode significar DATA (calendar day).
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);

                            const consultationDay = new Date(consultaDate);
                            consultationDay.setHours(0, 0, 0, 0);

                            // Se a data da consulta for MENOR que hoje (ontem ou antes), expirou.
                            if (consultationDay < today) {
                              isExpired = true;
                            }
                          }

                          if (isExpired) {
                            return (
                              <span
                                className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded"
                                title="Data da consulta expirada"
                              >
                                Expirada
                              </span>
                            );
                          }

                          return (
                            <button
                              className="action-button enter-action"
                              onClick={(e) => handleEnterConsultation(e, consultation)}
                              title="Entrar na Consulta"
                            >
                              <LogIn className="w-4 h-4" />
                            </button>
                          );
                        })()
                      )}
                      <button
                        className="action-button edit-action"
                        onClick={(e) => handleEditConsultation(e, consultation)}
                        title="Editar consulta"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="action-button delete-action"
                        onClick={(e) => handleDeleteConsultation(e, consultation)}
                        title="Excluir consulta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <button
            className="pagination-arrow"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>

          {/* Primeira página */}
          {currentPage > 3 && (
            <>
              <button
                className="pagination-number"
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
              {currentPage > 4 && <span className="pagination-dots">...</span>}
            </>
          )}

          {/* Páginas ao redor da atual */}
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
            if (pageNum > totalPages) return null;

            return (
              <button
                key={pageNum}
                className={`pagination-number ${pageNum === currentPage ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Última página */}
          {currentPage < totalPages - 2 && (
            <>
              {currentPage < totalPages - 3 && <span className="pagination-dots">...</span>}
              <button
                className="pagination-number"
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            className="pagination-arrow"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && consultationToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteConsultation}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon delete-icon">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="modal-title">Excluir Consulta</h3>
            </div>

            <div className="modal-body">
              <p className="modal-text">
                Tem certeza que deseja excluir a consulta de <strong>{consultationToDelete.patient_name}</strong>?
              </p>
              <p className="modal-warning">
                Esta ação irá remover a consulta do sistema e do Google Calendar (se sincronizado). Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={cancelDeleteConsultation}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                className="modal-button delete-button"
                onClick={confirmDeleteConsultation}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Consulta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Agendamento */}
      {showEditAgendamentoModal && editingAgendamento && (
        <div className="modal-overlay" onClick={handleCloseEditAgendamentoModal}>
          <div className="modal-content edit-agendamento-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Agendamento</h3>
              <button className="modal-close-btn" onClick={handleCloseEditAgendamentoModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body">
              {/* Paciente (readonly) */}
              <div className="form-group">
                <label className="form-label">Paciente</label>
                <div className="form-readonly-value">
                  <User className="w-4 h-4" />
                  {editingAgendamento.patient_name}
                </div>
              </div>

              {/* Data */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-agendamento-date">Data da Consulta</label>
                <input
                  type="date"
                  id="edit-agendamento-date"
                  className="form-input"
                  value={editAgendamentoForm.date}
                  onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Horário */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-agendamento-time">Horário</label>
                <input
                  type="time"
                  id="edit-agendamento-time"
                  className="form-input"
                  value={editAgendamentoForm.time}
                  onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              {/* Tipo de Atendimento */}
              <div className="form-group">
                <label className="form-label">Tipo de Atendimento</label>
                <div className="form-radio-group">
                  <label className={`form-radio-option ${editAgendamentoForm.type === 'TELEMEDICINA' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="agendamento-type"
                      value="TELEMEDICINA"
                      checked={editAgendamentoForm.type === 'TELEMEDICINA'}
                      onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <Video className="w-4 h-4" />
                    Telemedicina
                  </label>
                  <label className={`form-radio-option ${editAgendamentoForm.type === 'PRESENCIAL' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="agendamento-type"
                      value="PRESENCIAL"
                      checked={editAgendamentoForm.type === 'PRESENCIAL'}
                      onChange={(e) => setEditAgendamentoForm(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <User className="w-4 h-4" />
                    Presencial
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer modal-footer-between">
              <button
                className="modal-button delete-button"
                onClick={() => {
                  handleCloseEditAgendamentoModal();
                  setConsultationToDelete(editingAgendamento);
                  setShowDeleteModal(true);
                }}
                disabled={isSavingAgendamento}
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
              <div className="modal-footer-right">
                <button
                  className="modal-button cancel-button"
                  onClick={handleCloseEditAgendamentoModal}
                  disabled={isSavingAgendamento}
                >
                  Cancelar
                </button>
                <button
                  className="modal-button save-button"
                  onClick={handleSaveAgendamentoEdit}
                  disabled={isSavingAgendamento || !editAgendamentoForm.date || !editAgendamentoForm.time}
                >
                  {isSavingAgendamento ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Avanço de Etapa */}
      {showAdvanceModal && (
        <div className="modal-overlay" onClick={cancelAdvance}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: '#10b981', color: 'white' }}>
                <ArrowRight className="w-6 h-6" />
              </div>
              <h3 className="modal-title">Avançar para Próxima Etapa</h3>
            </div>

            <div className="modal-body">
              <p className="modal-text" style={{ marginBottom: '15px' }}>
                {advanceMessage}
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={cancelAdvance}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                className="modal-button"
                onClick={confirmAdvance}
                disabled={isSaving}
                style={{
                  background: '#10b981',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSaving ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Avançar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Loading component para o Suspense
function ConsultasPageLoading() {
  return (
    <div className="consultas-container">
      <div className="consultas-header">
        <h1 className="consultas-title">Lista de Consultas</h1>
      </div>
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    </div>
  );
}

// Wrapper com Suspense
export default function ConsultasPage() {
  return (
    <Suspense fallback={<ConsultasPageLoading />}>
      <ConsultasPageContent />
    </Suspense>
  );
}