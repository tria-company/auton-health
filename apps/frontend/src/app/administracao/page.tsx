'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { Calendar as CalendarIcon, User, FileText, Clock, TrendingUp, TrendingDown, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import './administracao.css';

interface DashboardData {
  estatisticas: {
    totalConsultas: number;
    totalPacientes: number;
    tempoMedioMinutos: number;
    taxaNoShow: string;
    variacaoConsultas: number;
    variacaoPacientes: number;
  };
  graficos: {
    consultasPorDia: Array<{ data: string; presencial: number; telemedicina: number }>;
    consultasPorProfissional: Array<{ nome: string; count: number }>;
    statusCount: Record<string, number>;
    etapaCount: Record<string, number>;
  };
  consultasAtivas: Array<{
    id: string;
    medico: string;
    tipo: string;
    paciente: string;
    inicio: string;
    duracao: string;
    sala: string;
  }>;
  proximasConsultas: Array<{
    id: string;
    paciente: string;
    tipo: string;
    horario: string;
    iniciais: string;
  }>;
  consultasCalendario: Record<string, {
    agendadas: Array<{
      id: string;
      paciente: string;
      medico: string;
      tipo: string;
      horario: string;
      data: string;
    }>;
    canceladas: Array<{
      id: string;
      paciente: string;
      medico: string;
      tipo: string;
      horario: string;
      data: string;
    }>;
  }>;
}

