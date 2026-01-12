'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedGradientProps {
  children?: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'sunset' | 'ocean' | 'forest' | 'aurora'
  speed?: 'slow' | 'medium' | 'fast'
  blur?: boolean
}

const gradientVariants = {
  primary: 'from-primary/30 via-primary/10 to-accent/20',
  secondary: 'from-secondary/40 via-muted/30 to-background',
  sunset: 'from-orange-500/20 via-pink-500/20 to-purple-500/20',
  ocean: 'from-blue-500/20 via-cyan-500/20 to-teal-500/20',
  forest: 'from-green-500/20 via-emerald-500/20 to-teal-500/20',
  aurora: 'from-violet-500/20 via-purple-500/20 to-fuchsia-500/20',
}

const speedMap = {
  slow: 8,
  medium: 5,
  fast: 3,
}

export function AnimatedGradient({
  children,
  className,
  variant = 'primary',
  speed = 'medium',
  blur = true,
}: AnimatedGradientProps) {
  const duration = speedMap[speed]

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <motion.div
        className={cn(
          'absolute inset-0 bg-gradient-to-br',
          gradientVariants[variant],
          blur && 'blur-3xl'
        )}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          backgroundSize: '200% 200%',
        }}
      />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  )
}

// Animated mesh gradient background
interface MeshGradientProps {
  className?: string
  colors?: string[]
}

export function MeshGradient({
  className,
  colors = ['#7c3aed', '#8b5cf6', '#a78bfa', '#6366f1'],
}: MeshGradientProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {colors.map((color, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full blur-3xl opacity-30"
          style={{
            background: color,
            width: '40%',
            height: '40%',
          }}
          animate={{
            x: [
              `${20 + index * 15}%`,
              `${50 + Math.sin(index) * 30}%`,
              `${20 + index * 15}%`,
            ],
            y: [
              `${10 + index * 20}%`,
              `${40 + Math.cos(index) * 30}%`,
              `${10 + index * 20}%`,
            ],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10 + index * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// Gradient text with animation
interface GradientTextProps {
  children: React.ReactNode
  className?: string
  animate?: boolean
  from?: string
  via?: string
  to?: string
}

export function GradientText({
  children,
  className,
  animate = true,
  from = 'from-primary',
  via = 'via-purple-500',
  to = 'to-pink-500',
}: GradientTextProps) {
  return (
    <span
      className={cn(
        'bg-gradient-to-r bg-clip-text text-transparent',
        from,
        via,
        to,
        animate && 'animate-gradient bg-[length:200%_auto]',
        className
      )}
    >
      {children}
    </span>
  )
}

// Glowing orb decoration
interface GlowingOrbProps {
  className?: string
  color?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  pulse?: boolean
}

const sizeMap = {
  sm: 'h-32 w-32',
  md: 'h-48 w-48',
  lg: 'h-64 w-64',
  xl: 'h-96 w-96',
}

export function GlowingOrb({
  className,
  color = 'bg-primary/30',
  size = 'md',
  pulse = true,
}: GlowingOrbProps) {
  return (
    <motion.div
      className={cn(
        'rounded-full blur-3xl',
        color,
        sizeMap[size],
        className
      )}
      animate={
        pulse
          ? {
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }
          : undefined
      }
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}
