'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface AreaCardProps {
  title: string
  index?: number
}

export default function AreaCard({ title, index = 0 }: AreaCardProps) {
  return (
    <motion.div
      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-8 py-6 text-center shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -2,
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)"
      }}
    >
      <p className="text-[#1a365d] text-[16px] lg:text-[17px] font-semibold leading-snug">
        {title}
      </p>
    </motion.div>
  )
}
