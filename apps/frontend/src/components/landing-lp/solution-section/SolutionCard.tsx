'use client'

import React from 'react'
import { motion } from 'framer-motion'
import CheckIcon from './CheckIcon'

interface SolutionCardProps {
  text: string
  index?: number
}

export default function SolutionCard({ text, index = 0 }: SolutionCardProps) {
  return (
    <motion.div
      className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-7 flex items-center gap-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -3,
        scale: 1.02,
        boxShadow: "0 8px 20px rgba(0,0,0,0.12)"
      }}
    >
      <CheckIcon />
      <p className="text-[#2d3748] text-[16px] lg:text-[17px] leading-relaxed font-medium">
        {text}
      </p>
    </motion.div>
  )
}
