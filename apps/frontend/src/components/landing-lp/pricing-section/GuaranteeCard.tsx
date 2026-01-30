'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface GuaranteeCardProps {
  title: string
  description: string
  index?: number
}

export default function GuaranteeCard({
  title,
  description,
  index = 0
}: GuaranteeCardProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center max-w-[280px] mx-auto"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.15
      }}
    >
      {/* Ícone Check Circle Dourado */}
      <div className="w-16 h-16 mb-4 flex items-center justify-center">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#FFF9E6"/>
          <circle cx="12" cy="12" r="10" stroke="#DEBB67" strokeWidth="2"/>
          <path 
            d="M9 12l2 2 4-4" 
            stroke="#DEBB67" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Título */}
      <h4 className="text-[#1a365d] text-[17px] lg:text-[18px] font-bold mb-2">
        {title}
      </h4>

      {/* Descrição */}
      <p className="text-[#4a5568] text-[14px] lg:text-[15px] leading-relaxed">
        {description}
      </p>
    </motion.div>
  )
}
