'use client'

import React from 'react'
import SolutionCard from './SolutionCard'
import Badge from './Badge'
import DecorativeDots from '../hero/DecorativeDots'

export default function SolutionSection() {
  const solutions = [
    "Integrar dados clínicos fragmentados",
    "Estruturar o raciocínio médico em tempo real",
    "Revelar padrões fisiopatológicos invisíveis",
    "Construir tratamentos personalizados da causa raiz"
  ]

  return (
    <section className="relative bg-white py-16 lg:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Background com bolinhas animadas */}
      <DecorativeDots />

      {/* Conteúdo principal */}
      <div className="relative z-10 max-w-[1200px] mx-auto">
        {/* Badge no topo */}
        <div className="flex justify-center mb-8">
          <Badge />
        </div>

        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[32px] lg:text-[42px] font-bold text-center leading-tight mb-12 lg:mb-16">
          O AUTON REVOLUCIONA O ATENDIMENTO CLÍNICO AO
        </h2>

        {/* Cards de Solução */}
        <div className="flex flex-col gap-4 max-w-[800px] mx-auto">
          {solutions.map((solution, index) => (
            <SolutionCard key={index} text={solution} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
