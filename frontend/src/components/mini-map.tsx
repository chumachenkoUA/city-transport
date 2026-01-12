'use client'

import { Map } from '@/components/ui/map'
import { cn } from '@/lib/utils'

// Lviv center coordinates
const LVIV_CENTER: [number, number] = [24.0316, 49.8429]

interface MiniMapProps {
  className?: string
}

export function MiniMap({ className }: MiniMapProps) {
  return (
    <div className={cn('relative w-full h-full', className)}>
      <Map
        center={LVIV_CENTER}
        zoom={12}
        interactive={false}
        attributionControl={false}
      />
    </div>
  )
}
