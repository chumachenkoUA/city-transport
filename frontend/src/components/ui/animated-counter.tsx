'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useSpring, useTransform } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  delay?: number
  className?: string
  prefix?: string
  suffix?: string
  formatFn?: (value: number) => string
}

export function AnimatedCounter({
  value,
  duration = 2,
  delay = 0,
  className,
  prefix = '',
  suffix = '',
  formatFn,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const [hasAnimated, setHasAnimated] = useState(false)

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  })

  const display = useTransform(spring, (current) => {
    const rounded = Math.round(current)
    return formatFn ? formatFn(rounded) : rounded.toLocaleString('uk-UA')
  })

  useEffect(() => {
    if (isInView && !hasAnimated) {
      const timer = setTimeout(() => {
        spring.set(value)
        setHasAnimated(true)
      }, delay * 1000)
      return () => clearTimeout(timer)
    }
  }, [isInView, hasAnimated, spring, value, delay])

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  )
}
