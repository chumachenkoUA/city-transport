import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getMyTrips } from '@/lib/passenger-api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/passenger/trips')({
  component: TripsPage,
})

function TripsPage() {
  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['passenger-trips'],
    queryFn: getMyTrips,
  })

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (error) return <div className="text-red-500 p-4">Помилка завантаження історії поїздок.</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Історія поїздок</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Маршрут</TableHead>
              <TableHead>Транспорт</TableHead>
              <TableHead className="text-right">Вартість</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips?.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell>{new Date(trip.startedAt).toLocaleString()}</TableCell>
                <TableCell>{trip.routeNumber}</TableCell>
                <TableCell>{trip.transportType}</TableCell>
                <TableCell className="text-right">{trip.cost} грн</TableCell>
              </TableRow>
            ))}
            {trips?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Поїздок не знайдено</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
