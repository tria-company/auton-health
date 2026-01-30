'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface PricingCardProps {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  buttonText: string
  buttonAction: string
  isPopular?: boolean
  index?: number
}

export default function PricingCard({
  name,
  price,
  period,
  description,
  features,
  buttonText,
  buttonAction,
  isPopular = false,
  index = 0
}: PricingCardProps) {
  return (
    <motion.div
      className={`relative bg-white rounded-[24px] p-8 shadow-lg ${
        isPopular ? 'border-2 border-[#DEBB67]' : 'border-2 border-[#E2E8F0]'
      }`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 16px 40px rgba(0,0,0,0.12)"
      }}
    >
      {/* Badge "MAIS POPULAR" */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-[#1a365d] text-white text-[11px] font-bold uppercase px-4 py-1.5 rounded-full">
            MAIS POPULAR
          </span>
        </div>
      )}

      {/* Nome do Plano */}
      <h3 className="text-[#1a365d] text-[20px] lg:text-[22px] font-bold mb-3">
        {name}
      </h3>

      {/* Preço */}
      <div className="mb-2">
        <span className="text-[#1a365d] text-[40px] lg:text-[48px] font-bold leading-none">
          R$
        </span>
        <span className="text-[#1a365d] text-[40px] lg:text-[48px] font-bold leading-none ml-1">
          {price}
        </span>
        <span className="text-[#4a5568] text-[18px] font-normal">
          {period}
        </span>
      </div>

      {/* Descrição */}
      <p className="text-[#4a5568] text-[14px] lg:text-[15px] mb-6">
        {description}
      </p>

      {/* Lista de Features */}
      <ul className="space-y-3 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex gap-3 items-start">
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              className="flex-shrink-0 mt-0.5"
            >
              <path 
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                stroke={isPopular ? "#1a365d" : "#94A3B8"} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[#4a5568] text-[14px] lg:text-[15px] leading-relaxed">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* Botão CTA */}
      <motion.button
        className={`w-full py-3.5 px-6 rounded-xl font-semibold text-[15px] transition-all ${
          isPopular
            ? 'bg-[#1a365d] text-white hover:bg-[#2c5282]'
            : 'border-2 border-[#1a365d] text-[#1a365d] hover:bg-[#1a365d] hover:text-white'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {buttonText}
      </motion.button>
    </motion.div>
  )
}
