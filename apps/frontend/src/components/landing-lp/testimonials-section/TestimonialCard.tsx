'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface TestimonialCardProps {
  imageSrc: string
  role: string
  quote: string
  index?: number
}

export default function TestimonialCard({
  imageSrc,
  role,
  quote,
  index = 0
}: TestimonialCardProps) {
  return (
    <motion.div
      className="bg-white rounded-[20px] shadow-md overflow-hidden"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.15,
        ease: "easeOut"
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 12px 30px rgba(0,0,0,0.12)"
      }}
    >
      {/* Imagem */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        <img 
          src={imageSrc} 
          alt={role}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Conteúdo */}
      <div className="p-6 lg:p-8">
        {/* Título/Role */}
        <h3 className="text-[#1a365d] text-[17px] lg:text-[18px] font-bold mb-3">
          {role}
        </h3>

        {/* Citação */}
        <p className="text-[#4a5568] text-[15px] lg:text-[16px] leading-relaxed italic">
          "{quote}"
        </p>
      </div>
    </motion.div>
  )
}
