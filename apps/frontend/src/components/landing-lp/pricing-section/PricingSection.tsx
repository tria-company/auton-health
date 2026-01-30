'use client'

import React from 'react'
import PricingCard from './PricingCard'
import PaymentTable from './PaymentTable'
import GuaranteeCard from './GuaranteeCard'
import DecorativeDots from '../hero/DecorativeDots'

export default function PricingSection() {
  const plans = [
    {
      name: "Essencial",
      price: "997",
      period: "/mês",
      description: "1 profissional | Até 30 consultas/mês",
      features: [
        "167 agentes de IA especializados",
        "Método ADS completo (5 dimensões)",
        "Área do paciente com dashboard",
        "Dashboard profissional com métricas",
        "Gestão completa de pacientes",
        "Agenda com calendário integrado",
        "Planos atualizados em tempo real",
        "Suporte por email (24h)"
      ],
      buttonText: "Começar Teste",
      buttonAction: "/signup"
    },
    {
      name: "Professional",
      price: "1.497",
      period: "/mês",
      description: "1 profissional | Até 80 consultas/mês",
      features: [
        "Tudo do Essencial +",
        "Análise automatizada de exames com IA",
        "Biblioteca de 500+ protocolos clínicos",
        "Relatórios de performance mensal",
        "Integrações (iZoom, Google Calendar)",
        "Suporte prioritário via WhatsApp (4h)",
        "Onboarding personalizado (sessão 1h)"
      ],
      buttonText: "Começar Teste",
      buttonAction: "/signup",
      isPopular: true
    },
    {
      name: "Clínica",
      price: "2.997",
      period: "/mês",
      description: "Até 3 profissionais | Até 200 consultas/mês",
      features: [
        "Tudo do Professional +",
        "Dashboard de equipe (múltiplos profissionais)",
        "Benefícios gerenciais avançados",
        "Gestão centralizada de pacientes",
        "Suporte dedicado (resposta em 2h)",
        "Onboarding presencial (sessão 2h)",
        "API para integrações customizadas"
      ],
      buttonText: "Começar Teste",
      buttonAction: "/signup"
    },
    {
      name: "Enterprise",
      price: "5.997+",
      period: "/mês",
      description: "4+ profissionais | Consultas ilimitadas",
      features: [
        "Tudo da Clínica +",
        "Customizações específicas da clínica",
        "White label (sua marca na plataforma)",
        "API completa para integração total",
        "Account manager dedicado",
        "SLA garantido (uptime 99,9%)",
        "Treinamento completo da equipe",
        "Suporte premium 24/7"
      ],
      buttonText: "Falar com Especialista",
      buttonAction: "/contact"
    }
  ]

  const guarantees = [
    {
      title: "Teste de 14 Dias",
      description: "Sem risco. Não paga nada."
    },
    {
      title: "Garantia de 30 Dias",
      description: "Reembolso total se não economizar aolhires"
    },
    {
      title: "Suporte na Implementação",
      description: "Nossa equipe configura tudo para você"
    }
  ]

  return (
    <section id="checkout" className="relative bg-white py-16 lg:py-24 px-6 lg:px-16 overflow-hidden">
      {/* Background Animado */}
      <DecorativeDots />

      {/* Conteúdo */}
      <div className="relative z-10 max-w-[1400px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[28px] lg:text-[38px] font-bold text-center mb-3">
          SELECIONE O SEU PLANO AUTON
        </h2>

        {/* Subtítulo */}
        <p className="text-[#4a5568] text-[16px] lg:text-[18px] text-center mb-12 lg:mb-16">
          Escolha o plano ideal para sua prática
        </p>

        {/* Grid de Cards de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16 lg:mb-20">
          {plans.map((plan, index) => (
            <PricingCard
              key={index}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              description={plan.description}
              features={plan.features}
              buttonText={plan.buttonText}
              buttonAction={plan.buttonAction}
              isPopular={plan.isPopular}
              index={index}
            />
          ))}
        </div>

        {/* Tabela de Formas de Pagamento */}
        <div className="mb-16 lg:mb-20">
          <PaymentTable />
        </div>

        {/* Cards de Garantias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-[1000px] mx-auto">
          {guarantees.map((guarantee, index) => (
            <GuaranteeCard
              key={index}
              title={guarantee.title}
              description={guarantee.description}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
