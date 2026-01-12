import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, MapPin } from 'lucide-react'
import { TripStatusBadge } from './TripStatusBadge'
import { EmptyState } from '../data-display/EmptyState'
import { TableSkeleton } from '../data-display/TableSkeleton'
import { Bus } from 'lucide-react'

interface Trip {
  id: number
  routeNumber: string
  vehicleFleetNumber: string
  driverName?: string
  startTime?: string
  endTime?: string
  passengerCount?: number
  status: 'active' | 'completed' | 'scheduled' | 'cancelled'
}

interface TripTableProps {
  trips?: Trip[]
  isLoading?: boolean
  onView?: (id: number) => void
  onTrack?: (id: number) => void
}

export function TripTable({ trips, isLoading, onView, onTrack }: TripTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={6} />
  }

  if (!trips || trips.length === 0) {
    return (
      <EmptyState
        icon={Bus}
        title="Немає активних рейсів"
        description="Рейси з'являться тут після створення розкладу та призначення водіїв."
      />
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Маршрут</TableHead>
            <TableHead>Транспорт</TableHead>
            <TableHead>Водій</TableHead>
            <TableHead>Час</TableHead>
            <TableHead>Пасажири</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Дії</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((trip) => (
            <TableRow key={trip.id}>
              <TableCell>
                <Badge>{trip.routeNumber}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{trip.vehicleFleetNumber}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {trip.driverName || '-'}
              </TableCell>
              <TableCell className="text-sm">
                {trip.startTime && trip.endTime
                  ? `${trip.startTime} - ${trip.endTime}`
                  : trip.startTime || '-'}
              </TableCell>
              <TableCell className="text-sm">
                {trip.passengerCount !== undefined ? trip.passengerCount : '-'}
              </TableCell>
              <TableCell>
                <TripStatusBadge status={trip.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onView(trip.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onTrack && trip.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onTrack(trip.id)}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
