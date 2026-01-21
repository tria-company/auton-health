import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

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
 * GET /cadastro-anamnese/:patientId
 * Busca dados do cadastro de anamnese do paciente (peso, altura, tipo sanguíneo, etc)
 */
export async function getCadastroAnamnese(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { patientId } = req.params;

    // Buscar cadastro de anamnese
    const { data: cadastro, error } = await supabase
      .from('a_cadastro_anamnese')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar cadastro de anamnese:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados do cadastro'
      });
    }

    // Se não encontrou, retorna dados vazios (não é erro)
    return res.json({
      success: true,
      cadastro: cadastro || null
    });

  } catch (error) {
    console.error('Erro ao buscar cadastro de anamnese:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
