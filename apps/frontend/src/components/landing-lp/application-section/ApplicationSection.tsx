'use client'

import React from 'react'
import ApplicationCard from './ApplicationCard'
import VideoSection from './VideoSection'
import { HeartbeatIcon, MicroscopeIcon, PillIcon, BrainIcon, HeartIcon } from './ApplicationIcons'

export default function ApplicationSection() {
  const applications = [
    { icon: <HeartbeatIcon />, title: 'Doenças crônicas' },
    { icon: <MicroscopeIcon />, title: 'Distúrbios metabólicos' },
    { icon: <PillIcon />, title: 'Autoimunidade' },
    { icon: <BrainIcon />, title: 'Saúde mental' },
    { icon: <HeartIcon />, title: 'Sintomas do espectro autista (TEA)' }
  ]

  return (
    <section className="bg-[#fafafa] py-16 lg:py-24 px-6 lg:px-16">
      <div className="max-w-[1200px] mx-auto">
        {/* Título Principal */}
        <h2 className="text-[#1a365d] text-[32px] lg:text-[40px] font-bold text-center mb-12 lg:mb-16">
          Tudo isso aplicado a:
        </h2>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1000px] mx-auto mb-8">
          {applications.slice(0, 3).map((app, index) => (
            <ApplicationCard
              key={index}
              icon={app.icon}
              title={app.title}
              index={index}
            />
          ))}
        </div>

        {/* Segunda linha com 2 cards centralizados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[680px] mx-auto">
          {applications.slice(3).map((app, index) => (
            <ApplicationCard
              key={index + 3}
              icon={app.icon}
              title={app.title}
              index={index + 3}
            />
          ))}
        </div>

        {/* Seção de Vídeo */}
        <VideoSection />
      </div>
    </section>
  )
}
