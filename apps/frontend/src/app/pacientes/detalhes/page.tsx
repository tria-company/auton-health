'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { gatewayClient } from '@/lib/gatewayClient';
import { ArrowLeft, Mail, Phone, Moon, Activity, Utensils, Scale } from 'lucide-react';
import Link from 'next/link';
import '../pacientes.css';

interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: string;
  cpf?: string;
  address?: string;
  status: string;
  created_at: string;
  updated_at: string;
  profile_pic?: string;
}

interface PatientMetrics {
  media_sono: { score: number; tempo_medio_horas?: number } | null;
  atividade_fisica: { score: number; tempo_medio_horas?: number; intensidade_media?: number } | null;
  alimentacao: { score: number; refeicoes_media?: number; agua_media_litros?: number } | null;
  equilibrio_geral: number | null;
  total_registros: number;
  periodo_dias: number;
}

function PatientDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') ?? '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [metrics, setMetrics] = useState<PatientMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID do paciente não informado');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [patientRes, metricsRes] = await Promise.all([
          gatewayClient.get<{ success: boolean; patient: Patient }>(`/patients/${id}`),
          gatewayClient.get<{ success: boolean; metrics: PatientMetrics }>(`/patients/${id}/metrics?dias=90`)
        ]);
        if (!patientRes.success || !patientRes.patient) {
          setError(patientRes.error || 'Paciente não encontrado');
          return;
        }
        setPatient(patientRes.patient);
        if (metricsRes.success && metricsRes.metrics) {
          setMetrics(metricsRes.metrics);
        } else {
          setMetrics({
            media_sono: null,
            atividade_fisica: null,
            alimentacao: null,
            equilibrio_geral: null,
            total_registros: 0,
            periodo_dias: 90
          });
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="patients-page">
        <div className="patients-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Carregando detalhes do paciente...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="patients-page">
        <div className="patients-container">
          <div className="error-state">
            <p className="error-title">{error || 'Paciente não encontrado'}</p>
            <Link href="/pacientes/" className="btn btn-primary">
              <ArrowLeft size={18} />
              Voltar à lista
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatScore = (v: number | null | undefined) =>
    v != null ? v.toFixed(1).replace('.', ',') : '—';

  return (
    <div className="patients-page">
      <div className="patients-container patient-details-container">
        <div className="patient-details-header">
          <Link href="/pacientes/" className="btn-back-details">
            <ArrowLeft size={20} />
            Voltar à lista de pacientes
          </Link>
          <div className="patient-details-title-row">
            <div className="patient-details-avatar">
              {patient.profile_pic ? (
                <img src={patient.profile_pic} alt={patient.name} className="patient-details-avatar-img" />
              ) : (
                <span className="patient-details-initials">{initials}</span>
              )}
            </div>
            <div>
              <h1 className="patient-details-name">{patient.name}</h1>
              <div className="patient-details-contact">
                {patient.email && (
                  <span className="contact-chip">
                    <Mail size={16} />
                    {patient.email}
                  </span>
                )}
                {patient.phone && (
                  <span className="contact-chip">
                    <Phone size={16} />
                    {patient.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Métricas do Check-in Diário */}
        <section className="patient-metrics-section">
          <h2 className="patient-metrics-section-title">Métricas de Check-in Diário</h2>
          <p className="patient-metrics-section-desc">
            Dados do outro sistema (check-in diário). Período: últimos {metrics?.periodo_dias ?? 90} dias
            {metrics?.total_registros != null && metrics.total_registros > 0 && (
              <> · {metrics.total_registros} registro(s)</>
            )}
          </p>

          <div className="patient-metrics-grid">
            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap sono">
                <Moon size={24} />
              </div>
              <div className="patient-metric-label">Sono</div>
              <div className="patient-metric-value">
                {metrics?.media_sono?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.media_sono.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.media_sono?.tempo_medio_horas != null && (
                <div className="patient-metric-extra">
                  ~{metrics.media_sono.tempo_medio_horas.toFixed(1)} h de sono
                </div>
              )}
            </div>

            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap atividade">
                <Activity size={24} />
              </div>
              <div className="patient-metric-label">Atividade Física</div>
              <div className="patient-metric-value">
                {metrics?.atividade_fisica?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.atividade_fisica.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.atividade_fisica?.tempo_medio_horas != null && (
                <div className="patient-metric-extra">
                  ~{metrics.atividade_fisica.tempo_medio_horas.toFixed(1)} h/semana
                </div>
              )}
            </div>

            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap alimentacao">
                <Utensils size={24} />
              </div>
              <div className="patient-metric-label">Alimentação</div>
              <div className="patient-metric-value">
                {metrics?.alimentacao?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.alimentacao.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.alimentacao?.refeicoes_media != null && (
                <div className="patient-metric-extra">
                  ~{metrics.alimentacao.refeicoes_media.toFixed(1)} refeições ·{' '}
                  {metrics.alimentacao.agua_media_litros != null
                    ? `${metrics.alimentacao.agua_media_litros.toFixed(1)} L água`
                    : ''}
                </div>
              )}
            </div>

            <div className="patient-metric-card equilibrio">
              <div className="patient-metric-icon-wrap equilibrio">
                <Scale size={24} />
              </div>
              <div className="patient-metric-label">Equilíbrio Geral</div>
              <div className="patient-metric-value">
                {metrics?.equilibrio_geral != null ? (
                  <>
                    <span className="score">{formatScore(metrics.equilibrio_geral)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
            </div>
          </div>

          {metrics?.total_registros === 0 && (
            <p className="patient-metrics-empty">
              Nenhum check-in registrado no período. As métricas aparecem quando o paciente preenche o check-in diário no outro sistema.
            </p>
          )}
        </section>

        {/* Dados cadastrais resumidos */}
        <section className="patient-info-section">
          <h2 className="patient-info-section-title">Dados cadastrais</h2>
          <div className="patient-info-grid">
            {patient.cpf && (
              <div className="patient-info-item">
                <span className="label">CPF</span>
                <span className="value">{patient.cpf}</span>
              </div>
            )}
            {patient.birth_date && (
              <div className="patient-info-item">
                <span className="label">Data de nascimento</span>
                <span className="value">{new Date(patient.birth_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {(patient.city || patient.state) && (
              <div className="patient-info-item">
                <span className="label">Cidade / Estado</span>
                <span className="value">{[patient.city, patient.state].filter(Boolean).join(' / ')}</span>
              </div>
            )}
            {patient.address && (
              <div className="patient-info-item full-width">
                <span className="label">Endereço</span>
                <span className="value">{patient.address}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PatientDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="patients-page">
          <div className="patients-container">
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p className="loading-text">Carregando...</p>
            </div>
          </div>
        </div>
      }
    >
      <PatientDetailsContent />
    </Suspense>
  );
}
