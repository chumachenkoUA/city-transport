import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { ErrorState } from '../data-display/ErrorState'

interface Route {
  id: number
  number: string
  direction: string
  transportTypeName: string
}

interface Vehicle {
  id: number
  fleetNumber: string
  routeId: number
}

interface ScheduleFormData {
  routeId: number
  vehicleId: number
  workStartTime: string
  workEndTime: string
  intervalMin: number
}

interface ScheduleFormProps {
  routes?: Route[]
  vehicles?: Vehicle[]
  onSubmit: (data: ScheduleFormData) => void
  isLoading?: boolean
  error?: Error | null
  defaultValues?: Partial<ScheduleFormData>
}

export function ScheduleForm({
  routes,
  vehicles,
  onSubmit,
  isLoading,
  error,
  defaultValues,
}: ScheduleFormProps) {
  const [routeId, setRouteId] = useState(defaultValues?.routeId?.toString() || '')
  const [vehicleId, setVehicleId] = useState(defaultValues?.vehicleId?.toString() || '')
  const [startTime, setStartTime] = useState(defaultValues?.workStartTime || '')
  const [endTime, setEndTime] = useState(defaultValues?.workEndTime || '')
  const [interval, setInterval] = useState(defaultValues?.intervalMin?.toString() || '')

  const filteredVehicles = vehicles?.filter(v => v.routeId === Number(routeId)) || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!routeId || !vehicleId || !startTime || !endTime || !interval) return

    onSubmit({
      routeId: Number(routeId),
      vehicleId: Number(vehicleId),
      workStartTime: startTime,
      workEndTime: endTime,
      intervalMin: Number(interval),
    })
  }

  const isFormValid = routeId && vehicleId && startTime && endTime && interval

  return (
    <Card>
      <CardHeader>
        <CardTitle>Створення розкладу</CardTitle>
        <CardDescription>Новий графік руху для маршруту</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="route">Маршрут</Label>
            <Select
              value={routeId}
              onValueChange={(value) => {
                setRouteId(value)
                setVehicleId('')
              }}
            >
              <SelectTrigger id="route">
                <SelectValue placeholder="Оберіть маршрут" />
              </SelectTrigger>
              <SelectContent>
                {routes?.map((route) => (
                  <SelectItem key={route.id} value={String(route.id)}>
                    {route.number} • {route.direction} • {route.transportTypeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Транспорт</Label>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={!routeId}>
              <SelectTrigger id="vehicle">
                <SelectValue
                  placeholder={routeId ? 'Оберіть транспорт' : 'Спочатку оберіть маршрут'}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                    {vehicle.fleetNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-time">Початок руху</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Кінець руху</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Інтервал руху (хвилин)</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              max={120}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              placeholder="Наприклад: 15"
            />
          </div>

          {error && (
            <ErrorState
              title="Помилка створення розкладу"
              message={error.message}
              className="mt-4"
            />
          )}

          <Button type="submit" disabled={isLoading || !isFormValid} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Створити розклад
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
