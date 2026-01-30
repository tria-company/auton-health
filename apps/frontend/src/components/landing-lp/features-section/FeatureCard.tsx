'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface FeatureCardProps {
  number: number
  title: string
  icon: React.ReactNode
  benefits: string[]
  immediateResults?: {
    title: string
    items: string[]
  }
  highlights?: string[]
  index?: number
}

export default function FeatureCard({
  number,
  title,
  icon,
  benefits,
  immediateResults,
  highlights,
  index = 0
}: FeatureCardProps) {
  return (
    <motion.div
      className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 lg:p-8 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 12px 30px rgba(0,0,0,0.1)"
      }}
    >
      <div className="flex gap-4 lg:gap-6">
        {/* Ícone */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* Conteúdo */}
        <div className="flex-1">
          {/* Título com número */}
          <h3 className="text-[#1a365d] text-[18px] lg:text-[20px] font-bold mb-4 leading-tight">
            {number} {title}
          </h3>

          {/* Lista de benefícios */}
          <ul className="space-y-3 mb-4">
            {benefits.map((benefit, idx) => (
              <li key={idx} className="flex gap-3 text-[#4a5568] text-[15px] lg:text-[16px] leading-relaxed">
                <span className="text-[#cbd5e1] mt-1 flex-shrink-0">○</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Highlights em amarelo (opcional) */}
          {highlights && highlights.length > 0 && (
            <div className="mt-4 space-y-2">
              {highlights.map((highlight, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-[#FDB022] text-[15px] lg:text-[16px] font-medium">
                    {highlight}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Resultado imediato (opcional) */}
          {immediateResults && (
            <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
              <p className="text-[#1a365d] font-semibold text-[15px] mb-3">
                {immediateResults.title}
              </p>
              <ul className="space-y-2">
                {immediateResults.items.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-[#4a5568] text-[14px] lg:text-[15px]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" fill="#FDB022" opacity="0.2"/>
                      <path d="M9 12l2 2 4-4" stroke="#FDB022" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
