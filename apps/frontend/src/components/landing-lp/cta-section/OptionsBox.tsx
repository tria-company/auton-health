'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function OptionsBox() {
  const options = [
    {
      number: 1,
      title: "OPÇÃO 1:",
      text: "Continuar como está. Enviando PDFs por WhatsApp. Perdendo 60h/mês. Vendo 70% dos pacientes abandonarem.",
      highlighted: false
    },
    {
      number: 2,
      title: "OPÇÃO 2:",
      text: "Esperar seus concorrentes adotarem primeiro. Perder vantagem competitiva. Não ser percebido como inovador.",
      highlighted: false
    },
    {
      number: 3,
      title: "OPÇÃO 3:",
      text: "Ser o PRIMEIRO da sua região. Superioridade tecnológica imediata. Você se torna A referência.",
      highlighted: true
    }
  ]

  return (
    <motion.div
      className="rounded-[20px] p-8 lg:p-12"
      style={{
        background: 'linear-gradient(135deg, #203554 0%, #3A5685 50%, #203554 100%)'
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      {/* Título */}
      <h3 className="text-white text-[24px] lg:text-[28px] font-bold text-center mb-10">
        Você Tem 3 Opções:
      </h3>

      {/* Grid de Opções (3 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {options.map((option, index) => (
          <motion.div
            key={index}
            className={`rounded-2xl p-6 ${
              option.highlighted
                ? 'bg-[#4a5568]/30 border-2 border-[#DEBB67]'
                : 'bg-transparent'
            }`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.4,
              delay: index * 0.15
            }}
          >
            {/* Título da Opção */}
            <h4 className={`font-bold text-[16px] lg:text-[18px] mb-4 ${
              option.highlighted ? 'text-[#DEBB67]' : 'text-white'
            }`}>
              {option.title}
            </h4>

            {/* Texto da Opção */}
            <p className={`text-[14px] lg:text-[15px] leading-relaxed ${
              option.highlighted
                ? 'text-white font-medium'
                : 'text-white/80'
            }`}>
              {option.text}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
