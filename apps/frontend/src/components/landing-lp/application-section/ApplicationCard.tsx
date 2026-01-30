'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface ApplicationCardProps {
  icon: React.ReactNode
  title: string
  index?: number
}

export default function ApplicationCard({ icon, title, index = 0 }: ApplicationCardProps) {
  return (
    <motion.div
      className="bg-white border-2 border-[#E2E8F0] rounded-2xl p-6 lg:p-8 flex flex-col items-center justify-center gap-4 shadow-sm min-h-[160px]"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: "easeOut"
      }}
      whileHover={{
        y: -5,
        scale: 1.05,
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
      }}
    >
      {icon}
      <p className="text-[#4a5568] text-[15px] lg:text-[16px] font-medium text-center">
        {title}
      </p>
    </motion.div>
  )
}