export default function AdministracaoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [periodo, setPeriodo] = useState('semana');
  const [tipoConsulta, setTipoConsulta] = useState<'PRESENCIAL' | 'TELEMEDICINA' | 'TODAS'>('TODAS');
  const [filtrarPorClinica, setFiltrarPorClinica] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string }>({
    visible: false,
    x: 0,
    y: 0,
    content: ''
  });
  const [calendarTooltip, setCalendarTooltip] = useState<{ visible: boolean; x: number; y: number; content: React.ReactNode }>({
    visible: false,
    x: 0,
    y: 0,
    content: null
  });
  const [mesAtualCalendario, setMesAtualCalendario] = useState(new Date());
  const [visualizacaoCalendario, setVisualizacaoCalendario] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [consultasModal, setConsultasModal] = useState<{
    visible: boolean;
    tipo: 'agendadas' | 'canceladas';
    data: string;
    medicoSelecionado: string | null;
  }>({
    visible: false,
    tipo: 'agendadas',
    data: '',
    medicoSelecionado: null
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [periodo, tipoConsulta, mesAtualCalendario, filtrarPorClinica]);

  // Determinar qual tema está ativo (considerando systemTheme)
  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const logoSrc = currentTheme === 'dark' ? '/logo-white.svg' : '/logo-black.svg';

  // Função para obter o ícone do card baseado no tema
  const getCardIcon = useCallback((cardNumber: number) => {
    const isDark = currentTheme === 'dark';
    if (isDark) {
      return `/card0${cardNumber}-black.svg`;
    }
    return `/card${cardNumber}.svg`;
  }, [currentTheme]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ periodo });
      if (tipoConsulta !== 'TODAS') {
        params.append('tipoConsulta', tipoConsulta);
      }
      // Adicionar mês do calendário para buscar consultas corretas
      params.append('mesCalendario', mesAtualCalendario.toISOString());
      // Adicionar parâmetro de filtro por clínica
      if (filtrarPorClinica) {
        params.append('filtrarPorClinica', 'true');
      }
      const response = await gatewayClient.get(`/admin/dashboard?${params.toString()}`);
      if (!response.success) throw new Error('Erro ao buscar dados');
      
      // ✅ Backend agora retorna no formato correto
      setDashboardData(response as DashboardData);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      // ✅ Definir dados vazios em caso de erro
      setDashboardData({
        estatisticas: {
          totalConsultas: 0,
          totalPacientes: 0,
          tempoMedioMinutos: 0,
          taxaNoShow: '0%',
          variacaoConsultas: 0,
          variacaoPacientes: 0
        },
        graficos: {
          consultasPorDia: [],
          consultasPorProfissional: [],
          statusCount: {},
          etapaCount: {}
        },
        consultasAtivas: [],
        proximasConsultas: [],
        consultasCalendario: {}
      });
    } finally {
      setLoading(false);
    }
  };

  // Calcular dias baseado na visualização
  const calcularDiasVisualizacao = () => {
    if (visualizacaoCalendario === 'dia') {
      // Mostrar apenas o dia atual do mês
      return [{ dia: mesAtualCalendario.getDate(), mes: mesAtualCalendario.getMonth(), ano: mesAtualCalendario.getFullYear() }];
    } else if (visualizacaoCalendario === 'semana') {
      // Mostrar a semana atual (7 dias começando no domingo)
      const primeiroDiaSemana = new Date(mesAtualCalendario);
      primeiroDiaSemana.setDate(mesAtualCalendario.getDate() - mesAtualCalendario.getDay());
      
      const diasSemana: Array<{ dia: number; mes: number; ano: number }> = [];
      for (let i = 0; i < 7; i++) {
        const dia = new Date(primeiroDiaSemana);
        dia.setDate(primeiroDiaSemana.getDate() + i);
        diasSemana.push({ 
          dia: dia.getDate(), 
          mes: dia.getMonth(), 
          ano: dia.getFullYear() 
        });
      }
      return diasSemana;
    } else {
      // Visualização mensal (padrão)
      const diasNoMes = new Date(mesAtualCalendario.getFullYear(), mesAtualCalendario.getMonth() + 1, 0).getDate();
      return Array.from({ length: diasNoMes }, (_, i) => ({ 
        dia: i + 1, 
        mes: mesAtualCalendario.getMonth(), 
        ano: mesAtualCalendario.getFullYear() 
      }));
    }
  };

  const diasVisualizacao = calcularDiasVisualizacao();
  const primeiroDiaMes = new Date(mesAtualCalendario.getFullYear(), mesAtualCalendario.getMonth(), 1);
  const primeiroDiaSemana = visualizacaoCalendario === 'mes' 
    ? primeiroDiaMes.getDay() 
    : 0; // Para semana e dia, não precisa de espaços vazios no início
  
  // Função para formatar data no formato da chave do calendário
  const formatarDataChave = (ano: number, mes: number, dia: number) => {
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  };
  
  // Função para obter consultas do dia
  const obterConsultasDoDia = (dia: number, mes?: number, ano?: number) => {
    const mesFinal = mes !== undefined ? mes : mesAtualCalendario.getMonth();
    const anoFinal = ano !== undefined ? ano : mesAtualCalendario.getFullYear();
    const chave = formatarDataChave(anoFinal, mesFinal, dia);
    return dashboardData?.consultasCalendario[chave] || { agendadas: [], canceladas: [] };
  };

  const obterMedicosUnicos = (consultas: Array<{ medico: string }>) => {
    const medicos = new Set(consultas.map(c => c.medico));
    return Array.from(medicos).sort();
  };

  const obterConsultasPorMedico = (consultas: Array<{ medico: string; id: string; paciente: string; horario: string; tipo: string }>, medico: string) => {
    return consultas.filter(c => c.medico === medico);
  };

  const handleAbrirModalConsultas = (tipo: 'agendadas' | 'canceladas', dia: number, mes: number, ano: number) => {
    const chave = formatarDataChave(ano, mes, dia);
    const consultasDia = dashboardData?.consultasCalendario[chave];
    const consultas = tipo === 'agendadas' ? consultasDia?.agendadas || [] : consultasDia?.canceladas || [];
    
    if (consultas.length > 0) {
      setConsultasModal({
        visible: true,
        tipo,
        data: chave,
        medicoSelecionado: null
      });
    }
  };

  const handleSelecionarMedico = (medico: string) => {
    setConsultasModal(prev => ({ ...prev, medicoSelecionado: medico }));
  };

  const handleVoltarMedicos = () => {
    setConsultasModal(prev => ({ ...prev, medicoSelecionado: null }));
  };

  const handleAbrirConsulta = (consultaId: string) => {
    router.push(`/consultas?consulta_id=${consultaId}`);
  };

  // Preparar dados para os cards com base nos dados dinâmicos
  const estatisticas = dashboardData ? [
    {
      titulo: 'Consultas',
      valor: String(dashboardData.estatisticas.totalConsultas),
      variacao: dashboardData.estatisticas.variacaoConsultas > 0 
        ? `+${dashboardData.estatisticas.variacaoConsultas}` 
        : dashboardData.estatisticas.variacaoConsultas < 0 
        ? `${dashboardData.estatisticas.variacaoConsultas}` 
        : '0',
      icone: getCardIcon(1)
    },
    {
      titulo: 'Pacientes cadastrados',
      valor: String(dashboardData.estatisticas.totalPacientes),
      variacao: dashboardData.estatisticas.variacaoPacientes > 0 
        ? `+${dashboardData.estatisticas.variacaoPacientes}` 
        : dashboardData.estatisticas.variacaoPacientes < 0 
        ? `${dashboardData.estatisticas.variacaoPacientes}` 
        : '0',
      icone: getCardIcon(2)
    },
    {
      titulo: 'Tempo médio de consulta',
      valor: `${dashboardData.estatisticas.tempoMedioMinutos} min`,
      variacao: `Tempo médio: ${dashboardData.estatisticas.tempoMedioMinutos} minutos`,
      icone: getCardIcon(3)
    },
    {
      titulo: 'Taxa de No-show',
      valor: `${dashboardData.estatisticas.taxaNoShow}%`,
      variacao: 'Meta: <5%',
      variacao_positiva: parseFloat(dashboardData.estatisticas.taxaNoShow) < 5,
      icone: getCardIcon(4)
    }
  ] : [];

  const consultasProfissional = dashboardData?.graficos.consultasPorProfissional || [];
  const consultasAtivas = dashboardData?.consultasAtivas || [];
  const proximasConsultas = dashboardData?.proximasConsultas || [];

  if (loading) {
    return (
      <div className="administracao-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={48} className="spinning" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px', color: '#1B4266' }} />
          <p style={{ color: '#6B7280', fontSize: '16px' }}>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="administracao-page">
      {/* Header */}
      <div className="admin-header">
        <div className="header-logo">
          <Image src={logoSrc} alt="AUTON Health" width={200} height={40} />
        </div>
      </div>

      {/* Filtros e período em uma linha */}
      <div className="filters-row">
        <div className="period-filter">
          <button className={periodo === 'hoje' ? 'active' : ''} onClick={() => setPeriodo('hoje')}>Hoje</button>
          <button className={periodo === 'semana' ? 'active' : ''} onClick={() => setPeriodo('semana')}>Semana</button>
          <button className={periodo === 'mes' ? 'active' : ''} onClick={() => setPeriodo('mes')}>Mês</button>
          <button className={periodo === 'personalizado' ? 'active' : ''} onClick={() => setPeriodo('personalizado')}>Personalizado</button>
        </div>

        <div className="header-filters">
          <div className="clinic-filter">
            <label>Clínica / Unidade</label>
            <select disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
              <option>Todas as Clínicas</option>
            </select>
          </div>
          
          <div className="professional-filter">
            <label>Profissional</label>
            <select>
              <option>Todos os Profissionais</option>
            </select>
          </div>
          
          <div className="type-filter">
            <label>Tipo de Consulta</label>
            <div className="type-buttons">
              <button 
                className={tipoConsulta === 'PRESENCIAL' ? 'active' : ''}
                onClick={() => setTipoConsulta('PRESENCIAL')}
              >
                Presencial
              </button>
              <button 
                className={tipoConsulta === 'TELEMEDICINA' ? 'active' : ''}
                onClick={() => setTipoConsulta('TELEMEDICINA')}
              >
                Telemedicina
              </button>
              <button 
                className={tipoConsulta === 'TODAS' ? 'active' : ''}
                onClick={() => setTipoConsulta('TODAS')}
              >
                Todas
              </button>
            </div>
          </div>

          <div className="type-filter">
            <label>Filtro</label>
            <div className="type-buttons">
              <button 
                className={filtrarPorClinica ? 'active' : ''}
                onClick={() => setFiltrarPorClinica(!filtrarPorClinica)}
                title="Filtrar apenas médicos da mesma clínica"
              >
                Minha Clínica
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="stats-grid">
        {estatisticas.map((stat, index) => (
          <div 
            key={index} 
            className="stat-card"
            style={{ backgroundImage: `url(${stat.icone})` }}
          >
            <div className="stat-content">
              <h3>{stat.titulo}</h3>
              <div className="stat-value-row">
                <span className="stat-value">{stat.valor}</span>
                {!stat.variacao.includes(':') && (
                  <span className={`stat-variation ${stat.variacao_positiva === false ? 'negative' : 'positive'}`}>
                    {stat.variacao}
                  </span>
                )}
              </div>
              {stat.variacao.includes(':') && !stat.variacao.includes('Meta') && (
                <p className="stat-subtitle">{stat.variacao}</p>
              )}
              {stat.variacao.includes('Meta') && (
                <p className="stat-subtitle meta-badge">{stat.variacao}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos principais */}
      <div className="charts-row">
        {/* Gráfico Presencial vs Telemedicina */}
        <div className="chart-card">
          <h3>Presencial vs Telemedicina</h3>
          <div className="line-chart">
            {/* Tooltip */}
            {tooltip.visible && (
              <div 
                className="chart-tooltip"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y}px`
                }}
              >
                {tooltip.content.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            {(() => {
              const dados = dashboardData?.graficos.consultasPorDia || [];
              if (dados.length === 0) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
                    Sem dados para exibir
                  </div>
                );
              }

              // Pegar primeiros 7 dias ou últimos 7 dias disponíveis
              const dadosLimitados = dados.slice(-7);
              const maxValue = Math.max(...dadosLimitados.map(d => Math.max(d.presencial, d.telemedicina)), 1);
              
              // Dimensões do gráfico - ajustadas para ocupar 100% do card
              const width = 1000;
              const height = 400;
              const marginLeft = 70;
              const marginRight = 120;
              const marginTop = 10;
              const marginBottom = 15;
              const chartWidth = width - marginLeft - marginRight;
              const chartHeight = height - marginTop - marginBottom;
              
              const pontosPorDia = dadosLimitados.length;
              const espacoX = pontosPorDia > 1 ? chartWidth / (pontosPorDia - 1) : chartWidth / 2;

              // Calcular pontos das linhas
              const pontosPresencial = dadosLimitados.map((d, i) => {
                const x = marginLeft + (i * espacoX);
                const y = marginTop + chartHeight - (d.presencial / maxValue * chartHeight);
                return { x, y };
              });

              const pontosTelemedicina = dadosLimitados.map((d, i) => {
                const x = marginLeft + (i * espacoX);
                const y = marginTop + chartHeight - (d.telemedicina / maxValue * chartHeight);
                return { x, y };
              });

              // Criar paths para as linhas
              const pathPresencial = pontosPresencial.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
              const pathTelemedicina = pontosTelemedicina.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

              return (
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    {/* Grid pattern */}
                    <pattern id="gridPattern" width="40" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 30" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
                    </pattern>
                  </defs>

                  {/* Grid lines horizontais */}
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <line 
                      key={`h-${i}`} 
                      x1={marginLeft} 
                      y1={marginTop + (chartHeight / 5) * i} 
                      x2={width - marginRight} 
                      y2={marginTop + (chartHeight / 5) * i} 
                      stroke="#F7F7F7" 
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Linhas verticais do grid */}
                  {dadosLimitados.map((_, i) => (
                    <line 
                      key={`v-${i}`} 
                      x1={marginLeft + (i * espacoX)} 
                      y1={marginTop} 
                      x2={marginLeft + (i * espacoX)} 
                      y2={marginTop + chartHeight} 
                      stroke="#E5E7EB" 
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Labels do eixo Y */}
                  {[5, 4, 3, 2, 1, 0].map((num, i) => {
                    const yPos = marginTop + (chartHeight / 5) * (5 - i);
                    const labelValue = Math.round((maxValue / 5) * num);
                    return (
                      <text key={`y-${num}`} x={marginLeft - 10} y={yPos + 5} fill="#6B7280" fontSize="13" fontWeight="600" textAnchor="end">
                        {labelValue}
                      </text>
                    );
                  })}
                  
                  {/* Linha Presencial (roxa/violeta) */}
                  <path
                    d={pathPresencial}
                    fill="none"
                    stroke="#976EF6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Linha Telemedicina (azul) - com traço */}
                  <path
                    d={pathTelemedicina}
                    fill="none"
                    stroke="#4387F6"
                    strokeWidth="4"
                    strokeDasharray="10,6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Pontos Presencial */}
                  {pontosPresencial.map((p, i) => (
                    <g key={`p-${i}`}>
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="8" 
                        fill="transparent" 
                        style={{ cursor: 'pointer' }}
                        onMouseMove={(e) => {
                          setTooltip({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            content: `${dadosLimitados[i].data}\nPresencial: ${dadosLimitados[i].presencial}`
                          });
                        }}
                        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, content: '' })}
                      />
                      <circle cx={p.x} cy={p.y} r="5" fill="#976EF6" stroke="white" strokeWidth="2.5" style={{ pointerEvents: 'none' }}/>
                    </g>
                  ))}
                  
                  {/* Pontos Telemedicina */}
                  {pontosTelemedicina.map((p, i) => (
                    <g key={`t-${i}`}>
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="8" 
                        fill="transparent" 
                        style={{ cursor: 'pointer' }}
                        onMouseMove={(e) => {
                          setTooltip({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            content: `${dadosLimitados[i].data}\nTelemedicina: ${dadosLimitados[i].telemedicina}`
                          });
                        }}
                        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, content: '' })}
                      />
                      <circle cx={p.x} cy={p.y} r="5" fill="#4387F6" stroke="white" strokeWidth="2.5" style={{ pointerEvents: 'none' }}/>
                    </g>
                  ))}
                  
                  {/* Labels do eixo X */}
                  {dadosLimitados.map((d, i) => (
                    <text 
                      key={`x-${i}`}
                      x={marginLeft + (i * espacoX)} 
                      y={height - marginBottom + 25} 
                      fill="#6B7280" 
                      fontSize="13" 
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {d.data}
                    </text>
                  ))}
                  
                  {/* Legenda no canto superior direito - melhor posicionada */}
                  <g>
                    {/* Presencial */}
                    <line x1={width - marginRight - 240} y1="15" x2={width - marginRight - 205} y2="15" stroke="#976EF6" strokeWidth="4" strokeLinecap="round"/>
                    <text x={width - marginRight - 195} y="20" fill="#323232" fontSize="14" fontWeight="600">Presencial</text>
                    
                    {/* Telemedicina */}
                    <line x1={width - marginRight - 90} y1="15" x2={width - marginRight - 55} y2="15" stroke="#4387F6" strokeWidth="4" strokeDasharray="10,6" strokeLinecap="round"/>
                    <text x={width - marginRight - 45} y="20" fill="#323232" fontSize="14" fontWeight="600">Telemedicina</text>
                  </g>
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Gráfico Consultas por profissional */}
        <div className="chart-card">
          <h3>Consultas por profissional</h3>
          <div className="bar-chart">
            {consultasProfissional.map((item, index) => (
              <div key={index} className="bar-item">
                <span className="bar-label">{item.nome}</span>
                <div className="bar-wrapper">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${Math.min((item.count / Math.max(...consultasProfissional.map(i => i.count), 1)) * 100, 100)}%`,
                      background: '#1B4266'
                    }}
                  ></div>
                </div>
                <span className="bar-value">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Consultas Ativas */}
      <div className="active-consultations">
        <div className="section-tabs">
          <div></div>
          <button className="tab active">Nome Médico</button>
          <button className="tab">Paciente</button>
          <button className="tab">Início</button>
          <button className="tab">Duração</button>
          <button className="tab">Sala</button>
        </div>
        
        <div className="consultations-list">
          {consultasAtivas.map((consulta, index) => (
            <div key={index} className="consultation-item">
              <div className="consultation-avatar">
                <span>AS</span>
              </div>
              <div className="consultation-info">
                <div className="medico-info">
                  <strong>{consulta.medico}</strong>
                  <span className="tipo-badge">{consulta.tipo}</span>
                </div>
              </div>
              <div className="consultation-patient">{consulta.paciente}</div>
              <div className="consultation-time">{consulta.inicio}</div>
              <div className="consultation-duration">{consulta.duracao}</div>
              <div className="consultation-room">{consulta.sala}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Seção inferior com gráficos e calendário */}
      <div className="bottom-section">
        {/* Coluna Esquerda - Gráficos de Status */}
        <div className="charts-left-column">
          {/* Status das consultas */}
          <div className="status-card">
            <h3>Status das consultas</h3>
            <div className="status-card-content">
              {(() => {
                const statusCount = dashboardData?.graficos.statusCount || {};
                const novos = statusCount['CREATED'] || 0;
                const retorno = statusCount['COMPLETED'] || 0;
                const cancelados = statusCount['CANCELLED'] || 0;
                const erro = statusCount['ERROR'] || 0;
                const total = novos + retorno + cancelados + erro;

                // Calcular proporções para o gráfico donut (circunferência total = 282)
                const circunferencia = 282;
                const novosDash = total > 0 ? Math.round((novos / total) * circunferencia) : 0;
                const retornoDash = total > 0 ? Math.round((retorno / total) * circunferencia) : 0;
                const canceladosDash = total > 0 ? Math.round((cancelados / total) * circunferencia) : 0;
                const erroDash = total > 0 ? Math.round((erro / total) * circunferencia) : 0;

                const retornoOffset = -novosDash;
                const canceladosOffset = -(novosDash + retornoDash);
                const erroOffset = -(novosDash + retornoDash + canceladosDash);

                return (
                  <>
                    <div className="donut-chart">
                      <svg viewBox="0 0 120 120" className="donut-svg">
                        {novosDash > 0 && (
                          <circle cx="60" cy="60" r="45" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray={`${novosDash} ${circunferencia}`} />
                        )}
                        {retornoDash > 0 && (
                          <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="20" strokeDasharray={`${retornoDash} ${circunferencia}`} strokeDashoffset={retornoOffset} />
                        )}
                        {canceladosDash > 0 && (
                          <circle cx="60" cy="60" r="45" fill="none" stroke="#F59E0B" strokeWidth="20" strokeDasharray={`${canceladosDash} ${circunferencia}`} strokeDashoffset={canceladosOffset} />
                        )}
                        {erroDash > 0 && (
                          <circle cx="60" cy="60" r="45" fill="none" stroke="#EF4444" strokeWidth="20" strokeDasharray={`${erroDash} ${circunferencia}`} strokeDashoffset={erroOffset} />
                        )}
                        <text x="60" y="65" textAnchor="middle" fill="#1F2937" fontSize="24" fontWeight="bold">{total}</text>
                      </svg>
                    </div>
                    <div className="legend">
                      <div className="legend-item"><span className="dot blue"></span> Novos ({novos})</div>
                      <div className="legend-item"><span className="dot green"></span> Concluídas ({retorno})</div>
                      <div className="legend-item"><span className="dot yellow"></span> Canceladas ({cancelados})</div>
                      {erro > 0 && <div className="legend-item"><span className="dot red"></span> Erro ({erro})</div>}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

        {/* Situação da Consulta */}
        <div className="status-card">
          <h3>Situação da Consulta</h3>
          <div className="status-card-content">
            {(() => {
              const statusCount = dashboardData?.graficos.statusCount || {};
              const agendada = statusCount['AGENDAMENTO'] || 0;
              const emAndamento = statusCount['RECORDING'] || statusCount['PROCESSING'] || statusCount['VALIDATION'] || 0;
              const finalizada = statusCount['COMPLETED'] || 0;
              const total = agendada + emAndamento + finalizada;

              // Calcular proporções para o gráfico donut (circunferência total = 282)
              const circunferencia = 282;
              const agendadaDash = total > 0 ? Math.round((agendada / total) * circunferencia) : 0;
              const emAndamentoDash = total > 0 ? Math.round((emAndamento / total) * circunferencia) : 0;
              const finalizadaDash = total > 0 ? Math.round((finalizada / total) * circunferencia) : 0;

              const emAndamentoOffset = -agendadaDash;
              const finalizadaOffset = -(agendadaDash + emAndamentoDash);

              return (
                <>
                  <div className="donut-chart">
                    <svg viewBox="0 0 120 120" className="donut-svg">
                      {agendadaDash > 0 && (
                        <circle cx="60" cy="60" r="45" fill="none" stroke="#3B82F6" strokeWidth="20" strokeDasharray={`${agendadaDash} ${circunferencia}`} />
                      )}
                      {emAndamentoDash > 0 && (
                        <circle cx="60" cy="60" r="45" fill="none" stroke="#9CA3AF" strokeWidth="20" strokeDasharray={`${emAndamentoDash} ${circunferencia}`} strokeDashoffset={emAndamentoOffset} />
                      )}
                      {finalizadaDash > 0 && (
                        <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" strokeWidth="20" strokeDasharray={`${finalizadaDash} ${circunferencia}`} strokeDashoffset={finalizadaOffset} />
                      )}
                      <text x="60" y="65" textAnchor="middle" fill="#1F2937" fontSize="24" fontWeight="bold">{total}</text>
                    </svg>
                  </div>
                  <div className="legend">
                    <div className="legend-item"><span className="dot blue"></span> Agendada ({agendada})</div>
                    <div className="legend-item"><span className="dot gray"></span> Em Andamento ({emAndamento})</div>
                    <div className="legend-item"><span className="dot green"></span> Finalizada ({finalizada})</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        </div>

        {/* Próximas Consultas */}
        <div className="upcoming-consultations">
          <div className="upcoming-header">
            <h3>Próximas Consultas</h3>
            <span className="info-icon">?</span>
          </div>
          <div className="upcoming-grid">
            {proximasConsultas.map((consulta, index) => (
              <div key={index} className="upcoming-item">
                <div className="upcoming-avatar" style={{ background: consulta.iniciais === 'RM' ? '#93C5FD' : '#BFDBFE' }}>
                  {consulta.iniciais}
                </div>
                <div className="upcoming-info">
                  <strong>{consulta.paciente}</strong>
                  <span>{consulta.tipo}</span>
                </div>
                <div className="upcoming-time">{consulta.horario}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendário */}
      <div className="calendar-section">
          <div className="calendar-header">
            <button 
              className="calendar-nav"
              onClick={() => {
                const novaData = new Date(mesAtualCalendario);
                if (visualizacaoCalendario === 'dia') {
                  novaData.setDate(novaData.getDate() - 1);
                } else if (visualizacaoCalendario === 'semana') {
                  novaData.setDate(novaData.getDate() - 7);
                } else {
                  novaData.setMonth(novaData.getMonth() - 1);
                }
                setMesAtualCalendario(novaData);
              }}
            >
              ‹
            </button>
            <button 
              className="calendar-nav"
              onClick={() => {
                const novaData = new Date(mesAtualCalendario);
                if (visualizacaoCalendario === 'dia') {
                  novaData.setDate(novaData.getDate() + 1);
                } else if (visualizacaoCalendario === 'semana') {
                  novaData.setDate(novaData.getDate() + 7);
                } else {
                  novaData.setMonth(novaData.getMonth() + 1);
                }
                setMesAtualCalendario(novaData);
              }}
            >
              ›
            </button>
            <button className="add-event-btn">Adicionar evento</button>
            <span className="calendar-month">
              {visualizacaoCalendario === 'dia' 
                ? mesAtualCalendario.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : visualizacaoCalendario === 'semana'
                ? `Semana de ${new Date(diasVisualizacao[0].ano, diasVisualizacao[0].mes, diasVisualizacao[0].dia).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`
                : mesAtualCalendario.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              }
            </span>
            <div className="calendar-view-buttons">
              <button 
                className={`view-btn ${visualizacaoCalendario === 'mes' ? 'active' : ''}`}
                onClick={() => setVisualizacaoCalendario('mes')}
              >
                Mês
              </button>
              <button 
                className={`view-btn ${visualizacaoCalendario === 'semana' ? 'active' : ''}`}
                onClick={() => setVisualizacaoCalendario('semana')}
              >
                Semana
              </button>
              <button 
                className={`view-btn ${visualizacaoCalendario === 'dia' ? 'active' : ''}`}
                onClick={() => setVisualizacaoCalendario('dia')}
              >
                Dia
              </button>
            </div>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                <div key={dia} className="weekday">{dia}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {visualizacaoCalendario === 'mes' && Array.from({ length: primeiroDiaSemana }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty"></div>
              ))}
              {diasVisualizacao.map((diaInfo, index) => {
                const consultasDia = obterConsultasDoDia(diaInfo.dia, diaInfo.mes, diaInfo.ano);
                const dataAtual = new Date();
                const diaAtual = new Date(diaInfo.ano, diaInfo.mes, diaInfo.dia);
                const isPassado = diaAtual < new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate());
                const isFuturo = diaAtual > new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate());
                
                return (
                  <div 
                    key={`${diaInfo.ano}-${diaInfo.mes}-${diaInfo.dia}`} 
                    className={`calendar-day ${isPassado ? 'past' : ''} ${isFuturo ? 'future' : ''}`}
                    onMouseEnter={(e) => {
                      if (consultasDia.agendadas.length > 0 || consultasDia.canceladas.length > 0) {
                        setCalendarTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          content: (
                            <div>
                              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                {diaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </div>
                              {consultasDia.agendadas.length > 0 && (
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontWeight: '600', color: '#10B981', marginBottom: '4px' }}>
                                    Agendadas ({consultasDia.agendadas.length})
                                  </div>
                                  {consultasDia.agendadas.map((c, idx) => (
                                    <div key={idx} style={{ fontSize: '12px', marginLeft: '8px', marginBottom: '2px' }}>
                                      {c.horario} - {c.paciente} ({c.medico})
                                    </div>
                                  ))}
                                </div>
                              )}
                              {consultasDia.canceladas.length > 0 && (
                                <div>
                                  <div style={{ fontWeight: '600', color: '#EF4444', marginBottom: '4px' }}>
                                    Canceladas ({consultasDia.canceladas.length})
                                  </div>
                                  {consultasDia.canceladas.map((c, idx) => (
                                    <div key={idx} style={{ fontSize: '12px', marginLeft: '8px', marginBottom: '2px' }}>
                                      {c.horario} - {c.paciente} ({c.medico})
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (calendarTooltip.visible) {
                        setCalendarTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
                      }
                    }}
                    onMouseLeave={() => {
                      setCalendarTooltip({ visible: false, x: 0, y: 0, content: null });
                    }}
                  >
                    <span className="day-number">{diaInfo.dia}</span>
                    <div className="calendar-day-content">
                      <div 
                        className="calendar-day-left" 
                        style={{ 
                          backgroundColor: consultasDia.agendadas.length > 0 ? '#D1FAE5' : 'transparent',
                          opacity: isPassado ? 0.6 : 1,
                          cursor: consultasDia.agendadas.length > 0 ? 'pointer' : 'default'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (consultasDia.agendadas.length > 0) {
                            handleAbrirModalConsultas('agendadas', diaInfo.dia, diaInfo.mes, diaInfo.ano);
                          }
                        }}
                      >
                        {consultasDia.agendadas.length > 0 && (
                          <span className="consultation-count">{consultasDia.agendadas.length}</span>
                        )}
                      </div>
                      <div className="calendar-day-divider"></div>
                      <div 
                        className="calendar-day-right" 
                        style={{ 
                          backgroundColor: consultasDia.canceladas.length > 0 ? '#FEE2E2' : 'transparent',
                          opacity: isPassado ? 0.6 : 1,
                          cursor: consultasDia.canceladas.length > 0 ? 'pointer' : 'default'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (consultasDia.canceladas.length > 0) {
                            handleAbrirModalConsultas('canceladas', diaInfo.dia, diaInfo.mes, diaInfo.ano);
                          }
                        }}
                      >
                        {consultasDia.canceladas.length > 0 && (
                          <span className="consultation-count">{consultasDia.canceladas.length}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {calendarTooltip.visible && (
              <div 
                className="calendar-tooltip"
                style={{
                  left: `${calendarTooltip.x + 10}px`,
                  top: `${calendarTooltip.y + 10}px`
                }}
              >
                {calendarTooltip.content}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Consultas */}
        {consultasModal.visible && (() => {
          const consultasDia = dashboardData?.consultasCalendario[consultasModal.data] || { agendadas: [], canceladas: [] };
          const consultas = consultasModal.tipo === 'agendadas' ? consultasDia.agendadas : consultasDia.canceladas;
          const medicos = obterMedicosUnicos(consultas);
          const consultasMedico = consultasModal.medicoSelecionado 
            ? obterConsultasPorMedico(consultas, consultasModal.medicoSelecionado)
            : [];

          const [ano, mes, dia] = consultasModal.data.split('-').map(Number);
          const dataFormatada = new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          });

          return (
            <div 
              className="consultas-modal-overlay"
              onClick={() => setConsultasModal({ visible: false, tipo: 'agendadas', data: '', medicoSelecionado: null })}
            >
              <div 
                className="consultas-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="consultas-modal-header">
                  <h2>
                    {consultasModal.tipo === 'agendadas' ? 'Consultas Agendadas' : 'Consultas Canceladas'} - {dataFormatada}
                  </h2>
                  <button
                    className="consultas-modal-close"
                    onClick={() => setConsultasModal({ visible: false, tipo: 'agendadas', data: '', medicoSelecionado: null })}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="consultas-modal-body">
                  {!consultasModal.medicoSelecionado ? (
                    <>
                      <h3>Selecione um médico:</h3>
                      <div className="medicos-list">
                        {medicos.map((medico, index) => {
                          const count = consultas.filter(c => c.medico === medico).length;
                          return (
                            <div
                              key={index}
                              className="medico-item"
                              onClick={() => handleSelecionarMedico(medico)}
                            >
                              <div className="medico-info">
                                <strong>{medico}</strong>
                                <span className="medico-count">{count} consulta{count > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="consultas-modal-nav">
                        <button
                          className="consultas-modal-back"
                          onClick={handleVoltarMedicos}
                        >
                          ← Voltar
                        </button>
                        <h3>Consultas de {consultasModal.medicoSelecionado}</h3>
                      </div>
                      <div className="consultas-list-modal">
                        {consultasMedico.map((consulta, index) => (
                          <div
                            key={index}
                            className="consulta-item-modal"
                            onClick={() => handleAbrirConsulta(consulta.id)}
                          >
                            <div className="consulta-horario">{consulta.horario}</div>
                            <div className="consulta-info">
                              <strong>{consulta.paciente}</strong>
                              <span className="consulta-tipo">{consulta.tipo}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

