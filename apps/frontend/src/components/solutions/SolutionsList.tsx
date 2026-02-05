'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  AlertCircle,
  Brain,
  Apple,
  Pill,
  Dumbbell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SolutionsData {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

interface SolutionsListProps {
  consultaId: string;
  onBack: () => void;
  onSolutionSelect: (solutionId: string) => void;
  solutions?: SolutionsData | null;
  loading?: boolean;
}

interface SolutionItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  hasData: boolean;
  dataCount?: number;
}

export default function SolutionsList({ consultaId, onBack, onSolutionSelect, solutions: propSolutions, loading: propLoading }: SolutionsListProps) {
  const [solutions, setSolutions] = useState<SolutionsData | null>(propSolutions || null);
  const [loading, setLoading] = useState(propLoading !== undefined ? propLoading : true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propSolutions !== undefined) {
      setSolutions(propSolutions);
    } else {
      fetchSolutions();
    }
  }, [consultaId, propSolutions]);

  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    }
  }, [propLoading]);

  const fetchSolutions = async () => {
    try {
      setLoading(true);
      
      // Buscar todas as soluções relacionadas à consulta via Supabase
      const [ltbResult, mentalidadeResult, suplementacaoResult, habitosResult, alimentacaoResult, atividadeResult] = await Promise.all([
        supabase.from('solucoes_ltb').select('*').eq('consulta_id', consultaId).single(),
        supabase.from('solucoes_mentalidade').select('*').eq('consulta_id', consultaId).single(),
        supabase.from('solucoes_suplementacao').select('*').eq('consulta_id', consultaId).single(),
        supabase.from('solucoes_habitos_vida').select('*').eq('consulta_id', consultaId).single(),
        supabase.from('alimentacao').select('*').eq('consulta_id', consultaId),
        supabase.from('atividade_fisica').select('*').eq('consulta_id', consultaId)
      ]);

      // Montar objeto de soluções
      const solutionsData: SolutionsData = {
        ltb: ltbResult.data || null,
        mentalidade: mentalidadeResult.data || null,
        alimentacao: alimentacaoResult.data || [],
        suplementacao: suplementacaoResult.data || null,
        exercicios: atividadeResult.data || [],
        habitos: habitosResult.data || null
      };

      setSolutions(solutionsData);
    } catch (err) {
      console.error('Erro ao buscar soluções:', err);
      setError('Erro ao carregar soluções');
    } finally {
      setLoading(false);
    }
  };

  const getSolutionItems = (): SolutionItem[] => {
    if (!solutions) return [];

    return [
      {
        id: 'mentalidade',
        name: 'Livro da Vida',
        icon: <Brain className="w-8 h-8" />,
        description: 'Transformação Mental e Emocional',
        hasData: !!solutions.mentalidade,
        dataCount: solutions.mentalidade ? 1 : 0
      },
      {
        id: 'alimentacao',
        name: 'Alimentação',
        icon: <Apple className="w-8 h-8" />,
        description: 'Plano Nutricional Personalizado',
        hasData: solutions.alimentacao.length > 0,
        dataCount: solutions.alimentacao.length
      },
      {
        id: 'suplementacao',
        name: 'Suplementação',
        icon: <Pill className="w-8 h-8" />,
        description: 'Protocolo de Suplementos',
        hasData: !!solutions.suplementacao,
        dataCount: solutions.suplementacao ? 1 : 0
      },
      {
        id: 'exercicios',
        name: 'Atividade Física',
        icon: <Dumbbell className="w-8 h-8" />,
        description: 'Programa de Exercícios',
        hasData: solutions.exercicios.length > 0,
        dataCount: solutions.exercicios.length
      }
    ];
  };

  const handleSolutionClick = (solutionId: string) => {
    onSolutionSelect(solutionId);
  };

  if (loading) {
    return (
      <div className="solutions-container">
        <div className="solutions-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="solutions-title">Soluções da Consulta</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Carregando soluções...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="solutions-container">
        <div className="solutions-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="solutions-title">Soluções da Consulta</h1>
        </div>
        <div className="error-container">
          <AlertCircle className="error-icon" />
          <p>{error}</p>
          <button className="retry-button" onClick={fetchSolutions}>
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const solutionItems = getSolutionItems();

  return (
    <div className="solutions-container">
      <div className="solutions-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="solutions-title">Soluções da Consulta</h1>
      </div>

      <div className="solutions-content">
        <div className="solutions-intro">
          <h2>Entregáveis da Consulta</h2>
          <p>Selecione uma solução para visualizar os detalhes ou baixe todas em um documento Word editável.</p>
        </div>

        <div className="solutions-grid">
          {solutionItems.map((item) => (
            <div
              key={item.id}
              className={`solution-card ${item.hasData ? 'has-data' : 'no-data'}`}
              onClick={() => handleSolutionClick(item.id)}
            >
              <div className="solution-card-header">
                <div className="solution-icon">{item.icon}</div>
              </div>
              
              <div className="solution-card-content">
                <h3 className="solution-name">{item.name}</h3>
                <p className="solution-description">{item.description}</p>
                
                <div className="solution-meta">
                  {item.hasData ? (
                    <span className="data-count">
                      {item.dataCount} {item.dataCount === 1 ? 'item' : 'itens'}
                    </span>
                  ) : (
                    <span className="no-data-text">Aguardando</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {solutionItems.filter(item => item.hasData).length === 0 && (
          <div className="no-solutions-message">
            <AlertCircle className="no-solutions-icon" />
            <h3>Nenhuma solução disponível</h3>
            <p>As soluções ainda estão sendo processadas. Tente novamente em alguns minutos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
