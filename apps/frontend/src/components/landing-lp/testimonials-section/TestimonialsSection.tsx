'use client'

import React from 'react'
import TestimonialCard from './TestimonialCard'

export default function TestimonialsSection() {
  const testimonials = [
    {
      imageSrc: "/doctor-1.png",
      role: "Médico Integrativo",
      quote: "O AUTON mudou completamente minha segurança clínica. Hoje, casos que antes me travavam agora têm clareza."
    },
    {
      imageSrc: "/doctor-2.png",
      role: "Clínica Multidisciplinar",
      quote: "A integração de dados reduziu drasticamente minha tentativa e erro. Meus pacientes evoluem mais rápido."
    },
    {
      imageSrc: "/doctor-3.png",
      role: "Médico Especialista",
      quote: "Depois do AUTON, meu consultório passou a ser referência em casos complexos."
    }
  ]

  return (
    <section className="bg-[#F9FAFB] py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[28px] lg:text-[38px] font-bold text-center mb-12 lg:mb-16">
          POR QUE OS MÉDICOS AMAM O AUTON
        </h2>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              imageSrc={testimonial.imageSrc}
              role={testimonial.role}
              quote={testimonial.quote}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
