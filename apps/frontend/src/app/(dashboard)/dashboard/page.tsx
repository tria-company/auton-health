'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Calendar as CalendarIcon, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Plus,
  Eye,
  Stethoscope,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';
import { gatewayClient } from '@/lib/gatewayClient';
import './dashboard.css';
import Chart3D from '../../../components/Chart3D';
import BarChart3D from '../../../components/BarChart3D';
import { Calendar } from '../../../components/Calendar';

// Componente de gráfico semanal simples
const WeeklyBarChart = ({ data }: { data: { labels: string[]; values: number[]; colors: string[] } }) => {
  const maxValue = Math.max(...data.values, 8);
  const chartHeight = 320;
  const chartWidth = '100%';
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartAreaHeight = chartHeight - padding.top - padding.bottom;
  const chartAreaWidth = '100%';
  
  // Valores do eixo Y (0, 2, 4, 6, 8)
  const yTicks = [0, 2, 4, 6, 8];
  
  const getBarHeight = (value: number) => {
    return (value / maxValue) * chartAreaHeight;
  };
  
  const getYPosition = (value: number) => {
    return padding.top + chartAreaHeight - getBarHeight(value);
  };
  
  return (
    <div className="weekly-bar-chart-container">
      <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
        {/* Linhas de grade horizontais */}
        {yTicks.map((tick) => {
          const y = padding.top + chartAreaHeight - (tick / maxValue) * chartAreaHeight;
          return (
            <line
              key={tick}
              x1={padding.left}
              y1={y}
              x2="100%"
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}
        
        {/* Barras */}
        {data.labels.map((label, index) => {
          const value = data.values[index];
          const barWidth = 40;
          const spacing = 20;
          const totalBarArea = data.labels.length * (barWidth + spacing) - spacing;
          const startX = `calc(50% - ${totalBarArea / 2}px)`;
          const x = index * (barWidth + spacing) + padding.left;
          const barHeight = getBarHeight(value);
          const y = getYPosition(value);
          
          return (
            <g key={label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#1B4266"
                rx="2"
              />
            </g>
          );
        })}
        
        {/* Labels do eixo Y */}
        {yTicks.map((tick) => {
          const y = padding.top + chartAreaHeight - (tick / maxValue) * chartAreaHeight;
          return (
            <text
              key={tick}
              x={padding.left - 10}
              y={y + 5}
              textAnchor="end"
              fontSize="12"
              fill="#6B7280"
              fontFamily="Inter, sans-serif"
            >
              {tick}
            </text>
          );
        })}
        
        {/* Labels do eixo X */}
        {data.labels.map((label, index) => {
          const barWidth = 40;
          const spacing = 20;
          const x = index * (barWidth + spacing) + padding.left + barWidth / 2;
          const y = chartHeight - padding.bottom + 20;
          
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="12"
              fill="#6B7280"
              fontFamily="Inter, sans-serif"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
import { StatusBadge, mapBackendStatus } from '../../../components/StatusBadge';
import { ConsultationStatusChart } from '../../../components/ConsultationStatusChart';
import { LoadingScreen } from '../../../components/shared/LoadingScreen';
import { ActiveConsultationBanner } from '../../../components/dashboard/ActiveConsultationBanner';
import '../../../components/Calendar.css';

interface DashboardData {
  medico: {
    id: string;
    name: string;
    specialty?: string;
    crm?: string;
    subscription_type: string;
  };
  estatisticas: {
    totalPacientes: number;
    consultasHoje: number;
    consultasConcluidasMes: number;
    duracaoMediaSegundos: number;
    duracaoMediaPresencialSegundos?: number;
    duracaoMediaTelemedicinaSegundos?: number;
    taxaSucesso: number;
    variacaoPacientes?: number;
    variacaoConsultas?: number;
  };
  distribuicoes: {
    porStatus: Record<string, number>;
    porTipo: Record<string, number>;
  };
  atividades: {
    ultimasConsultas: Array<{
      id: string;
      patient_name: string;
      consultation_type: string;
      status: string;
      duration?: number;
      created_at: string;
      patients?: {
        name: string;
        email?: string;
      };
    }>;
    proximasConsultas: Array<{
      id: string;
      patient_name: string;
      consultation_type: string;
      created_at: string;
      patients?: {
        name: string;
        email?: string;
      };
    }>;
  };
  graficos: {
    consultasPorDia: Array<{
      date: string;
      total: number;
      presencial: number;
      telemedicina: number;
      concluidas: number;
    }>;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicoName, setMedicoName] = useState<string>('');

  // Função para gerar saudação dinâmica
  const getGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
      return 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      return 'Boa tarde';
    } else {
      return 'Boa noite';
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('hoje');
  const [chartPeriodType, setChartPeriodType] = useState<'day' | 'week' | 'month' | 'year'>('year');
  const [chartSelectedDate, setChartSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [chartSelectedMonth, setChartSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [chartSelectedYear, setChartSelectedYear] = useState<number>(new Date().getFullYear()); // Ano específico para o gráfico
  const isMock = process.env.NEXT_PUBLIC_MOCK === 'true' || process.env.MOCK_MODE === 'true';
  const [consultationDates, setConsultationDates] = useState<Date[]>([]);
  const [updatingPeriodData, setUpdatingPeriodData] = useState(false);
  const isUpdatingRef = useRef(false);
  const monthInputRef = useRef<HTMLInputElement>(null);

  // Atualizar nome do médico e datas quando os dados do dashboard forem carregados
  useEffect(() => {
    if (dashboardData?.medico?.name) {
      setMedicoName(dashboardData.medico.name);
    }
    // Extrair datas únicas de consultas para destacar no calendário (usar toda a série)
    if (dashboardData?.graficos?.consultasPorDia) {
      const dates = new Set<string>();
      dashboardData.graficos.consultasPorDia.forEach((d) => {
        // d.date no formato 'YYYY-MM-DD' (sem TZ) → construir Date local para evitar deslocamento
        const [yyyy, mm, dd] = d.date.split('-').map(Number);
        const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1);
        dates.add(localDate.toDateString());
      });
      const uniqueDates = Array.from(dates).map((s) => new Date(s));
      setConsultationDates(uniqueDates);
    }
  }, [dashboardData]);

  // Adicionar listener para capturar mudanças nas setas do input month
  useEffect(() => {
    const monthInput = monthInputRef.current;
    if (!monthInput || chartPeriodType !== 'month') return;

    let lastValue = chartSelectedMonth;
    let intervalId: NodeJS.Timeout | null = null;

    const handleInputEvent = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const newValue = target.value;
      console.log('📅 [MONTH INPUT] Event listener capturado:', newValue);
      if (newValue && newValue !== chartSelectedMonth) {
        lastValue = newValue;
        setChartSelectedMonth(newValue);
      }
    };

    // Iniciar polling constante quando o input de mês estiver visível para capturar todas as mudanças
    // Isso garante que mudanças feitas clicando nas setas sejam detectadas mesmo sem foco
    intervalId = setInterval(() => {
      if (!monthInput) return;
      const currentValue = monthInput.value;
      if (currentValue && currentValue !== lastValue && currentValue !== chartSelectedMonth) {
        console.log('📅 [MONTH INPUT] Valor detectado via polling constante:', currentValue);
        lastValue = currentValue;
        setChartSelectedMonth(currentValue);
      }
    }, 100); // Verificar a cada 100ms constantemente quando o input está visível

    // Handler para capturar cliques em qualquer parte do input (incluindo setas)
    const handleClick = (e: MouseEvent) => {
      // Forçar múltiplas verificações em intervalos para capturar mudanças das setas
      const checkMultipleTimes = () => {
        const delays = [10, 50, 100, 150, 200];
        delays.forEach(delay => {
          setTimeout(() => {
            if (!monthInput) return;
            const currentValue = monthInput.value;
            if (currentValue && currentValue !== chartSelectedMonth) {
              console.log('📅 [MONTH INPUT] Valor detectado após clique:', currentValue);
              setChartSelectedMonth(currentValue);
            }
          }, delay);
        });
      };
      checkMultipleTimes();
    };

    // Handler para capturar quando o mouse é pressionado/solto (ao clicar nas setas)
    const handleMouseDown = () => {
      // Quando mouse é pressionado, pode estar clicando na seta - verificar múltiplas vezes
      const checkMultipleTimes = () => {
        const delays = [10, 30, 50, 100, 150];
        delays.forEach(delay => {
          setTimeout(() => {
            if (!monthInput) return;
            const currentValue = monthInput.value;
            if (currentValue && currentValue !== chartSelectedMonth) {
              console.log('📅 [MONTH INPUT] Valor detectado após mousedown:', currentValue);
              setChartSelectedMonth(currentValue);
            }
          }, delay);
        });
      };
      checkMultipleTimes();
    };

    const handleMouseUp = () => {
      // Quando mouse é solto, verificar novamente
      const checkMultipleTimes = () => {
        const delays = [10, 50, 100, 200];
        delays.forEach(delay => {
          setTimeout(() => {
            if (!monthInput) return;
            const currentValue = monthInput.value;
            if (currentValue && currentValue !== chartSelectedMonth) {
              console.log('📅 [MONTH INPUT] Valor detectado após mouseup:', currentValue);
              setChartSelectedMonth(currentValue);
            }
          }, delay);
        });
      };
      checkMultipleTimes();
    };

    // Adicionar múltiplos listeners para garantir que capture todas as mudanças
    monthInput.addEventListener('input', handleInputEvent);
    monthInput.addEventListener('change', handleInputEvent);
    monthInput.addEventListener('keyup', handleInputEvent);
    monthInput.addEventListener('click', handleClick);
    monthInput.addEventListener('mousedown', handleMouseDown);
    monthInput.addEventListener('mouseup', handleMouseUp);
    monthInput.addEventListener('wheel', handleInputEvent); // Capturar scroll também

    return () => {
      monthInput.removeEventListener('input', handleInputEvent);
      monthInput.removeEventListener('change', handleInputEvent);
      monthInput.removeEventListener('keyup', handleInputEvent);
      monthInput.removeEventListener('click', handleClick);
      monthInput.removeEventListener('mousedown', handleMouseDown);
      monthInput.removeEventListener('mouseup', handleMouseUp);
      monthInput.removeEventListener('wheel', handleInputEvent);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [chartPeriodType, chartSelectedMonth]);

  // Carregar dados iniciais do dashboard (apenas na montagem)
  useEffect(() => {
    if (isMock) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDashboardData({
        medico: {
          id: 'mock-medico-1',
          name: 'Dra. Mock',
          specialty: 'Clínico Geral',
          crm: '000000-MOCK',
          subscription_type: 'PRO',
        },
        estatisticas: {
          totalPacientes: 3,
          consultasHoje: 1,
          consultasConcluidasMes: 5,
          duracaoMediaSegundos: 900,
          taxaSucesso: 80,
        },
        distribuicoes: {
          porStatus: { CREATED: 1, COMPLETED: 5, PROCESSING: 0 },
          porTipo: { PRESENCIAL: 3, TELEMEDICINA: 3 },
        },
        atividades: {
          ultimasConsultas: [
            { id: 'c1', patient_name: 'MOC - João Silva', consultation_type: 'PRESENCIAL', status: 'COMPLETED', duration: 1200, created_at: today.toISOString(), patients: { name: 'MOC - João Silva', email: 'joao@email' } },
          ],
          proximasConsultas: [
            { id: 'c2', patient_name: 'MOC - Maria Santos', consultation_type: 'TELEMEDICINA', created_at: tomorrow.toISOString(), patients: { name: 'MOC - Maria Santos', email: 'maria@email' } },
          ],
        },
        graficos: {
          consultasPorDia: [
            { date: new Date().toISOString().split('T')[0], total: 2, presencial: 1, telemedicina: 1, concluidas: 1 },
          ],
        },
      });
      setLoading(false);
      return;
    }
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock]); // Removido selectedYear para não recarregar quando mudar no gráfico

  // Atualizar dados quando o período mudar (sem recarregar página)
  useEffect(() => {
    if (isMock || !dashboardData || isUpdatingRef.current) return;
    
    // Usar um pequeno delay para evitar múltiplas chamadas rápidas
    const timeoutId = setTimeout(async () => {
      if (isUpdatingRef.current) return;
      
      try {
        isUpdatingRef.current = true;
        setUpdatingPeriodData(true);
        
        // Construir parâmetros para o gráfico de Presencial/Telemedicina
        const queryParams: Record<string, string | number> = {
          year: selectedYear,
          period: selectedPeriod,
        };
        
        if (chartPeriodType === 'day') {
          queryParams.chartPeriod = 'day';
          queryParams.chartDate = chartSelectedDate;
        } else if (chartPeriodType === 'week') {
          queryParams.chartPeriod = 'week';
          queryParams.chartDate = chartSelectedDate;
        } else if (chartPeriodType === 'month') {
          queryParams.chartPeriod = 'month';
          queryParams.chartMonth = chartSelectedMonth;
        } else {
          queryParams.chartPeriod = 'year';
          queryParams.chartYear = chartSelectedYear;
        }
        
        const response = await gatewayClient.get('/dashboard', { queryParams });
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao carregar dados do período');
        }
        
        const data = response.data;
        
        // Atualizar apenas os dados que mudam com o período, mantendo o resto
        setDashboardData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            estatisticas: data.estatisticas || prev.estatisticas,
            distribuicoes: data.distribuicoes || prev.distribuicoes,
            graficos: {
              ...prev.graficos,
              consultasPorDia: data.graficos?.consultasPorDia || prev.graficos.consultasPorDia
            }
          };
        });
      } catch (err) {
        console.error('Erro ao atualizar dados do período:', err);
        setError(err instanceof Error ? err.message : 'Erro ao atualizar dados');
      } finally {
        isUpdatingRef.current = false;
        setUpdatingPeriodData(false);
      }
    }, 300);
    
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]); // Apenas selectedPeriod como dependência

  // Ref para controlar atualização do gráfico
  const isUpdatingChartRef = useRef(false);

  // Atualizar apenas o gráfico quando os filtros do gráfico mudarem (sem recarregar página)
  useEffect(() => {
    if (isMock || !dashboardData || isUpdatingChartRef.current || isUpdatingRef.current) {
      console.log('⏸️ [CHART UPDATE] Bloqueado:', { isMock, hasDashboardData: !!dashboardData, isUpdatingChart: isUpdatingChartRef.current, isUpdatingPeriod: isUpdatingRef.current });
      return;
    }
    
    console.log('🔄 [CHART UPDATE] Iniciando atualização do gráfico:', { chartPeriodType, chartSelectedMonth, chartSelectedDate, chartSelectedYear });
    
    // Usar um pequeno delay para evitar múltiplas chamadas rápidas
    const timeoutId = setTimeout(async () => {
      if (isUpdatingChartRef.current || isUpdatingRef.current) {
        console.log('⏸️ [CHART UPDATE] Bloqueado durante timeout');
        return;
      }
      
      try {
        isUpdatingChartRef.current = true;
        
        // Construir parâmetros para o gráfico de Presencial/Telemedicina
        const queryParams: Record<string, string | number> = {
          year: selectedYear,
          period: selectedPeriod,
        };
        
        if (chartPeriodType === 'day') {
          queryParams.chartPeriod = 'day';
          queryParams.chartDate = chartSelectedDate;
        } else if (chartPeriodType === 'week') {
          queryParams.chartPeriod = 'week';
          queryParams.chartDate = chartSelectedDate;
        } else if (chartPeriodType === 'month') {
          queryParams.chartPeriod = 'month';
          queryParams.chartMonth = chartSelectedMonth;
        } else {
          queryParams.chartPeriod = 'year';
          queryParams.chartYear = chartSelectedYear;
        }
        
        console.log('📊 [CHART UPDATE] Buscando dados:', queryParams);
        
        const response = await gatewayClient.get('/dashboard', { queryParams });
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao carregar dados do gráfico');
        }
        
        const data = response.data;
        
        console.log('✅ [CHART UPDATE] Dados recebidos:', data.graficos?.consultasPorDia?.length || 0, 'dias');
        
        // Atualizar apenas os dados do gráfico, mantendo o resto dos dados
        setDashboardData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            graficos: {
              ...prev.graficos,
              consultasPorDia: data.graficos?.consultasPorDia || prev.graficos.consultasPorDia
            }
          };
        });
      } catch (err) {
        console.error('❌ [CHART UPDATE] Erro ao atualizar gráfico:', err);
        // Não mostrar erro global, apenas logar
      } finally {
        isUpdatingChartRef.current = false;
      }
    }, 300);
    
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriodType, chartSelectedDate, chartSelectedMonth, chartSelectedYear]); // Usar chartSelectedYear ao invés de selectedYear

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Construir parâmetros para o gráfico de Presencial/Telemedicina
      const queryParams: Record<string, string | number | boolean> = {
        year: selectedYear,
        period: selectedPeriod,
      };
      
      if (chartPeriodType === 'day') {
        queryParams.chartPeriod = 'day';
        queryParams.chartDate = chartSelectedDate;
      } else if (chartPeriodType === 'week') {
        queryParams.chartPeriod = 'week';
        queryParams.chartDate = chartSelectedDate;
      } else if (chartPeriodType === 'month') {
        queryParams.chartPeriod = 'month';
        queryParams.chartMonth = chartSelectedMonth;
      } else {
        queryParams.chartPeriod = 'year';
        queryParams.chartYear = chartSelectedYear;
      }
      
      const response = await gatewayClient.get('/dashboard', { queryParams });
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar dados do dashboard');
      }
      
      setDashboardData(response.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do dashboard');
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };


  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };


  const getTypeIcon = (type: string) => {
    return type === 'PRESENCIAL' ? <Stethoscope className="w-4 h-4" /> : <Activity className="w-4 h-4" />;
  };

  const getTypeText = (type: string) => {
    return type === 'PRESENCIAL' ? 'Presencial' : 'Telemedicina';
  };

  // Processa dados da semana a partir dos dados de consultas
  const getWeeklyData = () => {
    if (!dashboardData?.graficos?.consultasPorDia) {
      return {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        values: [0, 0, 0, 0, 0, 0],
        colors: ['#1B4266', '#1B4266', '#1B4266', '#1B4266', '#1B4266', '#1B4266']
      };
    }

    // Últimos 7 dias
    const last7Days: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Segunda a Sábado
    
    dashboardData.graficos.consultasPorDia.forEach(item => {
      const date = new Date(item.date);
      const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      
      // Mapear: 1=Segunda, 2=Terça, ..., 6=Sábado (ignoramos domingo)
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        last7Days[dayOfWeek] = (last7Days[dayOfWeek] || 0) + item.total;
      }
    });

    return {
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      values: [last7Days[1] || 0, last7Days[2] || 0, last7Days[3] || 0, last7Days[4] || 0, last7Days[5] || 0, last7Days[6] || 0],
      colors: ['#1B4266', '#1B4266', '#1B4266', '#1B4266', '#1B4266', '#1B4266']
    };
  };

  // Componente de gráfico semanal simples com SVG
  const WeeklyBarChart = ({ data }: { data: { labels: string[]; values: number[]; colors: string[] } }) => {
    const maxValue = Math.max(...data.values, 8);
    const chartHeight = 280;
    const padding = { top: 20, right: 40, bottom: 40, left: 50 };
    const chartAreaHeight = chartHeight - padding.top - padding.bottom;
    
    // Valores do eixo Y (0, 2, 4, 6, 8)
    const yTicks = [0, 2, 4, 6, 8];
    
    const getBarHeight = (value: number) => {
      return (value / maxValue) * chartAreaHeight;
    };
    
    const getYPosition = (value: number) => {
      return padding.top + chartAreaHeight - getBarHeight(value);
    };
    
    const barWidth = 40;
    const spacing = 16;
    const totalBarArea = data.labels.length * (barWidth + spacing) - spacing;
    const chartStartX = padding.left;
    
    return (
      <div className="weekly-bar-chart-container">
        <svg width="100%" height={chartHeight} viewBox={`0 0 700 ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
          {/* Linhas de grade horizontais pontilhadas */}
          {yTicks.map((tick) => {
            const y = padding.top + chartAreaHeight - (tick / maxValue) * chartAreaHeight;
            return (
              <line
                key={tick}
                x1={padding.left}
                y1={y}
                x2={700 - padding.right}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}
          
          {/* Barras */}
          {data.labels.map((label, index) => {
            const value = data.values[index];
            const x = chartStartX + index * (barWidth + spacing);
            const barHeight = getBarHeight(value);
            const y = getYPosition(value);
            
            return (
              <g key={label}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#1B4266"
                  rx="2"
                />
              </g>
            );
          })}
          
          {/* Labels do eixo Y */}
          {yTicks.map((tick) => {
            const y = padding.top + chartAreaHeight - (tick / maxValue) * chartAreaHeight;
            return (
              <text
                key={tick}
                x={padding.left - 10}
                y={y + 5}
                textAnchor="end"
                fontSize="12"
                fill="#6B7280"
                fontFamily="Inter, sans-serif"
              >
                {tick}
              </text>
            );
          })}
          
          {/* Labels do eixo X */}
          {data.labels.map((label, index) => {
            const x = chartStartX + index * (barWidth + spacing) + barWidth / 2;
            const y = chartHeight - padding.bottom + 20;
            
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize="12"
                fill="#6B7280"
                fontFamily="Inter, sans-serif"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  if (loading) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  if (error || !dashboardData) {
    return (
      <div className="dashboard-exact">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          gap: '20px',
          padding: '40px'
        }}>
          <AlertCircle size={64} style={{ color: '#f44336' }} />
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff' }}>
            {error || 'Erro ao carregar dados do dashboard'}
          </h2>
          <p style={{ color: '#888', textAlign: 'center', maxWidth: '500px' }}>
            Não foi possível carregar as informações do dashboard. Verifique sua conexão e tente novamente.
          </p>
          <button 
            onClick={fetchDashboardData}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-exact">
      {/* Banner de consulta em andamento */}
      <ActiveConsultationBanner />
      
      {/* Saudação do dashboard */}
      <div className="dashboard-greeting-section">
        <h1 className="dashboard-title">
          {getGreeting()}, Dr {medicoName || 'Carregando...'}
        </h1>
      </div>

      {/* Grid Container - 12 colunas */}
      <div className="dashboard-grid-container">
        {/* Row 1: KPIs - 3 cards + Status de Consultas (col-span-3 cada) */}
        <div className="kpi kpi--cyan dashboard-col-span-3">
          <div className="title">Consultas no Dia</div>
          <div className="value">{dashboardData.estatisticas.consultasHoje}</div>
        </div>
        <div className="kpi kpi--amber dashboard-col-span-3">
          <div className="title">Pacientes cadastrados</div>
          <div className="value">{dashboardData.estatisticas.totalPacientes}</div>
        </div>
        <div className="kpi kpi--lilac dashboard-col-span-3">
          <div className="title">Tempo médio de consulta</div>
          <div className="value">
            {(() => {
              const duracaoSegundos = dashboardData.estatisticas.duracaoMediaSegundos || 0;
              if (duracaoSegundos === 0) {
                return 'N/A';
              }
              const minutes = Math.floor(duracaoSegundos / 60);
              const seconds = duracaoSegundos % 60;
              if (minutes > 0) {
                return `${minutes}:${String(seconds).padStart(2, '0')} min`;
              }
              return `${seconds} seg`;
            })()}
          </div>
          <div className="subtitle">
            {(() => {
              const presencialMin = Math.round((dashboardData.estatisticas.duracaoMediaPresencialSegundos || 0) / 60);
              const telemedicinaMin = Math.round((dashboardData.estatisticas.duracaoMediaTelemedicinaSegundos || 0) / 60);
              if (presencialMin === 0 && telemedicinaMin === 0) {
                return 'Sem dados disponíveis';
              }
              return `Telemedicina: ${telemedicinaMin} min | Presencial: ${presencialMin} min`;
            })()}
          </div>
        </div>
        <div className="card-dark status-card dashboard-col-span-3 dashboard-row-span-2" style={{ position: 'relative' }}>
          {updatingPeriodData && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '8px'
            }}>
              <div style={{
                background: 'rgba(27, 66, 102, 0.9)',
                padding: '12px 24px',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div className="spinner-small" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                Atualizando dados...
              </div>
            </div>
          )}
          <ConsultationStatusChart 
            data={{
              created: dashboardData?.distribuicoes?.porStatus?.CREATED || 0,
              inProgress: dashboardData?.distribuicoes?.porStatus?.PROCESSING || 0,
              completed: dashboardData?.distribuicoes?.porStatus?.COMPLETED || 0,
              cancelled: dashboardData?.distribuicoes?.porStatus?.CANCELLED || 0
            }}
            metrics={[
              { 
                label: 'Consultas concluídas', 
                value: dashboardData?.estatisticas?.consultasConcluidasMes || 0, 
                change: dashboardData?.estatisticas?.variacaoConsultas || 0, 
                isPositive: (dashboardData?.estatisticas?.variacaoConsultas || 0) >= 0
              },
              { 
                label: 'Total de pacientes', 
                value: dashboardData?.estatisticas?.totalPacientes || 0, 
                change: dashboardData?.estatisticas?.variacaoPacientes || 0, 
                isPositive: (dashboardData?.estatisticas?.variacaoPacientes || 0) >= 0
              }
            ]}
            selectedPeriod={selectedPeriod}
            onPeriodChange={(period: string) => {
              setSelectedPeriod(period);
              // fetchPeriodData será chamado automaticamente pelo useEffect
            }}
            duracaoMedia={dashboardData?.estatisticas?.duracaoMediaSegundos || 0}
            taxaFinalizacao={dashboardData?.estatisticas?.taxaSucesso || 0}
          />
        </div>

        {/* Row 2: Gráfico Presencial vs Telemedicina (col-span-6) */}
        <div className="card-dark chart-card dashboard-col-span-6 dashboard-row-2-height">
          <div className="card-header">
            <div className="card-title">Presencial vs Telemedicina</div>
            <div className="card-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select 
                className="year-select"
                value={chartPeriodType}
                onChange={(e) => setChartPeriodType(e.target.value as 'day' | 'week' | 'month' | 'year')}
                style={{ minWidth: '100px' }}
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mês</option>
                <option value="year">Ano</option>
              </select>
              
              {chartPeriodType === 'day' && (
                <input
                  type="date"
                  className="year-select"
                  value={chartSelectedDate}
                  onChange={(e) => setChartSelectedDate(e.target.value)}
                  style={{ minWidth: '140px' }}
                />
              )}
              
              {chartPeriodType === 'week' && (
                <input
                  type="date"
                  className="year-select"
                  value={chartSelectedDate}
                  onChange={(e) => setChartSelectedDate(e.target.value)}
                  style={{ minWidth: '140px' }}
                />
              )}
              
              {chartPeriodType === 'month' && (
                <input
                  ref={monthInputRef}
                  type="month"
                  className="year-select"
                  value={chartSelectedMonth}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    console.log('📅 [MONTH INPUT] onChange:', newValue);
                    if (newValue && newValue !== chartSelectedMonth) {
                      setChartSelectedMonth(newValue);
                    }
                  }}
                  onInput={(e) => {
                    const newValue = (e.target as HTMLInputElement).value;
                    console.log('📅 [MONTH INPUT] onInput:', newValue);
                    if (newValue && newValue !== chartSelectedMonth) {
                      setChartSelectedMonth(newValue);
                    }
                  }}
                  onKeyUp={(e) => {
                    const newValue = (e.target as HTMLInputElement).value;
                    console.log('📅 [MONTH INPUT] onKeyUp:', newValue);
                    if (newValue && newValue !== chartSelectedMonth) {
                      setChartSelectedMonth(newValue);
                    }
                  }}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    console.log('📅 [MONTH INPUT] onBlur:', newValue);
                    if (newValue && newValue !== chartSelectedMonth) {
                      setChartSelectedMonth(newValue);
                    }
                  }}
                  style={{ minWidth: '140px' }}
                />
              )}
              
              {chartPeriodType === 'year' && (
                <select 
                  className="year-select"
                  value={chartSelectedYear}
                  onChange={(e) => setChartSelectedYear(Number(e.target.value))}
                  style={{ minWidth: '100px' }}
                >
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                </select>
              )}
            </div>
          </div>
          <div className="chart-content">
            <div className="line-chart">
              <div className="chart-legend-top">
                <div className="legend-item">
                  <div className="legend-line presencial"></div>
                  <span>Presencial</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line telemedicina"></div>
                  <span>Telemedicina</span>
                </div>
              </div>
              <div className="chart-area">
                <Chart3D 
                  data={{
                    presencial: dashboardData?.graficos?.consultasPorDia?.map(d => d.presencial) || [],
                    telemedicina: dashboardData?.graficos?.consultasPorDia?.map(d => d.telemedicina) || [],
                    labels: dashboardData?.graficos?.consultasPorDia?.map(d => {
                      const [yyyy, mm, dd] = d.date.split('-').map(Number);
                      const localDate = new Date(yyyy, (mm || 1) - 1, dd || 1);
                      const day = String(localDate.getDate()).padStart(2, '0');
                      const month = localDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                      return `${day} de ${month}`;
                    }) || []
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Calendário (col-span-3) - Status de Consultas ocupa o espaço ao lado com row-span-2 */}
        <div className="card-dark calendar-card dashboard-col-span-3 dashboard-row-2-height">
          <div className="card-header">
            <div className="card-title">Calendário</div>
            <div className="card-actions">
              <Link href="/agenda" className="view-btn">
                Ver Agenda
              </Link>
            </div>
          </div>
          <div className="calendar-content">
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              highlightedDates={consultationDates}
              className="dashboard-calendar"
            />
          </div>
        </div>

        {/* Row 2: Painel lateral removido - Status de Consultas está na Row 1 */}

        {/* Row 3: Atendimentos na Semana (col-span-5) */}
        <div className="card-dark weekly-chart dashboard-col-span-5">
          <div className="card-title">Atendimentos na Semana</div>
          <BarChart3D
            useCSS3D={true}
            data={getWeeklyData()}
          />
        </div>

        {/* Row 3: Tabela de Consultas (col-span-7) */}
        <div className="card-dark consultations-table dashboard-col-span-7">
          {/* Header com design do Figma */}
          <div className="consultations-header">
            <div className="consultations-header-active">Consultas</div>
            <div className="consultations-header-item consultations-header-patient">Paciente</div>
            <div className="consultations-header-divider"></div>
            <div className="consultations-header-item">id</div>
            <div className="consultations-header-divider"></div>
            <div className="consultations-header-item">Início</div>
            <div className="consultations-header-divider"></div>
            <div className="consultations-header-item">Duração</div>
            <div className="consultations-header-divider"></div>
            <div className="consultations-header-item">Sala</div>
          </div>

          {/* Lista de consultas */}
          <div className="consultations-list">
            {dashboardData?.atividades?.ultimasConsultas && dashboardData.atividades.ultimasConsultas.length > 0 ? (
              dashboardData.atividades.ultimasConsultas.slice(0, 3).map((consulta: any) => {
                // Obter iniciais do médico
                const medicoNome = consulta.medicos?.name || dashboardData?.medico?.name || 'Médico';
                const iniciais = medicoNome
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2);

                // Formatar horário de início
                const inicioDate = consulta.consulta_inicio 
                  ? new Date(consulta.consulta_inicio)
                  : new Date(consulta.created_at);
                const horarioInicio = inicioDate.toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });

                // Formatar duração
                const duracaoMinutos = consulta.duracao 
                  ? Math.round(consulta.duracao) 
                  : consulta.duration 
                    ? Math.round(consulta.duration / 60) 
                    : 0;
                const duracaoFormatada = `${duracaoMinutos} min`;

                // Determinar tipo de sala
                const sala = consulta.consultation_type === 'TELEMEDICINA' 
                  ? 'Sala virtual' 
                  : 'Presencial';

                // Tipo de consulta formatado
                const tipoConsulta = consulta.consultation_type === 'TELEMEDICINA'
                  ? 'Telemedicina'
                  : 'Presencial';

                return (
                  <div 
                    key={consulta.id} 
                    className="consultation-row"
                    onClick={() => router.push(`/consultas?consulta_id=${consulta.id}`)}
                  >
                    <div className="consultation-patient-col">
                      <div className="consultation-avatar">
                        {iniciais}
                      </div>
                      <div className="consultation-patient-info">
                        <div className="consultation-medico-name">{medicoNome}</div>
                        <div className="consultation-type">{tipoConsulta}</div>
                      </div>
                    </div>
                    <div className="consultation-divider"></div>
                    <div className="consultation-id-col">{consulta.id.substring(0, 8)}</div>
                    <div className="consultation-divider"></div>
                    <div className="consultation-time-col">{horarioInicio}</div>
                    <div className="consultation-divider"></div>
                    <div className="consultation-duration-col">{duracaoFormatada}</div>
                    <div className="consultation-divider"></div>
                    <div className="consultation-room-col">{sala}</div>
                  </div>
                );
              })
            ) : (
              <div className="consultations-empty">
                Nenhuma consulta encontrada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}