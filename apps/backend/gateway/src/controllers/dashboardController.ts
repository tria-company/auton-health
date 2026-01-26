import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /dashboard
 * Retorna estatísticas do dashboard para o médico autenticado
 */
export async function getDashboardData(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('=== GET /dashboard (Gateway) ===');
    
    // Verificar autenticação
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const doctorAuthId = req.user.id;

    // Buscar médico na tabela medicos
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id, name, specialty, crm, subscription_type')
      .eq('user_auth', doctorAuthId)
      .single();
    
    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado no sistema'
      });
    }

    // Período alvo
    const { year, period, chartPeriod, chartDate, chartMonth, chartYear } = req.query;
    const targetYear = year ? Number(year) : new Date().getFullYear();

    // Calcular período para filtros de estatísticas
    let startDateRange: Date;
    let endDateRange: Date;

    if (period === 'hoje') {
      const hoje = new Date();
      startDateRange = new Date(hoje);
      startDateRange.setHours(0, 0, 0, 0);
      endDateRange = new Date(hoje);
      endDateRange.setHours(23, 59, 59, 999);
    } else if (period === '7d' || period === '15d' || period === '30d') {
      const days = Number((period as string).replace('d', ''));
      endDateRange = new Date();
      startDateRange = new Date();
      startDateRange.setDate(startDateRange.getDate() - days + 1);
      startDateRange.setHours(0, 0, 0, 0);
      endDateRange.setHours(23, 59, 59, 999);
    } else {
      startDateRange = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
      endDateRange = targetYear === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
    }

    // Estatísticas de Pacientes
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id);

    // Calcular variação de pacientes (mês atual vs mês anterior)
    const inicioMesAtual = new Date();
    inicioMesAtual.setDate(1);
    inicioMesAtual.setHours(0, 0, 0, 0);
    const fimMesAtual = new Date();
    fimMesAtual.setMonth(fimMesAtual.getMonth() + 1, 0);
    fimMesAtual.setHours(23, 59, 59, 999);
    
    const inicioMesAnterior = new Date(inicioMesAtual);
    inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
    const fimMesAnterior = new Date(inicioMesAtual);
    fimMesAnterior.setDate(0);
    fimMesAnterior.setHours(23, 59, 59, 999);

    const { count: pacientesMesAtual } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .gte('created_at', inicioMesAtual.toISOString())
      .lte('created_at', fimMesAtual.toISOString());

    const { count: pacientesMesAnterior } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .gte('created_at', inicioMesAnterior.toISOString())
      .lte('created_at', fimMesAnterior.toISOString());

    const variacaoPacientes = pacientesMesAnterior && pacientesMesAnterior > 0
      ? Math.round(((pacientesMesAtual || 0) - pacientesMesAnterior) / pacientesMesAnterior * 100)
      : pacientesMesAtual && pacientesMesAtual > 0 ? 100 : 0;

    // Consultas do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: consultasHoje } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    // Consultas concluídas
    let consultasConcluidasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .eq('status', 'COMPLETED');
    
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      consultasConcluidasQuery = consultasConcluidasQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    } else {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      consultasConcluidasQuery = consultasConcluidasQuery
        .gte('created_at', inicioMes.toISOString());
    }
    
    const { count: consultasConcluidasMes } = await consultasConcluidasQuery;

    // Calcular variação de consultas concluídas (mês atual vs mês anterior)
    const inicioMesAtualConsultas = new Date();
    inicioMesAtualConsultas.setDate(1);
    inicioMesAtualConsultas.setHours(0, 0, 0, 0);
    const fimMesAtualConsultas = new Date();
    fimMesAtualConsultas.setMonth(fimMesAtualConsultas.getMonth() + 1, 0);
    fimMesAtualConsultas.setHours(23, 59, 59, 999);
    
    const inicioMesAnteriorConsultas = new Date(inicioMesAtualConsultas);
    inicioMesAnteriorConsultas.setMonth(inicioMesAnteriorConsultas.getMonth() - 1);
    const fimMesAnteriorConsultas = new Date(inicioMesAtualConsultas);
    fimMesAnteriorConsultas.setDate(0);
    fimMesAnteriorConsultas.setHours(23, 59, 59, 999);

    const { count: consultasConcluidasMesAnterior } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .eq('status', 'COMPLETED')
      .gte('created_at', inicioMesAnteriorConsultas.toISOString())
      .lte('created_at', fimMesAnteriorConsultas.toISOString());

    const variacaoConsultas = consultasConcluidasMesAnterior && consultasConcluidasMesAnterior > 0
      ? Math.round(((consultasConcluidasMes || 0) - consultasConcluidasMesAnterior) / consultasConcluidasMesAnterior * 100)
      : consultasConcluidasMes && consultasConcluidasMes > 0 ? 100 : 0;

    // Duração média das consultas
    const calcularDuracaoEmSegundos = (c: any) => {
      if (c.duration != null && c.duration !== undefined && c.duration > 0) {
        return Number(c.duration);
      }
      
      if (c.duracao != null && c.duracao !== undefined && c.duracao > 0) {
        const duracaoValue = Number(c.duracao);
        return duracaoValue < 60 && duracaoValue > 0 ? duracaoValue * 60 : duracaoValue;
      }
      
      if (c.consulta_inicio && c.consulta_fim) {
        const inicio = new Date(c.consulta_inicio).getTime();
        const fim = new Date(c.consulta_fim).getTime();
        const diffSegundos = Math.max(0, Math.round((fim - inicio) / 1000));
        if (diffSegundos > 0) {
          return diffSegundos;
        }
      }
      
      return 0;
    };

    let consultasComDuracaoQuery = supabase
      .from('consultations')
      .select('id, duration, duracao, consultation_type, created_at, consulta_inicio, consulta_fim, status')
      .eq('doctor_id', medico.id)
      .in('status', ['COMPLETED', 'PROCESSING', 'VALID_SOLUCAO']);
    
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      consultasComDuracaoQuery = consultasComDuracaoQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: todasConsultas } = await consultasComDuracaoQuery;

    const consultasComDuracao = todasConsultas?.filter(c => {
      const duracao = calcularDuracaoEmSegundos(c);
      return duracao > 0;
    }) || [];

    const duracaoMedia = consultasComDuracao.length > 0
      ? consultasComDuracao.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasComDuracao.length
      : 0;

    const consultasPresencial = consultasComDuracao?.filter(c => c.consultation_type === 'PRESENCIAL') || [];
    const consultasTelemedicina = consultasComDuracao?.filter(c => c.consultation_type === 'TELEMEDICINA') || [];
    
    const duracaoMediaPresencial = consultasPresencial.length > 0
      ? consultasPresencial.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasPresencial.length
      : 0;
    
    const duracaoMediaTelemedicina = consultasTelemedicina.length > 0
      ? consultasTelemedicina.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasTelemedicina.length
      : 0;

    // Consultas por status
    let consultasPorStatusQuery = supabase
      .from('consultations')
      .select('status')
      .eq('doctor_id', medico.id);
    
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      consultasPorStatusQuery = consultasPorStatusQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: consultasPorStatus } = await consultasPorStatusQuery;

    const statusCounts = consultasPorStatus?.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Consultas por tipo
    let consultasPorTipoQuery = supabase
      .from('consultations')
      .select('consultation_type')
      .eq('doctor_id', medico.id);
    
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      consultasPorTipoQuery = consultasPorTipoQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }
    
    const { data: consultasPorTipo } = await consultasPorTipoQuery;

    const tipoCounts = consultasPorTipo?.reduce((acc, c) => {
      acc[c.consultation_type] = (acc[c.consultation_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Últimas 5 consultas
    const { data: ultimasConsultas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        status,
        duration,
        duracao,
        created_at,
        consulta_inicio,
        consulta_fim,
        patients:patient_id (
          name,
          email
        ),
        medicos:doctor_id (
          name
        )
      `)
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calcular período para o gráfico
    let chartStartDate: Date;
    let chartEndDate: Date;

    if (chartPeriod === 'day' && chartDate) {
      const selectedDate = new Date(chartDate + 'T00:00:00');
      chartStartDate = new Date(selectedDate);
      chartStartDate.setHours(0, 0, 0, 0);
      chartEndDate = new Date(selectedDate);
      chartEndDate.setHours(23, 59, 59, 999);
    } else if (chartPeriod === 'week' && chartDate) {
      const selectedDate = new Date(chartDate + 'T00:00:00');
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      chartStartDate = new Date(selectedDate);
      chartStartDate.setDate(selectedDate.getDate() + diff);
      chartStartDate.setHours(0, 0, 0, 0);
      chartEndDate = new Date(chartStartDate);
      chartEndDate.setDate(chartStartDate.getDate() + 6);
      chartEndDate.setHours(23, 59, 59, 999);
    } else if (chartPeriod === 'month' && chartMonth) {
      const [yearNum, monthNum] = (chartMonth as string).split('-').map(Number);
      chartStartDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0));
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      chartEndDate = new Date(Date.UTC(yearNum, monthNum - 1, lastDay, 23, 59, 59));
    } else if (chartPeriod === 'year' && chartYear) {
      const yearNum = Number(chartYear);
      chartStartDate = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0));
      chartEndDate = yearNum === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59));
    } else {
      chartStartDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
      chartEndDate = targetYear === new Date().getFullYear()
        ? new Date()
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59));
    }

    // Buscar consultas para o gráfico
    const { data: consultasGrafico } = await supabase
      .from('consultations')
      .select('created_at, status, consultation_type')
      .eq('doctor_id', medico.id)
      .gte('created_at', chartStartDate.toISOString())
      .lte('created_at', chartEndDate.toISOString())
      .order('created_at', { ascending: true });

    // Agrupar por dia
    const TIMEZONE = 'America/Sao_Paulo';
    const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const consultasPorDia = consultasGrafico?.reduce((acc, c) => {
      const dateKey = dayKeyFormatter.format(new Date(c.created_at));
      if (!acc[dateKey]) {
        acc[dateKey] = { total: 0, presencial: 0, telemedicina: 0, concluidas: 0 };
      }
      acc[dateKey].total += 1;
      if (c.consultation_type === 'PRESENCIAL') {
        acc[dateKey].presencial += 1;
      } else {
        acc[dateKey].telemedicina += 1;
      }
      if (c.status === 'COMPLETED') {
        acc[dateKey].concluidas += 1;
      }
      return acc;
    }, {} as Record<string, any>) || {};

    const graficoConsultas = Object.entries(consultasPorDia).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Taxa de sucesso
    const totalConsultas = Object.values(statusCounts).reduce((acc, count) => acc + count, 0);
    const consultasCompletas = (statusCounts.COMPLETED || 0) + (statusCounts.VALID_SOLUCAO || 0);
    const taxaSucesso = totalConsultas > 0 
      ? (consultasCompletas / totalConsultas) * 100 
      : 0;

    // Próximas consultas
    const { data: proximasConsultas } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        consultation_type,
        created_at,
        patients:patient_id (
          name,
          email
        )
      `)
      .eq('doctor_id', medico.id)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: true })
      .limit(5);

    return res.json({
      success: true,
      data: {
        medico: {
          id: medico.id,
          name: medico.name,
          specialty: medico.specialty,
          crm: medico.crm,
          subscription_type: medico.subscription_type
        },
        estatisticas: {
          totalPacientes: totalPatients || 0,
          consultasHoje: consultasHoje || 0,
          consultasConcluidasMes: consultasConcluidasMes || 0,
          duracaoMediaSegundos: Math.round(duracaoMedia),
          duracaoMediaPresencialSegundos: Math.round(duracaoMediaPresencial),
          duracaoMediaTelemedicinaSegundos: Math.round(duracaoMediaTelemedicina),
          taxaSucesso: Math.round(taxaSucesso * 100) / 100,
          variacaoPacientes: variacaoPacientes,
          variacaoConsultas: variacaoConsultas
        },
        distribuicoes: {
          porStatus: statusCounts,
          porTipo: tipoCounts
        },
        atividades: {
          ultimasConsultas: ultimasConsultas || [],
          proximasConsultas: proximasConsultas || []
        },
        graficos: {
          consultasPorDia: graficoConsultas
        }
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Erro no endpoint GET /dashboard:', message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: message
    });
  }
}
