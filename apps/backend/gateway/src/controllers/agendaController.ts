import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /agenda
 * Busca consultas agendadas por ano e mês
 */
export async function getAgenda(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: 'year e month são obrigatórios'
      });
    }

    // Buscar o ID do médico
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

    // Buscar consultas do mês
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const { data: consultations, error } = await supabase
      .from('consultations')
      .select(`
        id,
        patient_name,
        patient_id,
        consultation_type,
        status,
        duration,
        created_at,
        consulta_inicio
      `)
      .eq('doctor_id', medico.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar agenda:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar agenda'
      });
    }

    // Mapear para formato esperado pelo frontend
    const items = (consultations || []).map(c => ({
      id: c.id,
      patient: c.patient_name,
      patient_id: c.patient_id,
      consultation_type: c.consultation_type,
      status: c.status,
      duration: c.duration,
      created_at: c.created_at,
      consulta_inicio: c.consulta_inicio
    }));

    return res.json({
      success: true,
      ok: true, // Para compatibilidade com código antigo
      items
    });

  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
