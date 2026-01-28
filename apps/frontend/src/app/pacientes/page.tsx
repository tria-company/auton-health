'use client';

import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/components/shared/NotificationSystem';
import Link from 'next/link';
import { Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin, Calendar, Grid3X3, List, Link2, Copy, User, Trash, FileText, CheckCircle, Clock, Loader2, UserPlus, UserCheck, UserX, Eye, Send } from 'lucide-react';
import { PatientForm } from '@/components/patients/PatientForm';
import { supabase } from '@/lib/supabase';
import { gatewayClient } from '@/lib/gatewayClient';
import './pacientes.css';

// Tipos locais para pacientes - apenas campos da tabela patients
interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  // Campo para imagem do paciente
  profile_pic?: string;
  // Campo para anamnese
  anamnese?: {
    status: 'pendente' | 'preenchida';
  };
  // Campos para usuário do sistema externo
  user_auth?: string;
  user_status?: 'active' | 'inactive';
}

interface CreatePatientData {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
}

interface PatientsResponse {
  patients: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PatientsPage() {
  const { showSuccess, showError, showWarning } = useNotifications();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [showUserManagementModal, setShowUserManagementModal] = useState<Patient | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const isInitialMount = useRef(true);

  // Buscar pacientes
  const fetchPatients = async (page = 1, search = '', status = 'all', showLoading = false) => {
    try {
      // Só mostra loading se for carregamento inicial ou se explicitamente solicitado
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);

      console.log('🔍 Buscando pacientes...', `/patients?${params}`);

      const data = await gatewayClient.get<PatientsResponse>(`/patients?${params}`);
      
      console.log('📋 Dados recebidos:', data);
      console.log('👤 Primeiro paciente (exemplo):', data.patients[0]);
      setPatients(data.patients);
      setPagination(data.pagination);
    } catch (err) {
      console.error('❌ Erro ao buscar pacientes:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Carregar pacientes na montagem do componente
  useEffect(() => {
    fetchPatients(1, '', 'all', true); // Mostra loading no carregamento inicial
  }, []);

  // Fechar modal com tecla ESC
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showForm) {
          setShowForm(false);
        }
        if (editingPatient) {
          setEditingPatient(null);
        }
        if (showUserManagementModal) {
          setShowUserManagementModal(null);
        }
        if (showDeleteConfirm) {
          setShowDeleteConfirm(null);
        }
      }
    };

