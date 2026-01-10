import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MapRoute,
} from '@/components/ui/map'
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

export const Route = createFileRoute('/driver')({
  component: DriverPage,
})

type RouteFormState = {
  routeId: string
  routeNumber: string
  transportTypeId: string
  direction: DriverDirection
}

const directionLabels: Record<DriverDirection, string> = {
  forward: 'Прямий',
  reverse: 'Зворотній',
}

const LVIV_CENTER: [number, number] = [24.0316, 49.8429]

function DriverPage() {
  const queryClient = useQueryClient()
  const [scheduleDate, setScheduleDate] = useState(() => toDateInputValue(new Date()))
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [passengerTripId, setPassengerTripId] = useState<string | null>(null)
  const [passengerCount, setPassengerCount] = useState('')
  const [startFleetNumber, setStartFleetNumber] = useState('')
  const [startDirection, setStartDirection] = useState<DriverDirection>('forward')
  const [startTime, setStartTime] = useState('')
  const [finishTime, setFinishTime] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{
    lon: number
    lat: number
  } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(() => {
    if (typeof navigator === 'undefined') return null
    return 'geolocation' in navigator
      ? null
      : 'Геолокація недоступна у браузері.'
  })
  const [routeForm, setRouteForm] = useState<RouteFormState>({
    routeId: '',
    routeNumber: '',
    transportTypeId: '',
    direction: 'forward',
  })
  const [routeQuery, setRouteQuery] = useState<RouteLookupParams | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: getDriverProfile,
  })

  const {
    data: schedule,
    isLoading: scheduleLoading,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: ['driver-schedule', scheduleDate],
    queryFn: () => getDriverSchedule(scheduleDate || undefined),
  })

  const {
    data: activeTrip,
    isLoading: activeTripLoading,
    error: activeTripError,
  } = useQuery({
    queryKey: ['driver-active-trip'],
    queryFn: getDriverActiveTrip,
  })

  const { data: transportTypes } = useQuery({
    queryKey: ['transport-types'],
    queryFn: getTransportTypes,
  })

  const {
    data: routeStops,
    isLoading: routeStopsLoading,
    error: routeStopsError,
  } = useQuery({
    queryKey: ['driver-route-stops', routeQuery],
    queryFn: () => getDriverRouteStops(routeQuery!),
    enabled: !!routeQuery,
  })

  const {
    data: routePoints,
    isLoading: routePointsLoading,
    error: routePointsError,
  } = useQuery({
    queryKey: ['driver-route-points', routeQuery],
    queryFn: () => getDriverRoutePoints(routeQuery!),
    enabled: !!routeQuery,
  })

  const startTripMutation = useMutation({
    mutationFn: startDriverTrip,
    onSuccess: () => {
      setStartFleetNumber('')
      setStartTime('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
    },
  })

  const finishTripMutation = useMutation({
    mutationFn: finishDriverTrip,
    onSuccess: () => {
      setFinishTime('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
      queryClient.invalidateQueries({ queryKey: ['driver-active-trip'] })
    },
  })

  const passengerCountMutation = useMutation({
    mutationFn: updateTripPassengerCount,
    onSuccess: () => {
      setPassengerCount('')
      queryClient.invalidateQueries({ queryKey: ['driver-schedule'] })
    },
  })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
        })
        setGeoError(null)
      },
      () => {
        setGeoError('Не вдалося отримати геолокацію.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  const tripActionError = getTripActionError(
    startTripMutation.error,
    finishTripMutation.error
  )

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

  const resolvedPassengerTripId = useMemo(() => {
    if (passengerTripId) return passengerTripId
    if (activeTrip?.id) return String(activeTrip.id)
    const trips = schedule?.trips ?? []
    if (trips.length === 0) return null
    return String(trips[0].id)
  }, [activeTrip, passengerTripId, schedule])

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

  const passengerTripOptions = useMemo(() => {
    const options = schedule?.trips ? [...schedule.trips] : []
    if (
      activeTrip &&
      !options.some((trip) => trip.id === activeTrip.id)
    ) {
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

  const routeCoordinates = useMemo(() => {
    if (!routePoints?.length) return []
    return routePoints
      .map((point) => [Number(point.lon), Number(point.lat)] as [number, number])
      .filter(
        (coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1])
      )
  }, [routePoints])

  const routeBounds = useMemo(() => {
    if (routeCoordinates.length === 0) return null
    let minLng = routeCoordinates[0][0]
    let maxLng = routeCoordinates[0][0]
    let minLat = routeCoordinates[0][1]
    let maxLat = routeCoordinates[0][1]

    for (const [lng, lat] of routeCoordinates) {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }

    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ] as [[number, number], [number, number]]
  }, [routeCoordinates])

  const startStopCoordinate = useMemo(() => {
    const stop = routeStops?.[0] ?? selectedTrip?.stops?.[0]
    if (!stop) return null
    const lon = Number(stop.lon)
    const lat = Number(stop.lat)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    return [lon, lat] as [number, number]
  }, [routeStops, selectedTrip?.stops])

  const mapCenter = useMemo(() => {
    if (currentLocation) {
      return [currentLocation.lon, currentLocation.lat] as [number, number]
    }
    if (startStopCoordinate) {
      return startStopCoordinate
    }
    if (routeCoordinates.length > 0) {
      return routeCoordinates[0]
    }
    return LVIV_CENTER
  }, [currentLocation, routeCoordinates, startStopCoordinate])

  useEffect(() => {
    if (!routeBounds || !mapRef.current) return
    const mapInstance = mapRef.current
    const fitToBounds = () => {
      mapInstance.fitBounds(routeBounds, {
        padding: 48,
        duration: 600,
        maxZoom: 15,
      })
    }

    if (mapInstance.isStyleLoaded()) {
      fitToBounds()
    } else {
      mapInstance.once('load', fitToBounds)
    }
  }, [routeBounds])

  const handleStartTrip = () => {
    const fleetNumber = startFleetNumber.trim()
    if (!fleetNumber) return
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
      transportTypeId: routeForm.transportTypeId
        ? Number(routeForm.transportTypeId)
        : undefined,
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
    if (!resolvedPassengerTripId || passengerCount === '') return
    passengerCountMutation.mutate({
      tripId: Number(resolvedPassengerTripId),
      passengerCount: Number(passengerCount),
    })
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Панель водія</h1>
          <p className="text-muted-foreground">
            Розклад, активні рейси та інструменти для роботи.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Профіль</CardTitle>
              <CardDescription>Дані про водія</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {profileLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Завантаження профілю...
                </div>
              )}
              {profileError && (
                <p className="text-sm text-red-500">Не вдалося завантажити профіль.</p>
              )}
              {profile && (
                <>
                  <div className="text-sm">
                    <span className="font-medium">Імʼя:</span> {profile.fullName}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Логін:</span> {profile.login}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Телефон:</span> {profile.phone}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Email:</span> {profile.email}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Ліцензія:</span> {profile.driverLicenseNumber}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Активний рейс</CardTitle>
              <CardDescription>Поточна зміна</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeTripLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Перевіряємо активний рейс...
                </div>
              )}
              {activeTripError && (
                <p className="text-sm text-red-500">Не вдалося отримати активний рейс.</p>
              )}
              {!activeTripLoading && !activeTrip && (
                <p className="text-sm text-muted-foreground">Активного рейсу немає.</p>
              )}
              {activeTrip && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Маршрут {activeTrip.route.number}</Badge>
                    <Badge variant="outline">{directionLabels[activeTrip.route.direction]}</Badge>
                    <span className="text-muted-foreground">{activeTrip.transportType.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">Транспорт:</span> {activeTrip.vehicle.fleetNumber}
                  </div>
                  <div>
                    <span className="font-medium">Початок:</span> {formatDateTime(activeTrip.startsAt)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Керування рейсом</CardTitle>
            <CardDescription>Запуск та завершення поїздки</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="fleet-number">Бортовий номер</Label>
                <Input
                  id="fleet-number"
                  placeholder="Напр. 102"
                  value={startFleetNumber}
                  onChange={(event) => setStartFleetNumber(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Напрямок</Label>
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="start-time">Час старту (опційно)</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button
                onClick={handleStartTrip}
                disabled={
                  startTripMutation.isPending ||
                  !startFleetNumber.trim() ||
                  !!activeTrip
                }
              >
                {startTripMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Розпочати рейс
              </Button>
              <Button
                variant="outline"
                onClick={handleFinishTrip}
                disabled={finishTripMutation.isPending || !activeTrip}
              >
                {finishTripMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Завершити рейс
              </Button>
              <div className="flex flex-col gap-1">
                <Label htmlFor="finish-time" className="text-xs text-muted-foreground">
                  Час завершення (опційно)
                </Label>
                <Input
                  id="finish-time"
                  type="datetime-local"
                  value={finishTime}
                  onChange={(event) => setFinishTime(event.target.value)}
                  className="max-w-[220px]"
                />
              </div>
            </div>
            {tripActionError && (
              <p className="text-sm text-red-500">{tripActionError}</p>
            )}
          </CardContent>
        </Card>

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
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="w-[170px]"
                />
                <Button variant="outline" onClick={() => refetchSchedule()}>
                  Оновити
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scheduleLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Завантаження розкладу...
              </div>
            )}
            {scheduleError && (
              <p className="text-sm text-red-500">Не вдалося завантажити розклад.</p>
            )}
            {schedule && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={schedule.assigned ? 'secondary' : 'outline'}>
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
                      <span className="font-medium">Інтервал:</span>{' '}
                      {schedule.schedule.intervalMin} хв
                    </div>
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Старт</TableHead>
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
                          className={
                            resolvedTripId === trip.id ? 'bg-muted/40' : undefined
                          }
                        >
                          <TableCell>{formatDateTime(trip.startsAt)}</TableCell>
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
                      {schedule.trips.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center h-24 text-muted-foreground"
                          >
                            Рейсів не знайдено
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Зупинки вибраного рейсу</CardTitle>
            <CardDescription>Інтервали між зупинками</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTrip && (
              <p className="text-sm text-muted-foreground">
                Оберіть рейс у розкладі, щоб побачити зупинки.
              </p>
            )}
            {selectedTrip && (
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
                      {selectedTrip.stops.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center h-24 text-muted-foreground"
                          >
                            Зупинок не знайдено
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Маршрут для відображення</CardTitle>
            <CardDescription>Зупинки та точки маршруту</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Рейс з розкладу</Label>
                <Select
                  value={routeForm.routeId || undefined}
                  onValueChange={handleSelectTripForRoute}
                >
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
                  onChange={(event) =>
                    setRouteForm((prev) => ({
                      ...prev,
                      routeId: '',
                      routeNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Тип транспорту</Label>
                <Select
                  value={routeForm.transportTypeId || undefined}
                  onValueChange={(value) =>
                    setRouteForm((prev) => ({
                      ...prev,
                      routeId: '',
                      transportTypeId: value,
                    }))
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
                    setRouteForm((prev) => ({
                      ...prev,
                      routeId: '',
                      direction: value as DriverDirection,
                    }))
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
            <div className="flex flex-wrap gap-3">
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

            {!routeQuery && (
              <p className="text-sm text-muted-foreground">
                Вкажіть маршрут або оберіть рейс із розкладу, щоб завантажити зупинки та точки.
              </p>
            )}

            {routeQuery && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Зупинки маршруту</h3>
                  <div className="rounded-md border max-h-[320px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Назва</TableHead>
                          <TableHead>Координати</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routeStopsLoading && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center h-24">
                              <Loader2 className="h-5 w-5 animate-spin inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                        {routeStopsError && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-red-500">
                              Помилка завантаження зупинок
                            </TableCell>
                          </TableRow>
                        )}
                        {routeStops?.map((stop) => (
                          <TableRow key={`${stop.routeId}-${stop.stopId}`}>
                            <TableCell>{stop.stopId}</TableCell>
                            <TableCell>{stop.stopName}</TableCell>
                            <TableCell>
                              {formatCoord(stop.lat)}, {formatCoord(stop.lon)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {routeStops && routeStops.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center h-24 text-muted-foreground"
                            >
                              Зупинок не знайдено
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Маршрут на мапі</h3>
                  <div className="rounded-md border overflow-hidden">
                    <div className="h-[360px]">
                      <MapView ref={mapRef} center={mapCenter} zoom={12}>
                        <MapControls
                          showLocate
                          showFullscreen
                          onLocate={(coords) =>
                            setCurrentLocation({
                              lon: coords.longitude,
                              lat: coords.latitude,
                            })
                          }
                        />
                        {routeCoordinates.length >= 2 && (
                          <MapRoute
                            coordinates={routeCoordinates}
                            color="#2563EB"
                            width={4}
                            opacity={0.85}
                          />
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
                          <MapMarker
                            longitude={currentLocation.lon}
                            latitude={currentLocation.lat}
                          >
                            <MarkerContent>
                              <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
                            </MarkerContent>
                          </MapMarker>
                        )}
                      </MapView>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {routePointsLoading && 'Завантаження маршруту...'}
                    {routePointsError && 'Помилка завантаження маршруту.'}
                    {!routePointsLoading &&
                      !routePointsError &&
                      routeCoordinates.length < 2 &&
                      'Недостатньо точок для відображення маршруту.'}
                    {!routePointsLoading &&
                      !routePointsError &&
                      routeCoordinates.length >= 2 &&
                      'Маршрут відображено у масштабі повної траси.'}
                  </div>
                  {geoError && (
                    <p className="text-xs text-amber-600">{geoError}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Кількість пасажирів</CardTitle>
            <CardDescription>Введення пасажиропотоку за рейс</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 items-end">
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
              <div className="space-y-2">
                <Label htmlFor="passenger-count">Кількість</Label>
                <Input
                  id="passenger-count"
                  type="number"
                  min={0}
                  value={passengerCount}
                  onChange={(event) => setPassengerCount(event.target.value)}
                />
              </div>
              <Button
                onClick={handlePassengerSubmit}
                disabled={
                  passengerCountMutation.isPending ||
                  !resolvedPassengerTripId ||
                  passengerCount === ''
                }
              >
                {passengerCountMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Зберегти
              </Button>
            </div>
            {passengerCountMutation.error && (
              <p className="text-sm text-red-500">
                {getErrorMessage(passengerCountMutation.error) ||
                  'Не вдалося оновити дані'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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

function getTripActionError(startError: unknown, finishError: unknown) {
  const startMessage = getErrorMessage(startError)
  if (startMessage) return startMessage
  return getErrorMessage(finishError)
}

function getErrorMessage(error: unknown) {
  if (!error) return ''
  if (error instanceof Error) return error.message
  return ''
}
