'use client';

import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { Plus, Search, MoreVertical, Edit, Trash2, Phone, Mail, MapPin, Calendar, Grid3X3, List, Link2, Copy, User, Trash, FileText, CheckCircle, Clock, Loader2 } from 'lucide-react';
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
  const { showSuccess, showError } = useNotifications();
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
      }
    };

    if (showForm || editingPatient) {
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
  }, [showForm, editingPatient]);

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

  // Enviar anamnese por email
  const [sendingAnamnese, setSendingAnamnese] = useState<string | null>(null);
  const handleSendAnamneseEmail = async (patientId: string) => {
    setSendingAnamnese(patientId);
    try {
      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar dados do paciente para obter email e nome
      const patient = patients.find(p => p.id === patientId);
      if (!patient) {
        throw new Error('Paciente não encontrado');
      }

      if (!patient.email) {
        throw new Error('Paciente não possui email cadastrado');
      }

      // Criar ou atualizar anamnese inicial no Supabase (tabela correta: a_cadastro_anamnese)
      const { data: existingAnamnese } = await supabase
        .from('a_cadastro_anamnese')
        .select('*')
        .eq('paciente_id', patientId)
        .single();

      let anamneseResult;
      
      if (existingAnamnese) {
        // Atualizar existente
        const { data, error } = await supabase
          .from('a_cadastro_anamnese')
          .update({ 
            status: 'pendente',
            updated_at: new Date().toISOString()
          })
          .eq('paciente_id', patientId)
          .select()
          .single();
        
        if (error) throw error;
        anamneseResult = data;
      } else {
        // Criar nova
        const { data, error } = await supabase
          .from('a_cadastro_anamnese')
          .insert({
            paciente_id: patientId,
            user_id: user.id,
            status: 'pendente'
          })
          .select()
          .single();
        
        if (error) throw error;
        anamneseResult = data;
      }

      // Gerar link para anamnese
      const anamneseLink = `${window.location.origin}/anamnese-inicial?pacienteId=${patientId}`;

      // Enviar email via API do gateway
      const emailResponse = await gatewayClient.post('/email/anamnese', {
        to: patient.email,
        patientName: patient.name,
        anamneseLink
      });

      if (emailResponse.success) {
        showSuccess('Anamnese enviada por email com sucesso!', 'Anamnese Enviada');
      } else {
        showWarning(
          `Anamnese criada, mas email não foi enviado: ${emailResponse.error || 'Erro desconhecido'}. Use o link abaixo para copiar.`,
          'Atenção'
        );
      }
      
      // Recarregar lista de pacientes para atualizar status
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
                            handleSendAnamneseEmail(patient.id);
                          }}
                          disabled={sendingAnamnese === patient.id}
                          title="Enviar anamnese por email"
                        >
                          {sendingAnamnese === patient.id ? (
                            <>
                              <Loader2 size={16} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Mail size={16} />
                              <span>Enviar Email</span>
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
    </div>
  );
}