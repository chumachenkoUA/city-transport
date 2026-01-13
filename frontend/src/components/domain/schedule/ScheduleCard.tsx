import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, Bus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduleCardProps {
  id: number
  routeNumber: string
  routeDirection: string
  vehicleFleetNumber: string
  workStartTime: string
  workEndTime: string
  intervalMin: number
  isActive?: boolean
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function ScheduleCard({
  id: _id,
  routeNumber,
  routeDirection,
  vehicleFleetNumber,
  workStartTime,
  workEndTime,
  intervalMin,
  isActive = true,
  onView,
  onEdit,
  onDelete,
  className,
}: ScheduleCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', !isActive && 'opacity-60', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Маршрут {routeNumber}
            </CardTitle>
            <CardDescription className="mt-1">{routeDirection}</CardDescription>
          </div>
          <Badge variant={isActive ? 'success' : 'secondary'}>
            {isActive ? 'Активний' : 'Неактивний'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Транспорт:</span>
            <Badge variant="outline">{vehicleFleetNumber}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Час роботи:</span>
            <span className="font-medium">{workStartTime} - {workEndTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Інтервал:</span>
            <span className="font-medium">{intervalMin} хв</span>
          </div>
        </div>
        {(onView || onEdit || onDelete) && (
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
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Видалити
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
