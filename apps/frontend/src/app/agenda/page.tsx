'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Video, Plus, LogIn, RefreshCw, Check, X, Loader2, Pencil, Trash2 } from 'lucide-react';
import { gatewayClient } from '@/lib/gatewayClient';
import './agenda.css';

interface ConsultationEvent {
  id: string;
  title: string;
  patient: string;
  patient_id: string;
  date: Date;
  time: string;
  type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: 'CREATED' | 'AGENDAMENTO' | 'RECORDING' | 'PROCESSING' | 'VALIDATION' | 'VALID_ANAMNESE' | 'VALID_DIAGNOSTICO' | 'VALID_SOLUCAO' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  duration: number; // em minutos
}

interface GoogleCalendarStatus {
  connected: boolean;
  syncEnabled?: boolean;
  googleEmail?: string;
  calendarId?: string;
  calendarName?: string;
  lastSyncAt?: string;
  isExpired?: boolean;
}

// Sem dados mock – inicia vazio e carrega da API
const mockConsultations: ConsultationEvent[] = [];

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [consultations, setConsultations] = useState<ConsultationEvent[]>(mockConsultations);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Estados do Google Calendar
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(true);
  const [showGoogleMenu, setShowGoogleMenu] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados do Modal de Edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<ConsultationEvent | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: '',
    time: '',
    type: 'TELEMEDICINA' as 'PRESENCIAL' | 'TELEMEDICINA'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados do Modal de Confirmação de Exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [consultationToDelete, setConsultationToDelete] = useState<ConsultationEvent | null>(null);

  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Carregar status do Google Calendar
  const loadGoogleCalendarStatus = async () => {
    try {
      const response = await gatewayClient.get('/api/auth/google-calendar/status');
      // gatewayClient retorna flat response (properties misturados no objeto root)
      if (response.success) {
        setGoogleCalendarStatus({
          connected: response.connected,
          googleEmail: response.email // Backend envia 'email', interface espera 'googleEmail'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar status do Google Calendar:', error);
    } finally {
      setGoogleCalendarLoading(false);
    }
  };

  useEffect(() => {
    loadGoogleCalendarStatus();
  }, []);

  // Verificar query params do OAuth callback
  useEffect(() => {
    const connected = searchParams.get('google_calendar_connected');
    const error = searchParams.get('google_calendar_error');

    if (connected === 'true') {
      setNotification({ type: 'success', message: 'Google Calendar conectado com sucesso!' });
      // ✅ Forçar recarregamento do status
      loadGoogleCalendarStatus();
      // Limpar URL
      router.replace('/agenda', { scroll: false });
    } else if (error) {
      // ... error handling ...
      const errorMessages: Record<string, string> = {
        'access_denied': 'Acesso negado. Você cancelou a autorização.',
        'no_code': 'Erro na autorização. Tente novamente.',
        'invalid_state': 'Sessão inválida. Faça login novamente.',
        'config_error': 'Erro de configuração. Contate o suporte.',
        'token_exchange_failed': 'Erro ao obter autorização do Google.',
        'incomplete_tokens': 'Tokens incompletos. Tente novamente.',
        'medico_not_found': 'Médico não encontrado.',
        'save_failed': 'Erro ao salvar conexão.',
        'unknown': 'Erro desconhecido. Tente novamente.',
      };
      setNotification({ type: 'error', message: errorMessages[error] || 'Erro ao conectar Google Calendar.' });
      router.replace('/agenda', { scroll: false });
    }
  }, [searchParams, router]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Função para conectar Google Calendar
  const handleConnectGoogleCalendar = async () => {
    try {
      setGoogleCalendarLoading(true);
      const response = await gatewayClient.get<any>('/api/auth/google-calendar/authorize');

      if (response.success && (response.authUrl || response.data?.authUrl)) {
        window.location.href = response.authUrl || response.data?.authUrl;
      } else {
        console.error('Erro na conexão:', response);
        setNotification({
          type: 'error',
          message: response.error || response.message || 'Erro ao iniciar conexão com Google Calendar.'
        });
        setGoogleCalendarLoading(false);
      }
    } catch (error) {
      console.error('Erro ao conectar Google Calendar:', error);
      setNotification({ type: 'error', message: 'Erro ao conectar Google Calendar.' });
      setGoogleCalendarLoading(false);
    }
  };

  // Função para desconectar Google Calendar
  const handleDisconnectGoogleCalendar = async () => {
    if (!confirm('Tem certeza que deseja desconectar o Google Calendar?')) return;

    try {
      const response = await gatewayClient.post('/api/auth/google-calendar/disconnect');
      if (response.success) {
        setGoogleCalendarStatus({ connected: false });
        setNotification({ type: 'success', message: 'Google Calendar desconectado.' });
      } else {
        setNotification({ type: 'error', message: 'Erro ao desconectar.' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Erro ao desconectar.' });
    }
    setShowGoogleMenu(false);
  };

  // Carregar consultas do mês atual
  useEffect(() => {
    const load = async () => {
      const year = currentYear;
      const month = currentMonth + 1; // 1-12
      const res = await gatewayClient.get(`/agenda?year=${year}&month=${month}`);
      if (!res.success) return;
      const items = (res.items || []) as Array<{
        id: string;
        patient: string;
        patient_id: string;
        consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
        status: string;
        duration: number | null;
        created_at: string;
        consulta_inicio: string | null;
      }>;

      const mapped: ConsultationEvent[] = items.map((c) => {
        // Usar consulta_inicio se disponível, senão created_at
        const d = c.consulta_inicio ? new Date(c.consulta_inicio) : new Date(c.created_at);
        const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return {
          id: c.id,
          title: 'Consulta',
          patient: c.patient,
          patient_id: c.patient_id,
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          time,
          type: c.consultation_type,
          status: c.status as ConsultationEvent['status'], // Status real do banco
          duration: c.duration ? Math.round(c.duration / 60) : 30
        };
      });
      setConsultations(mapped);
    };
    load();
  }, [currentMonth, currentYear]);

  // Navegação
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') newDate.setMonth(prev.getMonth() - 1);
      else newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      const delta = direction === 'prev' ? -7 : 7;
      newDate.setDate(prev.getDate() + delta);
      return newDate;
    });
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'prev' ? -1 : 1));
      setSelectedDate(newDate);
      return newDate;
    });
  };

  // Obter dias do mês
  const getDaysInMonth = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Dias do mês anterior (para preencher o início)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevMonthDay = new Date(currentYear, currentMonth, -i);
      days.push({
        date: prevMonthDay,
        isCurrentMonth: false,
        isToday: false,
        consultations: []
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayConsultations = consultations.filter(consultation =>
        consultation.date.toDateString() === date.toDateString()
      );

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        consultations: dayConsultations
      });
    }

    // Dias do próximo mês (para preencher o final)
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonthDay = new Date(currentYear, currentMonth + 1, day);
      days.push({
        date: nextMonthDay,
        isCurrentMonth: false,
        isToday: false,
        consultations: []
      });
    }

    return days;
  };

  // Obter dias da semana corrente (domingo-sábado)
  const getDaysInWeek = () => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const dayOfWeek = start.getDay(); // 0-6
    start.setDate(start.getDate() - dayOfWeek);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayConsultations = consultations.filter(c => c.date.toDateString() === d.toDateString());
      days.push({
        date: d,
        isCurrentMonth: d.getMonth() === currentMonth && d.getFullYear() === currentYear,
        isToday: d.toDateString() === today.toDateString(),
        consultations: dayConsultations
      });
    }
    return days;
  };

  // Obter apenas o dia selecionado/atual
  const getDayView = () => {
    const d = selectedDate ? new Date(selectedDate) : new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    const dayConsultations = consultations.filter(c => c.date.toDateString() === d.toDateString());
    return [{
      date: d,
      isCurrentMonth: true,
      isToday: d.toDateString() === today.toDateString(),
      consultations: dayConsultations
    }];
  };

  // Obter consultas do dia selecionado
  const getSelectedDayConsultations = () => {
    if (!selectedDate) return [];
    return consultations.filter(consultation =>
      consultation.date.toDateString() === selectedDate.toDateString()
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'status-created';
      case 'AGENDAMENTO':
        return 'status-agendamento';
      case 'RECORDING':
        return 'status-recording';
      case 'PROCESSING':
        return 'status-processing';
      case 'VALIDATION':
        return 'status-validation';
      case 'VALID_ANAMNESE':
        return 'status-valid-anamnese';
      case 'VALID_DIAGNOSTICO':
        return 'status-valid-diagnostico';
      case 'VALID_SOLUCAO':
        return 'status-valid-solucao';
      case 'COMPLETED':
        return 'status-completed';
      case 'ERROR':
        return 'status-error';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-created';
    }
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'TELEMEDICINA':
        return 'Telemedicina';
      case 'PRESENCIAL':
        return 'Presencial';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'TELEMEDICINA' ? <Video className="event-type-icon" /> : <User className="event-type-icon" />;
  };

  // Função para entrar na consulta agendada
  const handleEnterConsultation = (consultation: ConsultationEvent) => {
    router.push(`/consulta/nova?agendamento_id=${consultation.id}&patient_id=${consultation.patient_id}&patient_name=${encodeURIComponent(consultation.patient)}&consultation_type=${consultation.type}`);
  };

  // Função para abrir detalhes da consulta
  const handleViewConsultation = (consultation: ConsultationEvent) => {
    // Se a consulta está agendada, redireciona para entrar na consulta (copiar link)
    if (consultation.status === 'AGENDAMENTO') {
      handleEnterConsultation(consultation);
    } else {
      // Para outros status, vai para os detalhes
      router.push(`/consultas?consulta_id=${consultation.id}`);
    }
  };

  // Função para abrir modal de edição
  const handleOpenEditModal = (consultation: ConsultationEvent) => {
    setEditingConsultation(consultation);

    // Formatar data para o input (YYYY-MM-DD)
    const dateStr = consultation.date.toISOString().split('T')[0];

    setEditFormData({
      date: dateStr,
      time: consultation.time,
      type: consultation.type
    });

    setEditModalOpen(true);
  };

  // Função para fechar modal
  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingConsultation(null);
    setEditFormData({ date: '', time: '', type: 'TELEMEDICINA' });
  };

  // Função para salvar edições
  const handleSaveEdit = async () => {
    if (!editingConsultation) return;

    setIsSaving(true);
    try {
      // Criar datetime combinando data e hora
      const [year, month, day] = editFormData.date.split('-').map(Number);
      const [hours, minutes] = editFormData.time.split(':').map(Number);
      const consultaInicio = new Date(year, month - 1, day, hours, minutes).toISOString();

      const response = await gatewayClient.patch(`/consultations/${editingConsultation.id}`, {
        consulta_inicio: consultaInicio,
        consultation_type: editFormData.type
      });

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Atualizar lista local
      setConsultations(prev => prev.map(c => {
        if (c.id === editingConsultation.id) {
          return {
            ...c,
            date: new Date(year, month - 1, day),
            time: editFormData.time,
            type: editFormData.type
          };
        }
        return c;
      }));

      setNotification({ type: 'success', message: 'Consulta atualizada com sucesso!' });
      handleCloseEditModal();
    } catch (error: any) {
      console.error('Erro ao atualizar consulta:', error);
      setNotification({ type: 'error', message: error.message || 'Erro ao atualizar consulta' });
    } finally {
      setIsSaving(false);
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const handleOpenDeleteModal = (consultation: ConsultationEvent) => {
    setConsultationToDelete(consultation);
    setDeleteModalOpen(true);
  };

  // Função para fechar modal de exclusão
  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setConsultationToDelete(null);
  };

  // Função para confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!consultationToDelete) return;

    setIsDeleting(true);
    try {
      console.log('Excluindo consulta:', consultationToDelete.id);

      const response = await gatewayClient.delete(`/consultations/${consultationToDelete.id}`);

      const data = response;
      console.log('Resposta da exclusão:', data);

      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }

      // Remover da lista local
      setConsultations(prev => prev.filter(c => c.id !== consultationToDelete.id));

      setNotification({ type: 'success', message: 'Consulta excluída com sucesso!' });
      handleCloseDeleteModal();
      handleCloseEditModal();
    } catch (error: any) {
      console.error('Erro ao excluir consulta:', error);
      setNotification({ type: 'error', message: error.message || 'Erro ao excluir consulta' });
    } finally {
      setIsDeleting(false);
    }
  };

  const days = viewMode === 'month' ? getDaysInMonth() : viewMode === 'week' ? getDaysInWeek() : getDayView();

  return (
    <div className="agenda-container">
      {/* Notificação */}
      {notification && (
        <div className={`agenda-notification ${notification.type}`}>
          {notification.type === 'success' ? <Check className="notification-icon" /> : <X className="notification-icon" />}
          <span>{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="agenda-header">
        <div className="agenda-title-section">
          <h1 className="agenda-title">Agenda</h1>
          <p className="agenda-subtitle">Gerencie suas consultas e compromissos</p>
        </div>

        <div className="agenda-actions">
          {/* Botão Google Calendar */}
          <div className="google-calendar-wrapper">
            {googleCalendarLoading ? (
              <button className="btn btn-google-calendar loading" disabled>
                <Loader2 className="btn-icon spinning" />
                Carregando...
              </button>
            ) : googleCalendarStatus.connected ? (
              <>
                <button
                  className="btn btn-google-calendar connected"
                  onClick={() => setShowGoogleMenu(!showGoogleMenu)}
                >
                  <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <Check className="btn-icon check-icon" size={14} />
                  Sincronizado
                </button>

                {/* Menu dropdown */}
                {showGoogleMenu && (
                  <div className="google-calendar-menu">
                    <div className="google-menu-header">
                      <span className="google-menu-email">{googleCalendarStatus.googleEmail}</span>
                      {googleCalendarStatus.lastSyncAt && (
                        <span className="google-menu-sync">
                          Última sync: {new Date(googleCalendarStatus.lastSyncAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <div className="google-menu-divider" />
                    <button className="google-menu-item" onClick={handleDisconnectGoogleCalendar}>
                      <X size={16} />
                      Desconectar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                className="btn btn-google-calendar"
                onClick={handleConnectGoogleCalendar}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Conectar Google Calendar
              </button>
            )}
          </div>

          <Link href="/consulta/nova" className="btn btn-primary">
            <Plus className="btn-icon" />
            Nova Consulta
          </Link>
        </div>
      </div>

      <div className="agenda-content">
        {/* Calendário */}
        <div className="calendar-section">
          <div className="calendar-header">
            <div className="calendar-navigation">
              <button
                className="nav-button"
                onClick={() => (viewMode === 'month' ? navigateMonth('prev') : viewMode === 'week' ? navigateWeek('prev') : navigateDay('prev'))}
              >
                <ChevronLeft className="nav-icon" />
              </button>

              <h2 className="calendar-title">
                {monthNames[currentMonth]} {currentYear}
              </h2>

              <button
                className="nav-button"
                onClick={() => (viewMode === 'month' ? navigateMonth('next') : viewMode === 'week' ? navigateWeek('next') : navigateDay('next'))}
              >
                <ChevronRight className="nav-icon" />
              </button>
            </div>

            <div className="view-mode-selector">
              <button
                className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Mês
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Semana
              </button>
              <button
                className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                onClick={() => setViewMode('day')}
              >
                Dia
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {/* Cabeçalho dos dias da semana (esconde no modo Dia) */}
            {viewMode !== 'day' && (
              <div className="calendar-weekdays">
                {dayNames.map(day => (
                  <div key={day} className="weekday-header">
                    {day}
                  </div>
                ))}
              </div>
            )}

            {/* Dias do calendário */}
            <div className="calendar-days" style={{ gridTemplateColumns: viewMode === 'day' ? '1fr' : 'repeat(7, 1fr)' }}>
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${day.isCurrentMonth ? 'current-month' : 'other-month'
                    } ${day.isToday ? 'today' : ''} ${selectedDate?.toDateString() === day.date.toDateString() ? 'selected' : ''
                    }`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="day-number">{day.date.getDate()}</span>

                  {day.consultations.length > 0 && (
                    <div className="day-events">
                      {day.consultations.slice(0, 3).map((consultation: ConsultationEvent) => (
                        <div
                          key={consultation.id}
                          className={`day-event ${getStatusColor(consultation.status)}`}
                          title={`${consultation.time} - ${consultation.patient}`}
                        >
                          <span className="event-time">{consultation.time}</span>
                          <span className="event-patient">{consultation.patient}</span>
                        </div>
                      ))}
                      {day.consultations.length > 3 && (
                        <div className="more-events">
                          +{day.consultations.length - 3} mais
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel lateral com detalhes */}
        <div className="agenda-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              {selectedDate ? (
                <>
                  <Calendar className="sidebar-icon" />
                  {selectedDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </>
              ) : (
                <>
                  <Calendar className="sidebar-icon" />
                  Selecione uma data
                </>
              )}
            </h3>

            {!selectedDate && (
              <div className="date-range-selector">
                <div className="date-input-group">
                  <label htmlFor="start-date" className="date-label">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>

                <div className="date-input-group">
                  <label htmlFor="end-date" className="date-label">
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="date-input"
                  />
                </div>

                {(startDate || endDate) && (
                  <div className="date-range-info">
                    <p className="range-text">
                      {startDate && endDate
                        ? `Período: ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`
                        : startDate
                          ? `A partir de: ${new Date(startDate).toLocaleDateString('pt-BR')}`
                          : `Até: ${new Date(endDate).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedDate && (
              <div className="day-consultations">
                {getSelectedDayConsultations().length === 0 ? (
                  <div className="no-consultations">
                    <p>Nenhuma consulta agendada para este dia</p>
                  </div>
                ) : (
                  <div className="consultations-list">
                    {getSelectedDayConsultations()
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map(consultation => (
                        <div
                          key={consultation.id}
                          className="consultation-card"
                          onClick={() => handleViewConsultation(consultation)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="consultation-header">
                            <div className="consultation-time">
                              <Clock className="time-icon" />
                              {consultation.time}
                            </div>
                            <div className="consultation-header-right">
                              <div className={`consultation-status ${getStatusColor(consultation.status)}`}>
                                {getStatusLabel(consultation.status)}
                              </div>
                              {/* Botões de Editar e Excluir (apenas para agendamentos) */}
                              {consultation.status === 'AGENDAMENTO' && (
                                <div className="consultation-card-actions">
                                  <button
                                    className="btn-card-action btn-edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditModal(consultation);
                                    }}
                                    title="Editar agendamento"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    className="btn-card-action btn-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeleteModal(consultation);
                                    }}
                                    title="Excluir agendamento"
                                    disabled={isDeleting}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="consultation-details">
                            <h4 className="consultation-title">{consultation.title}</h4>
                            <div className="consultation-patient">
                              <User className="patient-icon" />
                              {consultation.patient}
                            </div>
                            <div className="consultation-type">
                              {getTypeIcon(consultation.type)}
                              {getTypeLabel(consultation.type)}
                            </div>
                            <div className="consultation-duration">
                              Duração: {consultation.duration} min
                            </div>
                          </div>

                          {/* Botão Entrar na Consulta (apenas para consultas com status AGENDAMENTO) */}
                          {consultation.status === 'AGENDAMENTO' && (
                            <div className="consultation-actions">
                              <button
                                className="btn-enter-consultation"
                                onClick={() => handleEnterConsultation(consultation)}
                                title="Entrar na Consulta"
                              >
                                <LogIn className="btn-icon" />
                                Entrar na Consulta
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo do mês */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">
              <Calendar className="sidebar-icon" />
              Resumo do Mês
            </h3>

            <div className="month-summary">
              <div className="summary-item">
                <span className="summary-label">Total de Consultas</span>
                <span className="summary-value">{consultations.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Concluídas</span>
                <span className="summary-value">
                  {consultations.filter(c => c.status === 'COMPLETED').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Agendadas</span>
                <span className="summary-value">
                  {consultations.filter(c => c.status === 'AGENDAMENTO').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Telemedicina</span>
                <span className="summary-value">
                  {consultations.filter(c => c.type === 'TELEMEDICINA').length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Presencial</span>
                <span className="summary-value">
                  {consultations.filter(c => c.type === 'PRESENCIAL').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      {editModalOpen && editingConsultation && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar Agendamento</h2>
              <button className="modal-close" onClick={handleCloseEditModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Informações do Paciente (readonly) */}
              <div className="form-group">
                <label className="form-label">Paciente</label>
                <div className="form-value-readonly">
                  <User size={16} />
                  {editingConsultation.patient}
                </div>
              </div>

              {/* Data */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-date">Data da Consulta</label>
                <input
                  type="date"
                  id="edit-date"
                  className="form-input"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Horário */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-time">Horário</label>
                <input
                  type="time"
                  id="edit-time"
                  className="form-input"
                  value={editFormData.time}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>

              {/* Tipo de Atendimento */}
              <div className="form-group">
                <label className="form-label">Tipo de Atendimento</label>
                <div className="form-radio-group">
                  <label className={`form-radio-option ${editFormData.type === 'TELEMEDICINA' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="consultation-type"
                      value="TELEMEDICINA"
                      checked={editFormData.type === 'TELEMEDICINA'}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <Video size={16} />
                    Telemedicina
                  </label>
                  <label className={`form-radio-option ${editFormData.type === 'PRESENCIAL' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="consultation-type"
                      value="PRESENCIAL"
                      checked={editFormData.type === 'PRESENCIAL'}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as 'TELEMEDICINA' | 'PRESENCIAL' }))}
                    />
                    <User size={16} />
                    Presencial
                  </label>
                </div>
              </div>

            </div>

            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={() => handleOpenDeleteModal(editingConsultation)}
                disabled={isDeleting || isSaving}
              >
                <Trash2 className="btn-icon" />
                Excluir
              </button>
              <div className="modal-footer-right">
                <button
                  className="btn btn-secondary"
                  onClick={handleCloseEditModal}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editFormData.date || !editFormData.time}
                >
                  {isSaving ? <Loader2 className="btn-icon spinning" /> : <Check className="btn-icon" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModalOpen && consultationToDelete && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirmar Exclusão</h2>
              <button className="modal-close" onClick={handleCloseDeleteModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="confirm-icon-wrapper">
                <Trash2 size={48} className="confirm-icon-delete" />
              </div>
              <p className="confirm-message">
                Tem certeza que deseja excluir a consulta de <strong>{consultationToDelete.patient}</strong>?
              </p>
              <p className="confirm-warning">
                Esta ação irá remover a consulta do sistema e do Google Calendar (se sincronizado). Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="modal-footer modal-footer-center">
              <button
                className="btn btn-secondary"
                onClick={handleCloseDeleteModal}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="btn-icon spinning" /> : <Trash2 className="btn-icon" />}
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

