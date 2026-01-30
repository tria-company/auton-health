'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface LayerCardProps {
  number: number
  title: string
  subtitle: string
  icon: React.ReactNode
  items: string[]
  index?: number
}

export default function LayerCard({
  number,
  title,
  subtitle,
  icon,
  items,
  index = 0
}: LayerCardProps) {
  return (
    <motion.div
      className="bg-white border-2 border-[#E2E8F0] rounded-[24px] p-8 lg:p-10 shadow-md"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        delay: index * 0.15,
        ease: "easeOut"
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 16px 40px rgba(0,0,0,0.1)"
      }}
    >
      <div className="flex items-start gap-6 mb-6">
        {/* Ícone */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* Cabeçalho */}
        <div className="flex-1">
          <p className="text-[#FDB022] text-[13px] lg:text-[14px] font-semibold uppercase tracking-wide mb-2">
            CAMADA {number}
          </p>
          <h3 className="text-[#1a365d] text-[22px] lg:text-[26px] font-bold mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-[#4a5568] text-[16px] lg:text-[17px] font-medium">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Grid de Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-3 items-start">
            <span className="text-[#FDB022] mt-1.5 flex-shrink-0">●</span>
            <p className="text-[#4a5568] text-[15px] lg:text-[16px] leading-relaxed">
              {item}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
