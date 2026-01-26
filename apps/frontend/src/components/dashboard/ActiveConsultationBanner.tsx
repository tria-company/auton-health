'use client';

import { useNotifications } from '@/components/shared/NotificationSystem';
import { useState, useEffect, useRef } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useRouter } from 'next/navigation';
import { AlertCircle, Video, X, CheckCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { supabase } from '@/lib/supabase';
import './ActiveConsultationBanner.css';

interface ActiveConsultation {
  id: string;
  patient_name: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  status: string;
  created_at: string;
  patient_id?: string;
  patients?: {
    name: string;
    id?: string;
  };
}

export function ActiveConsultationBanner() {
  const { showError } = useNotifications();
  const [activeConsultation, setActiveConsultation] = useState<ActiveConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const router = useRouter();
  
  // ✅ Ref para controlar se polling deve continuar (para em caso de erro 401)
  const pollingActiveRef = useRef(true);
  // Ref para armazenar IDs dos intervalos
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fastIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref para armazenar a consulta ativa atual (evita problemas com closures)
  const activeConsultationRef = useRef<ActiveConsultation | null>(null);

  useEffect(() => {
    pollingActiveRef.current = true;
    checkActiveConsultation();
    
    // Polling adaptativo baseado no status da consulta ativa
    intervalRef.current = setInterval(() => {
      if (pollingActiveRef.current) {
      checkActiveConsultation();
      }
    }, 10000); // ✅ Aumentado para 10 segundos (era 5)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
    };
  }, []);

  // Polling adicional quando há consulta ativa para atualizar status mais rapidamente
  useEffect(() => {
    if (!activeConsultation) return;

    const status = activeConsultation.status;
    
    // Para status que mudam frequentemente, fazer polling mais rápido
    if (['PROCESSING', 'RECORDING'].includes(status)) {
      fastIntervalRef.current = setInterval(() => {
        if (pollingActiveRef.current) {
        checkActiveConsultation();
        }
      }, 5000); // ✅ Aumentado para 5 segundos (era 3)

      return () => {
        if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
      };
    }
  }, [activeConsultation?.status]);

  const checkActiveConsultation = async () => {
    // ✅ Verificar se polling ainda está ativo
    if (!pollingActiveRef.current) {
      return;
    }

    try {
      // ✅ Só definir loading como true na primeira verificação
      if (!activeConsultationRef.current) {
        setLoading(true);
      }
      
      // Verificar autenticação
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // ✅ CORREÇÃO: Se erro de autenticação, parar polling imediatamente
      if (userError || !user) {
        console.warn('⚠️ [ActiveConsultationBanner] Sessão expirada - parando polling');
        pollingActiveRef.current = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
        setActiveConsultation(null);
        setLoading(false);
        return;
      }
      
      // Buscar médico primeiro
      const { data: medico, error: medicoError } = await supabase
        .from('medicos')
        .select('id')
        .eq('user_auth', user.id)
        .single();
      
      if (medicoError || !medico) {
        pollingActiveRef.current = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
        setActiveConsultation(null);
        setLoading(false);
        return;
      }
      
      // Buscar apenas consultas com status RECORDING (sala aberta/gravando)
      const { data: consultations, error: queryError } = await supabase
        .from('consultations')
        .select('*')
        .eq('status', 'RECORDING')
        .eq('doctor_id', medico.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (queryError) {
        // ✅ Se já existe consulta ativa, não remover em caso de erro temporário
        if (!activeConsultationRef.current) {
          activeConsultationRef.current = null;
          setActiveConsultation(null);
        }
        setLoading(false);
        return;
      }
      
      // Encontrar a primeira consulta com status RECORDING (sala em aberto)
      const active = consultations?.find((c: ActiveConsultation) => 
        c.status === 'RECORDING'
      );

      if (active) {
        // ✅ Só atualizar se for uma consulta diferente (mudança de ID)
        if (!activeConsultationRef.current || activeConsultationRef.current.id !== active.id) {
          activeConsultationRef.current = active;
          setActiveConsultation(active);
        }
        // Se for a mesma consulta, não atualizar o estado (evita re-render desnecessário)
      } else {
        // ✅ Só remover se realmente não houver consulta ativa
        // Isso evita que o banner desapareça temporariamente durante o polling
        if (!activeConsultationRef.current) {
          activeConsultationRef.current = null;
          setActiveConsultation(null);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar consulta em andamento:', error);
      // ✅ Em caso de erro, só remover se não houver consulta ativa já carregada
      if (!activeConsultationRef.current) {
        activeConsultationRef.current = null;
        setActiveConsultation(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToConsultation = async () => {
    if (!activeConsultation) return;

    try {
      // Buscar detalhes da consulta para obter roomId
      const response = await gatewayClient.get(`/consultations/${activeConsultation.id}`);
      
      if (!response.success) {
        // Se não conseguir buscar, navegar para página de consultas
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
        return;
      }

      const data = response;
      const consultation = data.consultation;
      
      // Se tiver roomId, navegar diretamente para a sala
      if (consultation.roomId) {
        const patientId = consultation.patient_id || activeConsultation.patient_id || activeConsultation.patients?.id;
        const patientName = consultation.patients?.name || activeConsultation.patients?.name || activeConsultation.patient_name;
        
        // Determinar tipo de consulta e navegar para a sala correta
        if (consultation.consultation_type === 'PRESENCIAL') {
          // Para presencial, precisamos de mais informações - redirecionar para consultas
          router.push(`/consultas?consulta_id=${activeConsultation.id}`);
        } else {
          // Para telemedicina, navegar para a sala de vídeo
          const params = new URLSearchParams({
            roomId: consultation.roomId,
            role: 'host',
            ...(patientId && { patientId }),
            ...(patientName && { patientName })
          });
          router.push(`/consulta/online/doctor?${params.toString()}`);
        }
      } else {
        // Se não tiver roomId, navegar para página de consultas
        router.push(`/consultas?consulta_id=${activeConsultation.id}`);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da consulta:', error);
      // Em caso de erro, navegar para página de consultas
      router.push(`/consultas?consulta_id=${activeConsultation.id}`);
    }
  };

  const handleFinishConsultation = () => {
    if (!activeConsultation) return;
    setShowFinishConfirm(true);
  };

  const handleConfirmFinish = async () => {
    if (!activeConsultation) return;

    try {
      setIsFinishing(true);
      
      // Atualizar status para PROCESSING (inicia o processamento da consulta)
      const response = await gatewayClient.patch(`/consultations/${activeConsultation.id}`, {
        body: {
          status: 'PROCESSING',
        },
      });

      if (!response.success) {
        throw new Error(response.error || "Erro na requisição");
      }

      // Remover o banner
      activeConsultationRef.current = null;
      setActiveConsultation(null);
      
      // Recarregar a página para atualizar o dashboard
      window.location.reload();
    } catch (error) {
      console.error('Erro ao finalizar consulta:', error);
      showError('Erro ao finalizar consulta. Tente novamente.', 'Erro');
      setIsFinishing(false);
    }
  };

  const handleDismiss = () => {
    activeConsultationRef.current = null;
    setActiveConsultation(null);
  };

  if (loading || !activeConsultation) {
    return null;
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'RECORDING':
        return 'Gravando';
      case 'PROCESSING':
        return 'Processando';
      case 'VALID_ANAMNESE':
        return 'Validação Análise';
      case 'VALID_DIAGNOSTICO':
        return 'Validação Diagnóstico';
      case 'VALID_SOLUCAO':
        return 'Validação Solução';
      case 'VALIDATION':
        return 'Em Validação';
      default:
        return 'Em Andamento';
    }
  };

  const patientName = activeConsultation.patients?.name || activeConsultation.patient_name;
  const consultationType = activeConsultation.consultation_type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';

  return (
    <>
      <ConfirmModal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
        onConfirm={handleConfirmFinish}
        title="Encerrar Consulta"
        message={`Tem certeza que deseja encerrar a consulta com ${activeConsultation?.patients?.name || activeConsultation?.patient_name}?\n\nA consulta será finalizada e o status será alterado para PROCESSING para iniciar o processamento.`}
        confirmText="Encerrar"
        cancelText="Cancelar"
        variant="warning"
      />
    <div className="active-consultation-banner">
      <div className="banner-content">
        <div className="banner-icon">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="banner-info">
          <div className="banner-title">Consulta em Andamento</div>
          <div className="banner-details">
            <span className="patient-name">{patientName}</span>
            <span className="separator">•</span>
            <span className="consultation-type">{consultationType}</span>
            <span className="separator">•</span>
            <span className="status-badge">{getStatusText(activeConsultation.status)}</span>
          </div>
        </div>
        <div className="banner-actions">
          <button
            className="btn-return"
            onClick={handleReturnToConsultation}
            disabled={isFinishing}
          >
            <Video className="w-4 h-4" />
            Retornar à Consulta
          </button>
          <button
            className="btn-finish"
            onClick={handleFinishConsultation}
            disabled={isFinishing}
          >
            {isFinishing ? (
              <>
                <div className="spinner-small"></div>
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Finalizar
              </>
            )}
          </button>
          <button
            className="btn-dismiss"
            onClick={handleDismiss}
            disabled={isFinishing}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

