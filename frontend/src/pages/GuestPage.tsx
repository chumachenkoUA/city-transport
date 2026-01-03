import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

type TransportType = {
  id: number
  name: string
}

type StopRow = {
  id: number
  name: string
  lon: string
  lat: string
  distanceM?: number
}

type RouteStopRow = {
  id: number
  name: string
  lon: string
  lat: string
  distanceToNextKm: number | null
}

type RoutePointRow = {
  id: number
  routeId: number
  lon: string
  lat: string
}

type RouteSchedule = {
  route: {
    id: number
    number: string
    direction: string
    transportTypeId: number
    transportType: string
  }
  stop: {
    id: number
    name: string | null
    offsetMin: number | null
  } | null
  schedule: {
    workStartTime: string
    workEndTime: string
    intervalMin: number
  }
  departures: string[]
  arrivals: string[]
}

function GuestPage() {
  const [geoStatus, setGeoStatus] = useState('Геолокацію не запитували')
  const [nearForm, setNearForm] = useState({
    lon: '',
    lat: '',
    radius: '600',
    limit: '8',
  })
  const [selectedStop, setSelectedStop] = useState<StopRow | null>(null)
  const [routeForm, setRouteForm] = useState({
    transportTypeId: '',
    routeNumber: '',
    direction: 'forward',
  })
  const [tripForm, setTripForm] = useState({
    lonA: '',
    latA: '',
    lonB: '',
    latB: '',
    radius: '700',
  })
  const [scheduleForm, setScheduleForm] = useState({
    transportTypeId: '',
    routeNumber: '',
    direction: 'forward',
    stopId: '',
  })

  const transportTypesQuery = useQuery({
    queryKey: ['guest', 'transportTypes'],
    queryFn: async () => {
      const response = await api.get('/guest/transport-types')
      return response.data as TransportType[]
    },
  })


  const stopsNearMutation = useMutation({
    mutationFn: async () => {
      const params = {
        lon: Number(nearForm.lon),
        lat: Number(nearForm.lat),
        radius: Number(nearForm.radius),
        limit: Number(nearForm.limit),
      }
      const response = await api.get('/guest/stops/near', { params })
      return response.data as StopRow[]
    },
  })

  const routesByStopMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStop) {
        return []
      }
      const response = await api.get(`/guest/stops/${selectedStop.id}/routes`)
      return response.data as Array<{
        routeId: number
        routeNumber: string
        transportTypeId: number
        transportType: string
        direction: string
        approxArrivalMin: number | null
      }>
    },
  })

  const routeStopsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {
        direction: routeForm.direction,
      }
      if (routeForm.routeNumber) {
        params.routeNumber = routeForm.routeNumber
      }
      if (routeForm.transportTypeId) {
        params.transportTypeId = Number(routeForm.transportTypeId)
      }
      const response = await api.get('/guest/routes/stops', { params })
      return response.data as RouteStopRow[]
    },
  })

  const routePointsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {
        direction: routeForm.direction,
      }
      if (routeForm.routeNumber) {
        params.routeNumber = routeForm.routeNumber
      }
      if (routeForm.transportTypeId) {
        params.transportTypeId = Number(routeForm.transportTypeId)
      }
      const response = await api.get('/guest/routes/points', { params })
      return response.data as RoutePointRow[]
    },
  })

  const routesBetweenMutation = useMutation({
    mutationFn: async () => {
      const params = {
        lonA: Number(tripForm.lonA),
        latA: Number(tripForm.latA),
        lonB: Number(tripForm.lonB),
        latB: Number(tripForm.latB),
        radius: Number(tripForm.radius),
      }
      const response = await api.get('/guest/routes/near', { params })
      return response.data as {
        fromStop: StopRow
        toStop: StopRow
        routes: Array<{
          routeId: number
          routeNumber: string
          transportType: string
          direction: string
          distanceKm: number | null
          travelMinutes: number | null
        }>
      }
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {
        direction: scheduleForm.direction,
      }
      if (scheduleForm.routeNumber) {
        params.routeNumber = scheduleForm.routeNumber
      }
      if (scheduleForm.transportTypeId) {
        params.transportTypeId = Number(scheduleForm.transportTypeId)
      }
      if (scheduleForm.stopId) {
        params.stopId = Number(scheduleForm.stopId)
      }
      const response = await api.get('/guest/routes/schedule', { params })
      return response.data as RouteSchedule
    },
  })

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Геолокація недоступна у цьому браузері')
      return
    }
    setGeoStatus('Отримуємо координати...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = pos.coords.longitude.toFixed(6)
        const lat = pos.coords.latitude.toFixed(6)
        setNearForm((prev) => ({ ...prev, lon, lat }))
        setTripForm((prev) => ({ ...prev, lonA: lon, latA: lat }))
        setGeoStatus('Координати отримано')
      },
      () => {
        setGeoStatus('Немає доступу до геолокації')
      },
    )
  }

  const handleFindStops = () => {
    setSelectedStop(null)
    stopsNearMutation.mutate()
  }

  const handleSelectStop = (stop: StopRow) => {
    setSelectedStop(stop)
    routesByStopMutation.mutate()
  }

  const handleFindRouteDetails = () => {
    routeStopsMutation.mutate()
    routePointsMutation.mutate()
  }

  const handleFindRoutesBetween = () => {
    routesBetweenMutation.mutate()
  }

  const handleFindSchedule = () => {
    scheduleMutation.mutate()
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="rounded-3xl border border-white/70 bg-white/70 p-8 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              ct-guest
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Публічний довідник міського транспорту
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Зупинки поблизу, маршрути, точки та розклад — усе без реєстрації.
            </p>
          </div>
          <a
            href="/auth"
            className="inline-flex items-center justify-center rounded-full border border-slate-900/10 bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
          >
            Увійти або зареєструватися
          </a>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Найближчі зупинки
          </h2>
          <p className="mt-1 text-sm text-slate-600">{geoStatus}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGeolocation}
              className="rounded-full border border-slate-900/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow"
            >
              Взяти геолокацію
            </button>
            <button
              type="button"
              onClick={handleFindStops}
              className="rounded-full border border-emerald-600/30 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Оновити список
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {['lon', 'lat', 'radius', 'limit'].map((field) => (
              <label key={field} className="text-xs font-semibold text-slate-500">
                {field === 'lon' && 'Довгота'}
                {field === 'lat' && 'Широта'}
                {field === 'radius' && 'Радіус (м)'}
                {field === 'limit' && 'Ліміт'}
                <input
                  type="number"
                  step="0.000001"
                  value={(nearForm as Record<string, string>)[field]}
                  onChange={(event) =>
                    setNearForm((prev) => ({
                      ...prev,
                      [field]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            {(stopsNearMutation.data ?? []).map((stop) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => handleSelectStop(stop)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm shadow-sm transition ${
                  selectedStop?.id === stop.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-white/50 bg-white/80 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{stop.name}</p>
                    <p className="text-xs text-slate-500">
                      {stop.lon}, {stop.lat}
                    </p>
                  </div>
                  {stop.distanceM !== undefined && (
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {Math.round(stop.distanceM)} м
                    </span>
                  )}
                </div>
              </button>
            ))}
            {stopsNearMutation.isError && (
              <p className="text-sm text-rose-600">
                {getErrorMessage(stopsNearMutation.error)}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Зупинка — транспорт і прибуття
          </h2>
          {selectedStop ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                {selectedStop.name}
              </p>
              <p className="text-xs text-emerald-700">
                {selectedStop.lon}, {selectedStop.lat}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Оберіть зупинку зі списку ліворуч.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {(routesByStopMutation.data ?? []).map((route) => (
              <div
                key={`${route.routeId}-${route.direction}`}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Маршрут {route.routeNumber} · {route.transportType}
                    </p>
                    <p className="text-xs text-slate-500">
                      Напрямок: {route.direction}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {route.approxArrivalMin
                      ? `${route.approxArrivalMin} хв`
                      : 'без даних'}
                  </span>
                </div>
              </div>
            ))}
            {routesByStopMutation.isError && (
              <p className="text-sm text-rose-600">
                {getErrorMessage(routesByStopMutation.error)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Маршрут — зупинки та карта
            </h2>
            <button
              type="button"
              onClick={handleFindRouteDetails}
              className="rounded-full border border-emerald-600/30 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Показати маршрут
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">
              Тип транспорту
              <select
                value={routeForm.transportTypeId}
                onChange={(event) =>
                  setRouteForm((prev) => ({
                    ...prev,
                    transportTypeId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Оберіть</option>
                {(transportTypesQuery.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Номер маршруту
              <input
                value={routeForm.routeNumber}
                onChange={(event) =>
                  setRouteForm((prev) => ({
                    ...prev,
                    routeNumber: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Напрямок
              <select
                value={routeForm.direction}
                onChange={(event) =>
                  setRouteForm((prev) => ({
                    ...prev,
                    direction: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="forward">forward</option>
                <option value="reverse">reverse</option>
              </select>
            </label>
          </div>

          <div className="mt-6 space-y-2">
            {(routeStopsMutation.data ?? []).map((stop, index) => (
              <div
                key={`${stop.id}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{stop.name}</p>
                  <p className="text-xs text-slate-500">
                    {stop.lon}, {stop.lat}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {stop.distanceToNextKm
                    ? `${stop.distanceToNextKm} км`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Точки маршруту</h2>
          <p className="mt-1 text-sm text-slate-600">
            Полілінія для відображення на карті.
          </p>
          <div className="mt-4 space-y-2">
            {(routePointsMutation.data ?? []).slice(0, 12).map((point) => (
              <div
                key={point.id}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-xs text-slate-600"
              >
                {point.lon}, {point.lat}
              </div>
            ))}
            {(routePointsMutation.data ?? []).length === 0 && (
              <p className="text-sm text-slate-500">Немає точок маршруту.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Поїздка A → B</h2>
          <p className="mt-1 text-sm text-slate-600">
            Знайдіть маршрути між двома точками.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">
              A: Довгота
              <input
                value={tripForm.lonA}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, lonA: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              A: Широта
              <input
                value={tripForm.latA}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, latA: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              B: Довгота
              <input
                value={tripForm.lonB}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, lonB: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              B: Широта
              <input
                value={tripForm.latB}
                onChange={(event) =>
                  setTripForm((prev) => ({ ...prev, latB: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleFindRoutesBetween}
              className="rounded-full border border-slate-900/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Знайти маршрути
            </button>
          </div>

          {routesBetweenMutation.data && (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Від {routesBetweenMutation.data.fromStop.name} до{' '}
                {routesBetweenMutation.data.toStop.name}
              </div>
              {routesBetweenMutation.data.routes.map((route) => (
                <div
                  key={route.routeId}
                  className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    {route.transportType} · маршрут {route.routeNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {route.distanceKm ?? '—'} км ·{' '}
                    {route.travelMinutes ?? '—'} хв
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Розклад по маршруту
            </h2>
            <button
              type="button"
              onClick={handleFindSchedule}
              className="rounded-full border border-emerald-600/30 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Показати
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">
              Тип транспорту
              <select
                value={scheduleForm.transportTypeId}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    transportTypeId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Оберіть</option>
                {(transportTypesQuery.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Номер маршруту
              <input
                value={scheduleForm.routeNumber}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    routeNumber: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Напрямок
              <select
                value={scheduleForm.direction}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    direction: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="forward">forward</option>
                <option value="reverse">reverse</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Зупинка (ID)
              <input
                value={scheduleForm.stopId}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    stopId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          {scheduleMutation.data && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3">
                <p className="font-semibold text-slate-900">
                  Маршрут {scheduleMutation.data.route.number} ·{' '}
                  {scheduleMutation.data.route.transportType}
                </p>
                <p className="text-xs text-slate-500">
                  {scheduleMutation.data.schedule.workStartTime} —{' '}
                  {scheduleMutation.data.schedule.workEndTime} · інтервал{' '}
                  {scheduleMutation.data.schedule.intervalMin} хв
                </p>
              </div>
              {scheduleMutation.data.stop && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-emerald-700">
                    Зупинка: {scheduleMutation.data.stop.name ?? 'невідомо'}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Зміщення:{' '}
                    {scheduleMutation.data.stop.offsetMin ?? '—'} хв
                  </p>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {scheduleMutation.data.departures.slice(0, 8).map((time) => (
                  <div
                    key={time}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                  >
                    Відправлення: {time}
                  </div>
                ))}
              </div>
              {scheduleMutation.data.arrivals.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {scheduleMutation.data.arrivals.slice(0, 8).map((time) => (
                    <div
                      key={time}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
                    >
                      Прибуття: {time}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default GuestPage
