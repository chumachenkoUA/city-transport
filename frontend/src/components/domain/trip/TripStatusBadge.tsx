import { Badge } from '@/components/ui/badge'

type TripStatus = 'active' | 'completed' | 'scheduled' | 'cancelled'

interface TripStatusBadgeProps {
  status: TripStatus
  className?: string
}

const statusConfig = {
  active: {
    label: 'Активний',
    variant: 'success' as const,
  },
  completed: {
    label: 'Завершено',
    variant: 'secondary' as const,
  },
  scheduled: {
    label: 'Заплановано',
    variant: 'info' as const,
  },
  cancelled: {
    label: 'Скасовано',
    variant: 'destructive' as const,
  },
}

export function TripStatusBadge({ status, className }: TripStatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
