import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { ErrorState } from '../data-display/ErrorState'

interface Driver {
  id: number
  firstName: string
  lastName: string
}

interface Vehicle {
  id: number
  fleetNumber: string
  routeId?: number
  routeNumber?: string
}

interface AssignmentFormData {
  driverId: number
  vehicleId: number
  assignmentDate: string
}

interface AssignmentFormProps {
  drivers?: Driver[]
  vehicles?: Vehicle[]
  onSubmit: (data: AssignmentFormData) => void
  isLoading?: boolean
  error?: Error | null
}

export function AssignmentForm({
  drivers,
  vehicles,
  onSubmit,
  isLoading,
  error,
}: AssignmentFormProps) {
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!driverId || !vehicleId || !assignmentDate) return

    onSubmit({
      driverId: Number(driverId),
      vehicleId: Number(vehicleId),
      assignmentDate,
    })
  }

  const isFormValid = driverId && vehicleId && assignmentDate

  return (
    <Card>
      <CardHeader>
        <CardTitle>Призначення водія</CardTitle>
        <CardDescription>Призначити водія до транспортного засобу</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver">Водій</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger id="driver">
                <SelectValue placeholder="Оберіть водія" />
              </SelectTrigger>
              <SelectContent>
                {drivers?.map((driver) => (
                  <SelectItem key={driver.id} value={String(driver.id)}>
                    {driver.firstName} {driver.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Транспорт</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Оберіть транспорт" />
              </SelectTrigger>
              <SelectContent>
                {vehicles?.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                    {vehicle.fleetNumber}
                    {vehicle.routeNumber && ` • Маршрут ${vehicle.routeNumber}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Дата призначення</Label>
            <Input
              id="date"
              type="date"
              value={assignmentDate}
              onChange={(e) => setAssignmentDate(e.target.value)}
            />
          </div>

          {error && (
            <ErrorState
              title="Помилка призначення"
              message={error.message}
              className="mt-4"
            />
          )}

          <Button type="submit" disabled={isLoading || !isFormValid} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Призначити водія
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
