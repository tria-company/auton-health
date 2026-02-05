import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /admin/dashboard
 * Retorna estatísticas agregadas e métricas do dashboard administrativo
 * Implementação completa baseada na rota original do projeto homolog
 */
export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar se é admin e obter dados do médico
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('admin, clinica_id')
      .eq('user_auth', userId)
      .single();

    if (medicoError || !medico?.admin) {
      return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
    }

    // Pegar parâmetros de filtro da query
    const periodo = (req.query.periodo as string) || 'semana';
    const dataInicio = req.query.dataInicio as string;
    const dataFim = req.query.dataFim as string;
    const tipoConsulta = req.query.tipoConsulta as string;
    // Verificação de segurança: Se o médico tem clínica vinculada, FORÇA o filtro por essa clínica
    // Isso garante isolamento de dados entre clínicas (Multitenancy via código)
    const clinicaIdFiltro = medico.clinica_id || null;

    // Se filtrar por clínica, buscar IDs dos médicos da clínica
    let medicosIdsDaClinica: string[] | null = null;
    if (clinicaIdFiltro) {
      const { data: medicosClinica } = await supabase
        .from('medicos')
        .select('id')
        .eq('clinica_id', clinicaIdFiltro);

      if (medicosClinica && medicosClinica.length > 0) {
        medicosIdsDaClinica = medicosClinica.map(m => m.id);
      } else {
        medicosIdsDaClinica = [];
      }
    }

    // Calcular datas baseado no período
    const hoje = new Date();
    let startDate: Date;
    let endDate: Date = hoje;

    switch (periodo) {
      case 'hoje':
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        break;
      case 'semana':
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 7);
        break;
      case 'mes':
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 30);
        break;
      case 'personalizado':
        startDate = dataInicio ? new Date(dataInicio) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        endDate = dataFim ? new Date(dataFim) : hoje;
        break;
      default:
        startDate = new Date(hoje);
        startDate.setDate(hoje.getDate() - 7);
    }

    // 1. Total de Consultas (período atual)
    let consultasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      consultasQuery = consultasQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length === 0) {
        consultasQuery = consultasQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        consultasQuery = consultasQuery.in('doctor_id', medicosIdsDaClinica);
      }
    }

    const { count: totalConsultas } = await consultasQuery;

    // Calcular período anterior para comparação
    const diffTime = endDate.getTime() - startDate.getTime();
    const periodoAnteriorEnd = new Date(startDate.getTime() - 1);
    const periodoAnteriorStart = new Date(periodoAnteriorEnd.getTime() - diffTime);

    // Total de Consultas (período anterior)
    let consultasAnterioresQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', periodoAnteriorStart.toISOString())
      .lte('created_at', periodoAnteriorEnd.toISOString());

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      consultasAnterioresQuery = consultasAnterioresQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length === 0) {
        consultasAnterioresQuery = consultasAnterioresQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        consultasAnterioresQuery = consultasAnterioresQuery.in('doctor_id', medicosIdsDaClinica);
      }
    }

    const { count: totalConsultasAnterior } = await consultasAnterioresQuery;

    // Calcular variação de consultas
    const variacaoConsultas = (totalConsultasAnterior !== null && totalConsultasAnterior !== undefined)
      ? (totalConsultas || 0) - (totalConsultasAnterior || 0)
      : (totalConsultas || 0);

    // 2. Total de Pacientes (ativos atualmente)
    const { count: totalPacientes } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Calcular variação de pacientes
    const { count: pacientesNovosPeriodoAtual } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'active');

    const variacaoPacientes = pacientesNovosPeriodoAtual || 0;

    // 3. Tempo médio de consulta
    let duracaoQuery = supabase
      .from('consultations')
      .select('duracao, consultation_type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('duracao', 'is', null);

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      duracaoQuery = duracaoQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        duracaoQuery = duracaoQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        duracaoQuery = duracaoQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: consultasComDuracao } = await duracaoQuery;
    const duracoes = consultasComDuracao?.map(c => c.duracao || 0) || [];
    const tempoMedioMinutos = duracoes.length > 0
      ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
      : 0;

    // 4. Taxa de No-show
    let canceladasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CANCELLED')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      canceladasQuery = canceladasQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        canceladasQuery = canceladasQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        canceladasQuery = canceladasQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { count: consultasCanceladas } = await canceladasQuery;
    const taxaNoShow = totalConsultas && totalConsultas > 0
      ? ((consultasCanceladas || 0) / totalConsultas * 100).toFixed(1)
      : '0';

    // 5. Consultas por tipo ao longo do tempo
    let porTipoQuery = supabase
      .from('consultations')
      .select('created_at, consultation_type')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      porTipoQuery = porTipoQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        porTipoQuery = porTipoQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        porTipoQuery = porTipoQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: consultasPorTipo } = await porTipoQuery;

    const consultasPorDia: Record<string, { presencial: number; telemedicina: number }> = {};
    consultasPorTipo?.forEach(c => {
      const data = new Date(c.created_at).toLocaleDateString('pt-BR');
      if (!consultasPorDia[data]) {
        consultasPorDia[data] = { presencial: 0, telemedicina: 0 };
      }
      if (c.consultation_type === 'PRESENCIAL') {
        consultasPorDia[data].presencial++;
      } else {
        consultasPorDia[data].telemedicina++;
      }
    });

    // 6. Consultas por profissional
    let porMedicoQuery = supabase
      .from('consultations')
      .select(`
        doctor_id,
        consultation_type,
        medicos(name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (tipoConsulta && tipoConsulta !== 'TODAS') {
      porMedicoQuery = porMedicoQuery.eq('consultation_type', tipoConsulta);
    }

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        porMedicoQuery = porMedicoQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        porMedicoQuery = porMedicoQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: consultasPorMedico } = await porMedicoQuery;

    const medicosCount: Record<string, { nome: string; count: number }> = {};
    consultasPorMedico?.forEach((c: any) => {
      const medicoNome = c.medicos?.name || 'Desconhecido';
      if (!medicosCount[medicoNome]) {
        medicosCount[medicoNome] = { nome: medicoNome, count: 0 };
      }
      medicosCount[medicoNome].count++;
    });

    const consultasPorProfissional = Object.values(medicosCount)
      .sort((a, b) => b.count - a.count)
      ;

    // 7. Consultas ativas (em andamento)
    let consultasAtivasQuery = supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        consulta_inicio,
        duration,
        medicos!inner(name)
      `)
      .eq('status', 'RECORDING')
      .order('consulta_inicio', { ascending: false })
      ;

    if (medicosIdsDaClinica !== null && medicosIdsDaClinica.length > 0) {
      consultasAtivasQuery = consultasAtivasQuery.in('doctor_id', medicosIdsDaClinica);
    }

    const { data: consultasAtivas } = await consultasAtivasQuery;

    // 8. Status das consultas
    let consultasPorStatusQuery = supabase
      .from('consultations')
      .select('status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        consultasPorStatusQuery = consultasPorStatusQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        consultasPorStatusQuery = consultasPorStatusQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: consultasPorStatus } = await consultasPorStatusQuery;

    const statusCount: Record<string, number> = {};
    consultasPorStatus?.forEach(c => {
      statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    });

    // 9. Situação das consultas (por etapa)
    let consultasPorEtapaQuery = supabase
      .from('consultations')
      .select('etapa')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('etapa', 'is', null);

    if (medicosIdsDaClinica !== null) {
      if (medicosIdsDaClinica.length > 0) {
        consultasPorEtapaQuery = consultasPorEtapaQuery.in('doctor_id', medicosIdsDaClinica);
      } else {
        consultasPorEtapaQuery = consultasPorEtapaQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: consultasPorEtapa } = await consultasPorEtapaQuery;

    const etapaCount: Record<string, number> = {};
    consultasPorEtapa?.forEach(c => {
      if (c.etapa) {
        etapaCount[c.etapa] = (etapaCount[c.etapa] || 0) + 1;
      }
    });

    // 10. Próximas consultas agendadas
    let proximasConsultasQuery = supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consulta_inicio,
        consultation_type
      `)
      .eq('status', 'AGENDAMENTO')
      .gte('consulta_inicio', hoje.toISOString())
      .order('consulta_inicio', { ascending: true })
      .limit(10);

    if (medicosIdsDaClinica !== null && medicosIdsDaClinica.length > 0) {
      proximasConsultasQuery = proximasConsultasQuery.in('doctor_id', medicosIdsDaClinica);
    }

    const { data: proximasConsultas } = await proximasConsultasQuery;

    // 11. Consultas para o calendário
    const mesCalendarioParam = req.query.mesCalendario as string;
    const dataCalendario = mesCalendarioParam ? new Date(mesCalendarioParam) : hoje;
    const primeiroDiaMes = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth(), 1);
    const ultimoDiaMes = new Date(dataCalendario.getFullYear(), dataCalendario.getMonth() + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    let consultasMesQuery = supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consulta_inicio,
        consultation_type,
        status,
        medicos!inner(name)
      `)
      .gte('consulta_inicio', primeiroDiaMes.toISOString())
      .lte('consulta_inicio', ultimoDiaMes.toISOString());

    if (medicosIdsDaClinica !== null && medicosIdsDaClinica.length > 0) {
      consultasMesQuery = consultasMesQuery.in('doctor_id', medicosIdsDaClinica);
    }

    const { data: consultasMes } = await consultasMesQuery;

    const consultasPorDiaCalendario: Record<string, { agendadas: any[]; canceladas: any[] }> = {};
    consultasMes?.forEach((c: any) => {
      if (!c.consulta_inicio) return;
      const dataConsulta = new Date(c.consulta_inicio);
      const diaKey = `${dataConsulta.getFullYear()}-${String(dataConsulta.getMonth() + 1).padStart(2, '0')}-${String(dataConsulta.getDate()).padStart(2, '0')}`;

      if (!consultasPorDiaCalendario[diaKey]) {
        consultasPorDiaCalendario[diaKey] = { agendadas: [], canceladas: [] };
      }

      const consultaInfo = {
        id: c.id,
        paciente: c.patient_name,
        medico: c.medicos?.name || 'Desconhecido',
        tipo: c.consultation_type,
        horario: new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        data: new Date(c.consulta_inicio)
      };

      if (c.status === 'CANCELLED') {
        consultasPorDiaCalendario[diaKey].canceladas.push(consultaInfo);
      } else {
        consultasPorDiaCalendario[diaKey].agendadas.push(consultaInfo);
      }
    });

    // Retornar todos os dados
    return res.json({
      estatisticas: {
        totalConsultas: totalConsultas || 0,
        totalPacientes: totalPacientes || 0,
        tempoMedioMinutos,
        taxaNoShow,
        variacaoConsultas: variacaoConsultas || 0,
        variacaoPacientes: variacaoPacientes || 0
      },
      graficos: {
        consultasPorDia: Object.entries(consultasPorDia).map(([data, valores]) => ({
          data,
          ...valores
        })),
        consultasPorProfissional,
        statusCount,
        etapaCount
      },
      consultasAtivas: consultasAtivas?.map((c: any) => ({
        id: c.id,
        medico: c.medicos?.name || 'Desconhecido',
        tipo: c.consultation_type,
        paciente: c.patient_name,
        inicio: c.consulta_inicio ? new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
        duracao: c.duration ? `${Math.round(c.duration / 60)} min` : '-',
        sala: c.consultation_type === 'PRESENCIAL' ? 'Consultório' : 'Sala virtual'
      })) || [],
      proximasConsultas: proximasConsultas?.map(c => ({
        id: c.id,
        paciente: c.patient_name,
        tipo: 'Agendamento',
        horario: c.consulta_inicio ? new Date(c.consulta_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
        iniciais: c.patient_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
      })) || [],
      consultasCalendario: consultasPorDiaCalendario
    });

  } catch (error) {
    console.error('[AdminController] Erro ao buscar dados do dashboard:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados do dashboard',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
};
