'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function Footer() {
  return (
    <footer 
      className="py-12 lg:py-16 px-6 lg:px-16"
      style={{
        background: 'linear-gradient(135deg, #203554 0%, #3A5685 50%, #203554 100%)'
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-8 mb-8 lg:mb-12">
          
          {/* Brand & Tagline */}
          <motion.div 
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-white text-[24px] lg:text-[28px] font-bold mb-2">
              Authon Health
            </h2>
            <p className="text-white/75 text-[14px] lg:text-[15px] max-w-[400px] leading-relaxed">
              Tecnologia de ponta para medicina integrativa de elite
            </p>
          </motion.div>

          {/* Contact Links */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-6 items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Email */}
            <a 
              href="mailto:contato@autonhealth.com.br"
              className="flex items-center gap-2.5 text-white/80 hover:text-white transition-all duration-200 group"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="group-hover:-translate-y-0.5 transition-transform"
              >
                <rect 
                  x="3" 
                  y="5" 
                  width="18" 
                  height="14" 
                  rx="2" 
                  stroke="currentColor" 
                  strokeWidth="2"
                />
                <path 
                  d="M3 7l9 6 9-6" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[14px] group-hover:underline">
                contato@autonhealth.com.br
              </span>
            </a>

            {/* Phone */}
            <a 
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-white/80 hover:text-white transition-all duration-200 group"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none"
                className="group-hover:-translate-y-0.5 transition-transform"
              >
                <path 
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[14px] group-hover:underline">
                (11) 99999-9999
              </span>
            </a>
          </motion.div>
        </div>

        {/* Copyright */}
        <motion.div 
          className="border-t border-white/10 pt-6 lg:pt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-white/60 text-[13px] lg:text-[14px]">
            © 2028 Authon Health. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
