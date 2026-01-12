import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Edit, Trash2 } from 'lucide-react'
import { EmptyState } from '../data-display/EmptyState'
import { TableSkeleton } from '../data-display/TableSkeleton'
import { Calendar } from 'lucide-react'

interface Schedule {
  id: number
  routeNumber: string
  routeDirection: string
  vehicleFleetNumber: string
  workStartTime: string
  workEndTime: string
  intervalMin: number
}

interface ScheduleTableProps {
  schedules?: Schedule[]
  isLoading?: boolean
  selectedId?: number | null
  onSelect?: (id: number) => void
  onView?: (id: number) => void
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
}

export function ScheduleTable({
  schedules,
  isLoading,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onDelete,
}: ScheduleTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={6} />
  }

  if (!schedules || schedules.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Немає розкладів"
        description="Створіть перший розклад для організації руху транспорту на маршрутах."
      />
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Маршрут</TableHead>
            <TableHead>Напрямок</TableHead>
            <TableHead>Транспорт</TableHead>
            <TableHead>Час роботи</TableHead>
            <TableHead>Інтервал</TableHead>
            <TableHead className="text-right">Дії</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow
              key={schedule.id}
              className={selectedId === schedule.id ? 'bg-muted/50' : ''}
              onClick={() => onSelect?.(schedule.id)}
            >
              <TableCell>
                <Badge>{schedule.routeNumber}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {schedule.routeDirection}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{schedule.vehicleFleetNumber}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {schedule.workStartTime} - {schedule.workEndTime}
              </TableCell>
              <TableCell className="text-sm">
                {schedule.intervalMin} хв
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onView(schedule.id)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(schedule.id)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(schedule.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
