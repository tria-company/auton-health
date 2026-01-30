'use client'

import React from 'react'
import ProblemCard from './ProblemCard'
import SolutionBox from './SolutionBox'

export default function ProblemSection() {
  const problems = [
    "Dois pacientes com o mesmo diagnóstico evoluem de forma totalmente diferente",
    "Exames 'dentro da referência' não explicam sintomas reais",
    "Falta de tempo clínico para análise causal profunda",
    "Protocolos funcionam em alguns... e falham na maioria",
    "A consulta vira tentativa e erro disfarçada de ciência",
    "E quando o caso é complexo... tudo depende da sua cabeça"
  ]

  return (
    <section className="bg-[#fafafa] py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[32px] lg:text-[42px] font-bold text-center leading-tight mb-4">
          Vamos falar do problema que ninguém resolve
        </h2>

        {/* Subtítulo */}
        <p className="text-[#4a5568] text-[18px] lg:text-[20px] text-center mb-12 lg:mb-16">
          Você já percebeu isso,{' '}
          <strong className="text-[#1a365d] font-semibold">
            mesmo que ninguém fale abertamente
          </strong>
          :
        </p>

        {/* Cards de Problemas */}
        <div className="flex flex-col gap-4 max-w-[800px] mx-auto mb-12 lg:mb-16">
          {problems.map((problem, index) => (
            <ProblemCard key={index} text={problem} index={index} />
          ))}
        </div>

        {/* Box de Solução */}
        <SolutionBox />
      </div>
    </section>
  )
}
