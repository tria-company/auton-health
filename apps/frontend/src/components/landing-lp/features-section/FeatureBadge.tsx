'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function FeatureBadge() {
  return (
    <motion.div
      className="inline-flex items-center px-6 py-2.5 rounded-full shadow-sm"
      style={{
        background: 'linear-gradient(135deg, #DEBB67 0%, #FDD78A 50%, #DEBB67 100%)'
      }}
      initial={{ opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <span className="text-[13px] lg:text-[14px] text-[#1a365d] font-semibold tracking-wide">
        DESENVOLVIDO POR MÉDICOS, PARA MÉDICOS
      </span>
    </motion.div>
  )
}
