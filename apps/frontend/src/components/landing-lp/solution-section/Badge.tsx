'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function Badge() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-[#E2E8F0] rounded-full mb-6 shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <span className="text-[14px] lg:text-[15px] text-[#4a5568]">
        De tentativa e erro
      </span>
      <span className="text-[#1a365d]">→</span>
      <span className="text-[14px] lg:text-[15px] text-[#1a365d] font-medium">
        para raciocínio clínico previsível
      </span>
    </motion.div>
  )
}
