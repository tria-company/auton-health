'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../ui/Button'

export default function HeroContent() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!contentRef.current) return
    
    const rect = contentRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height
    
    setMousePosition({ x, y })
  }

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 })
  }

  return (
    <div 
      ref={contentRef}
      className="flex flex-col justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bloco branco com conteúdo principal */}
      <motion.div 
        className="bg-white rounded-none md:rounded-2xl p-6 md:p-10 lg:p-14 mb-6 md:mb-8 shadow-sm border-2 border-[#1a365d] -mx-6 md:mx-0"
        animate={{
          rotateX: mousePosition.y * 5,
          rotateY: mousePosition.x * 5,
          scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 150,
          damping: 15
        }}
        style={{
          transformStyle: "preserve-3d",
          transformPerspective: 1000,
        }}
      >
        {/* Título Principal */}
        <motion.h1 
          className="text-[24px] md:text-[42px] lg:text-[48px] font-bold text-[#1a365d] leading-[1.2] mb-4 md:mb-6"
          animate={{
            x: mousePosition.x * 10,
            y: mousePosition.y * 10,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 10
          }}
        >
          A 1ª IA para diagnosticar e solucionar a causa raiz de doenças crônicas, autoimunes e de saúde mental
        </motion.h1>

        {/* Parágrafo Descritivo */}
        <motion.p 
          className="text-[14px] md:text-[18px] text-[#4a5568] leading-[1.6] md:leading-[1.7]"
          animate={{
            x: mousePosition.x * 8,
            y: mousePosition.y * 8,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 10
          }}
        >
          Criada para <strong className="text-[#1a365d] font-semibold">integrar exames, sintomas e história do paciente em tempo real</strong>, estruturar o raciocínio clínico e tratar a causa raiz, com <strong className="text-[#1a365d] font-semibold">resultados previsíveis, replicáveis e escaláveis</strong>.
        </motion.p>
      </motion.div>

      {/* Texto de Credibilidade - Fora do bloco branco */}
      <motion.p 
        className="text-[13px] md:text-[16px] text-[#718096] mb-6 md:mb-8"
        animate={{
          x: mousePosition.x * 6,
          y: mousePosition.y * 6,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 10
        }}
      >
        Mais de <strong className="text-[#1a365d] font-semibold">3.000 médicos</strong> já usam o AUTON AI para tomar decisões com mais <strong className="text-[#1a365d] font-semibold">segurança e autoridade</strong>.
      </motion.p>

      {/* CTA Button */}
      <motion.div
        animate={{
          x: mousePosition.x * 5,
          y: mousePosition.y * 5,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 10
        }}
      >
        <a href="#checkout" className="block md:inline-block">
          <Button variant="primary" className="text-[14px] md:text-[16px] px-6 md:px-10 py-3 md:py-4 font-medium w-full md:w-auto">
            Inscreva-se gratuitamente e veja o AUTON AI em ação
          </Button>
        </a>
      </motion.div>
    </div>
  )
}
