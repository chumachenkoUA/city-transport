import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function ManagerPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_manager_role')

  const [driverForm, setDriverForm] = useState({
    login: '',
    email: '',
    phone: '',
    fullName: '',
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

  const hireDriverMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        login: driverForm.login,
        email: driverForm.email,
        phone: driverForm.phone,
        fullName: driverForm.fullName,
        driverLicenseNumber: driverForm.driverLicenseNumber,
        licenseCategories: driverForm.licenseCategories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        passportData: {
          series: driverForm.passportSeries,
          number: driverForm.passportNumber,
        },
      }
      const response = await api.post('/manager/drivers', payload)
      return response.data
    },
  })

  const addVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fleetNumber: vehicleForm.fleetNumber,
        transportTypeId: Number(vehicleForm.transportTypeId),
        capacity: Number(vehicleForm.capacity),
        routeId: Number(vehicleForm.routeId),
      }
      const response = await api.post('/manager/vehicles', payload)
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Manager access</div>
          <p className="hero-body">Sign in with a manager account.</p>
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
            This account does not have manager permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Manager desk</p>
          <h1>Hire drivers and add vehicles.</h1>
          <p className="hero-body">
            Create driver profiles and register vehicles in the fleet.
          </p>
        </div>
        <span className="panel-chip">ct_manager_role</span>
      </header>

      <div className="role-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            hireDriverMutation.mutate()
          }}
        >
          <div className="panel-title">Hire driver</div>
          <label>
            Login
            <input
              type="text"
              value={driverForm.login}
              onChange={(event) =>
                setDriverForm({ ...driverForm, login: event.target.value })
              }
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={driverForm.email}
              onChange={(event) =>
                setDriverForm({ ...driverForm, email: event.target.value })
              }
              required
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={driverForm.phone}
              onChange={(event) =>
                setDriverForm({ ...driverForm, phone: event.target.value })
              }
              required
            />
          </label>
          <label>
            Full name
            <input
              type="text"
              value={driverForm.fullName}
              onChange={(event) =>
                setDriverForm({ ...driverForm, fullName: event.target.value })
              }
              required
            />
          </label>
          <label>
            License number
            <input
              type="text"
              value={driverForm.driverLicenseNumber}
              onChange={(event) =>
                setDriverForm({
                  ...driverForm,
                  driverLicenseNumber: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            License categories (comma-separated)
            <input
              type="text"
              value={driverForm.licenseCategories}
              onChange={(event) =>
                setDriverForm({
                  ...driverForm,
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
              value={driverForm.passportSeries}
              onChange={(event) =>
                setDriverForm({
                  ...driverForm,
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
              value={driverForm.passportNumber}
              onChange={(event) =>
                setDriverForm({
                  ...driverForm,
                  passportNumber: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={hireDriverMutation.isPending}>
            {hireDriverMutation.isPending ? 'Saving...' : 'Create driver'}
          </button>
          {hireDriverMutation.error && (
            <div className="status error">
              {getErrorMessage(hireDriverMutation.error, 'Request failed.')}
            </div>
          )}
          {hireDriverMutation.data && (
            <pre className="result-block">
              {JSON.stringify(hireDriverMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            addVehicleMutation.mutate()
          }}
        >
          <div className="panel-title">Add vehicle</div>
          <label>
            Fleet number
            <input
              type="text"
              value={vehicleForm.fleetNumber}
              onChange={(event) =>
                setVehicleForm({
                  ...vehicleForm,
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
              value={vehicleForm.transportTypeId}
              onChange={(event) =>
                setVehicleForm({
                  ...vehicleForm,
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
              value={vehicleForm.capacity}
              onChange={(event) =>
                setVehicleForm({ ...vehicleForm, capacity: event.target.value })
              }
              required
            />
          </label>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={vehicleForm.routeId}
              onChange={(event) =>
                setVehicleForm({ ...vehicleForm, routeId: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={addVehicleMutation.isPending}>
            {addVehicleMutation.isPending ? 'Saving...' : 'Create vehicle'}
          </button>
          {addVehicleMutation.error && (
            <div className="status error">
              {getErrorMessage(addVehicleMutation.error, 'Request failed.')}
            </div>
          )}
          {addVehicleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(addVehicleMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default ManagerPage
