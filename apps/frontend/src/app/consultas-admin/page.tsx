'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  Video, 
  User, 
  Clock,
  ExternalLink,
  Loader2,
  PhoneOff,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { gatewayClient } from '@/lib/gatewayClient';
import './consultas-admin.css';

interface ConsultaAdmin {
  id: string;
  doctor_id: string;
  patient_id: string;
  status: string;
  consulta_inicio: string | null;
  patient_name: string;
  consultation_type: string;
  created_at: string;
  medico_email: string | null;
  medico_name: string | null;
  room_id: string | null;
  session_status: string | null;
  webrtc_active: boolean;
}

interface ConsultasResponse {
  consultations: ConsultaAdmin[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ConsultasAdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [consultas, setConsultas] = useState<ConsultaAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [terminatingRoom, setTerminatingRoom] = useState<string | null>(null);
  const [terminateSuccess, setTerminateSuccess] = useState<string | null>(null);

  // Verificar se o usuário é admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('admin')
          .eq('user_auth', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar status de admin:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(data?.admin === true);
        }
      } catch (err) {
        console.error('Erro ao verificar status de admin:', err);
        setIsAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminStatus();
    }
  }, [user?.id, authLoading]);

  // Buscar consultas abertas
  const fetchConsultas = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Buscar consultas com status RECORDING via gateway
      const response = await gatewayClient.get('/admin/consultations');

      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar consultas');
      }

      setConsultas(response.consultations || []);
    } catch (err) {
      console.error('Erro ao buscar consultas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carregar consultas quando admin for verificado
  useEffect(() => {
    if (isAdmin === true) {
      fetchConsultas();
    } else if (isAdmin === false) {
      setLoading(false);
    }
  }, [isAdmin]);

  // Função para encerrar chamada
  const handleTerminateCall = async (consulta: ConsultaAdmin) => {
    if (!consulta.room_id) {
      setError('Esta consulta não possui uma sala ativa');
      return;
    }

    const confirmMessage = `Tem certeza que deseja encerrar a chamada?\n\nPaciente: ${consulta.patient_name}\nMédico: ${consulta.medico_name || consulta.medico_email || 'Não identificado'}\nRoom ID: ${consulta.room_id}`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setTerminatingRoom(consulta.room_id);
    setError(null);
    setTerminateSuccess(null);

    try {
      // Encerrar consulta via gateway
      const response = await gatewayClient.post(`/admin/consultations/${consulta.id}/terminate`);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao encerrar chamada');
      }

      setTerminateSuccess(`Chamada encerrada com sucesso: ${consulta.room_id}`);
      
      // Atualizar lista de consultas
      await fetchConsultas();

      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setTerminateSuccess(null), 5000);

    } catch (err) {
      console.error('Erro ao encerrar chamada:', err);
      setError(err instanceof Error ? err.message : 'Erro ao encerrar chamada');
    } finally {
      setTerminatingRoom(null);
    }
  };

  // Formatar data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'status-created';
      case 'RECORDING':
        return 'status-recording';
      case 'PROCESSING':
        return 'status-processing';
      case 'VALIDATION':
        return 'status-validation';
      default:
        return 'status-default';
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <Loader2 className="loading-spinner" />
          <p>Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  // Não é admin
  if (isAdmin === false) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <AlertCircle size={48} />
          <h2>Acesso Negado</h2>
          <p>Você não tem permissão para acessar esta página.</p>
          <p>Apenas administradores podem visualizar este painel.</p>
          <button 
            className="btn-back"
            onClick={() => router.push('/dashboard')}
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-title">
          <ShieldCheck size={28} />
          <h1>Painel Administrativo</h1>
        </div>
        <div className="admin-subtitle">
          <p>Consultas abertas no sistema</p>
          <span className="consultation-count">{consultas.length} consulta(s) em aberto</span>
        </div>
        <button 
          className="btn-refresh"
          onClick={fetchConsultas}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'spinning' : ''} size={18} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div className="admin-error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {terminateSuccess && (
        <div className="admin-success-message">
          <CheckCircle size={20} />
          <span>{terminateSuccess}</span>
        </div>
      )}

      {consultas.length === 0 && !error ? (
        <div className="admin-empty">
          <Video size={48} />
          <h3>Nenhuma consulta aberta</h3>
          <p>Não há consultas em andamento no momento.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID da Consulta</th>
                <th>Email do Médico</th>
                <th>Paciente</th>
                <th>Status</th>
                <th>WebRTC</th>
                <th>Início</th>
                <th>Room ID</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {consultas.map((consulta) => (
                <tr key={consulta.id} className={consulta.webrtc_active ? 'row-webrtc-active' : ''}>
                  <td className="td-id">
                    <code>{consulta.id.substring(0, 8)}...</code>
                    <button 
                      className="btn-copy"
                      onClick={() => navigator.clipboard.writeText(consulta.id)}
                      title="Copiar ID completo"
                    >
                      📋
                    </button>
                  </td>
                  <td className="td-email">
                    {consulta.medico_email || '-'}
                    {consulta.medico_name && (
                      <span className="medico-name">({consulta.medico_name})</span>
                    )}
                  </td>
                  <td className="td-patient">
                    <div className="patient-info">
                      {consulta.patient_name && (
                        <span className="patient-name">{consulta.patient_name}</span>
                      )}
                      <code className="patient-id">{consulta.patient_id?.substring(0, 8) || '-'}...</code>
                    </div>
                  </td>
                  <td className="td-status">
                    <span className={`status-badge ${getStatusColor(consulta.status)}`}>
                      {consulta.status}
                    </span>
                    {consulta.session_status && (
                      <span className="session-status">
                        (Sessão: {consulta.session_status})
                      </span>
                    )}
                  </td>
                  <td className="td-webrtc">
                    {consulta.webrtc_active ? (
                      <div className="webrtc-active">
                        <Wifi size={16} className="webrtc-icon active" />
                        <span className="webrtc-label active">Conectado</span>
                      </div>
                    ) : (
                      <div className="webrtc-inactive">
                        <WifiOff size={16} className="webrtc-icon inactive" />
                        <span className="webrtc-label inactive">Desconectado</span>
                      </div>
                    )}
                  </td>
                  <td className="td-date">
                    <div className="date-info">
                      <Clock size={14} />
                      <span>{formatDate(consulta.consulta_inicio)}</span>
                    </div>
                    {!consulta.consulta_inicio && (
                      <span className="date-fallback">
                        Criado: {formatDate(consulta.created_at)}
                      </span>
                    )}
                  </td>
                  <td className="td-room">
                    {consulta.room_id ? (
                      <div className="room-info">
                        <Video size={14} />
                        <code>{consulta.room_id.substring(0, 12)}...</code>
                      </div>
                    ) : (
                      <span className="no-room">Sem sala</span>
                    )}
                  </td>
                  <td className="td-actions">
                    {consulta.room_id && (
                      <button
                        className={`btn-terminate ${terminatingRoom === consulta.room_id ? 'loading' : ''}`}
                        onClick={() => handleTerminateCall(consulta)}
                        disabled={terminatingRoom !== null}
                        title="Encerrar chamada"
                      >
                        {terminatingRoom === consulta.room_id ? (
                          <Loader2 size={16} className="spinning" />
                        ) : (
                          <PhoneOff size={16} />
                        )}
                        <span>Encerrar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
