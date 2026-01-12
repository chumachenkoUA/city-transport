import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FormSection } from '@/components/domain/forms'
import { ErrorState } from '@/components/domain/data-display'
import { Search, CreditCard, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  checkControllerCard,
  issueControllerFine,
  getRoutes,
  getVehicles,
  getActiveTrips,
} from '@/lib/controller-api'
import { toast } from 'sonner'

export const Route = createFileRoute('/controller')({
  component: ControllerPage,
})

function ControllerPage() {
  const [cardNumber, setCardNumber] = useState('')
  const [cardDetails, setCardDetails] = useState<any>(null)
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedTripId, setSelectedTripId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [checkedAt, setCheckedAt] = useState('')

  // Routes query
  const { data: routes } = useQuery({
    queryKey: ['controller-routes'],
    queryFn: getRoutes,
  })

  // Vehicles query (filtered by route)
  const { data: vehicles } = useQuery({
    queryKey: ['controller-vehicles', selectedRouteId],
    queryFn: () => getVehicles(selectedRouteId ? Number(selectedRouteId) : undefined),
    enabled: !!selectedRouteId,
  })

  // Active trips query
  const { data: activeTrips } = useQuery({
    queryKey: ['controller-trips', selectedVehicleId, checkedAt],
    queryFn: () => {
      const vehicle = vehicles?.find((v) => v.id === Number(selectedVehicleId))
      if (!vehicle) return Promise.resolve([])
      return getActiveTrips(vehicle.fleetNumber, checkedAt ? new Date(checkedAt).toISOString() : undefined)
    },
    enabled: !!selectedVehicleId && !!vehicles,
  })

  // Check card mutation
  const checkMutation = useMutation({
    mutationFn: checkControllerCard,
    onSuccess: (data) => {
      setCardDetails(data)
      toast.success('Картку перевірено', {
        description: `Пасажир: ${data.firstName} ${data.lastName}`,
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка перевірки картки', {
        description: error.message,
      })
    },
  })

  // Issue fine mutation
  const fineMutation = useMutation({
    mutationFn: issueControllerFine,
    onSuccess: (data) => {
      toast.success('Штраф виписано успішно!', {
        description: `ID штрафу: ${data.fineId}`,
      })
      // Reset form
      setAmount('')
      setReason('')
      setSelectedRouteId('')
      setSelectedVehicleId('')
      setSelectedTripId('')
      setCheckedAt('')
    },
    onError: (error: Error) => {
      toast.error('Помилка виписування штрафу', {
        description: error.message,
      })
    },
  })

  const formattedBalance = useMemo(() => {
    if (!cardDetails) return '—'
    const balance = Number(cardDetails.balance)
    if (Number.isNaN(balance)) return cardDetails.balance
    return `${balance.toFixed(2)} ₴`
  }, [cardDetails])

  const handleCheckCard = () => {
    const trimmed = cardNumber.trim()
    if (!trimmed) {
      toast.error('Введіть номер картки')
      return
    }
    checkMutation.mutate(trimmed)
  }

  const handleIssueFine = () => {
    if (!cardDetails?.cardNumber || !amount || !reason) {
      toast.error('Заповніть всі обов\'язкові поля')
      return
    }

    const checkedAtValue = checkedAt ? new Date(checkedAt) : null
    if (checkedAtValue && checkedAtValue.getTime() > Date.now() + 5 * 60 * 1000) {
      toast.error('Час перевірки не може бути у майбутньому')
      return
    }

    fineMutation.mutate({
      cardNumber: cardDetails.cardNumber,
      tripId: selectedTripId ? Number(selectedTripId) : undefined,
      checkedAt: checkedAtValue?.toISOString() || new Date().toISOString(),
      amount: Number(amount),
      reason,
    })
  }

  const isFormValid = cardDetails && amount && reason

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Головна</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Контролер</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-display-sm">Кабінет контролера</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Перевірка транспортних карток та виписування штрафів
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Card Check Section */}
          <FormSection
            title="Перевірка картки"
            description="Введіть номер транспортної картки пасажира"
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="card-number">Номер картки</Label>
                  <Input
                    id="card-number"
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="Наприклад: CARD-001"
                    onKeyDown={(e) => e.key === 'Enter' && handleCheckCard()}
                  />
                </div>
                <div className="self-end">
                  <Button
                    onClick={handleCheckCard}
                    disabled={checkMutation.isPending}
                  >
                    {checkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Перевірити</span>
                  </Button>
                </div>
              </div>

              {checkMutation.error && (
                <ErrorState
                  title="Помилка"
                  message={checkMutation.error.message}
                  onRetry={handleCheckCard}
                />
              )}
            </div>
          </FormSection>

          {/* Card Details Display */}
          {cardDetails && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <CardTitle>Інформація про картку</CardTitle>
                </div>
                <CardDescription>Дані перевіреної картки</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Номер:</span>
                  <Badge variant="outline">{cardDetails.cardNumber}</Badge>
                </div>
                <Separator />
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Пасажир:</span>
                    <span className="font-medium">
                      {cardDetails.firstName} {cardDetails.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Баланс:</span>
                    <span className={`font-medium ${Number(cardDetails.balance) < 0 ? 'text-destructive' : 'text-success'}`}>
                      {formattedBalance}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Fine Issuance Section */}
        {cardDetails && (
          <FormSection
            title="Виписування штрафу"
            description="Заповніть деталі порушення та виписати штраф"
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="route">Маршрут</Label>
                  <Select
                    value={selectedRouteId}
                    onValueChange={(value) => {
                      setSelectedRouteId(value)
                      setSelectedVehicleId('')
                      setSelectedTripId('')
                    }}
                  >
                    <SelectTrigger id="route">
                      <SelectValue placeholder="Оберіть маршрут" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes?.map((route) => (
                        <SelectItem key={route.id} value={String(route.id)}>
                          {route.number} • {route.transportTypeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle">Транспорт</Label>
                  <Select
                    value={selectedVehicleId}
                    onValueChange={(value) => {
                      setSelectedVehicleId(value)
                      setSelectedTripId('')
                    }}
                    disabled={!selectedRouteId}
                  >
                    <SelectTrigger id="vehicle">
                      <SelectValue placeholder={selectedRouteId ? "Оберіть транспорт" : "Спочатку оберіть маршрут"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                          {vehicle.fleetNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeTrips && activeTrips.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="trip">Рейс (опціонально)</Label>
                  <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                    <SelectTrigger id="trip">
                      <SelectValue placeholder="Оберіть рейс" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTrips.map((trip) => (
                        <SelectItem key={trip.tripId} value={String(trip.tripId)}>
                          Рейс #{trip.tripId} • {trip.startTime || 'Активний'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Сума штрафу (₴) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checked-at">Час перевірки (опціонально)</Label>
                  <Input
                    id="checked-at"
                    type="datetime-local"
                    value={checkedAt}
                    onChange={(e) => setCheckedAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Причина штрафу *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Опишіть порушення..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <p className="text-sm text-muted-foreground">
                  Переконайтесь, що всі дані введено коректно перед виписуванням штрафу
                </p>
              </div>

              <Button
                onClick={handleIssueFine}
                disabled={fineMutation.isPending || !isFormValid}
                className="w-full"
                size="lg"
              >
                {fineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Виписати штраф
              </Button>
            </div>
          </FormSection>
        )}
      </div>
    </div>
  )
}
