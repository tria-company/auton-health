'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Button from '../ui/Button'

export default function VideoSection() {
  return (
    <motion.div
      className="rounded-[24px] p-8 lg:p-12 max-w-[900px] mx-auto mt-12 lg:mt-16"
      style={{
        background: 'linear-gradient(180deg, #D8DFE8 0%, #CFD7E0 33%, #C6CED8 66%, #BDC5CF 100%)'
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Título */}
      <h3 className="text-[#1a365d] text-[28px] lg:text-[32px] font-bold text-center mb-4">
        Assista ao vídeo de 3 minutos
      </h3>

      {/* Descrição */}
      <p className="text-[#4a5568] text-[16px] lg:text-[17px] text-center mb-8 leading-relaxed">
        Veja como consultas complexas se transformam em{' '}
        <strong className="text-[#1a365d] font-semibold">
          decisões clínicas claras, previsíveis e replicáveis
        </strong>
        , elevando o nível de prática médica e os resultados entregues ao paciente.
      </p>

      {/* Container do Vídeo */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-700 to-gray-900 aspect-video mb-6 group cursor-pointer">
        {/* Placeholder da imagem do vídeo */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Play button */}
          <motion.div
            className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 5v14l11-7L8 5z"
                fill="#1a365d"
              />
            </svg>
          </motion.div>
        </div>

        {/* Overlay com logo AUTON Health */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <span className="text-white text-2xl font-bold opacity-40">AUTON Health</span>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex justify-center">
        <a href="#checkout">
          <Button variant="primary" className="text-[16px] px-10 py-4 font-medium">
            Iniciar Avaliação Gratuita
          </Button>
        </a>
      </div>
    </motion.div>
  )
}
