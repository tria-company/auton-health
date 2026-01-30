'use client'

import React from 'react'
import FAQItem from './FAQItem'

export default function FAQSection() {
  const faqs = [
    {
      question: "R$ 997/mês não é caro?",
      answer: "Se você atende 30 pacientes por mês (plano Essencial), são apenas R$ 33 por consulta. Considerando que o AUTON economiza 2-3 horas do seu dia (que você pode usar para atender mais pacientes ou estudar), o retorno é imediato. Um único paciente particular que você consegue atender a mais no mês já paga o investimento."
    },
    {
      question: "Como justificar esse investimento para meu contador?",
      answer: "O AUTON é uma ferramenta profissional essencial para sua prática médica, classificada como despesa operacional dedutível. Além disso, o aumento de produtividade e qualidade do atendimento resultam em maior faturamento, tornando o investimento facilmente justificável. Fornecemos nota fiscal e todos os documentos necessários."
    },
    {
      question: "E se eu não conseguir vender os planos personalizados?",
      answer: "O AUTON não foi criado para você vender planos, mas para você oferecer medicina de excelência. Os pacientes percebem o diferencial na consulta: você terá mais clareza diagnóstica, planos mais personalizados e resultados melhores. Isso naturalmente atrai e retém pacientes. Muitos médicos relatam aumento de indicações espontâneas após começarem a usar."
    },
    {
      question: "Quanto tempo levo para ter retorno do investimento?",
      answer: "A maioria dos médicos relata retorno em 30-60 dias. O ganho vem de três frentes: (1) redução de 70% do tempo de análise de exames, permitindo atender mais pacientes; (2) aumento da conversão de consultas por conta da confiança e clareza transmitidas; (3) redução de retrabalho e pacientes que abandonam o tratamento. Além disso, o tempo economizado pode ser usado para estudar, melhorando ainda mais seus resultados."
    },
    {
      question: "E se meus pacientes não usarem a área exclusiva?",
      answer: "A área do paciente é um diferencial, mas não é obrigatória. O maior valor do AUTON está na sua consulta: você terá acesso a análises automatizadas de exames, sugestões de protocolo, diagnóstico de causa raiz assistido por IA e muito mais. A área do paciente é apenas um bônus que aumenta o engajamento e facilita o acompanhamento, mas o AUTON entrega valor para VOCÊ, independentemente do paciente acessar ou não."
    },
    {
      question: "Posso cancelar quando quiser?",
      answer: "Sim, você pode cancelar a qualquer momento sem multas ou taxas extras. Não temos fidelidade nem burocracia. Acreditamos que você deve ficar porque vê valor real, não por contrato. Além disso, oferecemos 14 dias de teste grátis e 30 dias de garantia de reembolso total caso não veja resultado."
    }
  ]

  return (
    <section className="bg-[#F9FAFB] py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[900px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[26px] lg:text-[36px] font-bold text-center mb-12 lg:mb-16">
          Perguntas Sobre Investimento e Retorno
        </h2>

        {/* Lista de FAQs */}
        <div className="flex flex-col gap-4 lg:gap-5">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
