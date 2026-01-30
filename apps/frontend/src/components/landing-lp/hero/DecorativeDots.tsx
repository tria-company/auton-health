'use client'

import React, { useEffect, useRef } from 'react'

interface Dot {
  x: number
  y: number
  originalX: number
  originalY: number
  vx: number
  vy: number
  targetVx: number
  targetVy: number
  group: number
}

export default function DecorativeDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Configurar tamanho do canvas
    const updateCanvasSize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)

    // Rastrear posição do mouse globalmente
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // Verificar se o mouse está dentro dos limites do canvas
      if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
        mouseRef.current = { x, y }
      } else {
        mouseRef.current = { x: -1000, y: -1000 }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Criar grupos de pontos (organismos celulares)
    const groups = [
      // Grupo 1 - Superior esquerdo
      { centerX: 0.15, centerY: 0.18, count: 6, spread: 0.12 },
      // Grupo 2 - Superior centro
      { centerX: 0.45, centerY: 0.15, count: 7, spread: 0.15 },
      // Grupo 3 - Superior direito
      { centerX: 0.78, centerY: 0.20, count: 6, spread: 0.13 },
      // Grupo 4 - Centro esquerdo
      { centerX: 0.20, centerY: 0.48, count: 5, spread: 0.10 },
      // Grupo 5 - Centro
      { centerX: 0.55, centerY: 0.52, count: 8, spread: 0.16 },
      // Grupo 6 - Centro direito
      { centerX: 0.85, centerY: 0.55, count: 5, spread: 0.11 },
      // Grupo 7 - Inferior esquerdo
      { centerX: 0.25, centerY: 0.80, count: 6, spread: 0.14 },
      // Grupo 8 - Inferior centro-direito
      { centerX: 0.68, centerY: 0.82, count: 7, spread: 0.15 },
    ]

    // Gerar pontos em grupos
    const dots: Dot[] = []
    groups.forEach((group, groupIndex) => {
      for (let i = 0; i < group.count; i++) {
        const angle = (i / group.count) * Math.PI * 2 + Math.random() * 0.5
        const distance = Math.random() * group.spread
        const x = group.centerX + Math.cos(angle) * distance
        const y = group.centerY + Math.sin(angle) * distance
        dots.push({
          x,
          y,
          originalX: x,
          originalY: y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          targetVx: 0,
          targetVy: 0,
          group: groupIndex
        })
      }
    })

    const maxDistance = 140 // Distância para conectar pontos do mesmo grupo
    const mouseRepelDistance = 100 // Distância de repulsão do mouse
    const dotSize = 3 // Tamanho único e pequeno

    // Função de animação
    const animate = () => {
      if (!canvas || !ctx) return

      timeRef.current += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Atualizar posições com movimento orgânico
      dots.forEach((dot, index) => {
        // Movimento tipo Perlin noise simulado com senos/cossenos
        const noise1 = Math.sin(timeRef.current + index * 0.5) * 0.4
        const noise2 = Math.cos(timeRef.current * 0.8 + index * 0.3) * 0.4
        
        dot.targetVx = noise1
        dot.targetVy = noise2

        // Calcular repulsão do mouse
        const dotXPx = dot.x * canvas.width
        const dotYPx = dot.y * canvas.height
        const distToMouse = Math.sqrt(
          (dotXPx - mouseRef.current.x) ** 2 + (dotYPx - mouseRef.current.y) ** 2
        )

        if (distToMouse < mouseRepelDistance) {
          // Calcular direção de afastamento
          const angle = Math.atan2(dotYPx - mouseRef.current.y, dotXPx - mouseRef.current.x)
          const force = (1 - distToMouse / mouseRepelDistance) * 8
          dot.targetVx += Math.cos(angle) * force
          dot.targetVy += Math.sin(angle) * force
        }
        
        // Suavizar o movimento (easing)
        dot.vx += (dot.targetVx - dot.vx) * 0.05
        dot.vy += (dot.targetVy - dot.vy) * 0.05
        
        // Aplicar velocidade
        dot.x += dot.vx * 0.0003
        dot.y += dot.vy * 0.0003

        // Manter próximo ao grupo original (comportamento celular)
        const group = groups[dot.group]
        const distFromCenter = Math.sqrt(
          (dot.x - group.centerX) ** 2 + (dot.y - group.centerY) ** 2
        )
        
        if (distFromCenter > group.spread * 1.5) {
          dot.x += (group.centerX - dot.x) * 0.01
          dot.y += (group.centerY - dot.y) * 0.01
        }

        // Retornar suavemente para posição original após repulsão
        if (distToMouse > mouseRepelDistance) {
          dot.x += (dot.originalX - dot.x) * 0.005
          dot.y += (dot.originalY - dot.y) * 0.005
        }

        // Manter dentro dos limites
        dot.x = Math.max(0.02, Math.min(0.98, dot.x))
        dot.y = Math.max(0.02, Math.min(0.98, dot.y))
      })

      // Desenhar linhas conectando pontos do mesmo grupo
      ctx.lineWidth = 1
      
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          // Só conectar pontos do mesmo grupo
          if (dots[i].group !== dots[j].group) continue
          
          const x1 = dots[i].x * canvas.width
          const y1 = dots[i].y * canvas.height
          const x2 = dots[j].x * canvas.width
          const y2 = dots[j].y * canvas.height
          
          const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
          
          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.35
            ctx.strokeStyle = `rgba(120, 120, 120, ${opacity})`
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
          }
        }
      }

      // Desenhar pontos (tamanho único e pequeno)
      dots.forEach((dot) => {
        const x = dot.x * canvas.width
        const y = dot.y * canvas.height
        
        // Sombra do ponto
        ctx.fillStyle = 'rgba(100, 100, 100, 0.15)'
        ctx.beginPath()
        ctx.arc(x + 0.5, y + 0.5, dotSize, 0, Math.PI * 2)
        ctx.fill()
        
        // Ponto principal
        ctx.fillStyle = 'rgba(130, 130, 130, 0.7)'
        ctx.beginPath()
        ctx.arc(x, y, dotSize, 0, Math.PI * 2)
        ctx.fill()
        
        // Brilho central
        ctx.fillStyle = 'rgba(160, 160, 160, 0.5)'
        ctx.beginPath()
        ctx.arc(x - dotSize * 0.25, y - dotSize * 0.25, dotSize * 0.35, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0 pointer-events-none"
      style={{ opacity: 0.9 }}
    />
  )
}
