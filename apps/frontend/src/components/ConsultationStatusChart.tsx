'use client';

import { TrendingUp } from 'lucide-react';
import './ConsultationStatusChart.css';

interface StatusData {
  novos: number;
  novosConcluidos: number;
  retorno: number;
  retornoConcluidos: number;
  cancelado: number;
}

interface MetricData {
  label: string;
  value: number;
  change: number;
  isPositive: boolean;
}

interface ConsultationStatusChartProps {
  data?: StatusData;
  metrics?: MetricData[];
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  duracaoMedia?: number;
  taxaFinalizacao?: number;
}

const defaultData: StatusData = {
  novos: 0,
  novosConcluidos: 0,
  retorno: 0,
  retornoConcluidos: 0,
  cancelado: 0
};

const periods = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '15d', label: 'Últimos 15 dias' },
  { value: '30d', label: 'Últimos 30 dias' }
];

export function ConsultationStatusChart({
  data = defaultData,
  metrics = [],
  selectedPeriod = 'hoje',
  onPeriodChange,
  duracaoMedia = 0,
  taxaFinalizacao = 0
}: ConsultationStatusChartProps) {
  console.log('📊 [DONUT] Data recebido:', JSON.stringify(data));
  const total = data.novos + data.retorno + data.cancelado;

  // Calcular percentuais para o gráfico donut
  const percentages = {
    novos: total > 0 ? (data.novos / total) * 100 : 0,
    retorno: total > 0 ? (data.retorno / total) * 100 : 0,
    cancelado: total > 0 ? (data.cancelado / total) * 100 : 0
  };

  // Calcular ângulos para o gráfico de donut (conic-gradient)
  let currentAngle = 0;
  const segments: string[] = [];

  if (data.novos > 0) {
    const angle = (percentages.novos / 100) * 360;
    segments.push(`#5D87FF ${currentAngle}deg ${currentAngle + angle}deg`);
    currentAngle += angle;
  }

  if (data.retorno > 0) {
    const angle = (percentages.retorno / 100) * 360;
    segments.push(`#13DDB9 ${currentAngle}deg ${currentAngle + angle}deg`);
    currentAngle += angle;
  }

  if (data.cancelado > 0) {
    const angle = (percentages.cancelado / 100) * 360;
    segments.push(`#1325DE ${currentAngle}deg ${currentAngle + angle}deg`);
  }

  const pieGradient = segments.length > 0 ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#5D87FF 0deg 360deg)';

  // Formatar duração média
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0s';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="consultation-status-chart">
      {/* Título */}
      <h3 className="chart-title">Status das consultas</h3>

      {/* Gráfico com Legenda */}
      <div className="chart-with-legend">
        <div className="donut-chart-container">
          <div
            className="donut-chart"
            style={{ background: pieGradient }}
          >
            <div className="donut-center">
              <span className="donut-center-value">{total}</span>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="status-legend">
          <div className="legend-item">
            <span className="legend-dot legend-novos"></span>
            <span className="legend-label">Novos ({data.novosConcluidos})</span>
          </div>

          <div className="legend-item">
            <span className="legend-dot legend-retorno"></span>
            <span className="legend-label">Retorno ({data.retornoConcluidos})</span>
          </div>

          <div className="legend-item">
            <span className="legend-dot legend-cancelados2"></span>
            <span className="legend-label">Canceladas</span>
          </div>
        </div>
      </div>

      {/* Filtro por período */}
      <div className="period-filter-section">
        <label className="period-filter-label">Filtrar pro periodo</label>
        <select
          value={selectedPeriod}
          onChange={(e) => onPeriodChange?.(e.target.value)}
          className="period-select"
        >
          {periods.map(period => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {/* Consultas Concluídas */}
      {metrics.length > 0 && (
        <div className="metric-section">
          <div className="metric-label">{metrics[0]?.label || 'Consultas concluídas'}</div>
          <div className="metric-value-group">
            <span className="metric-value-large">{metrics[0]?.value || 0}</span>
            {metrics[0]?.change !== undefined && metrics[0].change !== 0 && (
              <span className={`metric-change-indicator ${metrics[0].isPositive ? 'positive' : 'negative'}`}>
                <TrendingUp className="trend-icon" size={12} style={{ transform: metrics[0].isPositive ? 'none' : 'rotate(180deg)' }} />
                <span className="change-value">
                  {metrics[0].isPositive ? '+' : ''}{metrics[0].change}%
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Total de Pacientes */}
      {metrics.length > 1 && (
        <div className="metric-section">
          <div className="metric-label">{metrics[1]?.label || 'Total de pacientes'}</div>
          <div className="metric-value-group">
            <span className="metric-value-large">{metrics[1]?.value || 0}</span>
            {metrics[1]?.change !== undefined && metrics[1].change !== 0 && (
              <span className={`metric-change-indicator ${metrics[1].isPositive ? 'positive' : 'negative'}`}>
                <TrendingUp className="trend-icon" size={12} style={{ transform: metrics[1].isPositive ? 'none' : 'rotate(180deg)' }} />
                <span className="change-value">
                  {metrics[1].isPositive ? '+' : ''}{metrics[1].change}%
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Duração Média */}
      <div className="metric-section metric-section-no-border">
        <div className="metric-label">Duração média</div>
        <div className="metric-value-small">{formatDuration(duracaoMedia)}</div>
        <div className="progress-bar-container">
          <div className="progress-bar-bg"></div>
        </div>
      </div>

      {/* Taxa de Finalização */}
      <div className="metric-section">
        <div className="metric-label">Taxa de finalização</div>
        <div className="metric-value-small">{taxaFinalizacao.toFixed(0)}%</div>
        <div className="progress-bar-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(taxaFinalizacao, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
