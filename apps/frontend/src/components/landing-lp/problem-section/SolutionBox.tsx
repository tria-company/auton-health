'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function SolutionBox() {
  return (
    <motion.div
      className="rounded-[20px] p-8 lg:p-12 max-w-[800px] mx-auto text-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #D8DFE8 0%, #CFD7E0 33%, #C6CED8 66%, #BDC5CF 100%)'
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: 0.2,
        ease: "easeOut"
      }}
    >
      {/* Título */}
      <h3 className="text-[#1a365d] text-[28px] lg:text-[32px] font-bold leading-tight mb-4">
        O problema não é falta de conhecimento.
      </h3>

      {/* Texto Explicativo */}
      <p className="text-[#4a5568] text-[17px] lg:text-[19px] leading-relaxed">
        O problema é que{' '}
        <strong className="text-[#1a365d] font-semibold">
          a medicina moderna nunca criou um sistema
        </strong>{' '}
        para integrar complexidade biológica e pensar a causa raiz em tempo real.
      </p>
    </motion.div>
  )
}
