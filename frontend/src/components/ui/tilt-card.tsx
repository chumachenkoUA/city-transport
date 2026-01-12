'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  tiltAmount?: number
  perspective?: number
  scale?: number
  glareEnabled?: boolean
  glareOpacity?: number
}

export function TiltCard({
  children,
  className,
  tiltAmount = 10,
  perspective = 1000,
  scale = 1.02,
  glareEnabled = true,
  glareOpacity = 0.2,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)

  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)

  const springConfig = { stiffness: 300, damping: 30 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  const rotateX = useTransform(springY, [0, 1], [tiltAmount, -tiltAmount])
  const rotateY = useTransform(springX, [0, 1], [-tiltAmount, tiltAmount])

  const glareX = useTransform(springX, [0, 1], ['0%', '100%'])
  const glareY = useTransform(springY, [0, 1], ['0%', '100%'])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const xPos = (e.clientX - rect.left) / rect.width
    const yPos = (e.clientY - rect.top) / rect.height
    x.set(xPos)
    y.set(yPos)
  }

  const handleMouseEnter = () => {
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    x.set(0.5)
    y.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective,
        transformStyle: 'preserve-3d',
      }}
      className={cn('relative', className)}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          scale: isHovering ? scale : 1,
          transformStyle: 'preserve-3d',
        }}
        transition={{ scale: { duration: 0.2 } }}
        className="relative h-full w-full"
      >
        {children}
        {glareEnabled && (
          <motion.div
            style={{
              background: useTransform(
                [glareX, glareY],
                ([gx, gy]) =>
                  `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,${glareOpacity}), transparent 50%)`
              ),
            }}
            className={cn(
              'pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200',
              isHovering ? 'opacity-100' : 'opacity-0'
            )}
          />
        )}
      </motion.div>
    </motion.div>
  )
}

// Simpler hover lift card without tilt
interface HoverLiftCardProps {
  children: React.ReactNode
  className?: string
  liftAmount?: number
  scale?: number
}

export function HoverLiftCard({
  children,
  className,
  liftAmount = 8,
  scale = 1.02,
}: HoverLiftCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -liftAmount,
        scale,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 20,
        },
      }}
      className={cn('relative', className)}
    >
      {children}
    </motion.div>
  )
}
