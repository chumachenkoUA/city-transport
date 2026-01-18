import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  getDriverScheduledTrips,
  startDriverTrip,
  updateTripPassengerCount,
  type DriverDirection,
  type DriverTrip,
  type RouteLookupParams,
} from '@/lib/driver-api'
import { useGpsTracking } from '@/hooks/use-gps-tracking'
import { toast } from 'sonner'
import { User, MapPin, Navigation, Calendar, Clock, Users, Loader2, Play, Square } from 'lucide-react'

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
  const [passengerTripId, setPassengerTripId] = useState<string | null>(null)
  const [passengerCount, setPassengerCount] = useState('')
  const [finishTime, setFinishTime] = useState('')
  const [routeForm, setRouteForm] = useState<RouteFormState>({
    routeId: '',
    routeNumber: '',
    transportTypeId: '',
    direction: 'forward',
  })
  const [routeQuery, setRouteQuery] = useState<RouteLookupParams | null>(null)

  // Queries
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: getDriverProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile rarely changes
  })

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['driver-schedule', scheduleDate],
    queryFn: () => getDriverSchedule(scheduleDate || undefined),
    staleTime: 60 * 1000, // 1 minute
  })

  const { data: activeTrip, isLoading: activeTripLoading } = useQuery({
    queryKey: ['driver-active-trip'],
    queryFn: getDriverActiveTrip,
    staleTime: 30 * 1000, // 30 seconds - needs fresher data
  })

  const { data: scheduledTrips, isLoading: scheduledTripsLoading } = useQuery({
    queryKey: ['driver-scheduled-trips'],
    queryFn: getDriverScheduledTrips,
    staleTime: 30 * 1000, // 30 seconds - aligned with activeTrip for consistency
  })

  const { data: transportTypes } = useQuery({
    queryKey: ['transport-types'],
    queryFn: getTransportTypes,
    staleTime: 10 * 60 * 1000, // 10 minutes - static data
  })

  const { data: routeStops } = useQuery({
    queryKey: ['driver-route-stops', routeQuery],
    queryFn: () => getDriverRouteStops(routeQuery!),
    enabled: !!routeQuery,
    staleTime: 5 * 60 * 1000, // 5 minutes - route data is static
  })

  const { data: routePoints } = useQuery({
    queryKey: ['driver-route-points', routeQuery],
    queryFn: () => getDriverRoutePoints(routeQuery!),
    enabled: !!routeQuery,
    staleTime: 5 * 60 * 1000, // 5 minutes - route data is static
  })

  // GPS Tracking
  const { currentLocation, error: geoError } = useGpsTracking({
    activeTripId: activeTrip?.id,
    enabled: true,
  })

  // Mutations with optimistic updates
  const startTripMutation = useMutation({
    mutationFn: startDriverTrip,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['driver-scheduled-trips'] })
      await queryClient.cancelQueries({ queryKey: ['driver-active-trip'] })

      // Snapshot previous values
      const previousScheduledTrips = queryClient.getQueryData(['driver-scheduled-trips'])

      // Optimistically update scheduled trips
      if (variables.tripId) {
        queryClient.setQueryData(
          ['driver-scheduled-trips'],
          (old: typeof scheduledTrips) =>
            old?.map((trip) =>
              trip.id === variables.tripId ? { ...trip, status: 'in_progress' as const } : trip,
            ),
        )
      }

      return { previousScheduledTrips }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousScheduledTrips) {
        queryClient.setQueryData(['driver-scheduled-trips'], context.previousScheduledTrips)
      }
      toast.error('Помилка запуску рейсу', {
        description: error.message,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
      queryClient.invalidateQueries({ queryKey: ['driver-scheduled-trips'] })
      toast.success('Рейс розпочато!', {
        description: 'GPS моніторинг активовано',
      })
    },
  })

  const finishTripMutation = useMutation({
    mutationFn: finishDriverTrip,
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['driver-active-trip'] })

      // Snapshot previous value
      const previousActiveTrip = queryClient.getQueryData(['driver-active-trip'])

      // Optimistically clear active trip
      queryClient.setQueryData(['driver-active-trip'], null)

      return { previousActiveTrip }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousActiveTrip) {
        queryClient.setQueryData(['driver-active-trip'], context.previousActiveTrip)
      }
      toast.error('Помилка завершення рейсу', {
        description: error.message,
      })
    },
    onSuccess: () => {
      setFinishTime('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
      queryClient.invalidateQueries({ queryKey: ['driver-scheduled-trips'] })
      toast.success('Рейс завершено!', {
        description: 'Дякуємо за роботу',
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

  // Combined loading state for trip transitions
  const isTripTransitioning = startTripMutation.isPending || finishTripMutation.isPending

  // Computed values
  const activeTripId = activeTrip?.id
  const { resolvedTripId, selectedTrip } = useMemo(() => {
    const trips = schedule?.trips ?? []
    if (trips.length === 0) return { resolvedTripId: null, selectedTrip: null }

    let tripId: number | null = null
    if (activeTripId && trips.some((trip) => trip.id === activeTripId)) {
      tripId = activeTripId
    } else {
      tripId = trips[0].id
    }

    const trip = trips.find((t) => t.id === tripId) ?? null
    return { resolvedTripId: tripId, selectedTrip: trip }
  }, [activeTripId, schedule])

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

  const { passengerTripOptions, resolvedPassengerTripId, selectedPassengerTrip } = useMemo(() => {
    const options: DriverTrip[] = schedule?.trips ? [...schedule.trips] : []
    if (activeTrip && !options.some((trip) => trip.id === activeTrip.id)) {
      options.unshift({
        id: activeTrip.id,
        startsAt: activeTrip.actualStartsAt,
        endsAt: null,
        passengerCount: activeTrip.passengerCount,
        plannedStartAt: activeTrip.plannedStartsAt,
        plannedEndsAt: null,
        startDelayMin: activeTrip.startDelayMin,
        route: {
          id: activeTrip.routeId,
          number: activeTrip.routeNumber,
          transportTypeId: 0,
          direction: activeTrip.direction,
        },
        vehicle: {
          id: activeTrip.vehicleId,
          fleetNumber: activeTrip.fleetNumber,
        },
        transportType: {
          id: 0,
          name: activeTrip.transportType,
        },
        stops: [],
      })
    }

    let tripId: string | null = null
    if (passengerTripId) {
      tripId = passengerTripId
    } else if (activeTrip?.id) {
      tripId = String(activeTrip.id)
    } else if (options.length > 0) {
      tripId = String(options[0].id)
    }

    const selected = tripId ? options.find((trip) => String(trip.id) === tripId) ?? null : null
    return { passengerTripOptions: options, resolvedPassengerTripId: tripId, selectedPassengerTrip: selected }
  }, [activeTrip, passengerTripId, schedule])

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

    return {
      totalTrips,
      completedTrips,
    }
  }, [schedule])

  // Handlers
  const handleStartTrip = (tripId?: number) => {
    startTripMutation.mutate({
      tripId,
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
            <div className="grid gap-4 md:grid-cols-3">
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
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    Профіль водія
                  </CardTitle>
                  <CardDescription className="mt-1">Особиста інформація</CardDescription>
                </CardHeader>
                <CardContent className="space-y-0">
                  {profileLoading ? (
                    <TableSkeleton rows={5} cols={1} />
                  ) : profile ? (
                    <>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-muted-foreground">ПІБ</span>
                        <span className="font-semibold">{profile.fullName}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-muted-foreground">Логін</span>
                        <span className="font-medium text-sm">{profile.login}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-muted-foreground">Телефон</span>
                        <span className="font-medium text-sm">{profile.phone}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="font-medium text-sm">{profile.email}</span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-muted-foreground">Ліцензія</span>
                        <Badge variant="outline" className="font-mono">{profile.driverLicenseNumber}</Badge>
                      </div>
                    </>
                  ) : (
                    <ErrorState title="Помилка завантаження" message="Не вдалося завантажити профіль" />
                  )}
                </CardContent>
              </Card>

              {/* Active Trip Card */}
              <Card className={`shadow-sm hover:shadow-md transition-shadow duration-300 ${activeTrip ? 'border-success/30 bg-gradient-to-br from-success/5 to-transparent' : ''}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${activeTrip ? 'bg-success/15' : 'bg-muted'}`}>
                      <Navigation className={`h-5 w-5 ${activeTrip ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    Активний рейс
                    {activeTrip && (
                      <Badge variant="success" className="ml-auto">Виконується</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">Поточна зміна</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeTripLoading ? (
                    <TableSkeleton rows={3} cols={1} />
                  ) : activeTrip ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="text-base px-3 py-1">Маршрут {activeTrip.routeNumber}</Badge>
                        <Badge variant="outline">{directionLabels[activeTrip.direction]}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {activeTrip.transportType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Транспорт</p>
                          <p className="font-semibold">{activeTrip.fleetNumber}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Затримка</p>
                          <p className="font-semibold">
                            {activeTrip.startDelayMin != null ? (
                              <span className={activeTrip.startDelayMin > 5 ? 'text-warning' : 'text-success'}>
                                {activeTrip.startDelayMin > 0 ? '+' : ''}{Math.round(activeTrip.startDelayMin)} хв
                              </span>
                            ) : (
                              <span className="text-success">Вчасно</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Плановий початок:</span>
                          <span className="font-medium">{formatDateTime(activeTrip.plannedStartsAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Фактичний початок:</span>
                          <span className="font-medium">{formatDateTime(activeTrip.actualStartsAt)}</span>
                        </div>
                      </div>

                      {currentLocation && (
                        <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
                          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                          <span className="text-sm text-success font-medium">
                            GPS: {currentLocation.lat.toFixed(5)}, {currentLocation.lon.toFixed(5)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                        <Navigation className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-muted-foreground">Активного рейсу немає</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Розпочніть рейс у розділі "Управління"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                      <Calendar className="h-5 w-5 text-blue-500" />
                    </div>
                    Робочий графік
                  </CardTitle>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-[170px]"
                  />
                </div>
                <CardDescription className="mt-1">Перегляд призначених рейсів</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleLoading ? (
                  <TableSkeleton rows={5} cols={8} />
                ) : schedule ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={schedule.assigned ? 'success' : 'outline'} className="text-sm">
                        {schedule.assigned ? 'Призначено' : 'Без призначень'}
                      </Badge>
                      {schedule.route && (
                        <Badge variant="secondary" className="text-sm">Маршрут {schedule.route.number}</Badge>
                      )}
                      {schedule.transportType?.name && (
                        <span className="text-sm text-muted-foreground">
                          {schedule.transportType.name}
                        </span>
                      )}
                      {schedule.vehicle?.fleetNumber && (
                        <Badge variant="outline" className="font-mono">
                          {schedule.vehicle.fleetNumber}
                        </Badge>
                      )}
                    </div>

                    {schedule.schedule && (
                      <div className="grid gap-3 md:grid-cols-2 max-w-md">
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Початок зміни</p>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            {formatTime(schedule.schedule.workStartTime)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Кінець зміни</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">
                            {formatTime(schedule.schedule.workEndTime)}
                          </p>
                        </div>
                      </div>
                    )}

                    {schedule.trips.length > 0 ? (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="font-semibold">План початок</TableHead>
                              <TableHead className="font-semibold">Факт початок</TableHead>
                              <TableHead className="font-semibold">План кінець</TableHead>
                              <TableHead className="font-semibold">Факт кінець</TableHead>
                              <TableHead className="font-semibold">Маршрут</TableHead>
                              <TableHead className="font-semibold">Транспорт</TableHead>
                              <TableHead className="font-semibold">Пасажири</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {schedule.trips.map((trip) => (
                              <TableRow
                                key={trip.id}
                                className={`hover:bg-muted/30 transition-colors ${resolvedTripId === trip.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                              >
                                <TableCell className="text-sm">{formatDateTime(trip.plannedStartAt)}</TableCell>
                                <TableCell className="text-sm">{formatDateTime(trip.startsAt)}</TableCell>
                                <TableCell className="text-sm">{formatDateTime(trip.plannedEndsAt)}</TableCell>
                                <TableCell className="text-sm">
                                  {trip.endsAt ? formatDateTime(trip.endsAt) : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="outline" className="font-mono">{trip.route.number}</Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {directionLabels[trip.route.direction]}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm">{trip.vehicle.fleetNumber}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">{trip.passengerCount ?? 0}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                          <Calendar className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-muted-foreground">Рейсів не знайдено</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">На обрану дату немає призначених рейсів</p>
                      </div>
                    )}

                    {/* Trip Stops */}
                    {selectedTrip && (
                      <Card className="mt-6 shadow-sm border-primary/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2.5 text-base">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <MapPin className="h-4 w-4 text-primary" />
                            </div>
                            Зупинки рейсу
                          </CardTitle>
                          <CardDescription>Інтервали між зупинками</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge className="text-sm">Маршрут {selectedTrip.route.number}</Badge>
                              <Badge variant="outline">
                                {directionLabels[selectedTrip.route.direction]}
                              </Badge>
                              <span className="text-muted-foreground">
                                {selectedTrip.transportType.name}
                              </span>
                            </div>
                            <div className="rounded-lg border max-h-[320px] overflow-auto">
                              <Table>
                                <TableHeader className="bg-muted/50 sticky top-0">
                                  <TableRow>
                                    <TableHead className="font-semibold">Зупинка</TableHead>
                                    <TableHead className="font-semibold">Координати</TableHead>
                                    <TableHead className="font-semibold">До наступної</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {selectedTrip.stops.map((stop, index) => (
                                    <TableRow key={stop.id} className="hover:bg-muted/30 transition-colors">
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                            {index + 1}
                                          </span>
                                          <span className="font-medium">{stop.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground font-mono">
                                        {formatCoord(stop.lat)}, {formatCoord(stop.lon)}
                                      </TableCell>
                                      <TableCell>
                                        {stop.minutesToNextStop != null ? (
                                          <Badge variant="outline">{stop.minutesToNextStop} хв</Badge>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">Кінцева</span>
                                        )}
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
          <TabsContent value="control" className="space-y-6 relative">
            {/* Loading overlay during trip transitions */}
            {isTripTransitioning && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Active Trip Card */}
            {activeTrip && (
              <Card className="border-success/40 bg-gradient-to-br from-success/5 to-transparent shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-lg">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15">
                        <Navigation className="h-5 w-5 text-success" />
                      </div>
                      <span className="text-success">Активний рейс</span>
                    </CardTitle>
                    <Badge variant="success" className="animate-pulse">Виконується</Badge>
                  </div>
                  <CardDescription className="mt-1">Рейс в процесі виконання</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Маршрут</p>
                      <p className="font-semibold">{activeTrip.routeNumber} • {directionLabels[activeTrip.direction]}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Транспорт</p>
                      <p className="font-semibold font-mono">{activeTrip.fleetNumber}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Початок</p>
                      <p className="font-semibold">{formatDateTime(activeTrip.actualStartsAt)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Затримка</p>
                      <p className={`font-semibold ${activeTrip.startDelayMin && activeTrip.startDelayMin > 5 ? 'text-warning' : 'text-success'}`}>
                        {activeTrip.startDelayMin != null
                          ? `${activeTrip.startDelayMin > 0 ? '+' : ''}${Math.round(activeTrip.startDelayMin)} хв`
                          : 'Вчасно'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="finish-time" className="text-sm">Час завершення (опційно)</Label>
                      <Input
                        id="finish-time"
                        type="datetime-local"
                        value={finishTime}
                        onChange={(e) => setFinishTime(e.target.value)}
                      />
                    </div>
                    <div className="self-end">
                      <Button
                        variant="destructive"
                        onClick={handleFinishTrip}
                        disabled={finishTripMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {finishTripMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Square className="mr-2 h-4 w-4" />
                        Завершити рейс
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Scheduled Trips List */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                      <Calendar className="h-5 w-5 text-blue-500" />
                    </div>
                    Заплановані рейси
                  </CardTitle>
                  <CardDescription className="mt-1">Оберіть рейс для запуску</CardDescription>
                </CardHeader>
                <CardContent>
                  {scheduledTripsLoading ? (
                    <TableSkeleton rows={5} cols={5} />
                  ) : scheduledTrips && scheduledTrips.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {scheduledTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
                            trip.status === 'scheduled'
                              ? 'border-border hover:border-primary/50 hover:bg-muted/30'
                              : trip.status === 'in_progress'
                              ? 'border-success/50 bg-gradient-to-r from-success/10 to-transparent'
                              : 'border-muted bg-muted/20 opacity-60'
                          }`}
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="text-sm">{trip.routeNumber}</Badge>
                              <Badge variant="outline">{directionLabels[trip.direction]}</Badge>
                              <TripStatusBadge status={trip.status} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span className="font-mono">{trip.fleetNumber || 'Не призначено'}</span>
                              <span>•</span>
                              <span>{trip.transportType}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">
                                {new Date(trip.plannedStartsAt).toLocaleTimeString('uk-UA', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {trip.plannedEndsAt && (
                                  <>
                                    {' — '}
                                    {new Date(trip.plannedEndsAt).toLocaleTimeString('uk-UA', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          {trip.status === 'scheduled' && !activeTrip && (
                            <Button
                              onClick={() => handleStartTrip(trip.id)}
                              disabled={startTripMutation.isPending}
                              size="sm"
                              className="ml-3 shrink-0"
                            >
                              {startTripMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              Почати
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                        <Calendar className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-muted-foreground">Немає запланованих рейсів</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Диспетчер ще не створив рейси для вас</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Passenger Count */}
              <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2.5 text-lg">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                      <Users className="h-5 w-5 text-amber-500" />
                    </div>
                    Кількість пасажирів
                  </CardTitle>
                  <CardDescription className="mt-1">Введення пасажиропотоку за рейс</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Рейс</Label>
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
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Маршрут</p>
                            <p className="font-semibold">{selectedPassengerTrip.route.number}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Транспорт</p>
                            <p className="font-semibold font-mono">{selectedPassengerTrip.vehicle.fleetNumber}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="passenger-count" className="text-sm">Кількість пасажирів *</Label>
                          <Input
                            id="passenger-count"
                            type="number"
                            min={0}
                            value={passengerCount}
                            onChange={(e) => setPassengerCount(e.target.value)}
                            placeholder="Введіть кількість"
                            className="text-lg font-semibold"
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
                          size="lg"
                        >
                          {passengerCountMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Зберегти
                        </Button>
                      </>
                    )}

                    {!selectedPassengerTrip && (
                      <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">Оберіть рейс для введення даних</p>
                      </div>
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
                          <MapView center={mapCenter} zoom={12}>
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

const tripStatusLabels: Record<string, string> = {
  scheduled: 'Заплановано',
  in_progress: 'Виконується',
  completed: 'Завершено',
  cancelled: 'Скасовано',
}

const tripStatusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  scheduled: 'outline',
  in_progress: 'default',
  completed: 'success',
  cancelled: 'destructive',
}

function TripStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={tripStatusVariants[status] ?? 'outline'}>
      {tripStatusLabels[status] ?? status}
    </Badge>
  )
}
