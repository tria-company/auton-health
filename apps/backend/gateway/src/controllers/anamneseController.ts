import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /anamnese/:consultaId
 * Busca dados da anamnese de uma consulta
 */
export async function getAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;

    // Buscar dados de todas as tabelas de anamnese
    const [
      cadastro_prontuario,
      objetivos_queixas,
      historico_risco,
      observacao_clinica_lab,
      historia_vida,
      setenios_eventos,
      ambiente_contexto,
      sensacao_emocoes,
      preocupacoes_crencas,
      reino_miasma
    ] = await Promise.all([
      supabase.from('a_cadastro_prontuario').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_objetivos_queixas').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_historico_risco').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_observacao_clinica_lab_2').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_historia_vida').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_setenios_eventos').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_ambiente_contexto').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_sensacao_emocoes').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_preocupacoes_crencas').select('*').eq('consulta_id', consultaId).maybeSingle(),
      supabase.from('a_reino_miasma').select('*').eq('consulta_id', consultaId).maybeSingle()
    ]);

    // Verificar se alguma query falhou
    const errors = [
      cadastro_prontuario, objetivos_queixas, historico_risco, observacao_clinica_lab,
      historia_vida, setenios_eventos, ambiente_contexto, sensacao_emocoes,
      preocupacoes_crencas, reino_miasma
    ].filter(result => result.error);

    if (errors.length > 0) {
      console.error('Erro ao buscar anamnese:', errors[0].error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anamnese'
      });
    }

    return res.json({
      success: true,
      cadastro_prontuario: cadastro_prontuario.data,
      objetivos_queixas: objetivos_queixas.data,
      historico_risco: historico_risco.data,
      observacao_clinica_lab: observacao_clinica_lab.data,
      historia_vida: historia_vida.data,
      setenios_eventos: setenios_eventos.data,
      ambiente_contexto: ambiente_contexto.data,
      sensacao_emocoes: sensacao_emocoes.data,
      preocupacoes_crencas: preocupacoes_crencas.data,
      reino_miasma: reino_miasma.data
    });

  } catch (error) {
    console.error('Erro ao buscar anamnese:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /anamnese/:consultaId/update-field
 * Atualiza um campo específico da anamnese
 */
export async function updateAnamneseField(req: AuthenticatedRequest, res: Response) {
  try {
    console.log('[updateAnamneseField] ========== INICIANDO ==========');
    console.log('[updateAnamneseField] consultaId:', req.params.consultaId);
    console.log('[updateAnamneseField] body:', JSON.stringify(req.body, null, 2));

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;
    const { fieldPath, value } = req.body;

    // Lista de tabelas válidas de anamnese
    const validTables = [
      'a_cadastro_prontuario',
      'a_objetivos_queixas',
      'a_historico_risco',
      'a_observacao_clinica_lab_2',
      'a_historia_vida',
      'a_setenios_eventos',
      'a_ambiente_contexto',
      'a_sensacao_emocoes',
      'a_preocupacoes_crencas',
      'a_reino_miasma'
    ];

    let tableName: string;
    let fieldName: string;
    let fieldValue: any;

    if (fieldPath) {
      const parts = fieldPath.split('.');
      if (parts.length >= 2) {
        tableName = parts[0];
        fieldName = parts.slice(1).join('.');
        fieldValue = value !== undefined ? value : req.body[fieldPath];
      } else {
        return res.status(400).json({ success: false, error: 'Formato de fieldPath inválido' });
      }
    } else {
      // Parsear o body para extrair tabela e campo (formato legado)
      // Formato esperado: { "tabela.campo": "valor" }
      const updateData = req.body;
      const keys = Object.keys(updateData);
      if (keys.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar'
        });
      }

      const firstKey = keys[0];
      const keyParts = firstKey.split('.');

      if (keyParts.length >= 2) {
        tableName = keyParts[0];
        fieldName = keyParts.slice(1).join('.');
        fieldValue = updateData[firstKey];
      } else {
        return res.status(400).json({ success: false, error: 'Formato de chave inválido' });
      }
    }

    console.log('[updateAnamneseField] Tabela:', tableName);
    console.log('[updateAnamneseField] Campo:', fieldName);
    console.log('[updateAnamneseField] Valor:', typeof fieldValue === 'string' ? fieldValue.substring(0, 50) + '...' : fieldValue);

    // Validar tabela
    if (!validTables.includes(tableName)) {
      console.error('[updateAnamneseField] ❌ Tabela inválida:', tableName);
      return res.status(400).json({
        success: false,
        error: `Tabela inválida: ${tableName}`
      });
    }

    // Verificar se já existe registro para essa consulta
    console.log('[updateAnamneseField] Buscando registro existente...');
    const { data: existing, error: existingError } = await supabase
      .from(tableName)
      .select('consulta_id')
      .eq('consulta_id', consultaId)
      .maybeSingle();

    if (existingError) {
      console.error('[updateAnamneseField] ❌ Erro ao buscar:', JSON.stringify(existingError, null, 2));
    }
    console.log('[updateAnamneseField] Registro existente:', existing ? 'SIM' : 'NÃO');

    let result;
    if (existing) {
      // Atualizar
      console.log('[updateAnamneseField] Atualizando...');
      const { data, error } = await supabase
        .from(tableName)
        .update({
          [fieldName]: fieldValue
        })
        .eq('consulta_id', consultaId)
        .select()
        .single();

      if (error) {
        console.error('[updateAnamneseField] ❌ Erro UPDATE:', JSON.stringify(error, null, 2));
        throw error;
      }
      console.log('[updateAnamneseField] ✅ Atualizado com sucesso');
      result = data;
    } else {
      // Criar novo registro
      console.log('[updateAnamneseField] Criando novo...');
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          consulta_id: consultaId,
          [fieldName]: fieldValue
        })
        .select()
        .single();

      if (error) {
        console.error('[updateAnamneseField] ❌ Erro INSERT:', JSON.stringify(error, null, 2));
        throw error;
      }
      console.log('[updateAnamneseField] ✅ Criado com sucesso');
      result = data;
    }

    return res.json({
      success: true,
      anamnese: result
    });

  } catch (error: any) {
    console.error('[updateAnamneseField] ❌❌ ERRO:', error?.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar anamnese',
      details: error?.message || 'Erro desconhecido'
    });
  }
}

