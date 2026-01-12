import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MapRoute,
} from '@/components/ui/map'
import { StatCard } from '@/components/domain/stats/StatCard'
import { TableSkeleton, EmptyState, ErrorState } from '@/components/domain/data-display'
import { getTransportTypes } from '@/lib/guest-api'
import {
  finishDriverTrip,
  getDriverActiveTrip,
  getDriverProfile,
  getDriverRoutePoints,
  getDriverRouteStops,
  getDriverSchedule,
  startDriverTrip,
  updateTripPassengerCount,
  type DriverDirection,
  type DriverTrip,
  type RouteLookupParams,
} from '@/lib/driver-api'
import { useGpsTracking } from '@/hooks/use-gps-tracking'
import { toast } from 'sonner'
import { User, MapPin, Navigation, Calendar, Clock, Users, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/driver')({
  component: DriverPage,
})

const directionLabels: Record<DriverDirection, string> = {
  forward: 'Прямий',
  reverse: 'Зворотній',
}

const LVIV_CENTER: [number, number] = [24.0316, 49.8429]

type RouteFormState = {
  routeId: string
  routeNumber: string
  transportTypeId: string
  direction: DriverDirection
}

function DriverPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [scheduleDate, setScheduleDate] = useState(() => toDateInputValue(new Date()))
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [passengerTripId, setPassengerTripId] = useState<string | null>(null)
  const [passengerCount, setPassengerCount] = useState('')
  const [startFleetNumber, setStartFleetNumber] = useState('')
  const [startDirection, setStartDirection] = useState<DriverDirection>('forward')
  const [startTime, setStartTime] = useState('')
  const [finishTime, setFinishTime] = useState('')
  const [routeForm, setRouteForm] = useState<RouteFormState>({
    routeId: '',
    routeNumber: '',
    transportTypeId: '',
    direction: 'forward',
  })
  const [routeQuery, setRouteQuery] = useState<RouteLookupParams | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  // Queries
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: getDriverProfile,
  })

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['driver-schedule', scheduleDate],
    queryFn: () => getDriverSchedule(scheduleDate || undefined),
  })

  const { data: activeTrip, isLoading: activeTripLoading } = useQuery({
    queryKey: ['driver-active-trip'],
    queryFn: getDriverActiveTrip,
  })

  const { data: transportTypes } = useQuery({
    queryKey: ['transport-types'],
    queryFn: getTransportTypes,
  })

  const { data: routeStops } = useQuery({
    queryKey: ['driver-route-stops', routeQuery],
    queryFn: () => getDriverRouteStops(routeQuery!),
    enabled: !!routeQuery,
  })

  const { data: routePoints } = useQuery({
    queryKey: ['driver-route-points', routeQuery],
    queryFn: () => getDriverRoutePoints(routeQuery!),
    enabled: !!routeQuery,
  })

  // GPS Tracking
  const { currentLocation, error: geoError } = useGpsTracking({
    activeTripId: activeTrip?.id,
    enabled: true,
  })

  // Mutations
  const startTripMutation = useMutation({
    mutationFn: startDriverTrip,
    onSuccess: () => {
      setStartFleetNumber('')
      setStartTime('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
      toast.success('Рейс розпочато!', {
        description: 'GPS моніторинг активовано',
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка запуску рейсу', {
        description: error.message,
      })
    },
  })

  const finishTripMutation = useMutation({
    mutationFn: finishDriverTrip,
    onSuccess: () => {
      setFinishTime('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
      toast.success('Рейс завершено!', {
        description: 'Дякуємо за роботу',
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка завершення рейсу', {
        description: error.message,
      })
    },
  })

  const passengerCountMutation = useMutation({
    mutationFn: updateTripPassengerCount,
    onSuccess: () => {
      setPassengerCount('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      toast.success('Дані оновлено', {
        description: 'Кількість пасажирів збережено',
      })
    },
    onError: (error: Error) => {
      toast.error('Помилка оновлення даних', {
        description: error.message,
      })
    },
  })

  // Computed values
  const resolvedTripId = useMemo(() => {
    const trips = schedule?.trips ?? []
    if (trips.length === 0) return null
    if (selectedTripId && trips.some((trip) => trip.id === selectedTripId)) {
      return selectedTripId
    }
    if (activeTrip?.id && trips.some((trip) => trip.id === activeTrip.id)) {
      return activeTrip.id
    }
    return trips[0].id
  }, [activeTrip?.id, schedule, selectedTripId])

  const selectedTrip = useMemo(() => {
    const trips = schedule?.trips ?? []
    if (trips.length === 0 || !resolvedTripId) return null
    return trips.find((trip) => trip.id === resolvedTripId) ?? null
  }, [schedule, resolvedTripId])

  const routeOptions = useMemo(() => {
    if (!schedule?.trips?.length) return []
    const seen = new Map<number, DriverTrip>()
    for (const trip of schedule.trips) {
      if (!seen.has(trip.route.id)) {
        seen.set(trip.route.id, trip)
      }
    }
    return Array.from(seen.values())
  }, [schedule])

  const resolvedPassengerTripId = useMemo(() => {
    if (passengerTripId) return passengerTripId
    if (activeTrip?.id) return String(activeTrip.id)
    const trips = schedule?.trips ?? []
    if (trips.length === 0) return null
    return String(trips[0].id)
  }, [activeTrip, passengerTripId, schedule])

  const passengerTripOptions = useMemo(() => {
    const options = schedule?.trips ? [...schedule.trips] : []
    if (activeTrip && !options.some((trip) => trip.id === activeTrip.id)) {
      options.unshift({
        id: activeTrip.id,
        startsAt: activeTrip.startsAt,
        endsAt: activeTrip.endsAt,
        passengerCount: 0,
        route: activeTrip.route,
        vehicle: activeTrip.vehicle,
        transportType: activeTrip.transportType,
        stops: [],
      })
    }
    return options
  }, [activeTrip, schedule])

  const selectedPassengerTrip = useMemo(() => {
    if (!resolvedPassengerTripId) return null
    return passengerTripOptions.find((trip) => String(trip.id) === resolvedPassengerTripId) ?? null
  }, [passengerTripOptions, resolvedPassengerTripId])

  const routeCoordinates = useMemo(() => {
    if (!routePoints?.length) return []
    return routePoints
      .map((point) => [Number(point.lon), Number(point.lat)] as [number, number])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
  }, [routePoints])

  const mapCenter = useMemo(() => {
    if (currentLocation) {
      return [currentLocation.lon, currentLocation.lat] as [number, number]
    }
    if (routeCoordinates.length > 0) {
      return routeCoordinates[0]
    }
    return LVIV_CENTER
  }, [currentLocation, routeCoordinates])

  // Statistics
  const stats = useMemo(() => {
    const trips = schedule?.trips || []
    const completedTrips = trips.filter((t) => t.endsAt).length
    const totalTrips = trips.length
    const avgDelay =
      trips.length > 0
        ? trips.reduce((sum, t) => sum + (t.startDelayMin || 0), 0) / trips.length
        : 0

    return {
      totalTrips,
      completedTrips,
      avgDelay: avgDelay.toFixed(1),
    }
  }, [schedule])

  // Handlers
  const handleStartTrip = () => {
    const fleetNumber = startFleetNumber.trim()
    if (!fleetNumber) {
      toast.error('Введіть бортовий номер')
      return
    }
    startTripMutation.mutate({
      fleetNumber,
      direction: startDirection,
      startedAt: startTime ? new Date(startTime).toISOString() : undefined,
    })
  }

  const handleFinishTrip = () => {
    finishTripMutation.mutate({
      endedAt: finishTime ? new Date(finishTime).toISOString() : undefined,
    })
  }

  const handleApplyRouteLookup = () => {
    if (routeForm.routeId) {
      setRouteQuery({ routeId: Number(routeForm.routeId) })
      return
    }

    const routeNumber = routeForm.routeNumber.trim()
    if (!routeNumber) {
      setRouteQuery(null)
      return
    }

    setRouteQuery({
      routeNumber,
      transportTypeId: routeForm.transportTypeId ? Number(routeForm.transportTypeId) : undefined,
      direction: routeForm.direction,
    })
  }

  const handleSelectTripForRoute = (value: string) => {
    if (!schedule?.trips?.length) return
    const trip = schedule.trips.find((item) => String(item.route.id) === value)
    if (!trip) return

    setRouteForm({
      routeId: String(trip.route.id),
      routeNumber: trip.route.number,
      transportTypeId: String(trip.route.transportTypeId),
      direction: trip.route.direction,
    })
    setRouteQuery({ routeId: trip.route.id })
  }

  const handlePassengerSubmit = () => {
    if (!resolvedPassengerTripId || passengerCount === '') {
      toast.error('Заповніть кількість пасажирів')
      return
    }
    passengerCountMutation.mutate({
      tripId: Number(resolvedPassengerTripId),
      passengerCount: Number(passengerCount),
    })
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Головна</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Водій</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-display-sm">Кабінет водія</h1>
          <p className="text-body-md text-muted-foreground mt-2">
            Управління рейсами та GPS моніторинг
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Огляд</TabsTrigger>
            <TabsTrigger value="schedule">Розклад</TabsTrigger>
            <TabsTrigger value="control">Управління</TabsTrigger>
            <TabsTrigger value="map">Карта маршруту</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Рейсів сьогодні"
                value={stats.totalTrips}
                icon={Calendar}
                description="Загальна кількість"
              />
              <StatCard
                title="Завершено"
                value={stats.completedTrips}
                icon={Clock}
                description={`з ${stats.totalTrips}`}
                variant={stats.completedTrips === stats.totalTrips ? 'success' : 'default'}
              />
              <StatCard
                title="Середнє відхилення"
                value={`${stats.avgDelay} хв`}
                icon={Navigation}
                description="Від розкладу"
                variant={Math.abs(Number(stats.avgDelay)) > 5 ? 'warning' : 'success'}
              />
              <StatCard
                title="GPS статус"
                value={currentLocation ? 'Активний' : 'Очікування'}
                icon={MapPin}
                description={geoError || 'Моніторинг ввімкнено'}
                variant={currentLocation ? 'success' : 'default'}
              />
            </div>

            {/* Profile and Active Trip */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <CardTitle>Профіль водія</CardTitle>
                  </div>
                  <CardDescription>Особиста інформація</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profileLoading ? (
                    <TableSkeleton rows={5} cols={1} />
                  ) : profile ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ПІБ:</span>
                        <span className="font-medium">{profile.fullName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Логін:</span>
                        <span className="font-medium">{profile.login}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Телефон:</span>
                        <span className="font-medium">{profile.phone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{profile.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ліцензія:</span>
                        <span className="font-medium">{profile.driverLicenseNumber}</span>
                      </div>
                    </>
                  ) : (
                    <ErrorState title="Помилка завантаження" message="Не вдалося завантажити профіль" />
                  )}
                </CardContent>
              </Card>

              {/* Active Trip Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    <CardTitle>Активний рейс</CardTitle>
                  </div>
                  <CardDescription>Поточна зміна</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeTripLoading ? (
                    <TableSkeleton rows={3} cols={1} />
                  ) : activeTrip ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Маршрут {activeTrip.route.number}</Badge>
                        <Badge variant="outline">{directionLabels[activeTrip.route.direction]}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {activeTrip.transportType.name}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Транспорт:</span>
                        <span className="font-medium">{activeTrip.vehicle.fleetNumber}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Початок:</span>
                        <span className="font-medium">{formatDateTime(activeTrip.startsAt)}</span>
                      </div>
                      {currentLocation && (
                        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
                          <MapPin className="h-4 w-4 text-success" />
                          <span className="text-sm text-success font-medium">
                            GPS: {currentLocation.lat.toFixed(5)}, {currentLocation.lon.toFixed(5)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Navigation}
                      title="Активного рейсу немає"
                      description="Розпочніть рейс у розділі 'Управління'"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle>Робочий графік</CardTitle>
                    <CardDescription>Перегляд призначених рейсів</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-[170px]"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleLoading ? (
                  <TableSkeleton rows={5} cols={8} />
                ) : schedule ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={schedule.assigned ? 'success' : 'outline'}>
                        {schedule.assigned ? 'Призначено' : 'Без призначень'}
                      </Badge>
                      {schedule.route && (
                        <Badge variant="outline">Маршрут {schedule.route.number}</Badge>
                      )}
                      {schedule.transportType?.name && (
                        <span className="text-sm text-muted-foreground">
                          {schedule.transportType.name}
                        </span>
                      )}
                      {schedule.vehicle?.fleetNumber && (
                        <span className="text-sm text-muted-foreground">
                          Транспорт: {schedule.vehicle.fleetNumber}
                        </span>
                      )}
                    </div>

                    {schedule.schedule && (
                      <div className="grid gap-3 md:grid-cols-3 text-sm">
                        <div>
                          <span className="font-medium">Початок зміни:</span>{' '}
                          {formatTime(schedule.schedule.workStartTime)}
                        </div>
                        <div>
                          <span className="font-medium">Кінець зміни:</span>{' '}
                          {formatTime(schedule.schedule.workEndTime)}
                        </div>
                        <div>
                          <span className="font-medium">Інтервал:</span> {schedule.schedule.intervalMin} хв
                        </div>
                      </div>
                    )}

                    {schedule.trips.length > 0 ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Старт</TableHead>
                              <TableHead>План</TableHead>
                              <TableHead>Відхилення</TableHead>
                              <TableHead>Фініш</TableHead>
                              <TableHead>Маршрут</TableHead>
                              <TableHead>Транспорт</TableHead>
                              <TableHead>Пасажири</TableHead>
                              <TableHead className="text-right">Дії</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {schedule.trips.map((trip) => (
                              <TableRow
                                key={trip.id}
                                className={resolvedTripId === trip.id ? 'bg-muted/40' : undefined}
                              >
                                <TableCell>{formatDateTime(trip.startsAt)}</TableCell>
                                <TableCell>{formatDateTime(trip.plannedStartAt)}</TableCell>
                                <TableCell>{formatDelay(trip.startDelayMin)}</TableCell>
                                <TableCell>
                                  {trip.endsAt ? formatDateTime(trip.endsAt) : 'В процесі'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{trip.route.number}</Badge>
                                    <Badge variant="secondary">
                                      {directionLabels[trip.route.direction]}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>{trip.vehicle.fleetNumber}</TableCell>
                                <TableCell>{trip.passengerCount ?? 0}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedTripId(trip.id)}
                                  >
                                    Деталі
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={Calendar}
                        title="Рейсів не знайдено"
                        description="На обрану дату немає призначених рейсів"
                      />
                    )}

                    {/* Trip Stops */}
                    {selectedTrip && (
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle>Зупинки рейсу</CardTitle>
                          <CardDescription>Інтервали між зупинками</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="outline">Маршрут {selectedTrip.route.number}</Badge>
                              <Badge variant="secondary">
                                {directionLabels[selectedTrip.route.direction]}
                              </Badge>
                              <span className="text-muted-foreground">
                                {selectedTrip.transportType.name}
                              </span>
                            </div>
                            <div className="rounded-md border max-h-[320px] overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Зупинка</TableHead>
                                    <TableHead>Координати</TableHead>
                                    <TableHead>Інтервал до наступної</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedTrip.stops.map((stop) => (
                                    <TableRow key={stop.id}>
                                      <TableCell>{stop.name}</TableCell>
                                      <TableCell>
                                        {formatCoord(stop.lat)}, {formatCoord(stop.lon)}
                                      </TableCell>
                                      <TableCell>
                                        {stop.minutesToNextStop != null
                                          ? `${stop.minutesToNextStop} хв`
                                          : '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="Немає даних"
                    description="Не вдалося завантажити розклад"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trip Control Tab */}
          <TabsContent value="control" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Start/Finish Trip */}
              <Card>
                <CardHeader>
                  <CardTitle>Керування рейсом</CardTitle>
                  <CardDescription>Запуск та завершення поїздки</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fleet-number">Бортовий номер *</Label>
                      <Input
                        id="fleet-number"
                        placeholder="Напр. 102"
                        value={startFleetNumber}
                        onChange={(e) => setStartFleetNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Напрямок *</Label>
                      <Select
                        value={startDirection}
                        onValueChange={(value) => setStartDirection(value as DriverDirection)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть напрямок" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forward">Прямий</SelectItem>
                          <SelectItem value="reverse">Зворотній</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start-time">Час старту (опційно)</Label>
                      <Input
                        id="start-time"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleStartTrip}
                      disabled={startTripMutation.isPending || !startFleetNumber.trim() || !!activeTrip}
                      className="flex-1"
                    >
                      {startTripMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Розпочати рейс
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="finish-time">Час завершення (опційно)</Label>
                    <Input
                      id="finish-time"
                      type="datetime-local"
                      value={finishTime}
                      onChange={(e) => setFinishTime(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleFinishTrip}
                    disabled={finishTripMutation.isPending || !activeTrip}
                    className="w-full"
                  >
                    {finishTripMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Завершити рейс
                  </Button>
                </CardContent>
              </Card>

              {/* Passenger Count */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>Кількість пасажирів</CardTitle>
                  </div>
                  <CardDescription>Введення пасажиропотоку за рейс</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Рейс</Label>
                      <Select
                        value={resolvedPassengerTripId || undefined}
                        onValueChange={(value) => setPassengerTripId(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть рейс" />
                        </SelectTrigger>
                        <SelectContent>
                          {passengerTripOptions.map((trip) => (
                            <SelectItem key={trip.id} value={String(trip.id)}>
                              {trip.route.number} • {formatDateTime(trip.startsAt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedPassengerTrip && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Маршрут</Label>
                            <Input value={selectedPassengerTrip.route.number} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label>Транспорт</Label>
                            <Input value={selectedPassengerTrip.vehicle.fleetNumber} readOnly />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="passenger-count">Кількість пасажирів *</Label>
                          <Input
                            id="passenger-count"
                            type="number"
                            min={0}
                            value={passengerCount}
                            onChange={(e) => setPassengerCount(e.target.value)}
                            placeholder="Введіть кількість"
                          />
                        </div>

                        <Button
                          onClick={handlePassengerSubmit}
                          disabled={
                            passengerCountMutation.isPending ||
                            !resolvedPassengerTripId ||
                            passengerCount === ''
                          }
                          className="w-full"
                        >
                          {passengerCountMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Зберегти
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Route Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Маршрут для відображення</CardTitle>
                <CardDescription>Зупинки та точки маршруту</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Рейс з розкладу</Label>
                    <Select value={routeForm.routeId || undefined} onValueChange={handleSelectTripForRoute}>
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть рейс" />
                      </SelectTrigger>
                      <SelectContent>
                        {routeOptions.map((trip) => (
                          <SelectItem key={trip.route.id} value={String(trip.route.id)}>
                            {trip.route.number} • {directionLabels[trip.route.direction]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-number">Номер маршруту</Label>
                    <Input
                      id="route-number"
                      placeholder="Напр. 5А"
                      value={routeForm.routeNumber}
                      onChange={(e) =>
                        setRouteForm((prev) => ({ ...prev, routeId: '', routeNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Тип транспорту</Label>
                    <Select
                      value={routeForm.transportTypeId || undefined}
                      onValueChange={(value) =>
                        setRouteForm((prev) => ({ ...prev, routeId: '', transportTypeId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {transportTypes?.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Напрямок</Label>
                    <Select
                      value={routeForm.direction}
                      onValueChange={(value) =>
                        setRouteForm((prev) => ({ ...prev, routeId: '', direction: value as DriverDirection }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть напрямок" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="forward">Прямий</SelectItem>
                        <SelectItem value="reverse">Зворотній</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleApplyRouteLookup}>Показати</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRouteQuery(null)
                      setRouteForm({
                        routeId: '',
                        routeNumber: '',
                        transportTypeId: '',
                        direction: 'forward',
                      })
                    }}
                  >
                    Очистити
                  </Button>
                </div>

                {routeQuery && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Route Stops Table */}
                    <div className="space-y-2">
                      <h3 className="text-heading-sm">Зупинки маршруту</h3>
                      {routeStops && routeStops.length > 0 ? (
                        <div className="rounded-md border max-h-[360px] overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Назва</TableHead>
                                <TableHead>Координати</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {routeStops.map((stop) => (
                                <TableRow key={`${stop.routeId}-${stop.stopId}`}>
                                  <TableCell>{stop.stopId}</TableCell>
                                  <TableCell>{stop.stopName}</TableCell>
                                  <TableCell>
                                    {formatCoord(stop.lat)}, {formatCoord(stop.lon)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <EmptyState
                          icon={MapPin}
                          title="Зупинок не знайдено"
                          description="Оберіть маршрут для відображення зупинок"
                        />
                      )}
                    </div>

                    {/* Map */}
                    <div className="space-y-2">
                      <h3 className="text-heading-sm">Візуалізація маршруту</h3>
                      <div className="rounded-md border overflow-hidden">
                        <div className="h-[400px]">
                          <MapView ref={mapRef} center={mapCenter} zoom={12}>
                            <MapControls
                              showLocate
                              showFullscreen
                              onLocate={(coords) =>
                                toast.success('Геолокацію оновлено', {
                                  description: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
                                })
                              }
                            />
                            {routeCoordinates.length >= 2 && (
                              <MapRoute coordinates={routeCoordinates} color="#2563EB" width={4} opacity={0.85} />
                            )}
                            {routeStops?.map((stop) => (
                              <MapMarker
                                key={`${stop.routeId}-${stop.stopId}`}
                                longitude={Number(stop.lon)}
                                latitude={Number(stop.lat)}
                              >
                                <MarkerContent>
                                  <div className="h-2 w-2 rounded-full bg-white border border-blue-600 shadow-sm" />
                                </MarkerContent>
                              </MapMarker>
                            ))}
                            {currentLocation && (
                              <MapMarker longitude={currentLocation.lon} latitude={currentLocation.lat}>
                                <MarkerContent>
                                  <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
                                </MarkerContent>
                              </MapMarker>
                            )}
                          </MapView>
                        </div>
                      </div>
                      {geoError && (
                        <p className="text-sm text-warning">{geoError}</p>
                      )}
                    </div>
                  </div>
                )}

                {!routeQuery && (
                  <EmptyState
                    icon={MapPin}
                    title="Маршрут не обрано"
                    description="Вкажіть маршрут або оберіть рейс із розкладу для відображення на мапі"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Utility functions
function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  return value.length >= 5 ? value.slice(0, 5) : value
}

function formatDelay(value?: number | null) {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value)} хв`
}

function formatCoord(value?: string | number | null) {
  if (value == null) return '—'
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return String(value)
  return numberValue.toFixed(5)
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
