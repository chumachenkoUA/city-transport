import { StatCard } from './StatCard'
import { type LucideIcon } from 'lucide-react'

interface Stat {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  variant?: 'default' | 'success' | 'warning' | 'error'
}

interface StatsGridProps {
  stats: Stat[]
  className?: string
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 5)} ${className || ''}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  )
}
