import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type DriverProfile = {
  id: number
  login: string
  fullName: string
  email: string
  phone: string
  driverLicenseNumber: string
  licenseCategories: string[]
}

type ScheduleTrip = {
  id: number
  startsAt: string
  endsAt: string | null
  route: {
    id: number
    number: string
    transportTypeId: number
    direction: string
  }
  vehicle: {
    id: number
    fleetNumber: string
  }
  transportType: {
    id: number
    name: string
  }
  stops: Array<{
    id: number
    name: string
    lon: string
    lat: string
    distanceToNextKm: number | null
    minutesToNextStop: number | null
  }>
}

type ScheduleResponse = {
  driver: DriverProfile
  date: string
  assigned: boolean
  vehicle?: {
    id: number
    fleetNumber: string
  }
  route?: {
    id: number
    number: string
    transportTypeId: number
    direction: string
  }
  transportType?: {
    id: number
    name: string
  }
  schedule?: {
    workStartTime: string
    workEndTime: string
    intervalMin: number
  } | null
  trips: ScheduleTrip[]
  stops: ScheduleTrip['stops']
}

type ActiveTrip = {
  id: number
  startsAt: string
  endsAt: string | null
  route: {
    id: number
    number: string
    transportTypeId: number
    direction: string
  }
  vehicle: {
    id: number
    fleetNumber: string
  }
  transportType: {
    id: number
    name: string
  }
}

