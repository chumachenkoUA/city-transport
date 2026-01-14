import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FormSection } from '@/components/domain/forms'
import { ErrorState } from '@/components/domain/data-display'
import { Search, CreditCard, AlertTriangle, CheckCircle2, Loader2, Clock, Bus, MapPin, User } from 'lucide-react'
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
  const [selectedFleetNumber, setSelectedFleetNumber] = useState('')
  const [selectedTripId, setSelectedTripId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  // Routes query
  const { data: routes } = useQuery({
    queryKey: ['controller-routes'],
    queryFn: getRoutes,
  })

  // Vehicles query (filtered by route if selected)
  const { data: vehicles } = useQuery({
    queryKey: ['controller-vehicles', selectedRouteId],
    queryFn: () => getVehicles(selectedRouteId ? Number(selectedRouteId) : undefined),
  })

  // Active trips query
  const { data: activeTrips, isLoading: tripsLoading } = useQuery({
    queryKey: ['controller-trips', selectedFleetNumber],
    queryFn: () => getActiveTrips(selectedFleetNumber),
    enabled: !!selectedFleetNumber,
    refetchInterval: 30000, // Auto-refresh every 30s
  })

  // Auto-select first trip when trips load
  useEffect(() => {
    if (activeTrips && activeTrips.length > 0 && !selectedTripId) {
      setSelectedTripId(String(activeTrips[0].tripId))
    }
  }, [activeTrips, selectedTripId])

  // Check card mutation
  const checkMutation = useMutation({
    mutationFn: checkControllerCard,
    onSuccess: (data) => {
      setCardDetails(data)
      toast.success('Картку перевірено', {
        description: `Пасажир: ${data.userFullName}`,
      })
    },
    onError: (error: Error) => {
      setCardDetails(null)
      toast.error('Помилка перевірки картки', {
        description: error.message,
      })
    },
  })

  // Issue fine mutation
  const fineMutation = useMutation({
    mutationFn: issueControllerFine,
    onSuccess: () => {
      toast.success('Штраф виписано успішно!')
      // Reset fine form only
      setAmount('')
      setReason('')
      setCardNumber('')
      setCardDetails(null)
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

    if (!selectedTripId && !selectedFleetNumber) {
      toast.error('Оберіть транспорт або рейс')
      return
    }

    fineMutation.mutate({
      cardNumber: cardDetails.cardNumber,
      fleetNumber: selectedFleetNumber || undefined,
      tripId: selectedTripId ? Number(selectedTripId) : undefined,
      checkedAt: new Date().toISOString(),
      amount: Number(amount),
      reason,
    })
  }

  const selectedVehicle = vehicles?.find(v => v.fleetNumber === selectedFleetNumber)
  const selectedTrip = activeTrips?.find(t => String(t.tripId) === selectedTripId)
  const hasActiveTrip = activeTrips && activeTrips.length > 0
  const isFormValid = cardDetails && amount && reason && (selectedTripId || selectedFleetNumber)

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-display-sm">Кабінет контролера</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Перевірка транспортних карток та виписування штрафів
          </p>
        </div>

        {/* Step 1: Transport Selection */}
        <FormSection
          title="1. Оберіть транспорт"
          description="Виберіть транспортний засіб, на якому проводите перевірку"
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="route">Маршрут (фільтр)</Label>
                <Select
                  value={selectedRouteId || '_all'}
                  onValueChange={(value) => {
                    setSelectedRouteId(value === '_all' ? '' : value)
                    setSelectedFleetNumber('')
                    setSelectedTripId('')
                  }}
                >
                  <SelectTrigger id="route">
                    <SelectValue placeholder="Всі маршрути" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Всі маршрути</SelectItem>
                    {routes?.map((route) => (
                      <SelectItem key={route.id} value={String(route.id)}>
                        {route.number} • {route.transportType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle">Бортовий номер *</Label>
                <Select
                  value={selectedFleetNumber}
                  onValueChange={(value) => {
                    setSelectedFleetNumber(value)
                    setSelectedTripId('')
                  }}
                >
                  <SelectTrigger id="vehicle">
                    <SelectValue placeholder="Оберіть транспорт" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles?.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.fleetNumber}>
                        {vehicle.fleetNumber}
                        {vehicle.routeNumber && ` • ${vehicle.routeNumber}`}
                        {vehicle.transportType && ` • ${vehicle.transportType}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active trips display */}
            {selectedFleetNumber && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Активні рейси</Label>
                  {tripsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {hasActiveTrip ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {activeTrips.map((trip) => (
                      <div
                        key={trip.tripId}
                        onClick={() => setSelectedTripId(String(trip.tripId))}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedTripId === String(trip.tripId)
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={trip.status === 'in_progress' ? 'default' : 'secondary'}>
                            {trip.status === 'in_progress' ? 'В дорозі' : trip.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">#{trip.tripId}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Bus className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{trip.routeNumber}</span>
                            <span className="text-muted-foreground">• {trip.transportType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{trip.driverName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {trip.actualStartsAt
                                ? `Розп. ${new Date(trip.actualStartsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
                                : `План ${new Date(trip.plannedStartsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border border-dashed text-center">
                    <Bus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Немає активних рейсів на транспорті {selectedFleetNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Штраф можна виписати, але без прив'язки до рейсу
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormSection>

        {/* Step 2: Card Check */}
        {selectedFleetNumber && (
          <FormSection
            title="2. Перевірка картки"
            description="Введіть номер транспортної картки пасажира"
          >
            <div className="grid gap-6 lg:grid-cols-2">
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
                    title="Картку не знайдено"
                    message={checkMutation.error.message}
                    onRetry={handleCheckCard}
                  />
                )}
              </div>

              {/* Card Details Display */}
              {cardDetails && (
                <Card className="border-success/30 bg-success/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <CardTitle className="text-base">Картка знайдена</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">{cardDetails.cardNumber}</Badge>
                    </div>
                    <Separator />
                    <div className="grid gap-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Пасажир:</span>
                        <span className="font-medium">{cardDetails.userFullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Баланс:</span>
                        <span className={`font-medium ${Number(cardDetails.balance) < 0 ? 'text-destructive' : 'text-success'}`}>
                          {formattedBalance}
                        </span>
                      </div>
                    </div>

                    {cardDetails.lastUsageAt && (
                      <>
                        <Separator />
                        <div className="text-xs text-muted-foreground">
                          <span>Остання поїздка: </span>
                          {new Date(cardDetails.lastUsageAt).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {cardDetails.lastRouteNumber && ` • ${cardDetails.lastRouteNumber}`}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </FormSection>
        )}

        {/* Step 3: Issue Fine */}
        {cardDetails && selectedFleetNumber && (
          <FormSection
            title="3. Виписування штрафу"
            description="Вкажіть суму та причину штрафу"
          >
            <div className="space-y-4">
              {/* Summary of selected context */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Bus className="h-4 w-4 text-muted-foreground" />
                  <span>Транспорт: <strong>{selectedFleetNumber}</strong></span>
                  {selectedVehicle?.routeNumber && (
                    <span className="text-muted-foreground">• Маршрут {selectedVehicle.routeNumber}</span>
                  )}
                </div>
                {selectedTrip && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Рейс: <strong>#{selectedTrip.tripId}</strong></span>
                    <span className="text-muted-foreground">• Водій: {selectedTrip.driverName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>Пасажир: <strong>{cardDetails.userFullName}</strong></span>
                  <span className="text-muted-foreground">• {cardDetails.cardNumber}</span>
                </div>
              </div>

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
                  <Label htmlFor="reason">Причина *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Безквитковий проїзд"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Перевірте дані перед виписуванням штрафу
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
