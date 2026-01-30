'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function HeroImage() {
  const imageRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return
    
    const rect = imageRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height
    
    setMousePosition({ x, y })
  }

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 })
  }

  return (
    <div 
      ref={imageRef}
      className="relative w-full flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div 
        className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-xl"
        animate={{
          rotateX: mousePosition.y * -8,
          rotateY: mousePosition.x * 8,
          scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.05 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 150,
          damping: 15
        }}
        style={{
          transformStyle: "preserve-3d",
          transformPerspective: 1000,
        }}
      >
        <motion.div 
          className="relative w-full h-full overflow-hidden"
          animate={{
            x: mousePosition.x * 15,
            y: mousePosition.y * 15,
          }}
          transition={{
            type: "spring",
            stiffness: 80,
            damping: 10
          }}
        >
          <Image
            src="/hero-medica.png"
            alt="Médica em jaleco branco conversando com paciente"
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