type RoutePoint = {
  id: number
  routeId: number
  lon: string
  lat: string
}

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const formatTime = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function DriverPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, roles, clear } = useAuthStore()
  const hasAccess = roles.includes('ct_driver_role')
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(toInputDate(today))
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [passengerCount, setPassengerCount] = useState('')
  const [passengerDate, setPassengerDate] = useState(toInputDate(today))

  useEffect(() => {
    setPassengerDate(selectedDate)
  }, [selectedDate])

  const profileQuery = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: async () => {
      const response = await api.get('/driver/me')
      return response.data as DriverProfile
    },
    enabled: hasAccess,
  })

  const scheduleQuery = useQuery({
    queryKey: ['driver', 'schedule', selectedDate],
    queryFn: async () => {
      const response = await api.get('/driver/schedule', {
        params: { date: selectedDate },
      })
      return response.data as ScheduleResponse
    },
    enabled: hasAccess,
  })

  const activeTripQuery = useQuery({
    queryKey: ['driver', 'activeTrip'],
    queryFn: async () => {
      const response = await api.get('/driver/active-trip')
      return response.data as ActiveTrip | null
    },
    enabled: hasAccess,
  })

  const schedule = scheduleQuery.data
  const activeTrip = activeTripQuery.data
  const now = new Date()

  const selectedTrip = useMemo(() => {
    if (!schedule?.trips?.length) {
      return null
    }

    if (selectedTripId) {
      return schedule.trips.find((trip) => trip.id === selectedTripId) ?? null
    }

    const slots = schedule.trips.map((trip) => ({
      ...trip,
      start: new Date(trip.startsAt),
      end: trip.endsAt
        ? new Date(trip.endsAt)
        : new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }))
    const activeSlot = slots.find(
      (trip) => trip.start <= now && trip.end >= now,
    )
    if (activeSlot) {
      return activeSlot
    }

    const upcoming = slots.find((trip) => trip.start > now)
    return upcoming ?? slots[0] ?? null
  }, [schedule, selectedTripId, now])

  useEffect(() => {
    if (!selectedTripId && selectedTrip?.id) {
      setSelectedTripId(selectedTrip.id)
    }
  }, [selectedTrip, selectedTripId])

  const tripContext = activeTrip ?? selectedTrip
  const assignmentRoute = tripContext?.route ?? schedule?.route
  const assignmentVehicle = tripContext?.vehicle ?? schedule?.vehicle
  const transportType = tripContext?.transportType ?? schedule?.transportType

  const tripStatus = useMemo(() => {
    if (activeTrip) {
      return { label: 'Активний', tone: 'text-emerald-700' }
    }
    if (selectedTrip) {
      if (!selectedTrip.endsAt) {
        return { label: 'Активний', tone: 'text-emerald-700' }
      }
      const ended = new Date(selectedTrip.endsAt) < now
      return {
        label: ended ? 'Завершено' : 'Не розпочато',
        tone: ended ? 'text-slate-500' : 'text-amber-600',
      }
    }
    return { label: 'Немає даних', tone: 'text-slate-400' }
  }, [activeTrip, selectedTrip, now])

  const routePointsQuery = useQuery({
    queryKey: [
      'driver',
      'routePoints',
      assignmentRoute?.number,
      assignmentRoute?.transportTypeId,
    ],
    queryFn: async () => {
      const response = await api.get('/driver/routes/points', {
        params: {
          routeNumber: assignmentRoute?.number,
          transportTypeId: assignmentRoute?.transportTypeId,
          direction: assignmentRoute?.direction,
        },
      })
      return response.data as RoutePoint[]
    },
    enabled: Boolean(assignmentRoute?.number),
  })

  const startTripMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {}
      if (assignmentVehicle?.fleetNumber) {
        payload.fleetNumber = assignmentVehicle.fleetNumber
      }
      if (assignmentRoute?.direction) {
        payload.direction = assignmentRoute.direction
      }
      const response = await api.post('/driver/trips/start', payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver', 'activeTrip'] })
      await queryClient.invalidateQueries({ queryKey: ['driver', 'schedule'] })
    },
  })

  const finishTripMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {}
      if (assignmentVehicle?.fleetNumber) {
        payload.fleetNumber = assignmentVehicle.fleetNumber
      }
      const response = await api.post('/driver/trips/finish', payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['driver', 'activeTrip'] })
      await queryClient.invalidateQueries({ queryKey: ['driver', 'schedule'] })
    },
  })

  const passengerMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        date: passengerDate,
        passengerCount: Number(passengerCount),
      }
      if (assignmentVehicle?.fleetNumber) {
        payload.fleetNumber = assignmentVehicle.fleetNumber
      }
      const response = await api.post('/driver/trips/passengers', payload)
      return response.data
    },
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['driver', 'schedule'] })
    queryClient.invalidateQueries({ queryKey: ['driver', 'activeTrip'] })
    queryClient.invalidateQueries({ queryKey: ['driver', 'me'] })
  }

  const handleSignOut = () => {
    api
      .post('/auth/logout')
      .catch(() => undefined)
      .finally(() => {
        clear()
        navigate({ to: '/' })
      })
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Водійський доступ</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом водія, щоб бачити розклад.
          </p>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Немає доступу</h2>
          <p className="mt-2 text-slate-600">
            Цей акаунт не має ролі водія.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
              CT-DRIVER-ROLE
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {profileQuery.data?.fullName || user.fullName || user.login}
            </h1>
            <p className="text-sm text-slate-500">
              Signed in as <span className="font-semibold">{user.login}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-700">
              Дата роботи
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                onClick={() => setSelectedDate(toInputDate(today))}
              >
                Сьогодні
              </button>
              <button
                type="button"
                className="rounded-full border border-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                onClick={() => setSelectedDate(toInputDate(addDays(today, 1)))}
              >
                Завтра
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-semibold text-emerald-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Мій графік</h2>
                <p className="text-sm text-slate-500">
                  {schedule?.date ? formatDate(schedule.date) : formatDate(selectedDate)}
                </p>
              </div>
              {schedule?.schedule && (
                <div className="text-sm text-slate-500">
                  {schedule.schedule.workStartTime} – {schedule.schedule.workEndTime}
                </div>
              )}
            </div>

            {scheduleQuery.isLoading ? (
              <div className="mt-6 text-sm text-slate-500">Завантаження графіка...</div>
            ) : scheduleQuery.error ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {getErrorMessage(scheduleQuery.error, 'Не вдалося завантажити графік.')}
              </div>
            ) : !schedule?.assigned || schedule.trips.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-lg font-semibold text-slate-700">
                  Розклад не призначено
                </p>
                <p className="text-sm text-slate-500">
                  Зверніться до диспетчера за графіком.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3">
                  {schedule.trips.map((trip) => {
                    const isSelected = trip.id === selectedTripId
                    return (
                      <button
                        key={trip.id}
                        type="button"
                        onClick={() => setSelectedTripId(trip.id)}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-emerald-200'
                        }`}
                      >
                        <div>
                          <p className="text-sm text-slate-500">Маршрут</p>
                          <p className="text-lg font-semibold text-slate-900">
                            №{trip.route.number}{' '}
                            <span className="text-xs font-semibold uppercase text-slate-400">
                              {trip.route.direction === 'reverse' ? 'Rev' : 'Fwd'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Транспорт</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {trip.vehicle.fleetNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Відправлення</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {formatTime(trip.startsAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Завершення</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {formatTime(trip.endsAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            isSelected
                              ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {isSelected ? 'Вибрано' : 'Вибрати'}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Коротко по зупинках
                  </p>
                  {selectedTrip?.stops && selectedTrip.stops.length > 0 ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {selectedTrip.stops.map((stop) => (
                        <div
                          key={stop.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {stop.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {stop.minutesToNextStop !== null
                              ? `${stop.minutesToNextStop} хв`
                              : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-500">
                      Немає даних по зупинках.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-900">Обраний рейс</h2>
            {activeTrip || selectedTrip ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Маршрут</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    №{assignmentRoute?.number ?? '—'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {transportType?.name ?? 'Невідомий тип'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Транспорт</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {assignmentVehicle?.fleetNumber ?? '—'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Статус:{' '}
                    <span className={`font-semibold ${tripStatus.tone}`}>
                      {tripStatus.label}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Початок</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {activeTrip
                      ? new Date(activeTrip.startsAt).toLocaleString('uk-UA')
                      : selectedTrip
                        ? `${formatDate(selectedTrip.startsAt)} ${formatTime(selectedTrip.startsAt)}`
                        : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">Завершення</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {activeTrip
                      ? activeTrip.endsAt
                        ? new Date(activeTrip.endsAt).toLocaleString('uk-UA')
                        : '—'
                      : selectedTrip
                        ? selectedTrip.endsAt
                          ? `${formatDate(selectedTrip.endsAt)} ${formatTime(selectedTrip.endsAt)}`
                          : '—'
                        : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Немає обраного рейсу. Спочатку виберіть графік.
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Керування рейсом
              </h2>
              <p className="text-sm text-slate-500">
                Старт і фініш доступні лише при призначеному транспорті.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startTripMutation.mutate()}
                  disabled={!schedule?.assigned || Boolean(activeTrip)}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-emerald-200"
                >
                  Start trip
                </button>
                <button
                  type="button"
                  onClick={() => finishTripMutation.mutate()}
                  disabled={!schedule?.assigned || !activeTrip}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  Finish trip
                </button>
              </div>
              {(startTripMutation.error || finishTripMutation.error) && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {getErrorMessage(
                    startTripMutation.error ?? finishTripMutation.error,
                    'Не вдалося виконати дію.',
                  )}
                </div>
              )}
              {startTripMutation.data && (
                <div className="mt-3 text-sm text-emerald-700">
                  Рейс розпочато.
                </div>
              )}
              {finishTripMutation.data && (
                <div className="mt-3 text-sm text-emerald-700">
                  Рейс завершено.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900">
                Пасажири за добу
              </h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="text-slate-500">Маршрут</p>
                  <p className="font-semibold text-slate-800">
                    №{assignmentRoute?.number ?? '—'} · {transportType?.name ?? '—'}
                  </p>
                  <p className="mt-2 text-slate-500">Транспорт</p>
                  <p className="font-semibold text-slate-800">
                    {assignmentVehicle?.fleetNumber ?? '—'}
                  </p>
                </div>
                <label className="text-sm font-semibold text-slate-700">
                  Дата
                  <input
                    type="date"
                    value={passengerDate}
                    onChange={(event) => setPassengerDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Кількість пасажирів
                  <input
                    type="number"
                    min={0}
                    value={passengerCount}
                    onChange={(event) => setPassengerCount(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    disabled={!schedule?.assigned}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => passengerMutation.mutate()}
                  disabled={!schedule?.assigned || !passengerCount}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200"
                >
                  Зберегти
                </button>
                {passengerMutation.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {getErrorMessage(passengerMutation.error, 'Не вдалося зберегти.')}
                  </div>
                )}
                {passengerMutation.data && (
                  <div className="text-sm text-emerald-700">
                    Дані збережено.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-900">
              Маршрут · Зупинки
            </h2>
            {selectedTrip?.stops && selectedTrip.stops.length > 0 ? (
              <div className="mt-4 space-y-3">
                {selectedTrip.stops.map((stop, index) => (
                  <details
                    key={stop.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      {index + 1}. {stop.name}
                    </summary>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div>
                        Координати: {stop.lon}, {stop.lat}
                      </div>
                      <div>
                        До наступної:{" "}
                        {stop.minutesToNextStop !== null
                          ? `${stop.minutesToNextStop} хв`
                          : '—'}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Немає даних по маршруту. Зверніться до диспетчера.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-900">
              Маршрут · Карта
            </h2>
            {routePointsQuery.isLoading ? (
              <p className="mt-3 text-sm text-slate-500">Завантаження...</p>
            ) : routePointsQuery.data && routePointsQuery.data.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">
                  Точки маршруту: {routePointsQuery.data.length}
                </p>
                <div className="mt-3 space-y-2 text-xs text-slate-500">
                  {routePointsQuery.data.slice(0, 6).map((point, index) => (
                    <div key={point.id} className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        {index + 1}
                      </span>
                      <span>
                        {point.lon}, {point.lat}
                      </span>
                    </div>
                  ))}
                  {routePointsQuery.data.length > 6 && (
                    <p>... ще {routePointsQuery.data.length - 6} точок</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Маршрутні точки не задані.
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default DriverPage
