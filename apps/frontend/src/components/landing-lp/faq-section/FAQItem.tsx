'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FAQItemProps {
  question: string
  answer: string
  index?: number
}

export default function FAQItem({ question, answer, index = 0 }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOpen = () => {
    setIsOpen(!isOpen)
  }

  return (
    <motion.div
      className={`bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden cursor-pointer transition-colors ${
        isOpen ? '' : 'hover:bg-[#F9FAFB]'
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.1
      }}
    >
      {/* Área Clicável */}
      <button
        onClick={toggleOpen}
        className="w-full text-left p-6 flex items-center justify-between gap-4"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
      >
        {/* Pergunta */}
        <h3 className="text-[#1a365d] text-[16px] lg:text-[18px] font-bold leading-snug flex-1">
          {question}
        </h3>

        {/* Chevron Icon */}
        <motion.svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="flex-shrink-0"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="#4a5568"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      {/* Resposta (Expansível) */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-answer-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2">
              <p className="text-[#4a5568] text-[15px] lg:text-[16px] leading-relaxed">
                {answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
