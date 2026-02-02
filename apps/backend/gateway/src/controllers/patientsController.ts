import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { Resend } from 'resend';

/**
 * GET /patients
 * Lista todos os pacientes do médico autenticado
 */
export async function getPatients(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // Parâmetros de paginação e filtros
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const status = req.query.status as string || 'all';

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Construir query base
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('doctor_id', medico.id);

    // Aplicar filtro de status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Aplicar busca por nome, email ou CPF
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,cpf.ilike.%${search}%`);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    // Aplicar paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Executar query
    const { data: patients, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar pacientes'
      });
    }

    // Buscar status da anamnese (a_cadastro_anamnese) para cada paciente
    const patientIds = (patients || []).map((p: { id: string }) => p.id);
    const anamneseByPaciente: Record<string, { status: string }> = {};

    if (patientIds.length > 0) {
      const { data: anamneseList } = await supabase
        .from('a_cadastro_anamnese')
        .select('paciente_id, status')
        .in('paciente_id', patientIds);

      if (anamneseList) {
        for (const row of anamneseList) {
          anamneseByPaciente[row.paciente_id] = { status: row.status || 'pendente' };
        }
      }
    }

    const patientsWithAnamnese = (patients || []).map((p: { id: string;[key: string]: unknown }) => ({
      ...p,
      anamnese: anamneseByPaciente[p.id] || undefined
    }));

    // Calcular paginação
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      patients: patientsWithAnamnese,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Erro ao listar pacientes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /patients
 * Cria um novo paciente para o médico autenticado
 */
export async function createPatient(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const patientData = req.body;

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Não permitir que o cliente envie doctor_id
    const { doctor_id: _discard, user_id: _discardUser, ...body } = patientData;
    const payload = {
      ...body,
      doctor_id: medico.id
    };

    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar paciente:', insertError);
      return res.status(500).json({
        success: false,
        error: insertError.message || 'Erro ao cadastrar paciente'
      });
    }

    return res.status(201).json({
      success: true,
      patient
    });
  } catch (error) {
    console.error('Erro ao criar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /patients/:id
 * Busca um paciente específico
 */
export async function getPatientById(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar paciente
    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    return res.json({
      success: true,
      patient
    });

  } catch (error) {
    console.error('Erro ao buscar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /patients/:id/metrics
 * Retorna métricas de check-in diário do paciente (sono, atividade, alimentação, equilíbrio geral)
 */
export async function getPatientMetrics(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id: pacienteId } = req.params;
    const dias = Math.min(parseInt(req.query.dias as string) || 90, 365);
    const debug = req.query.debug === '1' || req.query.debug === 'true';

    // Buscar médico autenticado
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Verificar se paciente existe e pertence ao médico
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, doctor_id')
      .eq('id', pacienteId)
      .eq('doctor_id', medico.id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    const toNum = (v: unknown): number | null =>
      v != null && !Number.isNaN(Number(v)) ? Math.round(Number(v) * 10) / 10 : null;

    // 1a) Tabela com várias linhas por paciente (tipo_metrica + valor)
    const tableNamesMulti = (process.env.PATIENT_METRICS_TABLE_MULTI || 'patient_metrics_values,paciente_metricas_valores,metricas_paciente').split(',');
    for (const tableName of tableNamesMulti) {
      try {
        const { data: rows, error: err } = await supabase
          .from(tableName.trim())
          .select('*')
          .eq('paciente_id', pacienteId);
        if (err || !rows?.length) continue;
        const tipoKey = Object.keys(rows[0]).find(k => /tipo|type|metric|metrica|nome|name/i.test(k)) || 'tipo_metrica';
        const valorKey = Object.keys(rows[0]).find(k => /valor|value|score|media/i.test(k)) || 'valor';
        const map: Record<string, number> = {};
        for (const r of rows) {
          const tipo = String(r[tipoKey] ?? r.metric_type ?? r.tipo ?? '').toLowerCase().replace(/\s/g, '_');
          const val = toNum(r[valorKey] ?? r.value ?? r.valor);
          if (tipo && val != null) map[tipo] = val;
        }
        const sono = map['sono'] ?? map['media_sono'] ?? map['sono_media'];
        const atividade = map['atividade_fisica'] ?? map['atividade'] ?? map['media_atividade'];
        const alimentacao = map['alimentacao'] ?? map['media_alimentacao'];
        const equilibrio = map['equilibrio_geral'] ?? map['equilibrio'];
        if (sono != null || atividade != null || alimentacao != null || equilibrio != null) {
          return res.json({
            success: true,
            metrics: {
              media_sono: sono != null ? { score: sono } : null,
              atividade_fisica: atividade != null ? { score: atividade } : null,
              alimentacao: alimentacao != null ? { score: alimentacao } : null,
              equilibrio_geral: equilibrio ?? null,
              total_registros: rows.length,
              periodo_dias: dias
            }
          });
        }
      } catch {
        /* próxima tabela */
      }
    }

    // 1b) Uma linha por paciente (colunas: equilibrio_geral + sono, atividade, alimentacao)
    const tableNames = (process.env.PATIENT_METRICS_TABLE || 'patient_metrics,paciente_metricas,resumo_metricas,metricas_resumo').split(',');
    let rowMetrics: any = null;
    for (const tableName of tableNames) {
      try {
        const result = await supabase
          .from(tableName.trim())
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!result.error && result.data) {
          rowMetrics = result.data;
          break;
        }
      } catch {
        /* próxima tabela */
      }
    }

    if (rowMetrics && rowMetrics.paciente_id) {
      const firstNum = (keys: string[], obj: any = rowMetrics): number | null => {
        if (!obj || typeof obj !== 'object') return null;
        const lowerKeys = Object.keys(obj).reduce((acc, k) => { acc[k.toLowerCase()] = k; return acc; }, {} as Record<string, string>);
        for (const k of keys) {
          const key = obj[k] !== undefined ? k : lowerKeys[k.toLowerCase()];
          if (key == null) continue;
          const n = toNum(obj[key]);
          if (n != null) return n;
        }
        return null;
      };
      const byKeyContains = (sub: string, exclude?: string): number | null => {
        const lower = sub.toLowerCase();
        const excl = (exclude || '').toLowerCase();
        for (const key of Object.keys(rowMetrics)) {
          if (excl && key.toLowerCase().includes(excl)) continue;
          if (key.toLowerCase().includes(lower)) {
            const n = toNum(rowMetrics[key]);
            if (n != null) return n;
          }
        }
        return null;
      };
      const nested = rowMetrics.metricas ?? rowMetrics.metrics ?? rowMetrics.data;
      // Tabela patient_metrics (trigger calculate_patient_metrics): equilibrio_sono, equilibrio_atividade_fisica, equilibrio_alimentacao, equilibrio_geral
      const sono = firstNum(['equilibrio_sono', 'metrica_sono', 'media_sono', 'sono', 'sono_media', 'score_sono', 'avg_sono', 'media_sleep', 'pontuacao_sono', 'indice_sono', 'sono_score', 'metric_sono'], rowMetrics) ?? firstNum(['sono', 'media_sono', 'score_sono'], nested) ?? byKeyContains('sono', 'equilibrio_geral');
      const atividade = firstNum(['equilibrio_atividade_fisica', 'metrica_atividade_fisica', 'metrica_atividade', 'media_atividade_fisica', 'atividade_fisica', 'atividade', 'media_atividade', 'atividade_media', 'score_atividade', 'pontuacao_atividade', 'indice_atividade', 'metric_atividade'], rowMetrics) ?? firstNum(['atividade_fisica', 'atividade', 'media_atividade'], nested) ?? byKeyContains('atividade', 'equilibrio_geral');
      const alimentacao = firstNum(['equilibrio_alimentacao', 'metrica_alimentacao', 'media_alimentacao', 'alimentacao', 'alimentacao_media', 'score_alimentacao', 'avg_alimentacao', 'media_food', 'pontuacao_alimentacao', 'indice_alimentacao', 'metric_alimentacao'], rowMetrics) ?? firstNum(['alimentacao', 'media_alimentacao', 'score_alimentacao'], nested) ?? byKeyContains('alimentacao', 'equilibrio');
      const equilibrio = firstNum(['equilibrio_geral', 'metrica_equilibrio_geral', 'metrica_equilibrio', 'equilibrio', 'equilibrio_media', 'score_equilibrio'], rowMetrics) ?? firstNum(['equilibrio', 'equilibrio_geral'], nested) ?? byKeyContains('equilibrio');
      const body: any = {
        success: true,
        metrics: {
          media_sono: sono != null ? { score: sono } : null,
          atividade_fisica: atividade != null ? { score: atividade } : null,
          alimentacao: alimentacao != null ? { score: alimentacao } : null,
          equilibrio_geral: equilibrio,
          total_registros: rowMetrics.total_registros ?? rowMetrics.total_registros ?? null,
          periodo_dias: dias
        }
      };
      if (debug) body._debug = { colunas: Object.keys(rowMetrics), valores: rowMetrics };
      return res.json(body);
    }

    // 2) Fallback: agregar de daily_checkins com fórmulas alinhadas ao outro sistema
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];

    const { data: checkins, error: checkinsError } = await supabase
      .from('daily_checkins')
      .select('sono_qualidade, sono_tempo_horas, atividade_tempo_horas, atividade_intensidade, alimentacao_refeicoes, alimentacao_agua_litros')
      .eq('paciente_id', pacienteId)
      .gte('data_checkin', dataInicioStr)
      .order('data_checkin', { ascending: false });

    if (checkinsError) {
      console.error('Erro ao buscar check-ins:', checkinsError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas do paciente'
      });
    }

    const totalRegistros = checkins?.length ?? 0;

    if (totalRegistros === 0) {
      return res.json({
        success: true,
        metrics: {
          media_sono: null,
          atividade_fisica: null,
          alimentacao: null,
          equilibrio_geral: null,
          total_registros: 0,
          periodo_dias: dias
        }
      });
    }

    const valid = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
    const round10 = (n: number) => Math.round(n * 10) / 10;

    // Sono: outro sistema ~6.1. Escala comum 1-5 → *2 para 0-10; ou 1-10 direto
    const sonoQualidade = (checkins as any[]).map(c => c.sono_qualidade).filter(valid);
    const sonoTempo = (checkins as any[]).map(c => c.sono_tempo_horas).filter(valid);
    const avgSonoQualidade = sonoQualidade.length ? sonoQualidade.reduce((a, b) => a + b, 0) / sonoQualidade.length : null;
    const avgSonoTempo = sonoTempo.length ? sonoTempo.reduce((a, b) => a + b, 0) / sonoTempo.length : null;
    const mediaSonoScore = avgSonoQualidade != null ? round10(Math.min(10, avgSonoQualidade <= 5 ? avgSonoQualidade * 2 : avgSonoQualidade)) : null;

    // Atividade: outro sistema ~5.8. Usar apenas intensidade 1-5 → *2 para 0-10
    const ativIntensidade = (checkins as any[]).map(c => c.atividade_intensidade).filter(valid);
    const ativTempo = (checkins as any[]).map(c => c.atividade_tempo_horas).filter(valid);
    const avgAtivIntensidade = ativIntensidade.length ? ativIntensidade.reduce((a, b) => a + b, 0) / ativIntensidade.length : null;
    const avgAtivTempo = ativTempo.length ? ativTempo.reduce((a, b) => a + b, 0) / ativTempo.length : null;
    const atividadeScore = avgAtivIntensidade != null ? round10(Math.min(10, avgAtivIntensidade <= 5 ? avgAtivIntensidade * 2 : avgAtivIntensidade)) : null;

    // Alimentação: outro sistema ~7.8. Refeições (0-6) + água (0-3L) normalizado para 0-10
    const refeicoes = (checkins as any[]).map(c => c.alimentacao_refeicoes).filter(valid);
    const agua = (checkins as any[]).map(c => c.alimentacao_agua_litros).filter(valid);
    const avgRefeicoes = refeicoes.length ? refeicoes.reduce((a, b) => a + b, 0) / refeicoes.length : null;
    const avgAgua = agua.length ? agua.reduce((a, b) => a + b, 0) / agua.length : null;
    const refeicoesScore = avgRefeicoes != null ? Math.min(10, (avgRefeicoes / 6) * 10) : null;
    const aguaScore = avgAgua != null ? Math.min(10, (avgAgua / 3) * 10) : null;
    const alimentacaoScore = (refeicoesScore != null && aguaScore != null)
      ? round10((refeicoesScore + aguaScore) / 2)
      : refeicoesScore ?? aguaScore;

    // Equilíbrio geral: média dos 3 (como no outro sistema: 6.6)
    const scores = [mediaSonoScore, atividadeScore, alimentacaoScore].filter((s): s is number => s != null);
    const equilibrioGeral = scores.length ? round10(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return res.json({
      success: true,
      metrics: {
        media_sono: mediaSonoScore != null ? { score: mediaSonoScore, tempo_medio_horas: avgSonoTempo } : null,
        atividade_fisica: atividadeScore != null ? { score: atividadeScore, tempo_medio_horas: avgAtivTempo, intensidade_media: avgAtivIntensidade } : null,
        alimentacao: alimentacaoScore != null ? { score: alimentacaoScore, refeicoes_media: avgRefeicoes, agua_media_litros: avgAgua } : null,
        equilibrio_geral: equilibrioGeral,
        total_registros: totalRegistros,
        periodo_dias: dias
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar métricas do paciente:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * PUT /patients/:id
 * Atualiza um paciente existente
 */
export async function updatePatient(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const patientData = req.body;

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingPatient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Atualizar paciente
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        ...patientData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar paciente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar paciente'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient
    });

  } catch (error) {
    console.error('Erro ao atualizar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * DELETE /patients/:id
 * Remove um paciente
 */
export async function deletePatient(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar o ID do médico a partir do user_auth
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', req.user.id)
      .single();

    if (medicoError || !medico) {
      return res.status(404).json({
        success: false,
        error: 'Médico não encontrado'
      });
    }

    // Verificar se o paciente existe e pertence ao médico
    const { data: existingPatient, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('doctor_id', medico.id)
      .single();

    if (checkError || !existingPatient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Deletar paciente
    const { error: deleteError } = await supabase
      .from('patients')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar paciente:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar paciente'
      });
    }

    return res.json({
      success: true,
      message: 'Paciente deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /cadastro-anamnese/:patientId
 * Busca dados do cadastro de anamnese do paciente (peso, altura, tipo sanguíneo, etc)
 */
export async function getCadastroAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('[getCadastroAnamnese] ========== INICIANDO ==========');
    console.log('[getCadastroAnamnese] patientId:', req.params.patientId);
    console.log('[getCadastroAnamnese] user:', req.user ? 'autenticado' : 'NÃO AUTENTICADO');

    const { patientId } = req.params;

    // Buscar cadastro de anamnese
    console.log('[getCadastroAnamnese] Fazendo query no Supabase...');
    const { data: cadastro, error } = await supabase
      .from('a_cadastro_anamnese')
      .select('*')
      .eq('paciente_id', patientId)  // ← CORRIGIDO: era 'patient_id'
      .maybeSingle();

    if (error) {
      console.error('[getCadastroAnamnese] ❌ ERRO Supabase:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do cadastro',
        details: error.message
      });
    }

    console.log('[getCadastroAnamnese] ✅ Query OK - cadastro:', cadastro ? 'encontrado' : 'não encontrado (null)');

    // Se não encontrou, retorna dados vazios (não é erro)
    return res.json({
      success: true,
      cadastro: cadastro || null
    });

  } catch (error: any) {
    console.error('[getCadastroAnamnese] ❌❌ ERRO CATCH:', error);
    console.error('[getCadastroAnamnese] Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

/**
 * POST /cadastro-anamnese/:patientId
 * Atualiza ou cria cadastro de anamnese do paciente
 */
export async function updateCadastroAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('[updateCadastroAnamnese] ========== INICIANDO ==========');
    console.log('[updateCadastroAnamnese] patientId:', req.params.patientId);
    console.log('[updateCadastroAnamnese] body:', JSON.stringify(req.body, null, 2));
    console.log('[updateCadastroAnamnese] user:', req.user ? req.user.id : 'NÃO AUTENTICADO');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { patientId } = req.params;
    const cadastroData = req.body;

    // Verificar se já existe
    console.log('[updateCadastroAnamnese] Buscando cadastro existente...');
    const { data: existing, error: existingError } = await supabase
      .from('a_cadastro_anamnese')
      .select('paciente_id')
      .eq('paciente_id', patientId)
      .maybeSingle();

    if (existingError) {
      console.error('[updateCadastroAnamnese] ❌ Erro ao buscar existente:', existingError);
    }
    console.log('[updateCadastroAnamnese] Cadastro existente:', existing ? 'SIM' : 'NÃO');

    let result;
    if (existing) {
      // Atualizar
      console.log('[updateCadastroAnamnese] Atualizando cadastro...');
      const { data, error } = await supabase
        .from('a_cadastro_anamnese')
        .update({
          ...cadastroData,
          updated_at: new Date().toISOString()
        })
        .eq('paciente_id', patientId)
        .select()
        .single();

      if (error) {
        console.error('[updateCadastroAnamnese] ❌ Erro Supabase UPDATE:', JSON.stringify(error, null, 2));
        throw error;
      }
      console.log('[updateCadastroAnamnese] ✅ Atualizado com sucesso');
      result = data;
    } else {
      // Criar
      console.log('[updateCadastroAnamnese] Criando novo cadastro...');
      const { data, error } = await supabase
        .from('a_cadastro_anamnese')
        .insert({
          paciente_id: patientId,
          ...cadastroData
        })
        .select()
        .single();

      if (error) {
        console.error('[updateCadastroAnamnese] ❌ Erro Supabase INSERT:', JSON.stringify(error, null, 2));
        throw error;
      }
      console.log('[updateCadastroAnamnese] ✅ Criado com sucesso');
      result = data;
    }

    return res.json({
      success: true,
      cadastro: result
    });

  } catch (error: any) {
    console.error('[updateCadastroAnamnese] ❌❌ ERRO CATCH:', error);
    console.error('[updateCadastroAnamnese] Stack:', error?.stack);
    console.error('[updateCadastroAnamnese] Message:', error?.message);
    console.error('[updateCadastroAnamnese] Code:', error?.code);
    console.error('[updateCadastroAnamnese] Details:', error?.details);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar cadastro',
      details: error?.message || 'Erro desconhecido'
    });
  }
}

/**
 * POST /patients/:id/sync-user
 * Cria ou atualiza usuário no sistema externo e sincroniza com paciente
 */
export async function syncPatientUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const { action } = req.body; // 'create', 'activate', 'deactivate'

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Verificar se email está presente (necessário para criar usuário)
    if (!patient.email) {
      return res.status(400).json({
        success: false,
        error: 'Email do paciente é obrigatório para criar usuário'
      });
    }

    let userAuthId: string | null = patient.user_auth || null;
    let userStatus: 'active' | 'inactive' = (patient.user_status as 'active' | 'inactive') || 'inactive';

    // Variáveis para controle de email (declaradas no escopo da função)
    let emailSent = false;
    let emailError: any = null;
    let generatedPassword: string | null = null;

    // Função para gerar senha temporária segura
    const generateTemporaryPassword = (): string => {
      const length = 12;
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%&*';
      const allChars = uppercase + lowercase + numbers + special;

      let password = '';
      // Garantir pelo menos um de cada tipo
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];

      // Preencher o resto
      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }

      // Embaralhar
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    // Criar ou atualizar usuário no banco de dados (Supabase Auth)

    if (!userAuthId || action === 'create') {
      // Gerar senha temporária segura
      generatedPassword = generateTemporaryPassword();

      // Criar novo usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: patient.email!,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          name: patient.name,
          phone: patient.phone,
          cpf: patient.cpf,
          patient_id: patient.id,
          role: 'patient',
          temporary_password: true // Marcar como senha temporária
        }
      });

      if (authError || !authData.user) {
        console.error('Erro ao criar usuário no Supabase Auth:', authError);
        return res.status(500).json({
          success: false,
          error: authError?.message || 'Erro ao criar usuário no banco de dados'
        });
      }

      userAuthId = authData.user.id;
      userStatus = 'active';

      // Enviar email com credenciais
      try {
        console.log('📧 [USER] Tentando enviar email com credenciais para:', patient.email);
        await sendCredentialsEmail(patient.email!, patient.name, patient.email!, generatedPassword, true);
        emailSent = true;
        console.log('✅ [USER] Email com credenciais enviado com sucesso para:', patient.email);
      } catch (err: any) {
        emailError = err;
        console.error('❌ [USER] Erro ao enviar email com credenciais:', err);
        console.error('❌ [USER] Detalhes do erro:', {
          message: err.message,
          stack: err.stack,
          email: patient.email
        });
        // Não falhar se apenas o email não for enviado - usuário já foi criado
      }
    } else {
      // Atualizar status do usuário existente
      if (action === 'activate') {
        userStatus = 'active';
      } else if (action === 'deactivate') {
        userStatus = 'inactive';
      }

      // Atualizar metadata do usuário se necessário
      if (userAuthId) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(userAuthId, {
          user_metadata: {
            name: patient.name,
            phone: patient.phone,
            cpf: patient.cpf,
            patient_id: patient.id,
            role: 'patient',
            status: userStatus
          }
        });

        if (updateError) {
          console.warn('Aviso ao atualizar metadata do usuário:', updateError);
          // Não falhar se apenas a atualização de metadata falhar
        }
      }
    }

    // Atualizar paciente com user_auth e user_status
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        user_auth: userAuthId,
        user_status: userStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar paciente:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar paciente'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient,
      message: action === 'deactivate'
        ? 'Usuário desativado com sucesso'
        : action === 'activate'
          ? 'Usuário ativado com sucesso'
          : 'Usuário criado com sucesso',
      emailSent: emailSent || false,
      emailError: emailError ? emailError.message : null,
      password: generatedPassword || undefined // Retornar senha para debug (remover em produção se necessário)
    });

  } catch (error: any) {
    console.error('Erro ao sincronizar usuário do paciente:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * PATCH /patients/:id/user-status
 * Ativa ou desativa usuário do paciente
 */
export async function togglePatientUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;
    const { status } = req.body; // 'active' ou 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status inválido. Use "active" ou "inactive"'
      });
    }

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    if (!patient.user_auth) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui usuário criado. Crie o usuário primeiro.'
      });
    }

    // Atualizar status do usuário no Supabase Auth (banco de dados)
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(patient.user_auth, {
      user_metadata: {
        ...(patient.user_auth ? {} : {}), // Preservar metadata existente
        status: status,
        patient_id: patient.id
      }
    });

    if (updateAuthError) {
      console.warn('Aviso ao atualizar status do usuário no Auth:', updateAuthError);
      // Continuar mesmo se a atualização do Auth falhar
    }

    // Atualizar status local
    const { data: updatedPatient, error: updateError } = await supabase
      .from('patients')
      .update({
        user_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar status do usuário:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status do usuário'
      });
    }

    return res.json({
      success: true,
      patient: updatedPatient,
      message: status === 'active' ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao alterar status do usuário:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * POST /patients/:id/resend-credentials
 * Reenvia email com credenciais de acesso para o paciente
 */
export async function resendPatientCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { id } = req.params;

    // Buscar paciente
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente não encontrado'
      });
    }

    // Verificar se email está presente
    if (!patient.email) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui email cadastrado'
      });
    }

    // Verificar se usuário existe
    if (!patient.user_auth) {
      return res.status(400).json({
        success: false,
        error: 'Paciente não possui usuário criado. Crie o usuário primeiro.'
      });
    }

    // Buscar usuário no Supabase Auth para obter email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(patient.user_auth);

    if (authError || !authUser.user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado no sistema de autenticação'
      });
    }

    // Gerar nova senha temporária
    const generateTemporaryPassword = (): string => {
      const length = 12;
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%&*';
      const allChars = uppercase + lowercase + numbers + special;

      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];

      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }

      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    const newPassword = generateTemporaryPassword();

    // Atualizar senha do usuário no Supabase Auth
    const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(patient.user_auth, {
      password: newPassword,
      user_metadata: {
        ...authUser.user.user_metadata,
        temporary_password: true
      }
    });

    if (updatePasswordError) {
      console.error('Erro ao atualizar senha do usuário:', updatePasswordError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar senha do usuário'
      });
    }

    // Enviar email com novas credenciais
    let emailSent = false;
    let emailError: any = null;
    try {
      console.log('📧 [RESEND] Tentando reenviar email com credenciais para:', patient.email);
      await sendCredentialsEmail(patient.email!, patient.name, authUser.user.email!, newPassword, true);
      emailSent = true;
      console.log('✅ [RESEND] Email reenviado com sucesso para:', patient.email);
    } catch (err: any) {
      emailError = err;
      console.error('❌ [RESEND] Erro ao reenviar email:', err);
      // Não falhar completamente se apenas o email não for enviado
    }

    return res.json({
      success: true,
      message: emailSent ? 'Email com credenciais reenviado com sucesso' : 'Senha atualizada, mas email não foi enviado',
      emailSent: emailSent,
      emailError: emailError ? emailError.message : null,
      password: emailSent ? undefined : newPassword // Retornar senha apenas se email falhou
    });

  } catch (error: any) {
    console.error('Erro ao reenviar credenciais:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}

/**
 * Função auxiliar para enviar email com credenciais
 */
async function sendCredentialsEmail(
  to: string,
  patientName: string,
  userEmail: string,
  password: string,
  temporaryPassword: boolean = false
): Promise<void> {
  console.log('📧 [EMAIL] Iniciando envio de email com credenciais...');
  console.log('  - Para:', to);
  console.log('  - Nome:', patientName);
  console.log('  - RESEND_API_KEY configurado:', !!process.env.RESEND_API_KEY);

  if (!process.env.RESEND_API_KEY) {
    const error = 'RESEND_API_KEY não configurado no servidor';
    console.error('❌ [EMAIL]', error);
    throw new Error(error);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const appName = process.env.APP_NAME || 'Auton Health';
  const loginUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

  console.log('📧 [EMAIL] Configurações:');
  console.log('  - From:', fromEmail);
  console.log('  - App Name:', appName);
  console.log('  - Login URL:', loginUrl);

  // Verificar se está em modo de teste
  const isTestMode = fromEmail.includes('@resend.dev');
  console.log('📧 [EMAIL] Modo de teste:', isTestMode);

  if (isTestMode) {
    const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
    console.log('📧 [EMAIL] Email verificado para modo de teste:', verifiedEmail);
    if (to !== verifiedEmail) {
      const error = `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}. Tentando enviar para: ${to}`;
      console.error('❌ [EMAIL]', error);
      throw new Error(error);
    }
  }

  console.log('📧 [EMAIL] Enviando email via Resend...');

  const { data, error } = await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: [to],
    subject: temporaryPassword
      ? `Suas Credenciais de Acesso - ${appName} (Senha Temporária)`
      : `Suas Credenciais de Acesso - ${appName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credenciais de Acesso</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Credenciais de Acesso</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Olá <strong>${patientName}</strong>,
          </p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Sua conta de acesso ao sistema foi criada com sucesso! ${temporaryPassword ? 'Você recebeu uma <strong>senha temporária</strong> que deve ser alterada no primeiro acesso.' : ''}
          </p>
          
          <div style="background: #f9fafb; border: 2px solid #1B4266; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h2 style="color: #1B4266; margin-top: 0; font-size: 18px; margin-bottom: 15px;">📧 Suas Credenciais:</h2>
            
            <div style="margin-bottom: 15px;">
              <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">E-mail (Usuário):</strong>
              <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600;">
                ${userEmail}
              </div>
            </div>
            
            <div>
              <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Senha${temporaryPassword ? ' Temporária' : ''}:</strong>
              <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600; letter-spacing: 2px;">
                ${password}
              </div>
            </div>
          </div>
          
          ${temporaryPassword ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⚠️ Importante:</strong> Esta é uma senha temporária. Por segurança, altere sua senha no primeiro acesso ao sistema.
            </p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a 
              href="${loginUrl}/auth/login" 
              style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
              Acessar Sistema
            </a>
          </div>
          
          <div style="background: #f9fafb; border-left: 4px solid #1B4266; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
              <strong>🔒 Dicas de Segurança:</strong><br>
              • Guarde suas credenciais em local seguro<br>
              • Não compartilhe sua senha com ninguém<br>
              • Use uma senha forte e única<br>
              ${temporaryPassword ? '• Altere sua senha temporária no primeiro acesso' : ''}
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            Se você não solicitou esta conta ou tiver alguma dúvida, entre em contato com seu médico ou suporte.
          </p>
          
          <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
            Este é um email automático, por favor não responda.
          </p>
        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error('❌ [EMAIL] Erro do Resend:', error);
    console.error('❌ [EMAIL] Detalhes:', JSON.stringify(error, null, 2));
    throw new Error(error.message || 'Erro ao enviar email via Resend');
  }

  console.log('✅ [EMAIL] Email enviado com sucesso!');
  console.log('✅ [EMAIL] ID do email:', data?.id);
}
