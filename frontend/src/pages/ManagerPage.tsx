import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type ManagerDriver = {
  id: number
  login: string
  fullName: string
  email: string
  phone: string
  driverLicenseNumber: string
  licenseCategories: string[]
}

type ManagerVehicle = {
  id: number
  fleetNumber: string
  capacity: number
  transportTypeId: number
  transportType: string
  routeId: number
  routeNumber: string
  direction: string
}

type ManagerRoute = {
  id: number
  number: string
  direction: string
  transportTypeId: number
  transportType: string
}

type TransportType = {
  id: number
  name: string
}

function ManagerPage() {
  const { user, roles, clear } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hasAccess = roles.includes('ct_manager_role')

  const [driverForm, setDriverForm] = useState({
    login: '',
    fullName: '',
    email: '',
    phone: '',
    driverLicenseNumber: '',
    licenseCategories: '',
    passportSeries: '',
    passportNumber: '',
  })

  const [vehicleForm, setVehicleForm] = useState({
    fleetNumber: '',
    transportTypeId: '',
    capacity: '',
    routeId: '',
  })

  const driversQuery = useQuery({
    queryKey: ['manager', 'drivers'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/manager/drivers')
      return response.data as ManagerDriver[]
    },
  })

  const vehiclesQuery = useQuery({
    queryKey: ['manager', 'vehicles'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/manager/vehicles')
      return response.data as ManagerVehicle[]
    },
  })

  const routesQuery = useQuery({
    queryKey: ['manager', 'routes'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/manager/routes')
      return response.data as ManagerRoute[]
    },
  })

  const transportTypesQuery = useQuery({
    queryKey: ['manager', 'transportTypes'],
    enabled: hasAccess,
    queryFn: async () => {
      const response = await api.get('/manager/transport-types')
      return response.data as TransportType[]
    },
  })

  const createDriverMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        login: driverForm.login.trim(),
        fullName: driverForm.fullName.trim(),
        email: driverForm.email.trim(),
        phone: driverForm.phone.trim(),
        driverLicenseNumber: driverForm.driverLicenseNumber.trim(),
        licenseCategories: driverForm.licenseCategories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        passportData: {
          series: driverForm.passportSeries.trim(),
          number: driverForm.passportNumber.trim(),
        },
      }
      const response = await api.post('/manager/drivers', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'drivers'] })
    },
  })

  const createVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fleetNumber: vehicleForm.fleetNumber.trim(),
        transportTypeId: Number(vehicleForm.transportTypeId),
        capacity: Number(vehicleForm.capacity),
        routeId: vehicleForm.routeId ? Number(vehicleForm.routeId) : undefined,
      }
      const response = await api.post('/manager/vehicles', payload)
      return response.data as { id: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'vehicles'] })
    },
  })

  const handleSignOut = () => {
    api
      .post('/auth/logout')
      .catch(() => undefined)
      .finally(() => {
        clear()
        navigate({ to: '/' })
      })
  }

  const routeOptions = useMemo(() => routesQuery.data ?? [], [routesQuery.data])
  const transportOptions = useMemo(
    () => transportTypesQuery.data ?? [],
    [transportTypesQuery.data],
  )

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold">Доступ менеджера</h2>
          <p className="mt-2 text-slate-600">
            Увійдіть під акаунтом менеджера, щоб керувати водіями і транспортом.
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
            Цей акаунт не має ролі менеджера.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="rounded-3xl border border-white/70 bg-white/70 p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              ct-manager
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Менеджер · кадрові та транспортні ресурси
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Підписано як {user.login}. Роль: ct_manager_role
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-slate-900/10 bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Водії — прийом на роботу
            </h2>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {driversQuery.data?.length ?? 0} водіїв
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {driversQuery.data?.map((driver) => (
              <div
                key={driver.id}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 text-sm shadow-sm"
              >
                <p className="font-semibold text-slate-900">{driver.fullName}</p>
                <p className="text-xs text-slate-500">{driver.login}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {driver.email} · {driver.phone}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ліцензія: {driver.driverLicenseNumber}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">
            Додати водія
          </h3>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Логін (db)"
              value={driverForm.login}
              onChange={(event) =>
                setDriverForm((prev) => ({ ...prev, login: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="ПІБ"
              value={driverForm.fullName}
              onChange={(event) =>
                setDriverForm((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={driverForm.email}
              onChange={(event) =>
                setDriverForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Телефон"
              value={driverForm.phone}
              onChange={(event) =>
                setDriverForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="№ посвідчення"
              value={driverForm.driverLicenseNumber}
              onChange={(event) =>
                setDriverForm((prev) => ({
                  ...prev,
                  driverLicenseNumber: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Категорії (A,B,C)"
              value={driverForm.licenseCategories}
              onChange={(event) =>
                setDriverForm((prev) => ({
                  ...prev,
                  licenseCategories: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Паспорт серія"
                value={driverForm.passportSeries}
                onChange={(event) =>
                  setDriverForm((prev) => ({
                    ...prev,
                    passportSeries: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                placeholder="Паспорт номер"
                value={driverForm.passportNumber}
                onChange={(event) =>
                  setDriverForm((prev) => ({
                    ...prev,
                    passportNumber: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => createDriverMutation.mutate()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Створити водія
            </button>
            {createDriverMutation.isError && (
              <p className="text-sm text-rose-600">
                {getErrorMessage(createDriverMutation.error)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              Транспорт — перелік
            </h2>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              {vehiclesQuery.data?.length ?? 0} одиниць
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {vehiclesQuery.data?.map((vehicle) => (
              <div
                key={vehicle.id}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 text-sm shadow-sm"
              >
                <p className="font-semibold text-slate-900">
                  {vehicle.fleetNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {vehicle.transportType} · маршрут {vehicle.routeNumber} (
                  {vehicle.direction})
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Місткість: {vehicle.capacity}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-900">
            Додати транспорт
          </h3>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Бортовий номер"
              value={vehicleForm.fleetNumber}
              onChange={(event) =>
                setVehicleForm((prev) => ({
                  ...prev,
                  fleetNumber: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={vehicleForm.transportTypeId}
              onChange={(event) =>
                setVehicleForm((prev) => ({
                  ...prev,
                  transportTypeId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Тип транспорту</option>
              {transportOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              value={vehicleForm.routeId}
              onChange={(event) =>
                setVehicleForm((prev) => ({
                  ...prev,
                  routeId: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Маршрут</option>
              {routeOptions.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.number} · {route.transportType} ({route.direction})
                </option>
              ))}
            </select>
            <input
              placeholder="Місткість"
              type="number"
              value={vehicleForm.capacity}
              onChange={(event) =>
                setVehicleForm((prev) => ({
                  ...prev,
                  capacity: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => createVehicleMutation.mutate()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Створити транспорт
            </button>
            {createVehicleMutation.isError && (
              <p className="text-sm text-rose-600">
                {getErrorMessage(createVehicleMutation.error)}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default ManagerPage
