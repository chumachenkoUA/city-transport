'use client'

import { motion, useScroll, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScrollProgressProps {
  className?: string
  color?: string
  height?: number
  position?: 'top' | 'bottom'
}

export function ScrollProgress({
  className,
  color,
  height = 3,
  position = 'top',
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className={cn(
        'fixed left-0 right-0 z-50 origin-left',
        position === 'top' ? 'top-0' : 'bottom-0',
        color ?? 'bg-primary',
        className
      )}
      style={{
        scaleX,
        height,
      }}
    />
  )
}

// Circular scroll progress indicator
interface CircularProgressProps {
  className?: string
  size?: number
  strokeWidth?: number
  showPercentage?: boolean
}

export function CircularScrollProgress({
  className,
  size = 48,
  strokeWidth = 3,
  showPercentage = true,
}: CircularProgressProps) {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center justify-center',
        className
      )}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none stroke-muted"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none stroke-primary"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            pathLength: progress,
          }}
          strokeDasharray={circumference}
          strokeDashoffset={0}
        />
      </svg>
      {showPercentage && (
        <motion.span
          className="absolute text-xs font-medium text-foreground"
          style={{
            opacity: scrollYProgress,
          }}
        >
          <ProgressPercentage progress={progress} />
        </motion.span>
      )}
    </div>
  )
}

// Helper to display percentage
function ProgressPercentage({ progress }: { progress: ReturnType<typeof useSpring> }) {
  const [percentage, setPercentage] = useState(0)

  useEffect(() => {
    const unsubscribe = progress.on('change', (v) => {
      setPercentage(Math.round(v * 100))
    })
    return unsubscribe
  }, [progress])

  return <>{percentage}%</>
}

import { useEffect, useState } from 'react'

// Scroll to top button with progress
interface ScrollToTopProps {
  className?: string
  showAfter?: number
}

export function ScrollToTop({
  className,
  showAfter = 300,
}: ScrollToTopProps) {
  const [show, setShow] = useState(false)
  const { scrollYProgress } = useScroll()

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > showAfter)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showAfter])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <motion.button
      onClick={scrollToTop}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: show ? 1 : 0,
        scale: show ? 1 : 0.8,
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg',
        'flex items-center justify-center',
        !show && 'pointer-events-none',
        className
      )}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 16V4M10 4L4 10M10 4L16 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <motion.svg
        className="absolute inset-0"
        width="48"
        height="48"
        viewBox="0 0 48 48"
      >
        <motion.circle
          cx="24"
          cy="24"
          r="22"
          className="fill-none stroke-primary-foreground/30"
          strokeWidth="2"
          style={{
            pathLength: scrollYProgress,
          }}
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.button>
  )
}
