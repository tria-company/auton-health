'use client'

import React from 'react'
import AreaCard from './AreaCard'
import DecorativeDots from '../hero/DecorativeDots'

export default function AgentsSection() {
  const clinicalAreas = [
    "Metabolismo",
    "Hormônios",
    "Psiquiatria integrativa",
    "Saúde mental",
    "Neurodivergência",
    "Inflamação crônica",
    "Autoimunidade",
    "Saúde intestinal",
    "Longevidade e performance"
  ]

  return (
    <section className="relative bg-white py-16 lg:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Background Animado */}
      <DecorativeDots />

      {/* Conteúdo */}
      <div className="relative z-10 max-w-[1200px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[28px] lg:text-[38px] font-bold text-center mb-2 leading-tight">
          ABORDAGEM MULTIDISCIPLINAR INTEGRADA COM
        </h2>

        {/* Subtítulo Destacado */}
        <h3 
          className="text-[32px] lg:text-[44px] font-bold text-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #DEBB67 0%, #FDD78A 50%, #DEBB67 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          167 AGENTES DE IA
        </h3>

        {/* Texto Descritivo */}
        <p className="text-[#4a5568] text-[17px] lg:text-[19px] text-center max-w-[900px] mx-auto mb-5 leading-relaxed">
          O Auton AI é composto por <strong className="text-[#1a365d] font-semibold">167 agentes de IA especializados</strong>, organizados em camadas clínicas, cada uma responsável por uma parte do raciocínio integrativo.
        </p>

        {/* Subtexto */}
        <p className="text-[#4a5568] text-[16px] lg:text-[18px] text-center max-w-[900px] mx-auto mb-10 lg:mb-12 leading-relaxed">
          Esses agentes trabalham de forma orquestrada, como uma <strong className="text-[#1a365d] font-semibold">equipe multidisciplinar invisível</strong>, disponível 24/7 ao médico com domínio clínico em:
        </p>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 max-w-[900px] mx-auto">
          {clinicalAreas.map((area, index) => (
            <AreaCard key={index} title={area} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
