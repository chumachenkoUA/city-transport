'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  rotation: number
  velocityX: number
  velocityY: number
}

interface ConfettiProps {
  active: boolean
  duration?: number
  particleCount?: number
  spread?: number
  origin?: { x: number; y: number }
  colors?: string[]
  className?: string
  onComplete?: () => void
}

const defaultColors = [
  '#7c3aed', // primary purple
  '#8b5cf6',
  '#a78bfa',
  '#22c55e', // success green
  '#f59e0b', // warning amber
  '#ec4899', // pink
  '#06b6d4', // cyan
]

export function Confetti({
  active,
  duration = 3000,
  particleCount = 50,
  spread = 100,
  origin = { x: 0.5, y: 0.5 },
  colors = defaultColors,
  className,
  onComplete,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  const generateParticles = useCallback(() => {
    const newParticles: Particle[] = []
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI * 2)
      const velocity = 2 + Math.random() * 4
      newParticles.push({
        id: i,
        x: origin.x * 100,
        y: origin.y * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
        velocityX: Math.cos(angle) * velocity * (spread / 50),
        velocityY: Math.sin(angle) * velocity * (spread / 50) - 2,
      })
    }
    return newParticles
  }, [particleCount, origin, colors, spread])

  useEffect(() => {
    if (active) {
      setParticles(generateParticles())
      const timer = setTimeout(() => {
        setParticles([])
        onComplete?.()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setParticles([])
    }
  }, [active, duration, generateParticles, onComplete])

  return (
    <div className={cn('pointer-events-none fixed inset-0 z-50 overflow-hidden', className)}>
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              rotate: particle.rotation,
              opacity: 1,
              scale: 1,
            }}
            animate={{
              left: `${particle.x + particle.velocityX * 30}%`,
              top: `${particle.y + particle.velocityY * 30 + 50}%`,
              rotate: particle.rotation + 360 * (Math.random() > 0.5 ? 1 : -1),
              opacity: 0,
              scale: 0.5,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: duration / 1000,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            style={{
              position: 'absolute',
              width: particle.size,
              height: particle.size * 0.6,
              backgroundColor: particle.color,
              borderRadius: '2px',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// Hook for triggering confetti
export function useConfetti() {
  const [isActive, setIsActive] = useState(false)

  const trigger = useCallback(() => {
    setIsActive(true)
  }, [])

  const handleComplete = useCallback(() => {
    setIsActive(false)
  }, [])

  return {
    isActive,
    trigger,
    onComplete: handleComplete,
  }
}

// Celebration effect - burst from multiple points
interface CelebrationProps {
  active: boolean
  className?: string
}

export function Celebration({ active, className }: CelebrationProps) {
  return (
    <>
      <Confetti
        active={active}
        origin={{ x: 0.1, y: 0.6 }}
        spread={80}
        particleCount={25}
        className={className}
      />
      <Confetti
        active={active}
        origin={{ x: 0.9, y: 0.6 }}
        spread={80}
        particleCount={25}
        className={className}
      />
      <Confetti
        active={active}
        origin={{ x: 0.5, y: 0.3 }}
        spread={120}
        particleCount={40}
        className={className}
      />
    </>
  )
}

// Success checkmark with confetti
interface SuccessAnimationProps {
  show: boolean
  message?: string
  className?: string
}

export function SuccessAnimation({
  show,
  message = 'Успішно!',
  className,
}: SuccessAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <Confetti active={show} origin={{ x: 0.5, y: 0.4 }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={cn(
              'fixed inset-0 z-40 flex flex-col items-center justify-center',
              className
            )}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.1,
              }}
              className="h-20 w-20 rounded-full bg-success flex items-center justify-center"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="h-10 w-10 text-success-foreground"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                <motion.path
                  d="M5 12l5 5L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 text-lg font-medium text-foreground"
            >
              {message}
            </motion.p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
