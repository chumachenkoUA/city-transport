import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, User, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type ComplaintStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected'

interface ComplaintCardProps {
  id: number
  passengerName: string
  routeNumber?: string
  fleetNumber?: string
  complaintText: string
  createdAt: string
  status: ComplaintStatus
  onReview?: () => void
  onResolve?: () => void
  onReject?: () => void
  className?: string
}

const statusConfig = {
  pending: {
    label: 'Нова',
    variant: 'warning' as const,
  },
  reviewed: {
    label: 'Розглянута',
    variant: 'info' as const,
  },
  resolved: {
    label: 'Вирішена',
    variant: 'success' as const,
  },
  rejected: {
    label: 'Відхилена',
    variant: 'destructive' as const,
  },
}

export function ComplaintCard({
  id,
  passengerName,
  routeNumber,
  fleetNumber,
  complaintText,
  createdAt,
  status,
  onReview,
  onResolve,
  onReject,
  className,
}: ComplaintCardProps) {
  const config = statusConfig[status]

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Скарга #{id}
            </CardTitle>
            <CardDescription className="mt-1">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                {passengerName}
              </div>
            </CardDescription>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {(routeNumber || fleetNumber) && (
            <div className="flex gap-2">
              {routeNumber && <Badge variant="outline">Маршрут {routeNumber}</Badge>}
              {fleetNumber && <Badge variant="outline">Транспорт {fleetNumber}</Badge>}
            </div>
          )}

          <p className="text-sm text-muted-foreground">{complaintText}</p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(createdAt).toLocaleString('uk-UA')}
          </div>
        </div>

        {status === 'pending' && (onReview || onResolve || onReject) && (
          <div className="flex gap-2 pt-2">
            {onReview && (
              <Button variant="outline" size="sm" onClick={onReview} className="flex-1">
                Розглянути
              </Button>
            )}
            {onResolve && (
              <Button variant="default" size="sm" onClick={onResolve} className="flex-1">
                Вирішити
              </Button>
            )}
            {onReject && (
              <Button variant="destructive" size="sm" onClick={onReject}>
                Відхилити
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
