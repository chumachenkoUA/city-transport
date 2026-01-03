import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type DashboardSummary = {
  activeTrips: number
  deviations: number
  schedulesToday: number
  unassignedDrivers: number
  unassignedVehicles: number
}

type RouteItem = {
  id: number
  number: string
  direction: string
  transportTypeId: number
  transportType: string
}

type ScheduleItem = {
  id: number
  routeId: number
  routeNumber: string
  direction: string
  transportTypeId: number
  transportType: string
  workStartTime: string
  workEndTime: string
  intervalMin: number
}

type ScheduleDetails = {
  id: number
  route: {
    id: number
    number: string
    transportTypeId: number
    direction: string
  }
  vehicles: Array<{ id: number; fleetNumber: string }>
  workStartTime: string
  workEndTime: string
  intervalMin: number
  stops: Array<{
    id: number
    name: string
    lon: string
    lat: string
    distanceToNextKm: number | null
    minutesToNextStop: number | null
  }>
}

type DriverItem = {
  id: number
  login: string
  fullName: string
  phone: string
  email: string
}

type VehicleItem = {
  id: number
  fleetNumber: string
  routeId: number
  transportTypeId: number
  capacity: number
}

type AssignmentItem = {
  id: number
  driverId: number
  driverName: string
  driverLogin: string
  driverPhone: string
  vehicleId: number
  fleetNumber: string
  routeId: number
  routeNumber: string
  direction: string
  transportTypeId: number
  transportType: string
  assignedAt: string
}

type ActiveTrip = {
  id: number
  routeId: number
  routeNumber: string
  direction: string
  transportTypeId: number
  transportType: string
  vehicleId: number
  fleetNumber: string
  driverId: number
  driverName: string
  driverLogin: string
  startsAt: string
  endsAt: string | null
}

type DeviationItem = {
  status: 'ok' | 'late' | 'out_of_schedule'
  fleetNumber: string
  routeNumber: string
  direction: string
  currentTime: string
  plannedTime: string | null
  deviationMin: number | null
  vehicleId: number
  driverName: string
  lastGps?: {
    vehicleId: number
    lon: string
    lat: string
    recordedAt: string
  } | null
  nearestStop?: { stopId: number; stopName: string } | null
  history?: Array<{
    vehicleId: number
    lon: string
    lat: string
    recordedAt: string
  }>
}

type MonitoringResponse = {
  vehicle: { id: number; fleetNumber: string; routeId: number }
  route: { id: number; number: string; transportTypeId: number; direction: string }
  routePoints: Array<{ id: number; lon: string; lat: string }>
  currentPosition: { lon: string; lat: string; recordedAt: string } | null
}

const tabs = [
  { id: 'overview', label: 'Огляд' },
  { id: 'schedules', label: 'Розклади' },
  { id: 'assignments', label: 'Призначення' },
  { id: 'monitoring', label: 'Моніторинг' },
  { id: 'deviations', label: 'Відхилення' },
] as const

type TabId = (typeof tabs)[number]['id']

const formatTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`

const makePreviewSlots = (
  startTime: string,
  intervalMin: number,
  count: number,
) => {
  const [h, m] = startTime.split(':').map(Number)
  const slots = []
  let totalMinutes = h * 60 + m
  for (let i = 0; i < count; i += 1) {
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    slots.push(`${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`)
    totalMinutes += intervalMin
  }
  return slots
}

const buildRouteLabel = (route?: RouteItem | null) =>
  route ? `#${route.number} · ${route.transportType} · ${route.direction}` : '—'

function DispatcherPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, roles, token, clear } = useAuthStore()
  const hasAccess = roles.includes('ct_dispatcher_role')
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [now, setNow] = useState(new Date())

  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState({
    routeNumber: '',
    transportType: '',
    fleetNumber: '',
    date: toInputDate(new Date()),
  })
  const [scheduleForm, setScheduleForm] = useState({
    mode: 'create' as 'create' | 'edit',
    routeId: '',
    fleetNumber: '',
    workStartTime: '06:00:00',
    workEndTime: '23:00:00',
    intervalMin: '10',
  })
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)

  const [assignmentForm, setAssignmentForm] = useState({
    driverLogin: '',
    fleetNumber: '',
    routeId: '',
    assignedAt: '',
  })
  const [monitorFleet, setMonitorFleet] = useState('')
  const [deviationSelected, setDeviationSelected] = useState<DeviationItem | null>(
    null,
  )
  const [checkedDeviations, setCheckedDeviations] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(timer)
  }, [])

  const dashboardQuery = useQuery({
    queryKey: ['dispatcher', 'dashboard'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/dashboard')
      return response.data as DashboardSummary
    },
    enabled: hasAccess,
    refetchInterval: 30000,
  })

  const routesQuery = useQuery({
    queryKey: ['dispatcher', 'routes'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/routes')
      return response.data as RouteItem[]
    },
    enabled: hasAccess,
  })

  const schedulesQuery = useQuery({
    queryKey: ['dispatcher', 'schedules'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/schedules')
      return response.data as ScheduleItem[]
    },
    enabled: hasAccess,
  })

  const scheduleDetailsQuery = useQuery({
    queryKey: ['dispatcher', 'schedule', selectedScheduleId],
    queryFn: async () => {
      if (!selectedScheduleId) {
        return null
      }
      const response = await api.get(`/dispatcher/schedules/${selectedScheduleId}`)
      return response.data as ScheduleDetails
    },
    enabled: hasAccess && Boolean(selectedScheduleId),
  })

  const driversQuery = useQuery({
    queryKey: ['dispatcher', 'drivers'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/drivers')
      return response.data as DriverItem[]
    },
    enabled: hasAccess,
  })

  const vehiclesQuery = useQuery({
    queryKey: ['dispatcher', 'vehicles'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/vehicles')
      return response.data as VehicleItem[]
    },
    enabled: hasAccess,
  })

  const assignmentsQuery = useQuery({
    queryKey: ['dispatcher', 'assignments'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/assignments')
      return response.data as AssignmentItem[]
    },
    enabled: hasAccess,
    refetchInterval: 30000,
  })

  const activeTripsQuery = useQuery({
    queryKey: ['dispatcher', 'activeTrips'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/active-trips')
      return response.data as ActiveTrip[]
    },
    enabled: hasAccess,
    refetchInterval: 20000,
  })

  const deviationsQuery = useQuery({
    queryKey: ['dispatcher', 'deviations'],
    queryFn: async () => {
      const response = await api.get('/dispatcher/deviations')
      return response.data as DeviationItem[]
    },
    enabled: hasAccess,
    refetchInterval: 20000,
    onSuccess: (data) => {
      if (!deviationSelected && data.length) {
        setDeviationSelected(data[0])
      }
    },
  })

  const monitoringQuery = useQuery({
    queryKey: ['dispatcher', 'monitoring', monitorFleet],
    queryFn: async () => {
      if (!monitorFleet) return null
      const response = await api.get(
        `/dispatcher/vehicles/${monitorFleet}/monitoring`,
      )
      return response.data as MonitoringResponse
    },
    enabled: hasAccess && Boolean(monitorFleet),
    refetchInterval: 15000,
  })

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        routeId: Number(scheduleForm.routeId),
        fleetNumber: scheduleForm.fleetNumber || undefined,
        workStartTime: scheduleForm.workStartTime,
        workEndTime: scheduleForm.workEndTime,
        intervalMin: Number(scheduleForm.intervalMin),
      }
      const response = await api.post('/dispatcher/schedules', payload)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatcher', 'schedules'] })
      void queryClient.invalidateQueries({ queryKey: ['dispatcher', 'dashboard'] })
      setScheduleModalOpen(false)
    },
  })

  const updateScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        routeId: Number(scheduleForm.routeId),
        workStartTime: scheduleForm.workStartTime,
        workEndTime: scheduleForm.workEndTime,
        intervalMin: Number(scheduleForm.intervalMin),
      }
      const response = await api.patch(
        `/dispatcher/schedules/${selectedScheduleId}`,
        payload,
      )
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatcher', 'schedules'] })
      if (selectedScheduleId) {
        void queryClient.invalidateQueries({
          queryKey: ['dispatcher', 'schedule', selectedScheduleId],
        })
      }
      setScheduleModalOpen(false)
    },
  })

  const assignDriverMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        driverLogin: assignmentForm.driverLogin,
        fleetNumber: assignmentForm.fleetNumber,
        routeId: assignmentForm.routeId ? Number(assignmentForm.routeId) : undefined,
        assignedAt: assignmentForm.assignedAt
          ? new Date(assignmentForm.assignedAt).toISOString()
          : undefined,
      }
      const response = await api.post('/dispatcher/assignments', payload)
      return response.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatcher', 'assignments'] })
      setAssignmentForm({ driverLogin: '', fleetNumber: '', routeId: '', assignedAt: '' })
    },
  })

  const filteredSchedules = useMemo(() => {
    const schedules = schedulesQuery.data ?? []
    return schedules.filter((schedule) => {
      const matchesRoute =
        !scheduleFilter.routeNumber ||
        schedule.routeNumber.includes(scheduleFilter.routeNumber)
      const matchesType =
        !scheduleFilter.transportType ||
        schedule.transportType
          .toLowerCase()
          .includes(scheduleFilter.transportType.toLowerCase())
      const matchesFleet = !scheduleFilter.fleetNumber
        ? true
        : (vehiclesQuery.data ?? []).some(
            (vehicle) =>
              vehicle.fleetNumber === scheduleFilter.fleetNumber &&
              vehicle.routeId === schedule.routeId,
          )
      return matchesRoute && matchesType && matchesFleet
    })
  }, [schedulesQuery.data, scheduleFilter, vehiclesQuery.data])

  const selectedScheduleDetails = scheduleDetailsQuery.data
  const routeDurationMinutes = useMemo(() => {
    if (!selectedScheduleDetails?.stops?.length) return null
    return selectedScheduleDetails.stops.reduce((total, stop) => {
      return total + (stop.minutesToNextStop ?? 0)
    }, 0)
  }, [selectedScheduleDetails])
  const calculatedEndTime = useMemo(() => {
    if (!selectedScheduleDetails || routeDurationMinutes === null) return null
    const [hours, minutes] = selectedScheduleDetails.workStartTime
      .split(':')
      .map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    const totalMinutes = hours * 60 + minutes + routeDurationMinutes
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMinutes = Math.round(totalMinutes % 60)
    return `${`${endHours}`.padStart(2, '0')}:${`${endMinutes}`.padStart(2, '0')}`
  }, [selectedScheduleDetails, routeDurationMinutes])
  const schedulePreview = useMemo(() => {
    if (!scheduleForm.workStartTime) return []
    return makePreviewSlots(scheduleForm.workStartTime, Number(scheduleForm.intervalMin || 0), 6)
  }, [scheduleForm.workStartTime, scheduleForm.intervalMin])

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      clear()
      navigate({ to: '/' })
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Диспетчерський доступ</h2>
          <p className="mt-2 text-slate-600">Увійдіть як диспетчер.</p>
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
            Цей акаунт не має ролі диспетчера.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-700">
              Диспетчер · Міський транспорт
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Панель оперативного контролю
            </h1>
            <p className="mt-2 text-slate-600">
              Актуальна зміна, розклади, призначення, моніторинг рейсів.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {now.toLocaleString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Session
              </div>
              <div className="font-semibold text-slate-800">
                {token ? 'Redis session ok' : 'Session missing'}
              </div>
              <div className="text-xs text-slate-500">
                DB user: {user.login}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Активні рейси зараз',
            value: dashboardQuery.data?.activeTrips ?? '—',
          },
          {
            label: 'Відхилення > 5 хв',
            value: dashboardQuery.data?.deviations ?? '—',
          },
          {
            label: 'Розкладів на сьогодні',
            value: dashboardQuery.data?.schedulesToday ?? '—',
          },
          {
            label: 'Непризначені',
            value:
              dashboardQuery.data
                ? `${dashboardQuery.data.unassignedDrivers} водіїв / ${dashboardQuery.data.unassignedVehicles} ТЗ`
                : '—',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-lg"
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {card.label}
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Активні рейси
            </div>
            <div className="mt-4 space-y-3">
              {(activeTripsQuery.data ?? []).map((trip) => (
                <div
                  key={trip.id}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="font-semibold text-slate-900">
                      #{trip.routeNumber} · {trip.transportType}
                    </div>
                    <div className="text-slate-500">
                      {trip.fleetNumber} · {trip.driverName}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Старт: {formatTime(trip.startsAt)} · Статус:{' '}
                    {trip.endsAt ? 'Завершується' : 'Активний'}
                  </div>
                </div>
              ))}
              {activeTripsQuery.data && activeTripsQuery.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Активних рейсів зараз немає.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Відхилення
            </div>
            <div className="mt-4 space-y-3">
              {(deviationsQuery.data ?? [])
                .filter((item) => item.deviationMin !== null)
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={`${item.fleetNumber}-${item.routeNumber}`}
                    className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {item.fleetNumber} · #{item.routeNumber}
                    </div>
                    <div className="text-sm text-slate-600">
                      Відхилення: {item.deviationMin} хв
                    </div>
                    <div className="text-xs text-slate-500">
                      План {item.plannedTime} · Зараз {item.currentTime}
                    </div>
                  </div>
                ))}
              {deviationsQuery.data && deviationsQuery.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Даних про відхилення немає.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'schedules' && (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Розклади
                </div>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Список розкладів
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScheduleForm({
                    mode: 'create',
                    routeId: '',
                    fleetNumber: '',
                    workStartTime: '06:00:00',
                    workEndTime: '23:00:00',
                    intervalMin: '10',
                  })
                  setScheduleModalOpen(true)
                }}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
              >
                Створити розклад
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Маршрут"
                value={scheduleFilter.routeNumber}
                onChange={(event) =>
                  setScheduleFilter({
                    ...scheduleFilter,
                    routeNumber: event.target.value,
                  })
                }
              />
              <input
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Тип транспорту"
                value={scheduleFilter.transportType}
                onChange={(event) =>
                  setScheduleFilter({
                    ...scheduleFilter,
                    transportType: event.target.value,
                  })
                }
              />
              <input
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Fleet number"
                value={scheduleFilter.fleetNumber}
                onChange={(event) =>
                  setScheduleFilter({
                    ...scheduleFilter,
                    fleetNumber: event.target.value,
                  })
                }
              />
              <input
                type="date"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={scheduleFilter.date}
                onChange={(event) =>
                  setScheduleFilter({
                    ...scheduleFilter,
                    date: event.target.value,
                  })
                }
              />
            </div>

            <div className="mt-4 space-y-2">
              {filteredSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    selectedScheduleId === schedule.id
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      #{schedule.routeNumber} · {schedule.transportType}
                    </span>
                    <span className="text-slate-500">
                      Інтервал {schedule.intervalMin} хв
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {schedule.direction} · {schedule.workStartTime} - {schedule.workEndTime}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedScheduleId(schedule.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Переглянути
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScheduleId(schedule.id)
                        setScheduleForm({
                          mode: 'edit',
                          routeId: `${schedule.routeId}`,
                          fleetNumber: '',
                          workStartTime: schedule.workStartTime,
                          workEndTime: schedule.workEndTime,
                          intervalMin: `${schedule.intervalMin}`,
                        })
                        setScheduleModalOpen(true)
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleForm({
                          mode: 'create',
                          routeId: `${schedule.routeId}`,
                          fleetNumber: '',
                          workStartTime: schedule.workStartTime,
                          workEndTime: schedule.workEndTime,
                          intervalMin: `${schedule.intervalMin}`,
                        })
                        setScheduleModalOpen(true)
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Дублювати
                    </button>
                  </div>
                </div>
              ))}
              {!filteredSchedules.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Розкладів не знайдено.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Деталі
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {selectedScheduleDetails
                ? `Розклад #${selectedScheduleDetails.id}`
                : 'Оберіть розклад'}
            </h3>
            {selectedScheduleDetails && (
              <>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">
                    Маршрут #{selectedScheduleDetails.route.number}
                  </div>
                  <div className="mt-2">
                    Старт: {selectedScheduleDetails.workStartTime} · Завершення:{' '}
                    {selectedScheduleDetails.workEndTime}
                  </div>
                  <div>Інтервал: {selectedScheduleDetails.intervalMin} хв</div>
                  <div className="mt-1">
                    Час закінчення маршруту:{' '}
                    {calculatedEndTime ? calculatedEndTime : '—'}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Зупинки
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedScheduleDetails.stops.map((stop) => (
                      <div
                        key={stop.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="font-medium text-slate-900">
                          {stop.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {stop.minutesToNextStop
                            ? `${stop.minutesToNextStop} хв`
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {activeTab === 'assignments' && (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Призначення
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Таблиця призначень
            </h2>
            <div className="mt-4 space-y-2">
              {(assignmentsQuery.data ?? []).map((assignment) => {
                const assignedAt = new Date(assignment.assignedAt)
                const ageHours = (now.getTime() - assignedAt.getTime()) / 3600000
                const status =
                  ageHours < 24 ? 'актуальне' : ageHours < 72 ? 'прострочене' : 'конфлікт'
                return (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">
                        {assignment.driverName} · {assignment.driverLogin}
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {assignment.fleetNumber} · #{assignment.routeNumber} ·{' '}
                      {assignment.transportType}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Призначено: {formatDateTime(assignment.assignedAt)}
                    </div>
                  </div>
                )
              })}
              {assignmentsQuery.data && assignmentsQuery.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Призначення відсутні.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Нове призначення
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Водій
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={assignmentForm.driverLogin}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      driverLogin: event.target.value,
                    })
                  }
                >
                  <option value="">Оберіть водія</option>
                  {(driversQuery.data ?? []).map((driver) => (
                    <option key={driver.login} value={driver.login}>
                      {driver.fullName} · {driver.login}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Транспорт
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={assignmentForm.fleetNumber}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      fleetNumber: event.target.value,
                    })
                  }
                >
                  <option value="">Оберіть транспорт</option>
                  {(vehiclesQuery.data ?? []).map((vehicle) => (
                    <option key={vehicle.fleetNumber} value={vehicle.fleetNumber}>
                      {vehicle.fleetNumber} · маршрут {vehicle.routeId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Маршрут
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={assignmentForm.routeId}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      routeId: event.target.value,
                    })
                  }
                >
                  <option value="">Не обрано</option>
                  {(routesQuery.data ?? []).map((route) => (
                    <option key={route.id} value={route.id}>
                      #{route.number} · {route.transportType} · {route.direction}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Час призначення
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={assignmentForm.assignedAt}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      assignedAt: event.target.value,
                    })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => assignDriverMutation.mutate()}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
                disabled={assignDriverMutation.isPending}
              >
                {assignDriverMutation.isPending ? 'Призначення...' : 'Призначити'}
              </button>
              {assignDriverMutation.error && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  {getErrorMessage(assignDriverMutation.error, 'Помилка призначення.')}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'monitoring' && (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Фільтри
            </div>
            <label className="mt-4 block text-sm">
              Маршрут
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                value={scheduleFilter.routeNumber}
                onChange={(event) =>
                  setScheduleFilter({
                    ...scheduleFilter,
                    routeNumber: event.target.value,
                  })
                }
              >
                <option value="">Усі маршрути</option>
                {(routesQuery.data ?? []).map((route) => (
                  <option key={route.id} value={route.number}>
                    #{route.number} · {route.transportType}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm">
              Транспорт
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                value={monitorFleet}
                onChange={(event) => setMonitorFleet(event.target.value)}
              >
                <option value="">Оберіть ТЗ</option>
                {(activeTripsQuery.data ?? []).map((trip) => (
                  <option key={trip.fleetNumber} value={trip.fleetNumber}>
                    {trip.fleetNumber} · #{trip.routeNumber}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {monitoringQuery.data ? (
                <>
                  <div className="font-semibold text-slate-900">
                    {monitoringQuery.data.vehicle.fleetNumber}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Останній GPS: {formatDateTime(monitoringQuery.data.currentPosition?.recordedAt)}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Координати: {monitoringQuery.data.currentPosition?.lon ?? '—'},{' '}
                    {monitoringQuery.data.currentPosition?.lat ?? '—'}
                  </div>
                </>
              ) : (
                <div>Оберіть транспорт для моніторингу.</div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Карта маршруту
            </div>
            <div className="mt-4 h-[360px] rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
              {monitoringQuery.data ? (
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  {monitoringQuery.data.routePoints.map((point, index) => {
                    const x = 10 + (index / (monitoringQuery.data.routePoints.length - 1 || 1)) * 80
                    const y = 20 + (Math.sin(index / 2) + 1) * 25
                    return (
                      <circle key={point.id} cx={x} cy={y} r={2.5} fill="#10b981" />
                    )
                  })}
                  {monitoringQuery.data.currentPosition && (
                    <circle cx={50} cy={50} r={4} fill="#f97316" />
                  )}
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Дані маршруту з'являться після вибору транспорту.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'deviations' && (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Відхилення від графіка
            </div>
            <div className="mt-4 space-y-2">
              {(deviationsQuery.data ?? []).map((item) => (
                <button
                  key={`${item.fleetNumber}-${item.routeNumber}`}
                  type="button"
                  onClick={() => setDeviationSelected(item)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                    deviationSelected?.fleetNumber === item.fleetNumber
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      {item.fleetNumber} · #{item.routeNumber}
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    План {item.plannedTime ?? '—'} · Факт {item.currentTime}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Відхилення: {item.deviationMin ?? '—'} хв
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Деталі
            </div>
            {deviationSelected ? (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-900">
                    {deviationSelected.fleetNumber} · #{deviationSelected.routeNumber}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Найближча зупинка:{' '}
                    {deviationSelected.nearestStop?.stopName ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Останній GPS: {formatDateTime(deviationSelected.lastGps?.recordedAt)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Історія GPS
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-slate-500">
                    {(deviationSelected.history ?? []).map((point, index) => (
                      <div key={`${point.recordedAt}-${index}`}>
                        {formatDateTime(point.recordedAt)} · {point.lon}, {point.lat}
                      </div>
                    ))}
                    {!deviationSelected.history?.length && (
                      <div>Немає історії GPS.</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCheckedDeviations({
                      ...checkedDeviations,
                      [deviationSelected.fleetNumber]: true,
                    })
                  }
                  className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                >
                  {checkedDeviations[deviationSelected.fleetNumber]
                    ? 'Перевірено'
                    : 'Позначити як перевірено'}
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                Оберіть відхилення зі списку.
              </div>
            )}
          </div>
        </section>
      )}

      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {scheduleForm.mode === 'create' ? 'Створити розклад' : 'Редагувати розклад'}
              </h3>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-4 text-sm">
              <label className="block">
                Маршрут
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={scheduleForm.routeId}
                  onChange={(event) =>
                    setScheduleForm({ ...scheduleForm, routeId: event.target.value })
                  }
                >
                  <option value="">Оберіть маршрут</option>
                  {(routesQuery.data ?? []).map((route) => (
                    <option key={route.id} value={route.id}>
                      #{route.number} · {route.transportType} · {route.direction}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Транспорт (fleet)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={scheduleForm.fleetNumber}
                  onChange={(event) =>
                    setScheduleForm({ ...scheduleForm, fleetNumber: event.target.value })
                  }
                  placeholder="AB-001"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  Старт
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={scheduleForm.workStartTime}
                    onChange={(event) =>
                      setScheduleForm({
                        ...scheduleForm,
                        workStartTime: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="block">
                  Фініш
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={scheduleForm.workEndTime}
                    onChange={(event) =>
                      setScheduleForm({
                        ...scheduleForm,
                        workEndTime: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="block">
                  Інтервал
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    value={scheduleForm.intervalMin}
                    onChange={(event) =>
                      setScheduleForm({
                        ...scheduleForm,
                        intervalMin: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Preview
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {schedulePreview.map((slot) => (
                    <span
                      key={slot}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={() =>
                    scheduleForm.mode === 'create'
                      ? createScheduleMutation.mutate()
                      : updateScheduleMutation.mutate()
                  }
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {scheduleForm.mode === 'create' ? 'Створити' : 'Зберегти'}
                </button>
              </div>
              {(createScheduleMutation.error || updateScheduleMutation.error) && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  {getErrorMessage(
                    createScheduleMutation.error ?? updateScheduleMutation.error,
                    'Помилка збереження.',
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default DispatcherPage
