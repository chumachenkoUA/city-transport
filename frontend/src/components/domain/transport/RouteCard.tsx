import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Clock, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RouteCardProps {
  routeNumber: string
  transportType: string
  direction: 'forward' | 'reverse'
  isActive?: boolean
  stops?: number
  duration?: number
  frequency?: number
  onView?: () => void
  onEdit?: () => void
  className?: string
}

const directionLabels = {
  forward: 'Прямий',
  reverse: 'Зворотній',
}

export function RouteCard({
  routeNumber,
  transportType,
  direction,
  isActive = true,
  stops,
  duration,
  frequency,
  onView,
  onEdit,
  className,
}: RouteCardProps) {
  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        !isActive && 'opacity-60',
        className
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl">{routeNumber}</CardTitle>
            <Badge variant={isActive ? 'success' : 'secondary'}>
              {isActive ? 'Активний' : 'Неактивний'}
            </Badge>
          </div>
          <Badge variant="outline">{transportType}</Badge>
        </div>
        <Badge variant="secondary" className="w-fit mt-2">
          {directionLabels[direction]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {stops !== undefined && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{stops}</p>
                <p className="text-xs text-muted-foreground">зупинок</p>
              </div>
            </div>
          )}
          {duration !== undefined && (
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{duration} хв</p>
                <p className="text-xs text-muted-foreground">тривалість</p>
              </div>
            </div>
          )}
          {frequency !== undefined && (
            <div className="flex items-start gap-2">
              <Timer className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{frequency} хв</p>
                <p className="text-xs text-muted-foreground">інтервал</p>
              </div>
            </div>
          )}
        </div>
        {(onView || onEdit) && (
          <div className="flex gap-2 pt-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView} className="flex-1">
                Переглянути
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" size="sm" onClick={onEdit} className="flex-1">
                Редагувати
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
