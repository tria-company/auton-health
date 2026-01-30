'use client'

import React from 'react'
import { motion } from 'framer-motion'
import XIcon from './XIcon'

interface ProblemCardProps {
  text: string
  index?: number
}

export default function ProblemCard({ text, index = 0 }: ProblemCardProps) {
  return (
    <motion.div
      className="bg-white border border-[#E2E8F0] rounded-xl p-5 lg:p-6 flex items-center gap-4 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}
    >
      <XIcon />
      <p className="text-[#2d3748] text-[16px] lg:text-[17px] leading-relaxed">
        {text}
      </p>
    </motion.div>
  )
}
