'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface ComparisonCardProps {
  title: string
  items: string[]
  isHighlighted?: boolean
  isNegative?: boolean
  index?: number
}

export default function ComparisonCard({
  title,
  items,
  isHighlighted = false,
  isNegative = false,
  index = 0
}: ComparisonCardProps) {
  return (
    <motion.div
      className={`bg-white rounded-[20px] p-7 lg:p-8 shadow-md ${
        isHighlighted ? 'border-2 border-[#DEBB67]' : 'border-2 border-[#E2E8F0]'
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.15
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 12px 30px rgba(0,0,0,0.1)"
      }}
    >
      {/* Título do Card */}
      <h3 className="text-[#1a365d] text-[18px] lg:text-[20px] font-bold mb-6">
        {title}
      </h3>

      {/* Lista de Items */}
      <ul className="space-y-4">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-3 items-start">
            {/* Ícone X (negativo) ou Check (positivo) */}
            {isNegative ? (
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="flex-shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" fill="#FEE2E2"/>
                <path 
                  d="M15 9l-6 6M9 9l6 6" 
                  stroke="#EF4444" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="flex-shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" fill="#DCFCE7"/>
                <path 
                  d="M9 12l2 2 4-4" 
                  stroke="#10B981" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            )}
            
            <span className="text-[#4a5568] text-[15px] lg:text-[16px] leading-relaxed">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
