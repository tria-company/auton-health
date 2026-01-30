'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../ui/Button'

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }
  return (
    <header className="fixed top-0 left-0 right-0 bg-white z-50 border-b border-[#e5e7eb]">
      <div className="max-w-[1400px] mx-auto px-12 lg:px-16 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          className="flex items-center gap-2.5"
          whileHover={{ scale: 1.05, x: 5 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <motion.div 
            className="h-9 flex items-center"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.3 }}
          >
            <img 
              src="/logo-auton.png" 
              alt="Auton Health" 
              className="h-9 w-auto"
            />
          </motion.div>
          <div className="flex items-baseline gap-1">
            <span className="text-[#1a365d] font-bold text-[20px]">AUTON</span>
            <span className="text-[#94a3b8] font-normal text-[20px]">Health</span>
          </div>
        </motion.div>

        {/* Botão Hamburger - Mobile Only */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden flex flex-col gap-1.5 w-8 h-8 items-center justify-center"
          aria-label="Menu"
        >
          <motion.span
            className="w-6 h-0.5 bg-[#1a365d] rounded-full"
            animate={isMobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.span
            className="w-6 h-0.5 bg-[#1a365d] rounded-full"
            animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.span
            className="w-6 h-0.5 bg-[#1a365d] rounded-full"
            animate={isMobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3 }}
          />
        </button>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-9">
          <motion.a 
            href="https://pacientes.autonhealth.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2c3e50] text-[15px] font-medium hover:text-[#1a365d] transition-colors duration-300 relative group"
            whileHover={{ y: -2, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Área do Paciente
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1a365d] transition-all duration-300 group-hover:w-full"></span>
          </motion.a>
          <motion.a 
            href="#funcionalidades" 
            className="text-[#2c3e50] text-[15px] font-medium hover:text-[#1a365d] transition-colors duration-300 relative group"
            whileHover={{ y: -2, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Funcionalidades
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1a365d] transition-all duration-300 group-hover:w-full"></span>
          </motion.a>
          <motion.a 
            href="#checkout" 
            className="text-[#2c3e50] text-[15px] font-medium hover:text-[#1a365d] transition-colors duration-300 relative group"
            whileHover={{ y: -2, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Planos
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1a365d] transition-all duration-300 group-hover:w-full"></span>
          </motion.a>
          <motion.div
            whileHover={{ scale: 1.08, y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <a href="/auth/signin">
              <Button variant="outline" className="px-5 py-2 text-[14px] rounded-md font-medium">
                Entrar
              </Button>
            </a>
          </motion.div>
        </nav>

        {/* Overlay - Mobile Only */}
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileMenu}
          />
        )}

        {/* Mobile Menu Drawer */}
        <motion.div
          className={`fixed top-0 right-0 h-full w-[280px] bg-white shadow-2xl z-50 md:hidden ${
            isMobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          initial={{ x: '100%' }}
          animate={{ x: isMobileMenuOpen ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex flex-col h-full">
            {/* Header do Drawer */}
            <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb]">
              <span className="text-[#1a365d] font-bold text-[18px]">Menu</span>
              <button
                onClick={closeMobileMenu}
                className="w-8 h-8 flex items-center justify-center"
                aria-label="Fechar menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="#1a365d"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Links de Navegação */}
            <nav className="flex flex-col p-6 gap-6">
              <a
                href="https://pacientes.autonhealth.com.br"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                className="text-[#2c3e50] text-[16px] font-medium hover:text-[#1a365d] transition-colors py-2 border-b border-[#e5e7eb]"
              >
                Área do Paciente
              </a>
              <a
                href="#funcionalidades"
                onClick={closeMobileMenu}
                className="text-[#2c3e50] text-[16px] font-medium hover:text-[#1a365d] transition-colors py-2 border-b border-[#e5e7eb]"
              >
                Funcionalidades
              </a>
              <a
                href="#checkout"
                onClick={closeMobileMenu}
                className="text-[#2c3e50] text-[16px] font-medium hover:text-[#1a365d] transition-colors py-2 border-b border-[#e5e7eb]"
              >
                Planos
              </a>
              
              {/* Botão Entrar - link para login existente do app */}
              <a href="/auth/signin" className="mt-4">
                <Button variant="outline" className="w-full px-5 py-3 text-[15px] rounded-md font-medium">
                  Entrar
                </Button>
              </a>
            </nav>
          </div>
        </motion.div>
      </div>
      <div className="h-[2px] w-full bg-[#1a365d]" />
    </header>
  )
}
