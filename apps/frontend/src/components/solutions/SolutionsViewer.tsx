'use client';

import React, { useState, useEffect } from 'react';
import SolutionsList from './SolutionsList';
import SolutionDetails from './SolutionDetails';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';

interface SolutionsViewerProps {
  consultaId: string;
  onBack: () => void;
  onSolutionSelect?: (solutionType: string) => void;
  mentalidadeData?: any; // New optional prop for immediate updates
}

interface SolutionsData {
  ltb: any;
  mentalidade: any;
  alimentacao: any[];
  suplementacao: any;
  exercicios: any[];
  habitos: any;
}

export default function SolutionsViewer({ consultaId, onBack, onSolutionSelect, mentalidadeData }: SolutionsViewerProps) {
  const [solutions, setSolutions] = useState<SolutionsData | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetchSolutions();
  }, [consultaId]);

  const fetchSolutions = async () => {
    try {
      setLoading(true);

      // Buscar soluções via Gateway (que usa os nomes corretos das tabelas)
      // Tabelas reais: s_agente_mentalidade_2, s_suplementacao2, s_gramaturas_alimentares, s_exercicios_fisicos
      const [mentalidadeResult, suplementacaoResult, alimentacaoResult, atividadeResult] = await Promise.all([
        gatewayClient.get<any>(`/solucao-mentalidade/${consultaId}`),
        gatewayClient.get<any>(`/solucao-suplementacao/${consultaId}`),
        gatewayClient.get<any>(`/alimentacao/${consultaId}`),
        gatewayClient.get<any>(`/atividade-fisica/${consultaId}`)
      ]);

      // Buscar Hábitos de Vida diretamente via Supabase (tabela: s_agente_habitos_de_vida_final)
      // Nota: LTB não existe como tabela separada
      const { data: habitosData } = await supabase
        .from('s_agente_habitos_de_vida_final')
        .select('*')
        .eq('consulta_id', consultaId)
        .maybeSingle();

      // Montar objeto de soluções
      const solutionsData: SolutionsData = {
        ltb: null, // Tabela LTB não existe
        mentalidade: mentalidadeResult.mentalidade_data || null,
        alimentacao: alimentacaoResult.alimentacao_data || [],
        suplementacao: suplementacaoResult.suplementacao_data || null,
        exercicios: atividadeResult.atividade_fisica_data || [],
        habitos: habitosData || null
      };

      console.log('✅ SolutionsViewer - Dados carregados:', solutionsData);
      setSolutions(solutionsData);
    } catch (err) {
      console.error('❌ SolutionsViewer - Erro ao buscar soluções:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSolutionSelect = (solutionId: string) => {

    if (onSolutionSelect) {
      // Se há uma função onSolutionSelect, usa ela (integração com o sistema principal)
      onSolutionSelect(solutionId);
    } else {
      // Senão, usa o comportamento antigo (visualização)
      setSelectedSolution(solutionId);
    }
  };

  const handleBackToList = () => {
    setSelectedSolution(null);
  };

  const getSolutionData = () => {
    // Merge state with props (props take precedence for mentalidadeData)
    const effectiveSolutions = solutions ? {
      ...solutions,
      mentalidade: mentalidadeData || solutions.mentalidade
    } : null;

    if (!effectiveSolutions || !selectedSolution) return null;

    switch (selectedSolution) {
      case 'ltb':
        return effectiveSolutions.ltb;
      case 'mentalidade':
        return effectiveSolutions.mentalidade;
      case 'alimentacao':
        return effectiveSolutions.alimentacao;
      case 'suplementacao':
        return effectiveSolutions.suplementacao;
      case 'exercicios':
        return effectiveSolutions.exercicios;
      case 'habitos':
        return effectiveSolutions.habitos;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="solutions-container">
        <div className="solutions-header">
          <button className="back-button" onClick={onBack}>
            ← Voltar
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

  if (selectedSolution) {
    return (
      <SolutionDetails
        solutionId={selectedSolution}
        solutionData={getSolutionData()}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <SolutionsList
      consultaId={consultaId}
      onBack={onBack}
      onSolutionSelect={handleSolutionSelect}
      solutions={solutions ? {
        ...solutions,
        mentalidade: mentalidadeData || solutions.mentalidade
      } : null}
      loading={loading}
    />
  );
}
