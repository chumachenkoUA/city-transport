import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TripStatusBadge } from './TripStatusBadge'
import { Clock, MapPin, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TripCardProps {
  id: number
  routeNumber: string
  vehicleFleetNumber: string
  driverName?: string
  startTime?: string
  endTime?: string
  passengerCount?: number
  currentStop?: string
  status: 'active' | 'completed' | 'scheduled' | 'cancelled'
  onView?: () => void
  onTrack?: () => void
  className?: string
}

export function TripCard({
  id,
  routeNumber,
  vehicleFleetNumber,
  driverName,
  startTime,
  endTime,
  passengerCount,
  currentStop,
  status,
  onView,
  onTrack,
  className,
}: TripCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Маршрут {routeNumber}
            </CardTitle>
            <CardDescription className="mt-1">Рейс #{id}</CardDescription>
          </div>
          <TripStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Badge variant="outline">{vehicleFleetNumber}</Badge>
            </div>
            {driverName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{driverName}</span>
              </div>
            )}
          </div>

          {(startTime || endTime) && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {startTime && `${startTime}`}
                {startTime && endTime && ' - '}
                {endTime && `${endTime}`}
              </span>
            </div>
          )}

          {currentStop && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Поточна зупинка:</span>
              <span className="font-medium">{currentStop}</span>
            </div>
          )}

          {passengerCount !== undefined && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Пасажирів:</span>
              <span className="font-medium">{passengerCount}</span>
            </div>
          )}
        </div>

        {(onView || onTrack) && (
          <div className="flex gap-2 pt-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView} className="flex-1">
                Деталі
              </Button>
            )}
            {onTrack && status === 'active' && (
              <Button variant="secondary" size="sm" onClick={onTrack} className="flex-1">
                Відстежити
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
