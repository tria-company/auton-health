'use client';

import React from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  Share,
  Brain,
  Apple,
  Pill,
  Dumbbell,
  FileText
} from 'lucide-react';

interface SolutionDetailsProps {
  solutionId: string;
  solutionData: any;
  onBack: () => void;
}

export default function SolutionDetails({ solutionId, solutionData, onBack }: SolutionDetailsProps) {

  const getSolutionInfo = () => {
    switch (solutionId) {
      case 'mentalidade':
        return {
          title: 'Livro da Vida',
          icon: <Brain className="w-8 h-8" />,
          description: 'Transformação mental e emocional'
        };
      case 'alimentacao':
        return {
          title: 'Plano Alimentar',
          icon: <Apple className="w-8 h-8" />,
          description: 'Gramaturas e proporções nutricionais'
        };
      case 'suplementacao':
        return {
          title: 'Protocolo de Suplementação',
          icon: <Pill className="w-8 h-8" />,
          description: 'Suplementos e dosagens personalizadas'
        };
      case 'exercicios':
        return {
          title: 'Programa de Exercícios',
          icon: <Dumbbell className="w-8 h-8" />,
          description: 'Treinos e atividades físicas'
        };
      default:
        return {
          title: 'Solução',
          icon: <FileText className="w-8 h-8" />,
          description: 'Detalhes da solução'
        };
    }
  };

  const solutionInfo = getSolutionInfo();

  const renderSolutionContent = () => {
    if (!solutionData) {
      return (
        <div className="no-data-message">
          <p>Nenhum dado disponível para esta solução.</p>
        </div>
      );
    }

    switch (solutionId) {
      case 'mentalidade':
        return renderMentalidadeContent(solutionData);
      case 'alimentacao':
        return renderAlimentacaoContent(solutionData);
      case 'suplementacao':
        return renderSuplementacaoContent(solutionData);
      case 'exercicios':
        return renderExerciciosContent(solutionData);
      default:
        return renderGenericContent(solutionData);
    }
  };

  const renderMentalidadeContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Objetivo Principal</h3>
        <p>{data.objetivo_principal || 'Não especificado'}</p>
      </div>

      <div className="solution-section">
        <h3>Realidade do Caso</h3>
        <p>{data.realidade_caso || 'Não especificada'}</p>
      </div>

      {data.fase1_duracao && (
        <div className="solution-section">
          <h3>Fase 1 - Estabilização</h3>
          <p><strong>Duração:</strong> {data.fase1_duracao}</p>
          <p><strong>Objetivo:</strong> {data.fase1_objetivo}</p>
        </div>
      )}

      {data.psicoterapia_modalidade && (
        <div className="solution-section">
          <h3>Psicoterapia</h3>
          <p><strong>Modalidade:</strong> {data.psicoterapia_modalidade}</p>
          <p><strong>Frequência:</strong> {data.psicoterapia_frequencia}</p>
          <p><strong>Duração da Sessão:</strong> {data.psicoterapia_duracao_sessao}</p>
        </div>
      )}

      {data.cronograma_mental_12_meses && (
        <div className="solution-section">
          <h3>Cronograma de 12 Meses</h3>
          <p>{data.cronograma_mental_12_meses}</p>
        </div>
      )}
    </div>
  );

  const renderAlimentacaoContent = (data: any[]) => {
    // Parse data if necessary (sometimes it might come as string JSON if not handled by fetch)
    const meals = data.map(item => {
      let mealData = item.data;
      if (typeof mealData === 'string') {
        try {
          mealData = JSON.parse(mealData);
        } catch (e) {
          mealData = {};
        }
      }
      return { ...item, data: mealData };
    });

    return (
      <div className="solution-content">
        <div className="solution-section">
          <h3>Plano Alimentar - Refeições</h3>
          <div className="alimentacao-list-container">
            {meals.map((meal, index) => (
              <div key={index} className="meal-card">
                <h4 className="meal-title">{meal.nome}</h4>

                {/* Principal */}
                {meal.data?.principal && meal.data.principal.length > 0 ? (
                  <div className="meal-section">
                    <h5 className="meal-subtitle">Principal</h5>
                    <ul className="meal-items-list">
                      {meal.data.principal.map((item: any, idx: number) => (
                        <li key={idx} className="meal-item">
                          <span className="item-name">{item.alimento}</span>
                          <div className="item-meta">
                            <span className="item-grams">{item.gramas ? `${item.gramas.toFixed(0)}g` : ''}</span>
                            <span className="item-category">{item.categoria}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="empty-section">Sem itens principais</p>
                )}

                {/* Substituições */}
                {meal.data?.substituicoes && Object.keys(meal.data.substituicoes).length > 0 && (
                  <div className="meal-section">
                    <h5 className="meal-subtitle">Substituições</h5>
                    <div className="substitutions-container">
                      {Object.entries(meal.data.substituicoes as Record<string, any[]>).map(([category, items], idx) => (
                        (items && items.length > 0) && (
                          <div key={idx} className="substitution-group">
                            <h6 className="substitution-category">{category.charAt(0).toUpperCase() + category.slice(1)}</h6>
                            <ul className="substitution-list">
                              {items.map((item: any, subIdx: number) => (
                                <li key={subIdx} className="substitution-item">
                                  {item.alimento} ({item.gramas ? `${item.gramas.toFixed(0)}g` : 'à v.'})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CSS inline for this specific new layout if not present in global css */}
        <style jsx>{`
          .alimentacao-list-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
          }
          .meal-card {
            background: #fff;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .meal-title {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .meal-subtitle {
            font-size: 0.9em;
            text-transform: uppercase;
            color: #7f8c8d;
            margin: 12px 0 8px;
            font-weight: 700;
          }
          .meal-items-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .meal-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .item-name {
            font-weight: 500;
          }
          .item-meta {
            display: flex;
            gap: 8px;
            font-size: 0.85em;
          }
          .item-grams {
            background: #e8f6fd;
            color: #2980b9;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .item-category {
            color: #95a5a6;
          }
          .substitution-group {
            margin-bottom: 8px;
          }
          .substitution-category {
            font-size: 0.85em;
            color: #e67e22;
            margin: 4px 0;
          }
          .substitution-list {
            list-style: disc;
            padding-left: 20px;
            margin: 0;
            font-size: 0.9em;
            color: #555;
          }
        `}</style>
      </div>
    );
  };

  const renderSuplementacaoContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Objetivo Principal</h3>
        <p>{data.objetivo_principal || 'Não especificado'}</p>
      </div>

      <div className="solution-section">
        <h3>Filosofia do Protocolo</h3>
        <p><strong>Realidade:</strong> {data.filosofia_realidade}</p>
        <p><strong>Princípio:</strong> {data.filosofia_principio}</p>
        <p><strong>Duração:</strong> {data.filosofia_duracao}</p>
      </div>

      {data.protocolo_mes1_2_lista && (
        <div className="solution-section">
          <h3>Protocolo Meses 1-2</h3>
          <p><strong>Lista:</strong> {data.protocolo_mes1_2_lista}</p>
          <p><strong>Justificativa:</strong> {data.protocolo_mes1_2_justificativa}</p>
        </div>
      )}

      {data.protocolo_mes3_6_lista && (
        <div className="solution-section">
          <h3>Protocolo Meses 3-6</h3>
          <p><strong>Lista:</strong> {data.protocolo_mes3_6_lista}</p>
          <p><strong>Justificativa:</strong> {data.protocolo_mes3_6_justificativa}</p>
        </div>
      )}
    </div>
  );

  const renderExerciciosContent = (data: any[]) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Programa de Exercícios ({data.length} exercícios)</h3>
        <div className="exercicios-grid">
          {data.map((exercicio, index) => (
            <div key={index} className="exercicio-item">
              <h4>{exercicio.nome_exercicio || `Exercício ${index + 1}`}</h4>
              <div className="exercicio-details">
                <p><strong>Tipo:</strong> {exercicio.tipo_treino}</p>
                <p><strong>Grupo Muscular:</strong> {exercicio.grupo_muscular}</p>
                <p><strong>Séries:</strong> {exercicio.series}</p>
                <p><strong>Repetições:</strong> {exercicio.repeticoes}</p>
                <p><strong>Descanso:</strong> {exercicio.descanso}</p>
                {exercicio.observacoes && <p><strong>Observações:</strong> {exercicio.observacoes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGenericContent = (data: any) => (
    <div className="solution-content">
      <div className="solution-section">
        <h3>Dados da Solução</h3>
        <pre className="data-preview">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="solution-details-container">
      <div className="solution-details-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <div className="solution-title-section">
          <div className="solution-title-icon">{solutionInfo.icon}</div>
          <div>
            <h1 className="solution-title">{solutionInfo.title}</h1>
            <p className="solution-subtitle">{solutionInfo.description}</p>
          </div>
        </div>
        <div className="solution-actions">
          <button className="action-button">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="action-button">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button className="action-button">
            <Share className="w-4 h-4" />
            Compartilhar
          </button>
        </div>
      </div>

      <div className="solution-details-content">
        {renderSolutionContent()}
      </div>
    </div>
  );
}
