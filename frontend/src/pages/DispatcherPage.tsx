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

  if (!user || !hasAccess) {
    return (
      <main className="page-shell flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-800">Обмежений доступ</h2>
          <p className="mt-2 text-slate-600">Увійдіть під акаунтом диспетчера.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="badge badge-success mb-2">ct-dispatcher</div>
          <h1 className="text-3xl font-bold text-slate-900">Диспетчерський центр</h1>
          <p className="text-slate-500">Оперативний контроль руху та розкладів.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-lg font-semibold text-slate-700">
              {now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400">{user.login}</div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost text-rose-500">Вихід</button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Активні рейси', value: dashboardQuery.data?.activeTrips ?? '—', color: 'text-emerald-600' },
          { label: 'Відхилення', value: dashboardQuery.data?.deviations ?? '—', color: 'text-amber-600' },
          { label: 'Розкладів', value: dashboardQuery.data?.schedulesToday ?? '—', color: 'text-indigo-600' },
          { label: 'Вільні водії', value: dashboardQuery.data?.unassignedDrivers ?? '—', color: 'text-slate-600' },
        ].map((stat, i) => (
          <div key={i} className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</span>
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <section className="grid-dashboard lg:grid-cols-2">
          <div className="card">
            <div className="card-header">
              <h2>Активні рейси</h2>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {(activeTripsQuery.data ?? []).map((trip) => (
                <div key={trip.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-800">#{trip.routeNumber} <span className="text-slate-400">·</span> {trip.fleetNumber}</div>
                    <div className="text-xs text-slate-500">{trip.driverName}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-emerald-600 font-medium">Активний</div>
                    <div className="text-slate-400">{formatTime(trip.startsAt)}</div>
                  </div>
                </div>
              ))}
              {!activeTripsQuery.data?.length && <p className="text-center text-slate-400 py-4 text-sm">Немає активних рейсів.</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Відхилення</h2>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {(deviationsQuery.data ?? []).filter(d => d.deviationMin !== null).map((dev, i) => (
                <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-amber-900">#{dev.routeNumber} <span className="text-amber-400">·</span> {dev.fleetNumber}</div>
                    <div className="text-xs text-amber-700/70">План: {dev.plannedTime}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-rose-600 font-bold">+{dev.deviationMin} хв</div>
                    <div className="text-xs text-amber-600">Запізнення</div>
                  </div>
                </div>
              ))}
              {!deviationsQuery.data?.length && <p className="text-center text-slate-400 py-4 text-sm">Все йде за графіком.</p>}
            </div>
          </div>
        </section>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <section className="card">
          <div className="card-header">
            <h2>Керування розкладами</h2>
            <button 
              onClick={() => {
                setScheduleForm({ mode: 'create', routeId: '', fleetNumber: '', workStartTime: '06:00:00', workEndTime: '23:00:00', intervalMin: '10' })
                setScheduleModalOpen(true)
              }} 
              className="btn btn-primary text-xs"
            >
              + Створити
            </button>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <div className="form-group">
              <label>Маршрут</label>
              <input value={scheduleFilter.routeNumber} onChange={e => setScheduleFilter({...scheduleFilter, routeNumber: e.target.value})} className="input py-2 text-sm" placeholder="№" />
            </div>
            <div className="form-group">
              <label>Транспорт</label>
              <input value={scheduleFilter.transportType} onChange={e => setScheduleFilter({...scheduleFilter, transportType: e.target.value})} className="input py-2 text-sm" placeholder="Тип" />
            </div>
            <div className="form-group">
              <label>Fleet</label>
              <input value={scheduleFilter.fleetNumber} onChange={e => setScheduleFilter({...scheduleFilter, fleetNumber: e.target.value})} className="input py-2 text-sm" placeholder="Бортовий" />
            </div>
            <div className="form-group">
              <label>Дата</label>
              <input type="date" value={scheduleFilter.date} onChange={e => setScheduleFilter({...scheduleFilter, date: e.target.value})} className="input py-2 text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Маршрут</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Напрямок</th>
                  <th className="px-4 py-3 font-medium">Час роботи</th>
                  <th className="px-4 py-3 font-medium">Інтервал</th>
                  <th className="px-4 py-3 font-medium text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchedules.map(schedule => (
                  <tr key={schedule.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{schedule.routeNumber}</td>
                    <td className="px-4 py-3">{schedule.transportType}</td>
                    <td className="px-4 py-3 text-slate-500">{schedule.direction}</td>
                    <td className="px-4 py-3 font-mono">{schedule.workStartTime} - {schedule.workEndTime}</td>
                    <td className="px-4 py-3">{schedule.intervalMin} хв</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => {
                          setSelectedScheduleId(schedule.id)
                          setScheduleForm({
                            mode: 'edit',
                            routeId: `${schedule.routeId}`,
                            fleetNumber: '',
                            workStartTime: schedule.workStartTime,
                            workEndTime: schedule.workEndTime,
                            intervalMin: `${schedule.intervalMin}`
                          })
                          setScheduleModalOpen(true)
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Ред.
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredSchedules.length && <div className="text-center py-8 text-slate-400">Нічого не знайдено.</div>}
          </div>
        </section>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <section className="grid-dashboard lg:grid-cols-[1fr_350px]">
          <div className="card">
            <div className="card-header">
              <h2>Журнал призначень</h2>
            </div>
            <div className="space-y-2">
              {(assignmentsQuery.data ?? []).map(assignment => (
                <div key={assignment.id} className="p-3 border border-slate-100 rounded-xl flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-semibold text-slate-800">{assignment.driverName}</div>
                    <div className="text-xs text-slate-500">{assignment.fleetNumber} · #{assignment.routeNumber}</div>
                  </div>
                  <div className="text-xs text-slate-400 text-right">
                    <div>{formatDateTime(assignment.assignedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card h-fit">
            <div className="card-header">
              <h2>Нове призначення</h2>
            </div>
            <div className="space-y-4">
              <div className="form-group">
                <label>Водій</label>
                <select 
                  className="select"
                  value={assignmentForm.driverLogin}
                  onChange={e => setAssignmentForm({...assignmentForm, driverLogin: e.target.value})}
                >
                  <option value="">Оберіть...</option>
                  {(driversQuery.data ?? []).map(d => (
                    <option key={d.login} value={d.login}>{d.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Транспорт</label>
                <select 
                  className="select"
                  value={assignmentForm.fleetNumber}
                  onChange={e => setAssignmentForm({...assignmentForm, fleetNumber: e.target.value})}
                >
                  <option value="">Оберіть...</option>
                  {(vehiclesQuery.data ?? []).map(v => (
                    <option key={v.fleetNumber} value={v.fleetNumber}>{v.fleetNumber} (ID: {v.id})</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={() => assignDriverMutation.mutate()}
                disabled={assignDriverMutation.isPending}
                className="btn btn-primary w-full"
              >
                Призначити
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <section className="card min-h-[500px]">
          <div className="card-header">
            <h2>GPS Моніторинг</h2>
            <select 
              className="select py-1 text-sm w-48"
              value={monitorFleet}
              onChange={e => setMonitorFleet(e.target.value)}
            >
              <option value="">Оберіть транспорт...</option>
              {(activeTripsQuery.data ?? []).map(t => (
                <option key={t.fleetNumber} value={t.fleetNumber}>{t.fleetNumber} (#{t.routeNumber})</option>
              ))}
            </select>
          </div>
          
          <div className="h-[400px] bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden flex items-center justify-center">
            {monitoringQuery.data ? (
              <div className="absolute inset-0 p-4">
                 {/* Simple visualization placeholder */}
                 <svg viewBox="0 0 100 100" className="w-full h-full opacity-50">
                    <path d="M10,50 Q50,10 90,50 T90,90" fill="none" stroke="#e2e8f0" strokeWidth="2" />
                 </svg>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <div className="text-4xl">📍</div>
                    <div className="text-xs font-mono bg-white px-2 py-1 rounded shadow mt-1">
                      {monitoringQuery.data.currentPosition?.lat}, {monitoringQuery.data.currentPosition?.lon}
                    </div>
                 </div>
              </div>
            ) : (
              <div className="text-slate-400">Оберіть транспорт зі списку активних рейсів.</div>
            )}
          </div>
        </section>
      )}

      {/* Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="card-header">
              <h2>{scheduleForm.mode === 'create' ? 'Створення розкладу' : 'Редагування'}</h2>
              <button onClick={() => setScheduleModalOpen(false)} className="btn btn-ghost px-2 py-1">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="form-group">
                <label>Маршрут</label>
                <select 
                  className="select"
                  value={scheduleForm.routeId}
                  onChange={e => setScheduleForm({...scheduleForm, routeId: e.target.value})}
                >
                  <option value="">Оберіть...</option>
                  {(routesQuery.data ?? []).map(r => (
                    <option key={r.id} value={r.id}>#{r.number} · {r.transportType} · {r.direction}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="form-group">
                  <label>Початок</label>
                  <input className="input" value={scheduleForm.workStartTime} onChange={e => setScheduleForm({...scheduleForm, workStartTime: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Кінець</label>
                  <input className="input" value={scheduleForm.workEndTime} onChange={e => setScheduleForm({...scheduleForm, workEndTime: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Інтервал (хв)</label>
                  <input className="input" value={scheduleForm.intervalMin} onChange={e => setScheduleForm({...scheduleForm, intervalMin: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setScheduleModalOpen(false)} className="btn btn-secondary">Скасувати</button>
                <button 
                  onClick={() => scheduleForm.mode === 'create' ? createScheduleMutation.mutate() : updateScheduleMutation.mutate()} 
                  className="btn btn-primary"
                >
                  Зберегти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default DispatcherPage