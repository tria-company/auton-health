import { Response } from 'express';
import { supabase } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * GET /admin/dashboard
 * Dashboard administrativo com estatísticas
 */
export async function getAdminDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado'
      });
    }

    // TODO: Adicionar verificação de permissão de admin aqui

    const { year, period, chartPeriod, chartYear } = req.query;

    // Buscar estatísticas gerais
    const { data: stats, error: statsError } = await supabase
      .rpc('get_admin_dashboard_stats', {
        filter_year: year ? parseInt(year as string) : new Date().getFullYear(),
        filter_period: period as string || 'todos'
      });

    if (statsError) {
      console.error('Erro ao buscar estatísticas admin:', statsError);
    }

    // Buscar dados do gráfico
    const { data: chartData, error: chartError } = await supabase
      .rpc('get_admin_dashboard_chart', {
        chart_period: chartPeriod as string || 'month',
        chart_year: chartYear ? parseInt(chartYear as string) : new Date().getFullYear()
      });

    if (chartError) {
      console.error('Erro ao buscar dados do gráfico:', chartError);
    }

    return res.json({
      success: true,
      stats: stats || {},
      chartData: chartData || []
    });

  } catch (error) {
    console.error('Erro ao buscar dashboard admin:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}
