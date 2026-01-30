'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline'
  children: React.ReactNode
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseStyles = 'font-medium text-base px-10 py-4 rounded-[30px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 relative overflow-hidden cursor-pointer'
  
  const variants = {
    primary: 'text-white focus:ring-[#1e3a5f] shadow-md',
    outline: 'bg-transparent border-2 border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white focus:ring-[#1e3a5f]'
  }

  return (
    <motion.button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 10px 30px rgba(26, 54, 93, 0.3)'
      }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      {...props}
    >
      {variant === 'primary' && (
        <motion.span 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(60, 120, 180, 1) 0%, rgba(44, 90, 138, 0.8) 40%, rgba(26, 54, 93, 1) 100%)'
          }}
          whileHover={{
            background: 'radial-gradient(circle at center, rgba(70, 130, 190, 1) 0%, rgba(54, 100, 148, 0.9) 40%, rgba(36, 64, 103, 1) 100%)'
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}
