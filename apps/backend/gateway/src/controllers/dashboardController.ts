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

    console.log('👨‍⚕️ [DASHBOARD] Médico encontrado:', { id: medico.id, name: medico.name, authId: doctorAuthId });

    // Debug: contar TODAS as consultas do médico (sem filtro de data)
    const { count: totalConsultasSemFiltro, error: debugError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id);

    console.log('🔍 [DASHBOARD] Total consultas do médico (sem filtro de data):', totalConsultasSemFiltro, debugError ? `Erro: ${debugError.message}` : '');

    // Debug: contar consultas sem filtro de doctor_id para ver se existem no banco
    if (totalConsultasSemFiltro === 0) {
      const { count: totalGeralConsultas } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true });
      console.log('⚠️ [DASHBOARD] Total geral de consultas no banco (sem filtro de médico):', totalGeralConsultas);

      // Buscar os doctor_ids distintos para debug
      const { data: sampleConsultas } = await supabase
        .from('consultations')
        .select('doctor_id, status, created_at')
        .limit(5);
      console.log('⚠️ [DASHBOARD] Amostra de consultas no banco:', JSON.stringify(sampleConsultas));
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

    // Consultas finalizadas
    let consultasConcluidasQuery = supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', medico.id)
      .eq('consulta_finalizada', true);

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
      .eq('consulta_finalizada', true)
      .gte('created_at', inicioMesAnteriorConsultas.toISOString())
      .lte('created_at', fimMesAnteriorConsultas.toISOString());

    const variacaoConsultas = consultasConcluidasMesAnterior && consultasConcluidasMesAnterior > 0
      ? Math.round(((consultasConcluidasMes || 0) - consultasConcluidasMesAnterior) / consultasConcluidasMesAnterior * 100)
      : consultasConcluidasMes && consultasConcluidasMes > 0 ? 100 : 0;

    // Duração média das consultas
    const calcularDuracaoEmSegundos = (c: any) => {
      // 1. Tentar usar campo duration direto (em segundos)
      if (c.duration != null && c.duration !== undefined && c.duration > 0) {
        return Number(c.duration);
      }

      // 2. Tentar usar campo duracao (pode estar em minutos)
      if (c.duracao != null && c.duracao !== undefined && c.duracao > 0) {
        const duracaoValue = Number(c.duracao);
        // Se for menor que 60, provavelmente está em minutos
        return duracaoValue < 60 && duracaoValue > 0 ? duracaoValue * 60 : duracaoValue;
      }

      // 3. Tentar usar consulta_inicio e consulta_fim
      if (c.consulta_inicio && c.consulta_fim) {
        const inicio = new Date(c.consulta_inicio).getTime();
        const fim = new Date(c.consulta_fim).getTime();
        const diffSegundos = Math.max(0, Math.round((fim - inicio) / 1000));
        if (diffSegundos > 0 && diffSegundos < 86400) { // Menos de 24 horas (razoável)
          return diffSegundos;
        }
      }

      // 4. Fallback: usar created_at e updated_at para consultas COMPLETED ou PROCESSING
      if ((c.status === 'COMPLETED' || c.status === 'PROCESSING' || c.status === 'VALID_SOLUCAO') && c.created_at && c.updated_at) {
        const inicio = new Date(c.created_at).getTime();
        const fim = new Date(c.updated_at).getTime();
        const diffSegundos = Math.max(0, Math.round((fim - inicio) / 1000));
        // Só usar se for razoável (entre 30 segundos e 6 horas)
        // Aumentado o limite superior para capturar consultas mais longas
        if (diffSegundos >= 30 && diffSegundos <= 21600) {
          return diffSegundos;
        }
      }

      return 0;
    };

    // Buscar consultas com duração - incluir mais status e usar call_sessions como fallback
    // Para o cálculo de duração média, vamos buscar consultas finalizadas no período
    // IMPORTANTE: Filtrado por doctor_id para garantir que apenas consultas do médico logado sejam consideradas
    let consultasComDuracaoQuery = supabase
      .from('consultations')
      .select('id, duration, duracao, consultation_type, created_at, updated_at, consulta_inicio, consulta_fim, status, consulta_finalizada')
      .eq('doctor_id', medico.id) // ✅ FILTRO POR MÉDICO
      .eq('consulta_finalizada', true);

    // Aplicar filtro de período baseado na data real da consulta
    // Para períodos específicos, filtrar por updated_at (quando foi finalizada) ou consulta_fim
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      // Filtrar por updated_at (data de finalização) dentro do período
      consultasComDuracaoQuery = consultasComDuracaoQuery
        .gte('updated_at', startDateRange.toISOString())
        .lte('updated_at', endDateRange.toISOString());
    }

    const { data: todasConsultas, error: consultasError } = await consultasComDuracaoQuery;

    if (consultasError) {
      console.error('Erro ao buscar consultas para cálculo de duração:', consultasError);
    }

    console.log('🔍 [DASHBOARD] Consultas encontradas para cálculo de duração:', {
      medicoId: medico.id,
      medicoName: medico.name,
      totalConsultas: todasConsultas?.length || 0,
      periodo: period
    });

    // Sempre tentar buscar duração de call_sessions para complementar os dados
    let consultasComDuracao = todasConsultas?.filter(c => {
      const duracao = calcularDuracaoEmSegundos(c);
      return duracao > 0;
    }) || [];

    // Buscar duração de call_sessions para consultas que não têm duration
    // Aplicar filtro de período também nas call_sessions
    if (todasConsultas && todasConsultas.length > 0) {
      const consultationIds = todasConsultas.map(c => c.id);
      const consultasSemDuracao = todasConsultas.filter(c => {
        const duracao = calcularDuracaoEmSegundos(c);
        return duracao === 0;
      });

      if (consultasSemDuracao.length > 0) {
        // ✅ IMPORTANTE: consultationIds já está filtrado por doctor_id (vem de todasConsultas)
        // Então as call_sessions também estarão filtradas por médico indiretamente
        let callSessionsQuery = supabase
          .from('call_sessions')
          .select('consultation_id, started_at, ended_at')
          .in('consultation_id', consultationIds) // ✅ Já filtrado por médico via consultations
          .eq('status', 'ended')
          .not('started_at', 'is', null)
          .not('ended_at', 'is', null);

        // Aplicar filtro de período nas call_sessions baseado em ended_at
        // Consideramos apenas sessões que terminaram no período para ter duração válida
        if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
          // Filtrar por ended_at (quando a sessão terminou) dentro do período
          callSessionsQuery = callSessionsQuery
            .gte('ended_at', startDateRange.toISOString())
            .lte('ended_at', endDateRange.toISOString());
        }

        const { data: callSessions } = await callSessionsQuery;

        if (callSessions && callSessions.length > 0) {
          // Mapear duração de call_sessions para consultas
          const duracaoPorConsulta = new Map<string, number>();
          callSessions.forEach(session => {
            if (session.started_at && session.ended_at && session.consultation_id) {
              const inicio = new Date(session.started_at).getTime();
              const fim = new Date(session.ended_at).getTime();
              const diffSegundos = Math.max(0, Math.round((fim - inicio) / 1000));
              // Validar duração razoável (entre 30 segundos e 4 horas)
              if (diffSegundos >= 30 && diffSegundos <= 14400) {
                duracaoPorConsulta.set(session.consultation_id, diffSegundos);
              }
            }
          });

          // Adicionar duração das call_sessions às consultas que não têm
          todasConsultas.forEach(consulta => {
            const duracaoSession = duracaoPorConsulta.get(consulta.id);
            if (duracaoSession && !consulta.duration) {
              consulta.duration = duracaoSession;
            }
          });

          // Recalcular consultas com duração
          consultasComDuracao = todasConsultas.filter(c => {
            const duracao = calcularDuracaoEmSegundos(c);
            return duracao > 0;
          });
        }
      }
    }

    // Filtrar consultas finalizadas no período (validação final)
    // Isso garante que mesmo consultas com call_sessions estejam no período correto
    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      const inicioPeriodo = startDateRange.getTime();
      const fimPeriodo = endDateRange.getTime();

      consultasComDuracao = consultasComDuracao.filter(c => {
        // Priorizar consulta_fim, depois updated_at, depois created_at (para call_sessions)
        const dataFinalizacao = c.consulta_fim
          ? new Date(c.consulta_fim).getTime()
          : (c.updated_at ? new Date(c.updated_at).getTime() : new Date(c.created_at).getTime());

        // Se a consulta tem duração de call_session, ela já foi filtrada por ended_at na query
        // Então podemos confiar que está no período se passou pelos filtros anteriores
        return dataFinalizacao >= inicioPeriodo && dataFinalizacao <= fimPeriodo;
      });
    }

    const duracaoMedia = consultasComDuracao.length > 0
      ? consultasComDuracao.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasComDuracao.length
      : 0;

    const consultasPresencial = consultasComDuracao?.filter(c => c.consultation_type === 'PRESENCIAL') || [];
    const consultasTelemedicina = consultasComDuracao?.filter(c => c.consultation_type === 'TELEMEDICINA') || [];

    console.log('📊 [DASHBOARD] Cálculo de duração média:', {
      medicoId: medico.id,
      medicoNome: medico.name,
      periodo: period,
      dataInicio: startDateRange.toISOString(),
      dataFim: endDateRange.toISOString(),
      totalConsultas: todasConsultas?.length || 0,
      consultasComDuracao: consultasComDuracao.length,
      duracaoMediaSegundos: Math.round(duracaoMedia),
      duracaoMediaMinutos: Math.round(duracaoMedia / 60),
      consultasPresencial: consultasPresencial.length,
      consultasTelemedicina: consultasTelemedicina.length
    });

    const duracaoMediaPresencial = consultasPresencial.length > 0
      ? consultasPresencial.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasPresencial.length
      : 0;

    const duracaoMediaTelemedicina = consultasTelemedicina.length > 0
      ? consultasTelemedicina.reduce((acc, c) => acc + calcularDuracaoEmSegundos(c), 0) / consultasTelemedicina.length
      : 0;

    // Consultas por status, andamento e consulta_finalizada
    let consultasPorStatusQuery = supabase
      .from('consultations')
      .select('status, andamento, consulta_finalizada')
      .eq('doctor_id', medico.id);

    if (period === 'hoje' || period === '7d' || period === '15d' || period === '30d') {
      consultasPorStatusQuery = consultasPorStatusQuery
        .gte('created_at', startDateRange.toISOString())
        .lte('created_at', endDateRange.toISOString());
    }

    const { data: consultasPorStatus, error: statusError } = await consultasPorStatusQuery;

    console.log('📊 [DASHBOARD] Consultas por status:', {
      total: consultasPorStatus?.length || 0,
      periodo: period,
      startDate: startDateRange.toISOString(),
      endDate: endDateRange.toISOString(),
      error: statusError?.message
    });

    const statusCounts = consultasPorStatus?.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Contagem por andamento (NOVA, RETORNO, CANCELADO) e concluídos por andamento
    const andamentoCounts: Record<string, number> = {};
    const concluidosPorAndamento: Record<string, number> = {};
    consultasPorStatus?.forEach(c => {
      const andamento = c.andamento || 'NOVA';
      andamentoCounts[andamento] = (andamentoCounts[andamento] || 0) + 1;
      if (c.consulta_finalizada === true) {
        concluidosPorAndamento[andamento] = (concluidosPorAndamento[andamento] || 0) + 1;
      }
    });

    console.log('📊 [DASHBOARD] andamentoCounts:', JSON.stringify(andamentoCounts));
    console.log('📊 [DASHBOARD] concluidosPorAndamento:', JSON.stringify(concluidosPorAndamento));
    console.log('📊 [DASHBOARD] Amostra consultasPorStatus:', JSON.stringify(consultasPorStatus?.slice(0, 3)));

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
      .select('created_at, status, consultation_type, consulta_finalizada')
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
      if (c.consulta_finalizada === true) {
        acc[dateKey].concluidas += 1;
      }
      return acc;
    }, {} as Record<string, any>) || {};

    const graficoConsultas = Object.entries(consultasPorDia).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Taxa de sucesso (finalização)
    const totalConsultas = Object.values(statusCounts).reduce((acc, count) => acc + count, 0);
    const consultasFinalizadas = consultasPorStatus?.filter(c => c.consulta_finalizada === true).length || 0;
    const taxaSucesso = totalConsultas > 0
      ? (consultasFinalizadas / totalConsultas) * 100
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

    // --- DADOS FIXOS PARA A SEMANA ATUAL (Atendimentos na Semana) ---
    // Sempre retorna a semana atual, independente dos filtros
    const hojeSemana = new Date();
    const dayOfWeekSemana = hojeSemana.getDay(); // 0 (Domingo) a 6 (Sábado)

    // Calcular início da semana (Segunda-feira) e fim (Sábado)
    // Se hoje é Domingo (0), a segunda-feira da semana "atual" (perspectiva de trabalho) seria amanhã?
    // Ou consideramos Domingo como início? O gráfico mostra Seg-Sáb.
    // Vamos considerar semana começando no Domingo para facilitar, mas o gráfico só usa Seg-Sáb.

    const startOfWeek = new Date(hojeSemana);
    startOfWeek.setDate(hojeSemana.getDate() - dayOfWeekSemana); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
    endOfWeek.setHours(23, 59, 59, 999);

    const { data: consultasSemanaAtual } = await supabase
      .from('consultations')
      .select('created_at, status, consultation_type')
      .eq('doctor_id', medico.id)
      .gte('created_at', startOfWeek.toISOString())
      .lte('created_at', endOfWeek.toISOString());

    const dadosSemanaAtual = consultasSemanaAtual?.reduce((acc, c) => {
      const dateKey = dayKeyFormatter.format(new Date(c.created_at));
      if (!acc[dateKey]) {
        acc[dateKey] = { total: 0, presencial: 0, telemedicina: 0, concluidas: 0 };
      }
      acc[dateKey].total += 1;
      return acc;
    }, {} as Record<string, any>) || {};

    const graficoSemanaAtual = Object.entries(dadosSemanaAtual).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));

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
          porAndamento: andamentoCounts,
          concluidosPorAndamento: concluidosPorAndamento,
          porTipo: tipoCounts
        },
        atividades: {
          ultimasConsultas: ultimasConsultas || [],
          proximasConsultas: proximasConsultas || []
        },
        graficos: {
          consultasPorDia: graficoConsultas,
          atendimentosSemanaAtual: graficoSemanaAtual
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
