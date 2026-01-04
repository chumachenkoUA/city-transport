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

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`

const formatTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

function DriverPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, roles, clear } = useAuthStore()
  const hasAccess = roles.includes('ct_driver_role')
  
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()))
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [passengerCount, setPassengerCount] = useState('')

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
      const response = await api.get('/driver/schedule', { params: { date: selectedDate } })
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
    refetchInterval: 10000,
  })

  const startTripMutation = useMutation({
    mutationFn: async () => {
      const payload = { fleetNumber: scheduleQuery.data?.vehicle?.fleetNumber }
      const response = await api.post('/driver/trips/start', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'activeTrip'] })
    },
  })

  const finishTripMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/driver/trips/finish')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'activeTrip'] })
    },
  })

  const passengerMutation = useMutation({
    mutationFn: async () => {
      const tripId = activeTripQuery.data?.id || selectedTripId
      if (!tripId) throw new Error('Оберіть рейс')
      const response = await api.post('/driver/trips/passengers', {
        tripId,
        passengerCount: Number(passengerCount),
      })
      return response.data
    },
    onSuccess: () => setPassengerCount('')
  })

  const handleSignOut = () => {
    api.post('/auth/logout').finally(() => {
      clear()
      navigate({ to: '/' })
    })
  }

  if (!user || !hasAccess) {
    return (
      <main className="page-shell flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-800">Обмежений доступ</h2>
          <p className="mt-2 text-slate-600">Увійдіть під акаунтом водія.</p>
        </div>
      </main>
    )
  }

  const activeTrip = activeTripQuery.data

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-xl font-bold">
            {user.login[0].toUpperCase()}
          </div>
          <div>
            <div className="badge badge-success mb-1">ct-driver</div>
            <h1 className="text-2xl font-bold text-slate-900">
              {profileQuery.data?.fullName || user.login}
            </h1>
          </div>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            className="input py-2 text-sm"
          />
          <button onClick={handleSignOut} className="btn btn-ghost text-rose-500">Вихід</button>
        </div>
      </header>

      {/* Active Trip Status Bar */}
      {activeTrip ? (
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="card border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row items-center justify-between gap-6 ring-2 ring-emerald-500/10">
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">У рейсі</span>
                <span className="text-2xl font-black text-emerald-900">#{activeTrip.route.number}</span>
              </div>
              <div className="h-10 w-px bg-emerald-200 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Транспорт</span>
                <span className="text-lg font-bold text-emerald-800">{activeTrip.vehicle.fleetNumber}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Старт</span>
                <span className="text-lg font-bold text-emerald-800">{formatTime(activeTrip.startsAt)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => finishTripMutation.mutate()}
              disabled={finishTripMutation.isPending}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 w-full sm:w-auto"
            >
              Завершити рейс
            </button>
          </div>
        </section>
      ) : (
        <section className="card bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
             <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M18 11h-5V6h5v5zm-6 0H7V6h5v5zm6 6h-5v-5h5v5zm-6 0H7v-5h5v5zM4 21h16a2 2 0 002-2V5a2 2 0 00-2-2H4a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold">Готові до нового рейсу?</h2>
              <p className="text-slate-400 text-sm">Призначений транспорт: <span className="text-white font-semibold">{scheduleQuery.data?.vehicle?.fleetNumber || 'не призначено'}</span></p>
            </div>
            <button 
              onClick={() => startTripMutation.mutate()}
              disabled={!scheduleQuery.data?.assigned || startTripMutation.isPending}
              className="btn bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-700 w-full sm:w-auto"
            >
              Розпочати рейс
            </button>
          </div>
        </section>
      )}

      <div className="grid-dashboard lg:grid-cols-[1.5fr_1fr]">
        {/* Schedule List */}
        <div className="card">
          <div className="card-header">
            <h2>Мій графік</h2>
          </div>
          
          <div className="space-y-3">
            {scheduleQuery.data?.trips.map(trip => (
              <div 
                key={trip.id}
                onClick={() => setSelectedTripId(trip.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                  selectedTripId === trip.id 
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10' 
                    : 'border-slate-100 bg-white hover:border-indigo-200'
                }`}
              >
                <div>
                  <div className="font-bold text-slate-900 text-lg">#{trip.route.number}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-tight">{trip.route.direction}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-700">{formatTime(trip.startsAt)} — {formatTime(trip.endsAt)}</div>
                  <div className="text-xs text-slate-400">{trip.vehicle.fleetNumber}</div>
                </div>
              </div>
            ))}
            {!scheduleQuery.data?.trips.length && (
              <div className="py-12 text-center">
                <p className="text-slate-400 italic">На цей день рейсів не призначено.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="card bg-indigo-600 text-white">
            <div className="card-header border-indigo-500">
              <h2 className="text-white">Облік пасажирів</h2>
            </div>
            <div className="space-y-4">
              <div className="form-group">
                <label className="text-indigo-200">Кількість на рейсі</label>
                <input 
                  type="number" 
                  value={passengerCount}
                  onChange={e => setPassengerCount(e.target.value)}
                  className="input bg-indigo-700/50 border-indigo-500 text-white placeholder:text-indigo-400 focus:bg-indigo-700"
                  placeholder="0"
                />
              </div>
              <button 
                onClick={() => passengerMutation.mutate()}
                disabled={passengerMutation.isPending || !passengerCount}
                className="btn bg-white text-indigo-600 hover:bg-indigo-50 w-full"
              >
                Зберегти дані
              </button>
              {passengerMutation.isSuccess && <p className="text-xs text-center text-indigo-200">✓ Дані успішно збережено</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Деталі зупинок</h2>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {scheduleQuery.data?.stops.map((stop, i) => (
                <div key={stop.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-sm">
                  <span className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {i+1}
                  </span>
                  <span className="flex-1 text-slate-700 font-medium">{stop.name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {stop.minutesToNextStop ? `+${stop.minutesToNextStop}хв` : 'END'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default DriverPage