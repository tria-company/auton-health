'use client'

import React from 'react'
import LayerCard from './LayerCard'
import { AnalysisIcon, DiagnosticIcon, SolutionsIcon } from './LayerIcons'
import DecorativeDots from '../hero/DecorativeDots'

export default function ADSMethodSection() {
  const layers = [
    {
      number: 1,
      title: "ANÁLISE (ADS | A)",
      subtitle: "Mapear a realidade biológica do paciente",
      icon: <AnalysisIcon />,
      items: [
        "Anamnese inteligente adaptativa",
        "Análise de sintomas por sistemas",
        "Leitura e interpretação de exames laboratoriais",
        "Análise de histórico médico e medicamentoso",
        "Avaliação de estilo de vida (sono, estresse, nutrição, atividade física)",
        "Análise de microbioma, inflamação, metabolismo, hormônios (quando disponível)"
      ]
    },
    {
      number: 2,
      title: "DIAGNÓSTICO DA CAUSA RAIZ (ADS | D)",
      subtitle: "Conectar os pontos invisíveis",
      icon: <DiagnosticIcon />,
      items: [
        "Correlação intestino-cérebro-hormônios-imunidade",
        "Identificação de padrões inflamatórios",
        "Hipóteses de disfunções mitocondriais",
        "Avaliação de resistência insulínica oculta",
        "Neuroinflamação e eixo HPA",
        "Diagnóstico funcional (não apenas CID)"
      ]
    },
    {
      number: 3,
      title: "SOLUÇÕES PERSONALIZADAS (ADS | S)",
      subtitle: "Transformar diagnóstico em plano de ação clínico",
      icon: <SolutionsIcon />,
      items: [
        "Sugestão de tratamentos inovadores",
        "Combinação inteligente de: nutrição funcional, suplementação, Fitoterapia, hormônios, peptídeos, injetáveis, soroterapia",
        "Ajustes conforme: idade, comorbidades, exames, objetivos do paciente",
        "Planos de curto, médio e longo prazo"
      ]
    }
  ]

  return (
    <section className="relative bg-white py-16 lg:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Background Animado */}
      <DecorativeDots />

      {/* Conteúdo */}
      <div className="relative z-10 max-w-[1100px] mx-auto">
        {/* Cards das Camadas */}
        <div className="flex flex-col gap-6 lg:gap-8">
          {layers.map((layer, index) => (
            <LayerCard
              key={index}
              number={layer.number}
              title={layer.title}
              subtitle={layer.subtitle}
              icon={layer.icon}
              items={layer.items}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
