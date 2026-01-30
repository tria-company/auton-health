'use client'

import React from 'react'
import FeatureCard from './FeatureCard'
import FeatureBadge from './FeatureBadge'
import { DocumentIcon, DiagnosticIcon, TelemedIcon, BrainAIIcon, BookIcon, ToolIcon } from './FeatureIcons'

export default function FeaturesSection() {
  const features = [
    {
      number: 1,
      title: "ANÁLISE FUNCIONAL DE EXAMES LABORATORIAIS",
      icon: <DocumentIcon />,
      benefits: [
        "Correlação entre múltiplos biomarcadores (isolados e em conjunto)",
        "Identificação de padrões ocultos (inflamação silenciosa, resistência imunológica, disfunções hormonais, eixos intestino-cérebro, mitocôndria)",
        "Detecção de causas raiz que passariam despercebidas na análise tradicional"
      ],
      immediateResults: {
        title: "Resultado imediato:",
        items: [
          "Redução de 70~80% do tempo gasto analisando exames",
          "Clareza sobre o que tratar primeiro"
        ]
      }
    },
    {
      number: 2,
      title: "MÉTODO ADS CODIFICADO (Análise → Diagnóstico → Solução)",
      icon: <DiagnosticIcon />,
      benefits: [
        "Anamnese integrativa estruturada (física, metabólica, emocional, comportamental)",
        "Raciocínio clínico estruturado, replicável e ensinável",
        "Guias inteligentes que conduzem o raciocínio clínico",
        "Padronização do pensamento integrativo sem engessar a consulta",
        "Priorização do que tratar primeiro (ordem terapêutica correta)"
      ]
    },
    {
      number: 3,
      title: "TELEMEDICINA COM IA PARA APOIO À DECISÃO CLÍNICA",
      icon: <TelemedIcon />,
      benefits: [
        "Telemedicina integrada ao AUTON AI",
        "O prontuário é preenchido automaticamente",
        "Os agentes analisam dados em tempo real"
      ],
      highlights: [
        "Menos burocracia",
        "Mais foco no paciente"
      ]
    },
    {
      number: 4,
      title: "DIAGNÓSTICO DA CAUSA RAIZ ASSISTIDO POR IA (COPILOT CLÍNICO)",
      icon: <BrainAIIcon />,
      benefits: [
        "Copilot em tempo real durante a consulta",
        "Sugestão de hipóteses diagnósticas integrativas",
        "Insights clínicos baseados em exames, sintomas e histórico"
      ],
      immediateResults: {
        title: "Resultado imediato:",
        items: [
          "Decisões clínicas mais rápidas e seguras",
          "Redução de vieses cognitivos",
          "Personalização real do tratamento"
        ]
      }
    },
    {
      number: 5,
      title: "BASE DE CONHECIMENTO APLICADA",
      icon: <BookIcon />,
      benefits: [
        "Digite sua pergunta receba recomendações instantâneas e claras",
        "Ajuda você a criar estratégias de atendimento em minutos",
        "Protocolos atualizados com base em estudo de caso"
      ],
      immediateResults: {
        title: "Resultado imediato:",
        items: [
          "Conhecimento prático (não teórico)",
          "Capacidade de aplicar no mesmo dia"
        ]
      }
    },
    {
      number: 6,
      title: "SOLUÇÕES TERAPÊUTICAS PERSONALIZADAS",
      icon: <ToolIcon />,
      benefits: [
        "Protocolos com base em: Evidência científica, Experiência clínica real, Visão sistêmica do paciente",
        "Sugestão de intervenções integradas",
        "Construção de planos de tratamento da causa raiz",
        "Sempre respeitando escopo legal, segurança e personalização"
      ]
    }
  ]

  return (
    <section id="funcionalidades" className="bg-white py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Badge no topo */}
        <div className="flex justify-center mb-6">
          <FeatureBadge />
        </div>

        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[32px] lg:text-[40px] font-bold text-center mb-12 lg:mb-16">
          O que o AUTON AI entrega na prática
        </h2>

        {/* Cards de Funcionalidades */}
        <div className="flex flex-col gap-6 max-w-[900px] mx-auto">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              number={feature.number}
              title={feature.title}
              icon={feature.icon}
              benefits={feature.benefits}
              immediateResults={feature.immediateResults}
              highlights={feature.highlights}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
