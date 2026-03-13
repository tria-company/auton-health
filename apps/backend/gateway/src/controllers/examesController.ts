import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /exames/:consultaId
 * Busca exames de uma consulta a partir do campo consultations.exames (text[])
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

    console.log('[getExames] Buscando exames para consulta:', consultaId);

    const { data: consultation, error } = await supabase
      .from('consultations')
      .select('exames')
      .eq('id', consultaId)
      .maybeSingle();

    if (error) {
      console.error('[getExames] Erro ao buscar exames:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar exames'
      });
    }

    if (!consultation) {
      console.warn('[getExames] Consulta não encontrada:', consultaId);
      return res.json({
        success: true,
        exames: [],
      });
    }

    // Transformar array de URLs em objetos para o frontend
    const urls: string[] = consultation.exames || [];
    const exames = urls.map((url, index) => {
      // Extrair nome do arquivo da URL
      const parts = url.split('/');
      const rawFileName = parts[parts.length - 1] || `exame_${index + 1}`;
      // Remover timestamp prefix (e.g. "1234567890_filename.pdf" -> "filename.pdf")
      const fileName = rawFileName.replace(/^\d+_/, '');
      // Extrair extensão para tipo
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const tipo = ext === 'pdf' ? 'PDF'
        : ['jpg', 'jpeg', 'png'].includes(ext) ? 'Imagem'
        : ['doc', 'docx'].includes(ext) ? 'Documento'
        : ext.toUpperCase();

      return {
        id: `${consultaId}-${index}`,
        nome: decodeURIComponent(fileName),
        dataAnexo: '', // Não temos data exata, pode ser inferido do timestamp
        tipo,
        url,
        fileName: decodeURIComponent(fileName),
      };
    });

    return res.json({
      success: true,
      exames,
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
 * POST /exames/:consultaId/link
 * Recebe URLs de arquivos já uploadados no Storage e vincula à consulta
 */
export async function linkExames(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    const { consultaId } = req.params;
    const { fileUrls } = req.body;

    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'fileUrls é obrigatório e deve ser um array não vazio'
      });
    }

    // Buscar exames atuais
    const { data: consultation, error: fetchError } = await supabase
      .from('consultations')
      .select('exames')
      .eq('id', consultaId)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar consulta:', fetchError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar consulta'
      });
    }

    if (!consultation) {
      return res.status(404).json({
        success: false,
        error: 'Consulta não encontrada'
      });
    }

    // Append sem duplicatas
    const currentExames: string[] = consultation?.exames || [];
    const newExames = [...currentExames];
    for (const url of fileUrls) {
      if (!newExames.includes(url)) {
        newExames.push(url);
      }
    }

    // Atualizar
    const { error: updateError } = await supabase
      .from('consultations')
      .update({ exames: newExames })
      .eq('id', consultaId);

    if (updateError) {
      console.error('Erro ao atualizar exames:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao vincular exames à consulta'
      });
    }

    return res.json({
      success: true,
      message: `${fileUrls.length} exame(s) vinculado(s) com sucesso`,
      totalExames: newExames.length,
    });

  } catch (error) {
    console.error('Erro ao vincular exames:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