    if (showForm || editingPatient || showUserManagementModal || showDeleteConfirm) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevenir scroll do body quando modal está aberto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showForm, editingPatient, showUserManagementModal, showDeleteConfirm]);

  // Buscar pacientes quando filtros mudarem (com debounce)
  useEffect(() => {
    // Ignorar a primeira renderização (já foi feita busca no useEffect inicial)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Debounce de 1 segundo para evitar muitas requisições enquanto o usuário digita
    // Não mostra tela de loading durante busca com filtros
    const timeoutId = setTimeout(() => {
      fetchPatients(1, searchTerm, statusFilter, false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  // Estado para controlar se está criando paciente
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);

  // Criar ou sincronizar usuário do paciente
  const handleSyncUser = async (patientId: string, action: 'create' | 'activate' | 'deactivate' = 'create') => {
    setSyncingUser(patientId);
    try {
      const response = await gatewayClient.post(`/patients/${patientId}/sync-user`, { action });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao sincronizar usuário');
      }

      // Verificar se o email foi enviado
      if (action === 'create') {
        if (response.emailSent) {
          showSuccess(`${response.message || 'Usuário criado com sucesso!'} Email com credenciais enviado.`, 'Sucesso');
        } else {
          const passwordInfo = response.password ? `\n\nSenha gerada: ${response.password}\n\nPor favor, informe esta senha ao paciente manualmente.` : '';
          showWarning(
            `${response.message || 'Usuário criado com sucesso!'}\n\n⚠️ Email não foi enviado: ${response.emailError || 'Erro desconhecido'}${passwordInfo}`,
            'Atenção - Email não enviado'
          );
        }
      } else {
        showSuccess(response.message || 'Usuário sincronizado com sucesso!', 'Sucesso');
      }
      
      // Atualizar paciente no modal se estiver aberto
      if (showUserManagementModal && showUserManagementModal.id === patientId && response.patient) {
        setShowUserManagementModal(response.patient);
      }
      
      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (error) {
      console.error('Erro ao sincronizar usuário:', error);
      showError(`Erro ao sincronizar usuário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
      throw error; // Re-throw para que o chamador saiba que houve erro
    } finally {
      setSyncingUser(null);
    }
  };

  // Ativar/Desativar usuário do paciente
  const handleToggleUserStatus = async (patientId: string, currentStatus: 'active' | 'inactive') => {
    setSyncingUser(patientId);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await gatewayClient.patch(`/patients/${patientId}/user-status`, { status: newStatus });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao alterar status do usuário');
      }

      showSuccess(response.message || `Usuário ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!`, 'Sucesso');
      
      // Atualizar paciente no modal se estiver aberto
      if (showUserManagementModal && showUserManagementModal.id === patientId && response.patient) {
        setShowUserManagementModal(response.patient);
      }
      
      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      showError(`Erro ao alterar status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setSyncingUser(null);
    }
  };

  // Reenviar email com credenciais
  const handleResendCredentials = async (patientId: string) => {
    setResendingEmail(true);
    try {
      const response = await gatewayClient.post(`/patients/${patientId}/resend-credentials`, {});

      if (!response.success) {
        throw new Error(response.error || 'Erro ao reenviar email');
      }

      if (response.emailSent) {
        showSuccess('Email com credenciais reenviado com sucesso!', 'Email Enviado');
      } else {
        const passwordInfo = response.password ? `\n\nNova senha gerada: ${response.password}\n\nPor favor, informe esta senha ao paciente manualmente.` : '';
        showWarning(
          `Email não foi enviado: ${response.emailError || 'Erro desconhecido'}${passwordInfo}`,
          'Atenção - Email não enviado'
        );
      }
    } catch (error) {
      console.error('Erro ao reenviar email:', error);
      showError(`Erro ao reenviar email: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setResendingEmail(false);
    }
  };

  // Criar novo paciente
  const handleCreatePatient = async (patientData: CreatePatientData) => {
    // Prevenir múltiplas requisições
    if (isCreatingPatient) {
      return;
    }

    setIsCreatingPatient(true);
    try {
      console.log('📤 Enviando dados do paciente:', patientData);
      
      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Criar paciente no Supabase
      const { data: result, error: insertError } = await supabase
        .from('pacientes')
        .insert({
          ...patientData,
          user_id: user.id,
        })
        .select()
        .single();

      console.log('📥 Resposta recebida:', { result, insertError });

      if (insertError || !result) {
        console.error('❌ Erro na resposta:', insertError);
        throw new Error(insertError?.message || 'Erro ao criar paciente');
      }

      console.log('✅ Paciente criado com sucesso:', result);

      // Criar usuário automaticamente se email estiver presente
      if (result.email && patientData.email) {
        try {
          await handleSyncUser(result.id, 'create');
        } catch (error) {
          console.warn('Paciente criado, mas não foi possível criar usuário:', error);
          // Não mostrar erro, apenas logar - o usuário pode criar depois manualmente
        }
      }

      setShowForm(false);
      setIsCreatingPatient(false); // Reabilitar o botão após sucesso
      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (err) {
      console.error('❌ Erro ao criar paciente:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar paciente');
      throw err; // Re-throw para que o formulário saiba que houve erro
    } finally {
      setIsCreatingPatient(false);
    }
  };

  // Atualizar paciente
  const handleUpdatePatient = async (patientData: CreatePatientData) => {
    if (!editingPatient) return;

    try {
      const response = await gatewayClient.put(`/patients/${editingPatient.id}`, patientData);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar paciente');
      }

      setEditingPatient(null);
      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar paciente');
    }
  };

  // Deletar paciente
  const handleDeletePatient = async (patientId: string) => {
    if (!confirm('Tem certeza que deseja deletar este paciente?')) {
      return;
    }

    try {
      const response = await gatewayClient.delete(`/patients/${patientId}`);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao deletar paciente');
      }

      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar paciente');
    }
  };

  // Calcular idade
  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Obter texto do status
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  // Copiar link da anamnese inicial
  const handleCopyAnamneseLink = async (patientId: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/anamnese-inicial?paciente_id=${patientId}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Link da anamnese copiado para a área de transferência!', 'Link Copiado');
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      showError('Erro ao copiar link. Tente novamente.', 'Erro ao Copiar');
    }
  };

  // Enviar anamnese por email e WhatsApp
  const [sendingAnamnese, setSendingAnamnese] = useState<string | null>(null);
  const handleSendAnamneseEmailAndWhatsApp = async (patientId: string) => {
    setSendingAnamnese(patientId);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const patient = patients.find(p => p.id === patientId);
      if (!patient) {
        throw new Error('Paciente não encontrado');
      }

      if (!patient.email && !patient.phone) {
        throw new Error('Paciente não possui email nem telefone cadastrado');
      }

      const { data: existingAnamnese } = await supabase
        .from('a_cadastro_anamnese')
        .select('*')
        .eq('paciente_id', patientId)
        .maybeSingle();

      if (existingAnamnese) {
        const { error } = await supabase
          .from('a_cadastro_anamnese')
          .update({ status: 'pendente', updated_at: new Date().toISOString() })
          .eq('paciente_id', patientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('a_cadastro_anamnese')
          .insert({
            paciente_id: patientId,
            status: 'pendente'
          });
        if (error) throw error;
      }

      const anamneseLink = `${window.location.origin}/anamnese-inicial?pacienteId=${patientId}`;
      let emailOk = false;
      let whatsappOk = false;

      if (patient.email) {
        const emailResponse = await gatewayClient.post('/email/anamnese', {
          to: patient.email,
          patientName: patient.name,
          anamneseLink
        });
        emailOk = !!emailResponse.success;
      }

      if (patient.phone) {
        const whatsappResponse = await gatewayClient.post('/whatsapp/anamnese', {
          phone: patient.phone,
          patientName: patient.name,
          anamneseLink
        });
        whatsappOk = !!whatsappResponse.success;
      }

      if (emailOk && whatsappOk) {
        showSuccess('Anamnese enviada por email e WhatsApp com sucesso!', 'Enviado');
      } else if (emailOk) {
        showSuccess('Anamnese enviada por email. WhatsApp não enviado (verifique o telefone).', 'Enviado');
      } else if (whatsappOk) {
        showSuccess('Anamnese enviada por WhatsApp. Email não enviado (verifique o email).', 'Enviado');
      } else {
        showWarning(
          'Anamnese criada, mas nenhum envio concluído. Use "Copiar Link" e envie manualmente.',
          'Atenção'
        );
      }

      fetchPatients(pagination.page, searchTerm, statusFilter, false);
    } catch (error) {
      console.error('Erro ao enviar anamnese:', error);
      showError(`Erro ao enviar anamnese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setSendingAnamnese(null);
    }
  };

  // Confirmar exclusão de paciente
  const handleConfirmDelete = async (patientId: string) => {
    try {
      const response = await gatewayClient.delete(`/patients/${patientId}`);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao deletar paciente');
      }

      setShowDeleteConfirm(null);
      fetchPatients(pagination.page, searchTerm, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar paciente');
    }
  };

  return (
    <div className="patients-page">
      <div className="patients-container">
        {/* Header */}
        <div className="patients-header">
          <div className="patients-header-content">
            <h1 className="patients-title">Lista de Pacientes</h1>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary btn-novo-paciente"
            >
              <Plus className="btn-icon" />
              Novo Paciente
            </button>
          </div>
          <div className="patients-count-badge">
            {pagination.total} {pagination.total === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}
          </div>
        </div>
        
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Carregando pacientes...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-content">
              <p className="error-title">Erro ao buscar pacientes</p>
              <p className="error-message">{error}</p>
            </div>
            <button 
              onClick={() => fetchPatients(pagination.page, searchTerm, statusFilter, true)}
              className="btn btn-secondary"
            >
              Tentar Novamente
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum paciente encontrado</h3>
            <p>Comece cadastrando seu primeiro paciente para gerenciar suas consultas.</p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <Plus className="btn-icon" />
              Cadastrar Primeiro Paciente
            </button>
          </div>
        ) : (
          <div className="patients-table-container">
            {/* Cabeçalho da Tabela */}
            <div className="patients-table-header">
              <div className="table-header-cell table-header-paciente">
                <div className="search-container-inline">
                  <Search className="search-icon-inline" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                    className="search-input-inline"
                  />
                </div>
              </div>
              <div className="table-header-titles-row">
                <div className="table-header-cell">
                  <span className="header-label">Paciente</span>
                </div>
                <div className="table-header-divider"></div>
                <div className="table-header-cell">
                  <span className="header-label">Dados do Paciente</span>
                </div>
                <div className="table-header-divider"></div>
                <div className="table-header-cell table-header-acoes">
                  <span className="header-label">Ações</span>
                </div>
              </div>
            </div>

            {/* Corpo da Tabela */}
            <div className="patients-table-body">
              {patients.map((patient) => {
                const initials = patient.name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                
                return (
                  <div key={patient.id} className="patients-table-row">
                    <div className="table-cell table-cell-paciente">
                      <div className="patient-info-cell">
                        <div className="patient-avatar-table">
                          {patient.profile_pic ? (
                            <img 
                              src={patient.profile_pic} 
                              alt={patient.name}
                              className="avatar-image-table"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const placeholder = target.nextElementSibling as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="avatar-placeholder-table" style={{ display: patient.profile_pic ? 'none' : 'flex' }}>
                            <span className="avatar-initial-table">{initials}</span>
                          </div>
                        </div>
                        <div className="patient-name-badge-container">
                          <div className="patient-name-table">{patient.name}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {patient.status === 'active' && (
                              <span className="patient-status-badge active">ATIVO</span>
                            )}
                            {patient.anamnese?.status ? (
                              <span 
                                className="patient-status-badge" 
                                style={{
                                  backgroundColor: patient.anamnese.status === 'preenchida' ? '#d1fae5' : '#fef3c7',
                                  color: patient.anamnese.status === 'preenchida' ? '#065f46' : '#92400e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {patient.anamnese.status === 'preenchida' ? (
                                  <>
                                    <CheckCircle size={14} />
                                    <span>Anamnese Preenchida</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={14} />
                                    <span>Anamnese Pendente</span>
                                  </>
                                )}
                              </span>
                            ) : (
                              <span 
                                className="patient-status-badge" 
                                style={{
                                  backgroundColor: '#f3f4f6',
                                  color: '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FileText size={14} />
                                <span>Anamnese Não Enviada</span>
                              </span>
                            )}
                            {patient.user_auth && (
                              <span 
                                className="patient-status-badge" 
                                style={{
                                  backgroundColor: patient.user_status === 'active' ? '#dbeafe' : '#fee2e2',
                                  color: patient.user_status === 'active' ? '#1e40af' : '#991b1b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {patient.user_status === 'active' ? (
                                  <>
                                    <UserCheck size={14} />
                                    <span>Usuário Ativo</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX size={14} />
                                    <span>Usuário Inativo</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="table-cell-divider"></div>
                    <div className="table-cell table-cell-dados">
                      <div className="patient-contact-info-table">
                        {patient.email && (
                          <div className="contact-item-table">
                            <Mail size={16} className="contact-icon-table" />
                            <span className="contact-value-table">{patient.email}</span>
                          </div>
                        )}
                        {patient.phone && (
                          <div className="contact-item-table">
                            <Phone size={16} className="contact-icon-table" />
                            <span className="contact-value-table">{patient.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="table-cell-divider"></div>
                    <div className="table-cell table-cell-acoes">
                      <div className="patient-actions-table">
                        <button 
                          className="action-btn-table email"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendAnamneseEmailAndWhatsApp(patient.id);
                          }}
                          disabled={sendingAnamnese === patient.id}
                          title="Enviar anamnese por email e WhatsApp"
                        >
                          {sendingAnamnese === patient.id ? (
                            <>
                              <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Send size={16} />
                              <span>Email e WhatsApp</span>
                            </>
                          )}
                        </button>
                        <button 
                          className={`action-btn-table copy ${copySuccess === patient.id ? 'success' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAnamneseLink(patient.id);
                          }}
                          title="Copiar link da anamnese inicial"
                        >
                          <Copy size={16} />
                          <span>Copiar Link</span>
                        </button>
                        <Link
                          href={`/pacientes/detalhes/?id=${patient.id}`}
                          className="action-btn-table details"
                          title="Ver detalhes e métricas do paciente"
                        >
                          <Eye size={16} />
                          <span>Ver detalhes</span>
                        </Link>
                        {/* Botão para gerenciar acesso do paciente */}
                        <button 
                          className="action-btn-table user-manage"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowUserManagementModal(patient);
                          }}
                          title="Gerenciar acesso do paciente"
                        >
                          <User size={16} />
                          <span>Gerenciar Acesso</span>
                        </button>
                        <button 
                          className="action-btn-table edit"
                          onClick={() => setEditingPatient(patient)}
                          title="Editar informações do paciente"
                        >
                          <Edit size={16} />
                          <span>Editar</span>
                        </button>
                        <button 
                          className="action-btn-table delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(patient.id);
                          }}
                          title="Excluir paciente"
                        >
                          <Trash2 size={16} />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Paginação */}
            {pagination.totalPages > 1 && (
              <div className="pagination-design">
                <button 
                  className="pagination-btn" 
                  disabled={pagination.page === 1}
                  onClick={() => fetchPatients(pagination.page - 1, searchTerm, statusFilter, false)}
                >
                  <span>‹</span>
                </button>
                
                {/* Primeira página */}
                {pagination.page > 3 && (
                  <>
                    <button 
                      className="pagination-number"
                      onClick={() => fetchPatients(1, searchTerm, statusFilter, false)}
                    >
                      1
                    </button>
                    {pagination.page > 4 && <span className="pagination-dots">...</span>}
                  </>
                )}
                
                {/* Páginas ao redor da atual */}
                {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.totalPages - 2, pagination.page - 1)) + i;
                  if (pageNum > pagination.totalPages) return null;
                  
                  return (
                    <button 
                      key={pageNum}
                      className={`pagination-number ${pageNum === pagination.page ? 'active' : ''}`}
                      onClick={() => fetchPatients(pageNum, searchTerm, statusFilter, false)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {/* Última página */}
                {pagination.page < pagination.totalPages - 2 && (
                  <>
                    {pagination.page < pagination.totalPages - 3 && <span className="pagination-dots">...</span>}
                    <button 
                      className="pagination-number"
                      onClick={() => fetchPatients(pagination.totalPages, searchTerm, statusFilter, false)}
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}
                
                <button 
                  className="pagination-btn"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => fetchPatients(pagination.page + 1, searchTerm, statusFilter, false)}
                >
                  <span>›</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Modal de Formulário */}
      {showForm && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="modal-content">
            <PatientForm
              onSubmit={handleCreatePatient}
              onCancel={() => setShowForm(false)}
              title="Novo Paciente"
            />
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingPatient && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingPatient(null);
            }
          }}
        >
          <div className="modal-content">
            <PatientForm
              patient={editingPatient}
              onSubmit={handleUpdatePatient}
              onCancel={() => setEditingPatient(null)}
              title="Editar Paciente"
            />
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(null);
            }
          }}
        >
          <div className="modal-content delete-confirm-modal">
            <div className="delete-modal-icon-wrapper">
              <div className="delete-modal-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div className="modal-header">
              <h3 className="modal-title">Confirmar Exclusão</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-message">Tem certeza que deseja excluir este paciente?</p>
              <p className="warning-text">⚠️ Esta ação não pode ser desfeita.</p>
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary delete-modal-cancel"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-danger delete-modal-confirm"
                onClick={() => handleConfirmDelete(showDeleteConfirm)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Acesso */}
      {showUserManagementModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUserManagementModal(null);
            }
          }}
        >
          <div className="modal-content user-management-modal">
            <div className="modal-header">
              <h3 className="modal-title">Gerenciar Acesso do Paciente</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setShowUserManagementModal(null)}
                aria-label="Fechar"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="user-management-info">
                <div className="user-management-patient-info">
                  <h4>{showUserManagementModal.name}</h4>
                  {showUserManagementModal.email && (
                    <p className="user-management-email">
                      <Mail size={16} />
                      {showUserManagementModal.email}
                    </p>
                  )}
                </div>

                <div className="user-management-status">
                  {!showUserManagementModal.user_auth ? (
                    <div className="status-badge status-none">
                      <UserX size={16} />
                      <span>Usuário não criado</span>
                    </div>
                  ) : showUserManagementModal.user_status === 'active' ? (
                    <div className="status-badge status-active">
                      <UserCheck size={16} />
                      <span>Usuário Ativo</span>
                    </div>
                  ) : (
                    <div className="status-badge status-inactive">
                      <UserX size={16} />
                      <span>Usuário Inativo</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="user-management-actions">
                {!showUserManagementModal.user_auth ? (
                  <button
                    className="btn btn-primary user-action-btn"
                    onClick={async () => {
                      try {
                        await handleSyncUser(showUserManagementModal.id, 'create');
                      } catch (error) {
                        // Erro já tratado em handleSyncUser
                      }
                    }}
                    disabled={syncingUser === showUserManagementModal.id || !showUserManagementModal.email}
                  >
                    {syncingUser === showUserManagementModal.id ? (
                      <>
                        <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                        Criando Usuário...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Criar Usuário de Acesso
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    {showUserManagementModal.user_status === 'active' ? (
                      <button
                        className="btn btn-warning user-action-btn"
                        onClick={async () => {
                          await handleToggleUserStatus(showUserManagementModal.id, 'active');
                        }}
                        disabled={syncingUser === showUserManagementModal.id}
                      >
                        {syncingUser === showUserManagementModal.id ? (
                          <>
                            <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                            Desativando...
                          </>
                        ) : (
                          <>
                            <UserX size={16} />
                            Desativar Usuário
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        className="btn btn-success user-action-btn"
                        onClick={async () => {
                          await handleToggleUserStatus(showUserManagementModal.id, 'inactive');
                        }}
                        disabled={syncingUser === showUserManagementModal.id}
                      >
                        {syncingUser === showUserManagementModal.id ? (
                          <>
                            <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                            Ativando...
                          </>
                        ) : (
                          <>
                            <UserCheck size={16} />
                            Ativar Usuário
                          </>
                        )}
                      </button>
                    )}
                    
                    {showUserManagementModal.user_auth && (
                      <button
                        className="btn btn-secondary user-action-btn"
                        onClick={async () => {
                          await handleResendCredentials(showUserManagementModal.id);
                        }}
                        disabled={resendingEmail || !showUserManagementModal.email}
                      >
                        {resendingEmail ? (
                          <>
                            <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                            Reenviando...
                          </>
                        ) : (
                          <>
                            <Mail size={16} />
                            Reenviar Email com Credenciais
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              {!showUserManagementModal.email && (
                <div className="user-management-warning">
                  <p>⚠️ Este paciente não possui email cadastrado. É necessário ter um email para criar ou gerenciar o acesso.</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowUserManagementModal(null);
                  fetchPatients(pagination.page, searchTerm, statusFilter, false);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}