import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VehicleCardProps {
  fleetNumber: string
  model: string
  transportType: string
  routeNumber?: string
  capacity?: number
  registrationDate?: string
  isActive?: boolean
  onView?: () => void
  onEdit?: () => void
  className?: string
}

export function VehicleCard({
  fleetNumber,
  model,
  transportType,
  routeNumber,
  capacity,
  registrationDate,
  isActive = true,
  onView,
  onEdit,
  className,
}: VehicleCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', !isActive && 'opacity-60', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{fleetNumber}</CardTitle>
          </div>
          <Badge variant={isActive ? 'success' : 'secondary'}>
            {isActive ? 'Активний' : 'Неактивний'}
          </Badge>
        </div>
        <CardDescription>{model}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Тип транспорту:</span>
            <Badge variant="outline">{transportType}</Badge>
          </div>
          {routeNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Маршрут:</span>
              <Badge>{routeNumber}</Badge>
            </div>
          )}
          {capacity !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Місткість:</span>
              <span className="font-medium">{capacity} осіб</span>
            </div>
          )}
          {registrationDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Зареєстровано: {registrationDate}</span>
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
