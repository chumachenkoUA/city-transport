import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { ErrorState } from '../data-display/ErrorState'

interface StopFormData {
  name: string
  lon: number
  lat: number
}

interface StopFormProps {
  onSubmit: (data: StopFormData) => void
  isLoading?: boolean
  error?: Error | null
  defaultValues?: Partial<StopFormData>
  mode?: 'create' | 'edit'
}

export function StopForm({
  onSubmit,
  isLoading,
  error,
  defaultValues,
  mode = 'create',
}: StopFormProps) {
  const [name, setName] = useState(defaultValues?.name || '')
  const [lon, setLon] = useState(defaultValues?.lon?.toString() || '')
  const [lat, setLat] = useState(defaultValues?.lat?.toString() || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !lon || !lat) return

    onSubmit({
      name,
      lon: Number(lon),
      lat: Number(lat),
    })
  }

  const isFormValid = name && lon && lat

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Нова зупинка' : 'Редагувати зупинку'}</CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Створіть нову зупинку транспорту'
            : 'Оновіть інформацію про зупинку'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stop-name">Назва зупинки</Label>
            <Input
              id="stop-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: Площа Ринок"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="longitude">Довгота (Longitude)</Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="24.031594"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">Широта (Latitude)</Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="49.842957"
              />
            </div>
          </div>

          {error && (
            <ErrorState
              title={`Помилка ${mode === 'create' ? 'створення' : 'оновлення'} зупинки`}
              message={error.message}
              className="mt-4"
            />
          )}

          <Button type="submit" disabled={isLoading || !isFormValid} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Створити зупинку' : 'Оновити зупинку'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
