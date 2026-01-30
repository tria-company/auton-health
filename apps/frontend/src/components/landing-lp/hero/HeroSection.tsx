import React from 'react'
import HeroContent from './HeroContent'
import HeroImage from './HeroImage'
import DecorativeDots from './DecorativeDots'

export default function HeroSection() {
  return (
    <section className="relative bg-[#fafafa] pt-[74px] pb-20 lg:pb-28 px-12 lg:px-16 overflow-hidden">
      {/* Background decorativo */}
      <DecorativeDots />
      
      {/* Conteúdo principal */}
      <div className="relative max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Coluna Esquerda - Conteúdo */}
          <div className="relative z-10">
            <HeroContent />
          </div>

          {/* Coluna Direita - Imagem */}
          <div className="relative z-10">
            <HeroImage />
          </div>
        </div>
      </div>
    </section>
  )
}