/**
 * GET /anamnese-inicial
 * Busca anamnese inicial do paciente (tabela a_cadastro_anamnese, coluna paciente_id)
 */
export async function getAnamneseInicial(req: AuthenticatedRequest, res: Response) {
  try {
    // Rota pública - paciente não está logado
    const { patient_id } = req.query;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id é obrigatório'
      });
    }

    // Buscar anamnese e dados do paciente em paralelo
    const [anamneseResult, patientResult] = await Promise.all([
      supabase
        .from('a_cadastro_anamnese')
        .select('*')
        .eq('paciente_id', patient_id)
        .maybeSingle(),
      supabase
        .from('patients')
        .select('id, name, email, cpf, gender, birth_date, user_auth')
        .eq('id', patient_id)
        .maybeSingle(),
    ]);

    if (anamneseResult.error) {
      console.error('Erro ao buscar anamnese inicial:', anamneseResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar anamnese inicial'
      });
    }

    // Se não houver anamnese ainda, pré-popular com dados do paciente
    let anamnese = anamneseResult.data;
    if (!anamnese && patientResult.data) {
      const p = patientResult.data;
      anamnese = {
        nome_completo: p.name || '',
        email: p.email || '',
        cpf: p.cpf || '',
        genero: p.gender || '',
        data_nascimento: p.birth_date || '',
      };
    }

    // Email bloqueado se já existe user auth criado para o paciente
    const emailLocked = Boolean(patientResult.data?.user_auth);

    return res.json({
      success: true,
      anamnese: anamnese || null,
      emailLocked,
    });

  } catch (error) {
    console.error('Erro ao buscar anamnese inicial:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /anamnese/anamnese-inicial/save
 * Salva anamnese inicial do paciente:
 * 1. Upsert na tabela a_cadastro_anamnese
 * 2. Atualiza dados correspondentes na tabela patients
 */
export async function saveAnamneseInicial(req: AuthenticatedRequest, res: Response) {
  try {
    // Rota pública - paciente não está logado
    const { paciente_id, ...formData } = req.body;

    if (!paciente_id) {
      return res.status(400).json({
        success: false,
        error: 'paciente_id é obrigatório'
      });
    }

    // 1. Whitelist de campos permitidos para a_cadastro_anamnese
    const allowedAnamneseKeys = [
      'nome_completo', 'cpf', 'email', 'genero', 'data_nascimento', 'idade', 'tipo_saguineo',
      'estado_civil', 'profissao', 'altura', 'peso_atual', 'peso_antigo', 'peso_desejado',
      'objetivo_principal', 'patrica_atividade_fisica', 'frequencia_deseja_treinar',
      'restricao_movimento', 'informacoes_importantes', 'NecessidadeEnergeticaDiaria',
      'proteinas', 'carboidratos', 'vegetais', 'legumes', 'leguminosas', 'gorduras', 'frutas',
    ];

    const anamnesePayload: Record<string, unknown> = {
      paciente_id,
      status: 'preenchida',
      updated_at: new Date().toISOString(),
    };
    for (const key of allowedAnamneseKeys) {
      if (Object.prototype.hasOwnProperty.call(formData, key)) {
        anamnesePayload[key] = formData[key];
      }
    }

    // Upsert na a_cadastro_anamnese (insert se não existe, update se já existe)
    const { error: anamneseError } = await supabase
      .from('a_cadastro_anamnese')
      .upsert(anamnesePayload, { onConflict: 'paciente_id' });

    if (anamneseError) {
      console.error('[saveAnamneseInicial] Erro ao salvar anamnese:', anamneseError);
      return res.status(500).json({
        success: false,
        error: `Erro ao salvar anamnese: ${anamneseError.message}`
      });
    }

    // 2. Atualizar tabela patients com dados correspondentes
    const patientUpdate: Record<string, unknown> = {};

    if (formData.nome_completo) patientUpdate.name = formData.nome_completo;
    if (formData.cpf) patientUpdate.cpf = formData.cpf;
    if (formData.email) patientUpdate.email = formData.email;
    if (formData.genero) {
      // Mapear genero do form para o formato da tabela patients (M/F/O)
      const genderMap: Record<string, string> = {
        'Masculino': 'M',
        'Feminino': 'F',
        'Outro': 'O',
      };
      patientUpdate.gender = genderMap[formData.genero] || formData.genero;
    }
    if (formData.data_nascimento) {
      // Converter DD/MM/AAAA para YYYY-MM-DD (formato date do PostgreSQL)
      const parts = formData.data_nascimento.split('/');
      if (parts.length === 3) {
        patientUpdate.birth_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    if (Object.keys(patientUpdate).length > 0) {
      const { error: patientError } = await supabase
        .from('patients')
        .update(patientUpdate)
        .eq('id', paciente_id);

      if (patientError) {
        console.error('[saveAnamneseInicial] Erro ao atualizar paciente:', patientError);
        // Não retornar erro — a anamnese já foi salva
        console.warn('[saveAnamneseInicial] Anamnese salva mas paciente não atualizado');
      }
    }

    return res.json({
      success: true,
      message: 'Anamnese salva com sucesso'
    });

  } catch (error) {
    console.error('[saveAnamneseInicial] Erro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
