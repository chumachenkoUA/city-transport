'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TypewriterProps {
  words: string[]
  className?: string
  cursorClassName?: string
  typingSpeed?: number
  deletingSpeed?: number
  delayBetweenWords?: number
  loop?: boolean
}

export function Typewriter({
  words,
  className,
  cursorClassName,
  typingSpeed = 100,
  deletingSpeed = 50,
  delayBetweenWords = 2000,
  loop = true,
}: TypewriterProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentWord = words[currentWordIndex]

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (currentText.length < currentWord.length) {
            setCurrentText(currentWord.slice(0, currentText.length + 1))
          } else {
            if (loop || currentWordIndex < words.length - 1) {
              setTimeout(() => setIsDeleting(true), delayBetweenWords)
            }
          }
        } else {
          if (currentText.length > 0) {
            setCurrentText(currentText.slice(0, -1))
          } else {
            setIsDeleting(false)
            setCurrentWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    )

    return () => clearTimeout(timeout)
  }, [
    currentText,
    currentWordIndex,
    isDeleting,
    words,
    typingSpeed,
    deletingSpeed,
    delayBetweenWords,
    loop,
  ])

  return (
    <span className={cn('inline-flex', className)}>
      <span>{currentText}</span>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        className={cn('ml-0.5 inline-block w-[3px] bg-current', cursorClassName)}
      >
        &nbsp;
      </motion.span>
    </span>
  )
}

// Text reveal animation - reveals text letter by letter
interface TextRevealProps {
  text: string
  className?: string
  delay?: number
  staggerDelay?: number
}

export function TextReveal({
  text,
  className,
  delay = 0,
  staggerDelay = 0.03,
}: TextRevealProps) {
  const letters = text.split('')

  return (
    <span className={cn('inline-block', className)}>
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: delay + index * staggerDelay,
            duration: 0.3,
          }}
          className="inline-block"
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </span>
  )
}

// Word rotate animation - cycles through words with fade animation
interface WordRotateProps {
  words: string[]
  className?: string
  duration?: number
}

export function WordRotate({
  words,
  className,
  duration = 3000,
}: WordRotateProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length)
    }, duration)

    return () => clearInterval(interval)
  }, [words.length, duration])

  return (
    <span className={cn('inline-block relative', className)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="inline-block"
        >
          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// Split text animation
interface SplitTextProps {
  text: string
  className?: string
  wordClassName?: string
  animation?: 'fadeUp' | 'fadeIn' | 'blur'
  staggerDelay?: number
}

export function SplitText({
  text,
  className,
  wordClassName,
  animation = 'fadeUp',
  staggerDelay = 0.05,
}: SplitTextProps) {
  const words = text.split(' ')

  const animations = {
    fadeUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
    },
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
    },
    blur: {
      initial: { opacity: 0, filter: 'blur(10px)' },
      animate: { opacity: 1, filter: 'blur(0px)' },
    },
  }

  return (
    <span className={cn('inline-flex flex-wrap', className)}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={animations[animation].initial}
          animate={animations[animation].animate}
          transition={{
            delay: index * staggerDelay,
            duration: 0.4,
          }}
          className={cn('inline-block mr-[0.25em]', wordClassName)}
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}
