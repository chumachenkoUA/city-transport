import { useMemo, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'
import { Map } from '../lib/Map'
import maplibregl from 'maplibre-gl'

type TransportType = {
  id: number
  name: string
}

type StopRow = {
  id: number
  name: string
  lon: string
  lat: string
}
// ... (rest of types)

type PassengerFlowRow = {
  day: string
  fleetNumber: string
  routeNumber: string
  transportTypeId: number
  passengerCount: string
}

type ComplaintRow = {
  id: number
  type: string
  message: string
  status: string
  createdAt: string | null
  routeNumber: string | null
  transportType: string | null
  fleetNumber: string | null
}

type DraftStop = {
  stopId?: string
  name?: string
  lon?: string
  lat?: string
  distanceToNextKm?: string
}

const today = new Date()
const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

function MunicipalityPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_municipality_role')
  const queryClient = useQueryClient()

  const [stopForm, setStopForm] = useState({
    name: '',
    lon: '',
    lat: '',
  })
  const [stopEdit, setStopEdit] = useState<StopRow | null>(null)
  const [routeForm, setRouteForm] = useState({
    transportTypeId: '',
    number: '',
    direction: 'forward',
  })
  const [draftStops, setDraftStops] = useState<DraftStop[]>([
    { stopId: '' },
    { stopId: '' },
  ])
  const [pointsInput, setPointsInput] = useState('')
  const [flowQuery, setFlowQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
    routeNumber: '',
    transportTypeId: '',
  })
  const [complaintsQuery, setComplaintsQuery] = useState({
    from: formatDate(thirtyDaysAgo),
    to: formatDate(today),
    routeNumber: '',
    transportTypeId: '',
    fleetNumber: '',
  })

  const transportTypesQuery = useQuery({
    queryKey: ['municipality', 'transport-types'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/municipality/transport-types')
      return response.data as TransportType[]
    },
  })

  const stopsQuery = useQuery({
    queryKey: ['municipality', 'stops'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/municipality/stops')
      return response.data as StopRow[]
    },
  })

  const createStopMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: stopForm.name.trim(),
        lon: Number(stopForm.lon),
        lat: Number(stopForm.lat),
      }
      const response = await api.post('/municipality/stops', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality', 'stops'] })
      setStopForm({ name: '', lon: '', lat: '' })
    },
  })

  const updateStopMutation = useMutation({
    mutationFn: async () => {
      if (!stopEdit) {
        throw new Error('stop not selected')
      }
      const payload = {
        name: stopEdit.name,
        lon: Number(stopEdit.lon),
        lat: Number(stopEdit.lat),
      }
      const response = await api.patch(`/municipality/stops/${stopEdit.id}`, payload)
      return response.data as StopRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality', 'stops'] })
      setStopEdit(null)
    },
  })

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const stops = draftStops.map((stop) => ({
        stopId: stop.stopId ? Number(stop.stopId) : undefined,
        name: stop.stopId ? undefined : stop.name?.trim(),
        lon: stop.stopId ? undefined : Number(stop.lon),
        lat: stop.stopId ? undefined : Number(stop.lat),
        distanceToNextKm: stop.distanceToNextKm
          ? Number(stop.distanceToNextKm)
          : undefined,
      }))
      const points = pointsInput
        .split('\n')
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => {
          const [lon, lat] = row.split(',').map((value) => value.trim())
          return { lon: Number(lon), lat: Number(lat) }
        })
      const payload = {
        transportTypeId: Number(routeForm.transportTypeId),
        number: routeForm.number.trim(),
        direction: routeForm.direction,
        isActive: true,
        stops,
        points,
      }
      const response = await api.post('/municipality/routes', payload)
      return response.data
    },
  })

  const flowMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        from: flowQuery.from,
        to: flowQuery.to,
      }
      if (flowQuery.routeNumber) {
        params.routeNumber = flowQuery.routeNumber
      }
      if (flowQuery.transportTypeId) {
        params.transportTypeId = flowQuery.transportTypeId
      }
      const response = await api.get('/municipality/passenger-flow', { params })
      return response.data as PassengerFlowRow[]
    },
  })

  const complaintsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        from: complaintsQuery.from,
        to: complaintsQuery.to,
      }
      if (complaintsQuery.routeNumber) {
        params.routeNumber = complaintsQuery.routeNumber
      }
      if (complaintsQuery.transportTypeId) {
        params.transportTypeId = complaintsQuery.transportTypeId
      }
      if (complaintsQuery.fleetNumber) {
        params.fleetNumber = complaintsQuery.fleetNumber
      }
      const response = await api.get('/municipality/complaints', { params })
      return response.data as ComplaintRow[]
    },
  })

  const stopOptions = useMemo(() => stopsQuery.data ?? [], [stopsQuery.data])
  const transportOptions = useMemo(
    () => transportTypesQuery.data ?? [],
    [transportTypesQuery.data],
  )

  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapMarkers = useMemo(() => {
    const markers = stopOptions.map(s => ({
      lon: Number(s.lon),
      lat: Number(s.lat),
      title: s.name,
      color: '#3b82f6'
    }))
    
    if (stopForm.lon && stopForm.lat) {
      markers.push({
        lon: Number(stopForm.lon),
        lat: Number(stopForm.lat),
        title: stopForm.name || 'Нова зупинка',
        color: '#ef4444'
      })
    }
    
    return markers
  }, [stopOptions, stopForm])

  if (!user || !hasAccess) {
    return (
      <main className="page-shell flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-800">Обмежений доступ</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом департаменту мерії.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-2">
        <div className="badge badge-neutral w-fit">ct-municipality</div>
        <h1 className="text-3xl sm:text-4xl text-slate-900">
          Управління транспортом
        </h1>
        <p className="text-slate-500 max-w-2xl">
          Проєктування маршрутів, керування зупинками та аналіз ефективності міської транспортної мережі.
        </p>
      </header>

      <section className="grid-dashboard lg:grid-cols-[1.5fr_1fr]">
        <div className="lg:col-span-2 card p-0 overflow-hidden h-[400px] relative">
          <Map 
            onMapLoad={(map) => { mapRef.current = map }}
            markers={mapMarkers}
            onClick={(e) => {
              setStopForm(prev => ({
                ...prev,
                lon: e.lngLat.lng.toFixed(6),
                lat: e.lngLat.lat.toFixed(6)
              }))
            }}
          />
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider z-10">
            Клікніть на мапу, щоб обрати координати
          </div>
        </div>

        {/* Route Creator */}
        <div className="card">
          <div className="card-header">
            <h2>Новий маршрут</h2>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="form-group">
              <label>Тип</label>
              <select
                value={routeForm.transportTypeId}
                onChange={(e) => setRouteForm({ ...routeForm, transportTypeId: e.target.value })}
                className="select"
              >
                <option value="">Оберіть...</option>
                {transportOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Номер</label>
              <input
                value={routeForm.number}
                onChange={(e) => setRouteForm({ ...routeForm, number: e.target.value })}
                className="input"
                placeholder="Напр. 12-А"
              />
            </div>
            <div className="form-group">
              <label>Напрямок</label>
              <select
                value={routeForm.direction}
                onChange={(e) => setRouteForm({ ...routeForm, direction: e.target.value })}
                className="select"
              >
                <option value="forward">Прямий</option>
                <option value="reverse">Зворотній</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Ланцюжок зупинок</h3>
              <button
                type="button"
                onClick={() => setDraftStops((prev) => [...prev, { stopId: '' }])}
                className="btn btn-secondary text-xs py-1.5"
              >
                + Зупинка
              </button>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {draftStops.map((stop, index) => (
                <div key={index} className="flex flex-col gap-3 rounded-2xl bg-slate-50/50 border border-slate-100 p-3 relative group">
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                     <button
                      type="button"
                      onClick={() => {
                        const next = draftStops.filter((_, idx) => idx !== index)
                        setDraftStops(next)
                      }}
                      className="text-rose-400 hover:text-rose-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <div className="form-group">
                      <label>Зупинка</label>
                      <select
                        value={stop.stopId ?? ''}
                        onChange={(e) => {
                          const next = [...draftStops]
                          next[index] = { ...next[index], stopId: e.target.value }
                          setDraftStops(next)
                        }}
                        className="select py-2 text-xs"
                      >
                        <option value="">Створити нову...</option>
                        {stopOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Дистанція (км)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stop.distanceToNextKm ?? ''}
                        onChange={(e) => {
                          const next = [...draftStops]
                          next[index] = { ...next[index], distanceToNextKm: e.target.value }
                          setDraftStops(next)
                        }}
                        className="input py-2 text-xs"
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {!stop.stopId && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        placeholder="Назва нової зупинки"
                        value={stop.name ?? ''}
                        onChange={(e) => {
                          const next = [...draftStops]
                          next[index] = { ...next[index], name: e.target.value }
                          setDraftStops(next)
                        }}
                        className="input py-2 text-xs"
                      />
                      <input
                        placeholder="Lon"
                        value={stop.lon ?? ''}
                        onChange={(e) => {
                          const next = [...draftStops]
                          next[index] = { ...next[index], lon: e.target.value }
                          setDraftStops(next)
                        }}
                        className="input py-2 text-xs"
                      />
                      <input
                        placeholder="Lat"
                        value={stop.lat ?? ''}
                        onChange={(e) => {
                          const next = [...draftStops]
                          next[index] = { ...next[index], lat: e.target.value }
                          setDraftStops(next)
                        }}
                        className="input py-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="form-group">
              <label>Геометрія маршруту (CSV: lon,lat)</label>
              <textarea
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                rows={4}
                className="input font-mono text-xs"
                placeholder="30.52345,50.45012&#10;30.52350,50.45015"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => createRouteMutation.mutate()}
              disabled={createRouteMutation.isPending}
              className="btn btn-primary w-full sm:w-auto"
            >
              {createRouteMutation.isPending ? 'Збереження...' : 'Створити маршрут'}
            </button>
          </div>
          
          {createRouteMutation.isError && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-sm border border-rose-100">
              {getErrorMessage(createRouteMutation.error)}
            </div>
          )}
        </div>

        {/* Stops Manager */}
        <div className="card h-fit">
          <div className="card-header">
            <h2>Реєстр зупинок</h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="form-group">
                <label>Назва</label>
                <input
                  value={stopForm.name}
                  onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  className="input"
                  placeholder="Центральна площа"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label>Довгота</label>
                  <input
                    value={stopForm.lon}
                    onChange={(e) => setStopForm({ ...stopForm, lon: e.target.value })}
                    className="input"
                    placeholder="30.5..."
                  />
                </div>
                <div className="form-group">
                  <label>Широта</label>
                  <input
                    value={stopForm.lat}
                    onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })}
                    className="input"
                    placeholder="50.4..."
                  />
                </div>
              </div>
              <button
                onClick={() => createStopMutation.mutate()}
                disabled={createStopMutation.isPending}
                className="btn btn-secondary w-full"
              >
                Додати зупинку
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Останні додані</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {stopOptions.slice(0, 8).map((stop) => (
                  <div
                    key={stop.id}
                    onClick={() => setStopEdit(stop)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-900">{stop.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{stop.lon}, {stop.lat}</p>
                    </div>
                    <span className="text-slate-300">✎</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {stopEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="card w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="card-header">
                  <h2>Редагування</h2>
                  <button onClick={() => setStopEdit(null)} className="btn btn-ghost text-lg leading-none px-2 py-1">×</button>
                </div>
                <div className="space-y-4">
                  <div className="form-group">
                    <label>Назва</label>
                    <input
                      value={stopEdit.name}
                      onChange={(e) => setStopEdit({ ...stopEdit, name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label>Lon</label>
                      <input
                        value={stopEdit.lon}
                        onChange={(e) => setStopEdit({ ...stopEdit, lon: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Lat</label>
                      <input
                        value={stopEdit.lat}
                        onChange={(e) => setStopEdit({ ...stopEdit, lat: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => updateStopMutation.mutate()}
                    className="btn btn-primary w-full"
                  >
                    Зберегти зміни
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid-dashboard lg:grid-cols-2">
        {/* Analytics */}
        <div className="card">
          <div className="card-header">
            <h2>Пасажиропотік</h2>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-group">
                <label>З</label>
                <input
                  type="date"
                  value={flowQuery.from}
                  onChange={(e) => setFlowQuery({ ...flowQuery, from: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>По</label>
                <input
                  type="date"
                  value={flowQuery.to}
                  onChange={(e) => setFlowQuery({ ...flowQuery, to: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Маршрут</label>
                <input
                  value={flowQuery.routeNumber}
                  onChange={(e) => setFlowQuery({ ...flowQuery, routeNumber: e.target.value })}
                  className="input"
                  placeholder="Всі"
                />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select
                  value={flowQuery.transportTypeId}
                  onChange={(e) => setFlowQuery({ ...flowQuery, transportTypeId: e.target.value })}
                  className="select"
                >
                  <option value="">Всі</option>
                  {transportOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => flowMutation.mutate()}
              disabled={flowMutation.isPending}
              className="btn btn-secondary w-full"
            >
              Сформувати звіт
            </button>
            
            <div className="mt-4 space-y-2">
              {(flowMutation.data ?? []).length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">Дані відсутні</p>
              ) : (
                (flowMutation.data ?? []).map((row, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                    <div className="flex gap-3">
                      <span className="font-mono text-slate-500">{row.day}</span>
                      <span className="font-semibold text-slate-900">{row.routeNumber}</span>
                      <span className="text-slate-600">#{row.fleetNumber}</span>
                    </div>
                    <span className="badge badge-success">{row.passengerCount} пас.</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Complaints */}
        <div className="card">
          <div className="card-header">
            <h2>Скарги та пропозиції</h2>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-group">
                <label>Період</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={complaintsQuery.from}
                    onChange={(e) => setComplaintsQuery({ ...complaintsQuery, from: e.target.value })}
                    className="input w-full"
                  />
                  <input
                    type="date"
                    value={complaintsQuery.to}
                    onChange={(e) => setComplaintsQuery({ ...complaintsQuery, to: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Фільтр</label>
                <input
                  placeholder="Бортовий номер"
                  value={complaintsQuery.fleetNumber}
                  onChange={(e) => setComplaintsQuery({ ...complaintsQuery, fleetNumber: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <button
              onClick={() => complaintsMutation.mutate()}
              disabled={complaintsMutation.isPending}
              className="btn btn-secondary w-full"
            >
              Завантажити
            </button>

            <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {(complaintsMutation.data ?? []).map((row) => (
                <div key={row.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`badge ${row.type === 'Скарга' ? 'badge-error' : 'badge-success'}`}>
                      {row.type}
                    </span>
                    <span className="text-xs text-slate-400">{row.createdAt ? row.createdAt.slice(0, 10) : ''}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{row.message}</p>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex gap-3 text-xs text-slate-500">
                    {row.routeNumber && <span>Маршрут: {row.routeNumber}</span>}
                    {row.fleetNumber && <span>Авто: {row.fleetNumber}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default MunicipalityPage