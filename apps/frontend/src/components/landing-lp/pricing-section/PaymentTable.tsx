'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function PaymentTable() {
  const paymentOptions = [
    {
      period: "Mensal",
      discount: "0%",
      essencial: "R$ 997/mês",
      professional: "R$ 1.497/mês",
      highlight: false
    },
    {
      period: "Trimestral",
      discount: "5%",
      essencial: "R$ 2.842 (R$ 947/mês)",
      professional: "R$ 4.277 (R$ 1.425/mês)",
      highlight: false
    },
    {
      period: "Semestral",
      discount: "10%",
      essencial: "R$ 5.382 (R$ 897/mês)",
      professional: "R$ 8.082 (R$ 1.347/mês)",
      highlight: false
    },
    {
      period: "Anual",
      discount: "15% + 1 mês grátis",
      essencial: "R$ 10.172 (R$ 763/mês)",
      professional: "R$ 15.269 (R$ 1.145/mês)",
      highlight: true
    }
  ]

  return (
    <motion.div
      className="bg-white border-2 border-[#E2E8F0] rounded-[20px] p-6 lg:p-8 max-w-[800px] mx-auto"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-[#1a365d] text-[20px] lg:text-[24px] font-bold text-center mb-6">
        Formas de Pagamento
      </h3>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[#E2E8F0]">
              <th className="text-left py-3 px-4 text-[#1a365d] font-bold text-[14px] lg:text-[15px]">
                Período
              </th>
              <th className="text-left py-3 px-4 text-[#1a365d] font-bold text-[14px] lg:text-[15px]">
                Desconto
              </th>
              <th className="text-left py-3 px-4 text-[#1a365d] font-bold text-[14px] lg:text-[15px]">
                Essencial
              </th>
              <th className="text-left py-3 px-4 text-[#1a365d] font-bold text-[14px] lg:text-[15px]">
                Professional
              </th>
            </tr>
          </thead>
          <tbody>
            {paymentOptions.map((option, index) => (
              <tr
                key={index}
                className={`border-b border-[#E2E8F0] ${
                  option.highlight ? 'bg-[#FFF9E6]' : ''
                }`}
              >
                <td className={`py-3 px-4 text-[14px] lg:text-[15px] ${
                  option.highlight ? 'text-[#1a365d] font-semibold' : 'text-[#4a5568]'
                }`}>
                  {option.period}
                </td>
                <td className={`py-3 px-4 text-[14px] lg:text-[15px] font-semibold ${
                  option.highlight ? 'text-[#DEBB67]' : 'text-[#4a5568]'
                }`}>
                  {option.discount}
                </td>
                <td className={`py-3 px-4 text-[14px] lg:text-[15px] ${
                  option.highlight ? 'text-[#DEBB67] font-semibold' : 'text-[#4a5568]'
                }`}>
                  {option.essencial}
                </td>
                <td className={`py-3 px-4 text-[14px] lg:text-[15px] ${
                  option.highlight ? 'text-[#DEBB67] font-semibold' : 'text-[#4a5568]'
                }`}>
                  {option.professional}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
