import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

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

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Доступ мерії</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом департаменту мерії.
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
            Цей акаунт не має ролі мерії.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="rounded-3xl border border-white/70 bg-white/70 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          ct-municipality
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Департамент мерії — маршрути, зупинки, аналітика
        </h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Проєктування нового маршруту
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              value={routeForm.transportTypeId}
              onChange={(event) =>
                setRouteForm((prev) => ({
                  ...prev,
                  transportTypeId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Тип транспорту</option>
              {transportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Номер маршруту"
              value={routeForm.number}
              onChange={(event) =>
                setRouteForm((prev) => ({
                  ...prev,
                  number: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={routeForm.direction}
              onChange={(event) =>
                setRouteForm((prev) => ({
                  ...prev,
                  direction: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Зупинки</p>
            {draftStops.map((stop, index) => (
              <div
                key={`${index}-${stop.stopId ?? 'new'}`}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 text-sm"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={stop.stopId ?? ''}
                    onChange={(event) => {
                      const next = [...draftStops]
                      next[index] = { stopId: event.target.value }
                      setDraftStops(next)
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">Нова зупинка</option>
                    {stopOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Назва"
                    value={stop.name ?? ''}
                    onChange={(event) => {
                      const next = [...draftStops]
                      next[index] = { ...next[index], name: event.target.value }
                      setDraftStops(next)
                    }}
                    disabled={Boolean(stop.stopId)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs disabled:opacity-60"
                  />
                  <input
                    placeholder="Дистанція до наступної (км)"
                    value={stop.distanceToNextKm ?? ''}
                    onChange={(event) => {
                      const next = [...draftStops]
                      next[index] = {
                        ...next[index],
                        distanceToNextKm: event.target.value,
                      }
                      setDraftStops(next)
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                </div>
                {!stop.stopId && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      placeholder="Довгота"
                      value={stop.lon ?? ''}
                      onChange={(event) => {
                        const next = [...draftStops]
                        next[index] = { ...next[index], lon: event.target.value }
                        setDraftStops(next)
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      placeholder="Широта"
                      value={stop.lat ?? ''}
                      onChange={(event) => {
                        const next = [...draftStops]
                        next[index] = { ...next[index], lat: event.target.value }
                        setDraftStops(next)
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (index === 0) {
                        return
                      }
                      const next = [...draftStops]
                      const temp = next[index - 1]
                      next[index - 1] = next[index]
                      next[index] = temp
                      setDraftStops(next)
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index === draftStops.length - 1) {
                        return
                      }
                      const next = [...draftStops]
                      const temp = next[index + 1]
                      next[index + 1] = next[index]
                      next[index] = temp
                      setDraftStops(next)
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = draftStops.filter((_, idx) => idx !== index)
                      setDraftStops(next)
                    }}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraftStops((prev) => [...prev, { stopId: '' }])
              }
              className="rounded-full border border-slate-900/10 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow"
            >
              Додати зупинку
            </button>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-700">
              Точки маршруту (lon,lat по рядках)
            </p>
            <textarea
              value={pointsInput}
              onChange={(event) => setPointsInput(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              placeholder="30.52345,50.45012"
            />
          </div>

          <button
            type="button"
            onClick={() => createRouteMutation.mutate()}
            className="mt-6 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Зберегти маршрут
          </button>
          {createRouteMutation.isError && (
            <p className="mt-2 text-sm text-rose-600">
              {getErrorMessage(createRouteMutation.error)}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">Зупинки</h3>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Назва"
              value={stopForm.name}
              onChange={(event) =>
                setStopForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Довгота"
                value={stopForm.lon}
                onChange={(event) =>
                  setStopForm((prev) => ({ ...prev, lon: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                placeholder="Широта"
                value={stopForm.lat}
                onChange={(event) =>
                  setStopForm((prev) => ({ ...prev, lat: event.target.value }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => createStopMutation.mutate()}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Додати зупинку
            </button>
          </div>

          <div className="mt-6 space-y-2">
            {stopOptions.slice(0, 8).map((stop) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setStopEdit(stop)}
                className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-left text-sm"
              >
                <p className="font-semibold text-slate-900">{stop.name}</p>
                <p className="text-xs text-slate-500">
                  {stop.lon}, {stop.lat}
                </p>
              </button>
            ))}
          </div>

          {stopEdit && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-semibold text-amber-900">
                Редагування: {stopEdit.name}
              </p>
              <div className="mt-3 grid gap-3">
                <input
                  value={stopEdit.name}
                  onChange={(event) =>
                    setStopEdit((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev,
                    )
                  }
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={stopEdit.lon}
                    onChange={(event) =>
                      setStopEdit((prev) =>
                        prev ? { ...prev, lon: event.target.value } : prev,
                      )
                    }
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
                  />
                  <input
                    value={stopEdit.lat}
                    onChange={(event) =>
                      setStopEdit((prev) =>
                        prev ? { ...prev, lat: event.target.value } : prev,
                      )
                    }
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateStopMutation.mutate()}
                  className="rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Оновити зупинку
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Аналітика пасажиропотоку
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={flowQuery.from}
              onChange={(event) =>
                setFlowQuery((prev) => ({ ...prev, from: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={flowQuery.to}
              onChange={(event) =>
                setFlowQuery((prev) => ({ ...prev, to: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Маршрут"
              value={flowQuery.routeNumber}
              onChange={(event) =>
                setFlowQuery((prev) => ({
                  ...prev,
                  routeNumber: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={flowQuery.transportTypeId}
              onChange={(event) =>
                setFlowQuery((prev) => ({
                  ...prev,
                  transportTypeId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Тип транспорту</option>
              {transportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => flowMutation.mutate()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Застосувати
          </button>
          <div className="mt-4 space-y-2 text-sm">
            {(flowMutation.data ?? []).map((row) => (
              <div
                key={`${row.day}-${row.fleetNumber}`}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-2"
              >
                {row.day} · {row.fleetNumber} · маршрут {row.routeNumber} ·{' '}
                {row.passengerCount} пас.
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Скарги та пропозиції
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={complaintsQuery.from}
              onChange={(event) =>
                setComplaintsQuery((prev) => ({
                  ...prev,
                  from: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={complaintsQuery.to}
              onChange={(event) =>
                setComplaintsQuery((prev) => ({
                  ...prev,
                  to: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Маршрут"
              value={complaintsQuery.routeNumber}
              onChange={(event) =>
                setComplaintsQuery((prev) => ({
                  ...prev,
                  routeNumber: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Бортовий №"
              value={complaintsQuery.fleetNumber}
              onChange={(event) =>
                setComplaintsQuery((prev) => ({
                  ...prev,
                  fleetNumber: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={complaintsQuery.transportTypeId}
              onChange={(event) =>
                setComplaintsQuery((prev) => ({
                  ...prev,
                  transportTypeId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Тип транспорту</option>
              {transportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => complaintsMutation.mutate()}
            className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
          >
            Показати
          </button>
          <div className="mt-4 space-y-2 text-sm">
            {(complaintsMutation.data ?? []).map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3"
              >
                <p className="font-semibold text-slate-900">{row.type}</p>
                <p className="text-xs text-slate-500">
                  {row.routeNumber ?? '—'} · {row.transportType ?? '—'} ·{' '}
                  {row.fleetNumber ?? '—'}
                </p>
                <p className="mt-2 text-xs text-slate-600">{row.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default MunicipalityPage
