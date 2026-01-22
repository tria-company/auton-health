import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /exames/:consultaId
 * Busca exames de uma consulta
 */
export async function getExames(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;

    const { data: exames, error } = await supabase
      .from('exames')
      .select('*')
      .eq('consultation_id', consultaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar exames:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar exames'
      });
    }

    return res.json({
      success: true,
      exames: exames || []
    });

  } catch (error) {
    console.error('Erro ao buscar exames:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /processar-exames/:consultaId
 * Processa exames de uma consulta
 */
export async function processarExames(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;
    const { exames } = req.body;

    if (!exames || !Array.isArray(exames)) {
      return res.status(400).json({
        success: false,
        error: 'exames é obrigatório e deve ser um array'
      });
    }

    // Processar cada exame
    const processedExames = [];
    for (const exame of exames) {
      // Aqui você pode adicionar lógica de processamento de IA
      // Por enquanto, apenas salva no banco
      
      const { data, error } = await supabase
        .from('exames')
        .insert({
          consultation_id: consultaId,
          ...exame,
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao processar exame:', error);
        continue;
      }

      processedExames.push(data);
    }

    return res.json({
      success: true,
      exames: processedExames,
      message: `${processedExames.length} exames processados com sucesso`
    });

  } catch (error) {
    console.error('Erro ao processar exames:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar exames'
    });
  }
}
