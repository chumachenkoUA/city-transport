'use client'

import { motion, type Variants, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

// Fade in from bottom
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// Fade in from left
const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

// Fade in from right
const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
}

// Scale up
const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

// Simple fade
const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

// Stagger container
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

export const animationVariants = {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleUp,
  fade,
  staggerContainer,
}

type AnimationType = keyof typeof animationVariants

interface FadeInProps extends HTMLMotionProps<'div'> {
  animation?: AnimationType
  delay?: number
  duration?: number
  once?: boolean
  children: React.ReactNode
}

export function FadeIn({
  animation = 'fadeInUp',
  delay = 0,
  duration = 0.5,
  once = true,
  children,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-50px' }}
      variants={animationVariants[animation]}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number
  delayChildren?: number
  children: React.ReactNode
}

export function Stagger({
  staggerDelay = 0.1,
  delayChildren = 0,
  children,
  className,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  animation?: AnimationType
  children: React.ReactNode
}

export function StaggerItem({
  animation = 'fadeInUp',
  children,
  className,
  ...props
}: StaggerItemProps) {
  return (
    <motion.div
      variants={animationVariants[animation]}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Hover scale effect for cards
interface HoverScaleProps extends HTMLMotionProps<'div'> {
  scale?: number
  children: React.ReactNode
}

export function HoverScale({
  scale = 1.02,
  children,
  className,
  ...props
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn('cursor-pointer', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Pulse animation for attention
export function Pulse({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'> & { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.02, 1],
        opacity: [1, 0.9, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Floating animation
export function Float({
  children,
  className,
  amplitude = 10,
  ...props
}: HTMLMotionProps<'div'> & { children: React.ReactNode; amplitude?: number }) {
  return (
    <motion.div
      animate={{
        y: [-amplitude / 2, amplitude / 2, -amplitude / 2],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// Shimmer/shine effect for cards
export function ShimmerBorder({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ translateX: ['100%', '-100%'] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: 'easeInOut',
        }}
      />
      {children}
    </div>
  )
}
