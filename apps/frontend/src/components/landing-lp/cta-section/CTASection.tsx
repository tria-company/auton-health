'use client'

import React from 'react'
import { motion } from 'framer-motion'
import ComparisonCard from './ComparisonCard'
import OptionsBox from './OptionsBox'

export default function CTASection() {
  const comparison = {
    other: {
      title: "Outras Ferramentas",
      items: [
        "Enviam PDF genéricos por WhatsApp",
        "Pacientes pedem informações em 3 dias",
        "70% abandonam o tratamento",
        "Percepção de valor baixa",
        "Impossível justificar honorários premium"
      ]
    },
    authon: {
      title: "Você com Authon",
      items: [
        "Plataforma exclusiva com dashboard",
        "Planos atualizados em tempo real",
        "85% seguem o tratamento até o fim",
        "Percepção de valor 3x maior",
        "Honorários 40-50% acima da média"
      ]
    }
  }

  return (
    <section className="bg-white py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[28px] lg:text-[38px] font-bold text-center mb-4 leading-tight">
          Outras Ferramentas Tratam Sintomas.<br />
          Você Encontra a Causa Raiz.
        </h2>

        {/* Subtítulo/Descrição */}
        <p className="text-[#4a5568] text-[16px] lg:text-[18px] text-center max-w-[800px] mx-auto mb-10 lg:mb-12 leading-relaxed">
          Se você chegou até aqui, é porque sabe que <strong className="text-[#1a365d]">resolver a causa raiz</strong> é a única forma de curar de verdade. A medicina convencional prescreve medicação para controlar sintomas. Você, com o AUTHON, <strong className="text-[#1a365d]">identifica e resolve a causa</strong>.
        </p>

        {/* Imagem Central */}
        <div className="max-w-[600px] mx-auto mb-12 lg:mb-16">
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-[20px] shadow-lg">
            <img
              src="/doctor-patient.png"
              alt="Médico mostrando tablet para paciente"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Grid de Comparação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 mb-12 lg:mb-16">
          <ComparisonCard
            title={comparison.other.title}
            items={comparison.other.items}
            isNegative={true}
            index={0}
          />
          <ComparisonCard
            title={comparison.authon.title}
            items={comparison.authon.items}
            isHighlighted={true}
            isNegative={false}
            index={1}
          />
        </div>

        {/* Box de Opções */}
        <div className="mb-12 lg:mb-16">
          <OptionsBox />
        </div>

        {/* Botão CTA Principal */}
        <div className="text-center mb-8">
          <a href="#checkout">
            <motion.button
              className="text-white text-[16px] lg:text-[18px] font-bold px-12 lg:px-16 py-4 lg:py-5 rounded-xl shadow-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #203554 0%, #3A5685 50%, #203554 100%)'
              }}
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}
              whileTap={{ scale: 0.98 }}
            >
              Começar Teste de 14 Dias — Sem Cartão de Crédito
            </motion.button>
          </a>
        </div>

        {/* Rodapé com Garantias e Contato */}
        <div className="text-center space-y-4">
          {/* Garantias */}
          <p className="text-[#4a5568] text-[14px] lg:text-[15px]">
            Sem risco <span className="mx-2">|</span> Sem compromisso <span className="mx-2">|</span> Cancele quando quiser
          </p>

          {/* Ainda tem dúvidas? */}
          <p className="text-[#1a365d] text-[15px] lg:text-[16px] font-semibold">
            Ainda tem dúvidas?
          </p>

          {/* Contatos */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-[#4a5568] text-[14px] lg:text-[15px]">
            <a 
              href="mailto:contato@autonhealth.com.br" 
              className="hover:text-[#1a365d] transition-colors"
            >
              contato@autonhealth.com.br
            </a>
            <span className="hidden sm:inline">|</span>
            <a 
              href="https://wa.me/5521971760439" 
              className="hover:text-[#1a365d] transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp: (21) 97176-0439
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
