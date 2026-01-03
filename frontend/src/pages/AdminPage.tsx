import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function AdminPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_admin_role')

  const [createUserForm, setCreateUserForm] = useState({
    login: '',
    email: '',
    phone: '',
    fullName: '',
  })
  const [updateUserForm, setUpdateUserForm] = useState({
    id: '',
    login: '',
    email: '',
    phone: '',
    fullName: '',
  })
  const [deleteUserForm, setDeleteUserForm] = useState({ id: '' })

  const [createDriverForm, setCreateDriverForm] = useState({
    login: '',
    email: '',
    phone: '',
    fullName: '',
    driverLicenseNumber: '',
    licenseCategories: '',
    passportSeries: '',
    passportNumber: '',
  })
  const [updateDriverForm, setUpdateDriverForm] = useState({
    id: '',
    login: '',
    email: '',
    phone: '',
    fullName: '',
    driverLicenseNumber: '',
    licenseCategories: '',
    passportSeries: '',
    passportNumber: '',
  })
  const [deleteDriverForm, setDeleteDriverForm] = useState({ id: '' })

  const [createStopForm, setCreateStopForm] = useState({
    name: '',
    lon: '',
    lat: '',
  })
  const [updateStopForm, setUpdateStopForm] = useState({
    id: '',
    name: '',
    lon: '',
    lat: '',
  })
  const [deleteStopForm, setDeleteStopForm] = useState({ id: '' })

  const [createTransportTypeForm, setCreateTransportTypeForm] = useState({
    name: '',
  })
  const [updateTransportTypeForm, setUpdateTransportTypeForm] = useState({
    id: '',
    name: '',
  })
  const [deleteTransportTypeForm, setDeleteTransportTypeForm] = useState({
    id: '',
  })

  const [createRouteForm, setCreateRouteForm] = useState({
    transportTypeId: '',
    number: '',
    direction: 'forward',
    isActive: 'true',
  })
  const [updateRouteForm, setUpdateRouteForm] = useState({
    id: '',
    transportTypeId: '',
    number: '',
    direction: '',
    isActive: '',
  })
  const [deleteRouteForm, setDeleteRouteForm] = useState({ id: '' })

  const [createVehicleForm, setCreateVehicleForm] = useState({
    fleetNumber: '',
    transportTypeId: '',
    capacity: '',
    routeId: '',
  })
  const [updateVehicleForm, setUpdateVehicleForm] = useState({
    id: '',
    fleetNumber: '',
    transportTypeId: '',
    capacity: '',
    routeId: '',
  })
  const [deleteVehicleForm, setDeleteVehicleForm] = useState({ id: '' })

  const summaryMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/admin/summary')
      return response.data
    },
  })

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        login: createUserForm.login,
        email: createUserForm.email,
        phone: createUserForm.phone,
        fullName: createUserForm.fullName,
      }
      const response = await api.post('/admin/users', payload)
      return response.data
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {}
      if (updateUserForm.login) payload.login = updateUserForm.login
      if (updateUserForm.email) payload.email = updateUserForm.email
      if (updateUserForm.phone) payload.phone = updateUserForm.phone
      if (updateUserForm.fullName) payload.fullName = updateUserForm.fullName
      const response = await api.patch(
        `/admin/users/${updateUserForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/admin/users/${deleteUserForm.id}`)
      return response.data
    },
  })

  const createDriverMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        login: createDriverForm.login,
        email: createDriverForm.email,
        phone: createDriverForm.phone,
        fullName: createDriverForm.fullName,
        driverLicenseNumber: createDriverForm.driverLicenseNumber,
        licenseCategories: createDriverForm.licenseCategories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        passportData: {
          series: createDriverForm.passportSeries,
          number: createDriverForm.passportNumber,
        },
      }
      const response = await api.post('/admin/drivers', payload)
      return response.data
    },
  })

  const updateDriverMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {}
      if (updateDriverForm.login) payload.login = updateDriverForm.login
      if (updateDriverForm.email) payload.email = updateDriverForm.email
      if (updateDriverForm.phone) payload.phone = updateDriverForm.phone
      if (updateDriverForm.fullName) payload.fullName = updateDriverForm.fullName
      if (updateDriverForm.driverLicenseNumber) {
        payload.driverLicenseNumber = updateDriverForm.driverLicenseNumber
      }
      if (updateDriverForm.licenseCategories) {
        payload.licenseCategories = updateDriverForm.licenseCategories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      }
      if (updateDriverForm.passportSeries || updateDriverForm.passportNumber) {
        payload.passportData = {
          series: updateDriverForm.passportSeries,
          number: updateDriverForm.passportNumber,
        }
      }
      const response = await api.patch(
        `/admin/drivers/${updateDriverForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const deleteDriverMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(
        `/admin/drivers/${deleteDriverForm.id}`,
      )
      return response.data
    },
  })

  const createStopMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: createStopForm.name,
        lon: Number(createStopForm.lon),
        lat: Number(createStopForm.lat),
      }
      const response = await api.post('/admin/stops', payload)
      return response.data
    },
  })

  const updateStopMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {}
      if (updateStopForm.name) payload.name = updateStopForm.name
      if (updateStopForm.lon) payload.lon = Number(updateStopForm.lon)
      if (updateStopForm.lat) payload.lat = Number(updateStopForm.lat)
      const response = await api.patch(`/admin/stops/${updateStopForm.id}`, payload)
      return response.data
    },
  })

  const deleteStopMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/admin/stops/${deleteStopForm.id}`)
      return response.data
    },
  })

  const createTransportTypeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/admin/transport-types', {
        name: createTransportTypeForm.name,
      })
      return response.data
    },
  })

  const updateTransportTypeMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {}
      if (updateTransportTypeForm.name) {
        payload.name = updateTransportTypeForm.name
      }
      const response = await api.patch(
        `/admin/transport-types/${updateTransportTypeForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const deleteTransportTypeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(
        `/admin/transport-types/${deleteTransportTypeForm.id}`,
      )
      return response.data
    },
  })

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        transportTypeId: Number(createRouteForm.transportTypeId),
        number: createRouteForm.number,
        direction: createRouteForm.direction,
        isActive: createRouteForm.isActive === 'true',
      }
      const response = await api.post('/admin/routes', payload)
      return response.data
    },
  })

  const updateRouteMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number | boolean> = {}
      if (updateRouteForm.transportTypeId) {
        payload.transportTypeId = Number(updateRouteForm.transportTypeId)
      }
      if (updateRouteForm.number) payload.number = updateRouteForm.number
      if (updateRouteForm.direction) payload.direction = updateRouteForm.direction
      if (updateRouteForm.isActive) {
        payload.isActive = updateRouteForm.isActive === 'true'
      }
      const response = await api.patch(
        `/admin/routes/${updateRouteForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const deleteRouteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/admin/routes/${deleteRouteForm.id}`)
      return response.data
    },
  })

  const createVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fleetNumber: createVehicleForm.fleetNumber,
        transportTypeId: Number(createVehicleForm.transportTypeId),
        capacity: Number(createVehicleForm.capacity),
        routeId: Number(createVehicleForm.routeId),
      }
      const response = await api.post('/admin/vehicles', payload)
      return response.data
    },
  })

  const updateVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {}
      if (updateVehicleForm.fleetNumber) {
        payload.fleetNumber = updateVehicleForm.fleetNumber
      }
      if (updateVehicleForm.transportTypeId) {
        payload.transportTypeId = Number(updateVehicleForm.transportTypeId)
      }
      if (updateVehicleForm.capacity) {
        payload.capacity = Number(updateVehicleForm.capacity)
      }
      if (updateVehicleForm.routeId) {
        payload.routeId = Number(updateVehicleForm.routeId)
      }
      const response = await api.patch(
        `/admin/vehicles/${updateVehicleForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(
        `/admin/vehicles/${deleteVehicleForm.id}`,
      )
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Admin access</div>
          <p className="hero-body">Sign in with an admin account.</p>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">No access</div>
          <p className="hero-body">
            This account does not have admin permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Admin desk</p>
          <h1>System-wide management.</h1>
          <p className="hero-body">
            Manage users, drivers, stops, routes, vehicles, and transport types.
          </p>
        </div>
        <span className="panel-chip">ct_admin_role</span>
      </header>

      <div className="role-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            summaryMutation.mutate()
          }}
        >
          <div className="panel-title">Summary</div>
          <button type="submit" disabled={summaryMutation.isPending}>
            {summaryMutation.isPending ? 'Loading...' : 'Get summary'}
          </button>
          {summaryMutation.error && (
            <div className="status error">
              {getErrorMessage(summaryMutation.error, 'Request failed.')}
            </div>
          )}
          {summaryMutation.data && (
            <pre className="result-block">
              {JSON.stringify(summaryMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createUserMutation.mutate()
          }}
        >
          <div className="panel-title">Create user</div>
          <label>
            Login
            <input
              type="text"
              value={createUserForm.login}
              onChange={(event) =>
                setCreateUserForm({ ...createUserForm, login: event.target.value })
              }
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={createUserForm.email}
              onChange={(event) =>
                setCreateUserForm({ ...createUserForm, email: event.target.value })
              }
              required
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={createUserForm.phone}
              onChange={(event) =>
                setCreateUserForm({ ...createUserForm, phone: event.target.value })
              }
              required
            />
          </label>
          <label>
            Full name
            <input
              type="text"
              value={createUserForm.fullName}
              onChange={(event) =>
                setCreateUserForm({
                  ...createUserForm,
                  fullName: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? 'Saving...' : 'Create user'}
          </button>
          {createUserMutation.error && (
            <div className="status error">
              {getErrorMessage(createUserMutation.error, 'Request failed.')}
            </div>
          )}
          {createUserMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createUserMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateUserMutation.mutate()
          }}
        >
          <div className="panel-title">Update user</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={updateUserForm.id}
              onChange={(event) =>
                setUpdateUserForm({ ...updateUserForm, id: event.target.value })
              }
              required
            />
          </label>
          <label>
            Login
            <input
              type="text"
              value={updateUserForm.login}
              onChange={(event) =>
                setUpdateUserForm({
                  ...updateUserForm,
                  login: event.target.value,
                })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={updateUserForm.email}
              onChange={(event) =>
                setUpdateUserForm({
                  ...updateUserForm,
                  email: event.target.value,
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={updateUserForm.phone}
              onChange={(event) =>
                setUpdateUserForm({
                  ...updateUserForm,
                  phone: event.target.value,
                })
              }
            />
          </label>
          <label>
            Full name
            <input
              type="text"
              value={updateUserForm.fullName}
              onChange={(event) =>
                setUpdateUserForm({
                  ...updateUserForm,
                  fullName: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateUserMutation.isPending}>
            {updateUserMutation.isPending ? 'Updating...' : 'Update user'}
          </button>
          {updateUserMutation.error && (
            <div className="status error">
              {getErrorMessage(updateUserMutation.error, 'Request failed.')}
            </div>
          )}
          {updateUserMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateUserMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteUserMutation.mutate()
          }}
        >
          <div className="panel-title">Delete user</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={deleteUserForm.id}
              onChange={(event) =>
                setDeleteUserForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteUserMutation.isPending}>
            {deleteUserMutation.isPending ? 'Deleting...' : 'Delete user'}
          </button>
          {deleteUserMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteUserMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteUserMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteUserMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createDriverMutation.mutate()
          }}
        >
          <div className="panel-title">Create driver</div>
          <label>
            Login
            <input
              type="text"
              value={createDriverForm.login}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  login: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={createDriverForm.email}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  email: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={createDriverForm.phone}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  phone: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Full name
            <input
              type="text"
              value={createDriverForm.fullName}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  fullName: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            License number
            <input
              type="text"
              value={createDriverForm.driverLicenseNumber}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  driverLicenseNumber: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            License categories
            <input
              type="text"
              value={createDriverForm.licenseCategories}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  licenseCategories: event.target.value,
                })
              }
              placeholder="B, C, D"
              required
            />
          </label>
          <label>
            Passport series
            <input
              type="text"
              value={createDriverForm.passportSeries}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  passportSeries: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Passport number
            <input
              type="text"
              value={createDriverForm.passportNumber}
              onChange={(event) =>
                setCreateDriverForm({
                  ...createDriverForm,
                  passportNumber: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={createDriverMutation.isPending}>
            {createDriverMutation.isPending ? 'Saving...' : 'Create driver'}
          </button>
          {createDriverMutation.error && (
            <div className="status error">
              {getErrorMessage(createDriverMutation.error, 'Request failed.')}
            </div>
          )}
          {createDriverMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createDriverMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateDriverMutation.mutate()
          }}
        >
          <div className="panel-title">Update driver</div>
          <label>
            Driver ID
            <input
              type="number"
              min={1}
              value={updateDriverForm.id}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  id: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Login
            <input
              type="text"
              value={updateDriverForm.login}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  login: event.target.value,
                })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={updateDriverForm.email}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  email: event.target.value,
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={updateDriverForm.phone}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  phone: event.target.value,
                })
              }
            />
          </label>
          <label>
            Full name
            <input
              type="text"
              value={updateDriverForm.fullName}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  fullName: event.target.value,
                })
              }
            />
          </label>
          <label>
            License number
            <input
              type="text"
              value={updateDriverForm.driverLicenseNumber}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  driverLicenseNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            License categories
            <input
              type="text"
              value={updateDriverForm.licenseCategories}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  licenseCategories: event.target.value,
                })
              }
              placeholder="B, C, D"
            />
          </label>
          <label>
            Passport series
            <input
              type="text"
              value={updateDriverForm.passportSeries}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  passportSeries: event.target.value,
                })
              }
            />
          </label>
          <label>
            Passport number
            <input
              type="text"
              value={updateDriverForm.passportNumber}
              onChange={(event) =>
                setUpdateDriverForm({
                  ...updateDriverForm,
                  passportNumber: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateDriverMutation.isPending}>
            {updateDriverMutation.isPending ? 'Updating...' : 'Update driver'}
          </button>
          {updateDriverMutation.error && (
            <div className="status error">
              {getErrorMessage(updateDriverMutation.error, 'Request failed.')}
            </div>
          )}
          {updateDriverMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateDriverMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteDriverMutation.mutate()
          }}
        >
          <div className="panel-title">Delete driver</div>
          <label>
            Driver ID
            <input
              type="number"
              min={1}
              value={deleteDriverForm.id}
              onChange={(event) =>
                setDeleteDriverForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteDriverMutation.isPending}>
            {deleteDriverMutation.isPending ? 'Deleting...' : 'Delete driver'}
          </button>
          {deleteDriverMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteDriverMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteDriverMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteDriverMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createStopMutation.mutate()
          }}
        >
          <div className="panel-title">Create stop</div>
          <label>
            Name
            <input
              type="text"
              value={createStopForm.name}
              onChange={(event) =>
                setCreateStopForm({
                  ...createStopForm,
                  name: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="0.0000001"
              value={createStopForm.lon}
              onChange={(event) =>
                setCreateStopForm({ ...createStopForm, lon: event.target.value })
              }
              required
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="0.0000001"
              value={createStopForm.lat}
              onChange={(event) =>
                setCreateStopForm({ ...createStopForm, lat: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={createStopMutation.isPending}>
            {createStopMutation.isPending ? 'Saving...' : 'Create stop'}
          </button>
          {createStopMutation.error && (
            <div className="status error">
              {getErrorMessage(createStopMutation.error, 'Request failed.')}
            </div>
          )}
          {createStopMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createStopMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateStopMutation.mutate()
          }}
        >
          <div className="panel-title">Update stop</div>
          <label>
            Stop ID
            <input
              type="number"
              min={1}
              value={updateStopForm.id}
              onChange={(event) =>
                setUpdateStopForm({ ...updateStopForm, id: event.target.value })
              }
              required
            />
          </label>
          <label>
            Name
            <input
              type="text"
              value={updateStopForm.name}
              onChange={(event) =>
                setUpdateStopForm({ ...updateStopForm, name: event.target.value })
              }
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="0.0000001"
              value={updateStopForm.lon}
              onChange={(event) =>
                setUpdateStopForm({ ...updateStopForm, lon: event.target.value })
              }
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="0.0000001"
              value={updateStopForm.lat}
              onChange={(event) =>
                setUpdateStopForm({ ...updateStopForm, lat: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={updateStopMutation.isPending}>
            {updateStopMutation.isPending ? 'Updating...' : 'Update stop'}
          </button>
          {updateStopMutation.error && (
            <div className="status error">
              {getErrorMessage(updateStopMutation.error, 'Request failed.')}
            </div>
          )}
          {updateStopMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateStopMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteStopMutation.mutate()
          }}
        >
          <div className="panel-title">Delete stop</div>
          <label>
            Stop ID
            <input
              type="number"
              min={1}
              value={deleteStopForm.id}
              onChange={(event) =>
                setDeleteStopForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteStopMutation.isPending}>
            {deleteStopMutation.isPending ? 'Deleting...' : 'Delete stop'}
          </button>
          {deleteStopMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteStopMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteStopMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteStopMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createTransportTypeMutation.mutate()
          }}
        >
          <div className="panel-title">Create transport type</div>
          <label>
            Name
            <input
              type="text"
              value={createTransportTypeForm.name}
              onChange={(event) =>
                setCreateTransportTypeForm({
                  name: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={createTransportTypeMutation.isPending}>
            {createTransportTypeMutation.isPending
              ? 'Saving...'
              : 'Create transport type'}
          </button>
          {createTransportTypeMutation.error && (
            <div className="status error">
              {getErrorMessage(createTransportTypeMutation.error, 'Request failed.')}
            </div>
          )}
          {createTransportTypeMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createTransportTypeMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateTransportTypeMutation.mutate()
          }}
        >
          <div className="panel-title">Update transport type</div>
          <label>
            Type ID
            <input
              type="number"
              min={1}
              value={updateTransportTypeForm.id}
              onChange={(event) =>
                setUpdateTransportTypeForm({
                  ...updateTransportTypeForm,
                  id: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Name
            <input
              type="text"
              value={updateTransportTypeForm.name}
              onChange={(event) =>
                setUpdateTransportTypeForm({
                  ...updateTransportTypeForm,
                  name: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateTransportTypeMutation.isPending}>
            {updateTransportTypeMutation.isPending
              ? 'Updating...'
              : 'Update transport type'}
          </button>
          {updateTransportTypeMutation.error && (
            <div className="status error">
              {getErrorMessage(updateTransportTypeMutation.error, 'Request failed.')}
            </div>
          )}
          {updateTransportTypeMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateTransportTypeMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteTransportTypeMutation.mutate()
          }}
        >
          <div className="panel-title">Delete transport type</div>
          <label>
            Type ID
            <input
              type="number"
              min={1}
              value={deleteTransportTypeForm.id}
              onChange={(event) =>
                setDeleteTransportTypeForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteTransportTypeMutation.isPending}>
            {deleteTransportTypeMutation.isPending
              ? 'Deleting...'
              : 'Delete transport type'}
          </button>
          {deleteTransportTypeMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteTransportTypeMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteTransportTypeMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteTransportTypeMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createRouteMutation.mutate()
          }}
        >
          <div className="panel-title">Create route</div>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={createRouteForm.transportTypeId}
              onChange={(event) =>
                setCreateRouteForm({
                  ...createRouteForm,
                  transportTypeId: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={createRouteForm.number}
              onChange={(event) =>
                setCreateRouteForm({ ...createRouteForm, number: event.target.value })
              }
              required
            />
          </label>
          <label>
            Direction
            <select
              value={createRouteForm.direction}
              onChange={(event) =>
                setCreateRouteForm({
                  ...createRouteForm,
                  direction: event.target.value,
                })
              }
            >
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <label>
            Active
            <select
              value={createRouteForm.isActive}
              onChange={(event) =>
                setCreateRouteForm({
                  ...createRouteForm,
                  isActive: event.target.value,
                })
              }
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <button type="submit" disabled={createRouteMutation.isPending}>
            {createRouteMutation.isPending ? 'Saving...' : 'Create route'}
          </button>
          {createRouteMutation.error && (
            <div className="status error">
              {getErrorMessage(createRouteMutation.error, 'Request failed.')}
            </div>
          )}
          {createRouteMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createRouteMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateRouteMutation.mutate()
          }}
        >
          <div className="panel-title">Update route</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={updateRouteForm.id}
              onChange={(event) =>
                setUpdateRouteForm({ ...updateRouteForm, id: event.target.value })
              }
              required
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={updateRouteForm.transportTypeId}
              onChange={(event) =>
                setUpdateRouteForm({
                  ...updateRouteForm,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={updateRouteForm.number}
              onChange={(event) =>
                setUpdateRouteForm({
                  ...updateRouteForm,
                  number: event.target.value,
                })
              }
            />
          </label>
          <label>
            Direction
            <select
              value={updateRouteForm.direction}
              onChange={(event) =>
                setUpdateRouteForm({
                  ...updateRouteForm,
                  direction: event.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <label>
            Active
            <select
              value={updateRouteForm.isActive}
              onChange={(event) =>
                setUpdateRouteForm({
                  ...updateRouteForm,
                  isActive: event.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <button type="submit" disabled={updateRouteMutation.isPending}>
            {updateRouteMutation.isPending ? 'Updating...' : 'Update route'}
          </button>
          {updateRouteMutation.error && (
            <div className="status error">
              {getErrorMessage(updateRouteMutation.error, 'Request failed.')}
            </div>
          )}
          {updateRouteMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateRouteMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteRouteMutation.mutate()
          }}
        >
          <div className="panel-title">Delete route</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={deleteRouteForm.id}
              onChange={(event) =>
                setDeleteRouteForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteRouteMutation.isPending}>
            {deleteRouteMutation.isPending ? 'Deleting...' : 'Delete route'}
          </button>
          {deleteRouteMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteRouteMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteRouteMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteRouteMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createVehicleMutation.mutate()
          }}
        >
          <div className="panel-title">Create vehicle</div>
          <label>
            Fleet number
            <input
              type="text"
              value={createVehicleForm.fleetNumber}
              onChange={(event) =>
                setCreateVehicleForm({
                  ...createVehicleForm,
                  fleetNumber: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={createVehicleForm.transportTypeId}
              onChange={(event) =>
                setCreateVehicleForm({
                  ...createVehicleForm,
                  transportTypeId: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={createVehicleForm.capacity}
              onChange={(event) =>
                setCreateVehicleForm({
                  ...createVehicleForm,
                  capacity: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={createVehicleForm.routeId}
              onChange={(event) =>
                setCreateVehicleForm({
                  ...createVehicleForm,
                  routeId: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={createVehicleMutation.isPending}>
            {createVehicleMutation.isPending ? 'Saving...' : 'Create vehicle'}
          </button>
          {createVehicleMutation.error && (
            <div className="status error">
              {getErrorMessage(createVehicleMutation.error, 'Request failed.')}
            </div>
          )}
          {createVehicleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createVehicleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateVehicleMutation.mutate()
          }}
        >
          <div className="panel-title">Update vehicle</div>
          <label>
            Vehicle ID
            <input
              type="number"
              min={1}
              value={updateVehicleForm.id}
              onChange={(event) =>
                setUpdateVehicleForm({
                  ...updateVehicleForm,
                  id: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Fleet number
            <input
              type="text"
              value={updateVehicleForm.fleetNumber}
              onChange={(event) =>
                setUpdateVehicleForm({
                  ...updateVehicleForm,
                  fleetNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={updateVehicleForm.transportTypeId}
              onChange={(event) =>
                setUpdateVehicleForm({
                  ...updateVehicleForm,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={updateVehicleForm.capacity}
              onChange={(event) =>
                setUpdateVehicleForm({
                  ...updateVehicleForm,
                  capacity: event.target.value,
                })
              }
            />
          </label>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={updateVehicleForm.routeId}
              onChange={(event) =>
                setUpdateVehicleForm({
                  ...updateVehicleForm,
                  routeId: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateVehicleMutation.isPending}>
            {updateVehicleMutation.isPending ? 'Updating...' : 'Update vehicle'}
          </button>
          {updateVehicleMutation.error && (
            <div className="status error">
              {getErrorMessage(updateVehicleMutation.error, 'Request failed.')}
            </div>
          )}
          {updateVehicleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateVehicleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deleteVehicleMutation.mutate()
          }}
        >
          <div className="panel-title">Delete vehicle</div>
          <label>
            Vehicle ID
            <input
              type="number"
              min={1}
              value={deleteVehicleForm.id}
              onChange={(event) =>
                setDeleteVehicleForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={deleteVehicleMutation.isPending}>
            {deleteVehicleMutation.isPending ? 'Deleting...' : 'Delete vehicle'}
          </button>
          {deleteVehicleMutation.error && (
            <div className="status error">
              {getErrorMessage(deleteVehicleMutation.error, 'Request failed.')}
            </div>
          )}
          {deleteVehicleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deleteVehicleMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default AdminPage
