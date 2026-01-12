import { Bus, Train, Zap } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

interface TransportTypeIconProps {
  type: string
  className?: string
}

const transportIcons: Record<string, LucideIcon> = {
  'Автобус': Bus,
  'Тролейбус': Zap,
  'Трамвай': Train,
  'Bus': Bus,
  'Trolleybus': Zap,
  'Tram': Train,
}

export function TransportTypeIcon({ type, className }: TransportTypeIconProps) {
  const Icon = transportIcons[type] || Bus
  return <Icon className={className} />
}
