import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function DispatcherPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_dispatcher_role')

  const [createScheduleForm, setCreateScheduleForm] = useState({
    routeId: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
    fleetNumber: '',
    workStartTime: '',
    workEndTime: '',
    intervalMin: '',
  })
  const [updateScheduleForm, setUpdateScheduleForm] = useState({
    id: '',
    routeId: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
    workStartTime: '',
    workEndTime: '',
    intervalMin: '',
  })
  const [getScheduleForm, setGetScheduleForm] = useState({ id: '' })
  const [assignDriverForm, setAssignDriverForm] = useState({
    driverId: '',
    vehicleId: '',
    fleetNumber: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
    assignedAt: '',
  })
  const [monitorForm, setMonitorForm] = useState({ fleetNumber: '' })
  const [deviationForm, setDeviationForm] = useState({
    fleetNumber: '',
    currentTime: '',
  })

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        workStartTime: createScheduleForm.workStartTime,
        workEndTime: createScheduleForm.workEndTime,
        intervalMin: Number(createScheduleForm.intervalMin),
      }
      if (createScheduleForm.routeId) {
        payload.routeId = Number(createScheduleForm.routeId)
      }
      if (createScheduleForm.transportTypeId) {
        payload.transportTypeId = Number(createScheduleForm.transportTypeId)
      }
      if (createScheduleForm.routeNumber) {
        payload.routeNumber = createScheduleForm.routeNumber
      }
      if (createScheduleForm.direction) {
        payload.direction = createScheduleForm.direction
      }
      if (createScheduleForm.fleetNumber) {
        payload.fleetNumber = createScheduleForm.fleetNumber
      }
      const response = await api.post('/dispatcher/schedules', payload)
      return response.data
    },
  })

  const updateScheduleMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {}
      if (updateScheduleForm.routeId) {
        payload.routeId = Number(updateScheduleForm.routeId)
      }
      if (updateScheduleForm.transportTypeId) {
        payload.transportTypeId = Number(updateScheduleForm.transportTypeId)
      }
      if (updateScheduleForm.routeNumber) {
        payload.routeNumber = updateScheduleForm.routeNumber
      }
      if (updateScheduleForm.direction) {
        payload.direction = updateScheduleForm.direction
      }
      if (updateScheduleForm.workStartTime) {
        payload.workStartTime = updateScheduleForm.workStartTime
      }
      if (updateScheduleForm.workEndTime) {
        payload.workEndTime = updateScheduleForm.workEndTime
      }
      if (updateScheduleForm.intervalMin) {
        payload.intervalMin = Number(updateScheduleForm.intervalMin)
      }
      const response = await api.patch(
        `/dispatcher/schedules/${updateScheduleForm.id}`,
        payload,
      )
      return response.data
    },
  })

  const getScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/dispatcher/schedules/${getScheduleForm.id}`)
      return response.data
    },
  })

  const assignDriverMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        driverId: Number(assignDriverForm.driverId),
      }
      if (assignDriverForm.vehicleId) {
        payload.vehicleId = Number(assignDriverForm.vehicleId)
      }
      if (assignDriverForm.fleetNumber) {
        payload.fleetNumber = assignDriverForm.fleetNumber
      }
      if (assignDriverForm.transportTypeId) {
        payload.transportTypeId = Number(assignDriverForm.transportTypeId)
      }
      if (assignDriverForm.routeNumber) {
        payload.routeNumber = assignDriverForm.routeNumber
      }
      if (assignDriverForm.direction) {
        payload.direction = assignDriverForm.direction
      }
      if (assignDriverForm.assignedAt) {
        payload.assignedAt = new Date(assignDriverForm.assignedAt).toISOString()
      }
      const response = await api.post('/dispatcher/assignments', payload)
      return response.data
    },
  })

  const monitorMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(
        `/dispatcher/vehicles/${monitorForm.fleetNumber}/monitoring`,
      )
      return response.data
    },
  })

  const deviationMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {}
      if (deviationForm.currentTime) {
        payload.currentTime = deviationForm.currentTime
      }
      const response = await api.post(
        `/dispatcher/vehicles/${deviationForm.fleetNumber}/deviation`,
        payload,
      )
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Dispatcher access</div>
          <p className="hero-body">Sign in with a dispatcher account.</p>
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
            This account does not have dispatcher permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Dispatcher desk</p>
          <h1>Schedules, assignments, and monitoring.</h1>
          <p className="hero-body">
            Manage route schedules, assign drivers, and monitor vehicles.
          </p>
        </div>
        <span className="panel-chip">ct_dispatcher_role</span>
      </header>

      <div className="role-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            createScheduleMutation.mutate()
          }}
        >
          <div className="panel-title">Create schedule</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={createScheduleForm.routeId}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  routeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={createScheduleForm.transportTypeId}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={createScheduleForm.routeNumber}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  routeNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Direction
            <select
              value={createScheduleForm.direction}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
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
            Fleet number
            <input
              type="text"
              value={createScheduleForm.fleetNumber}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  fleetNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Work start time (HH:MM:SS)
            <input
              type="text"
              value={createScheduleForm.workStartTime}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  workStartTime: event.target.value,
                })
              }
              placeholder="06:00:00"
              required
            />
          </label>
          <label>
            Work end time (HH:MM:SS)
            <input
              type="text"
              value={createScheduleForm.workEndTime}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  workEndTime: event.target.value,
                })
              }
              placeholder="22:00:00"
              required
            />
          </label>
          <label>
            Interval (min)
            <input
              type="number"
              min={1}
              value={createScheduleForm.intervalMin}
              onChange={(event) =>
                setCreateScheduleForm({
                  ...createScheduleForm,
                  intervalMin: event.target.value,
                })
              }
              required
            />
          </label>
          <button type="submit" disabled={createScheduleMutation.isPending}>
            {createScheduleMutation.isPending ? 'Saving...' : 'Create schedule'}
          </button>
          {createScheduleMutation.error && (
            <div className="status error">
              {getErrorMessage(createScheduleMutation.error, 'Request failed.')}
            </div>
          )}
          {createScheduleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(createScheduleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            updateScheduleMutation.mutate()
          }}
        >
          <div className="panel-title">Update schedule</div>
          <label>
            Schedule ID
            <input
              type="number"
              min={1}
              value={updateScheduleForm.id}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  id: event.target.value,
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
              value={updateScheduleForm.routeId}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  routeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={updateScheduleForm.transportTypeId}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={updateScheduleForm.routeNumber}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  routeNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Direction
            <select
              value={updateScheduleForm.direction}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
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
            Work start time
            <input
              type="text"
              value={updateScheduleForm.workStartTime}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  workStartTime: event.target.value,
                })
              }
              placeholder="06:00:00"
            />
          </label>
          <label>
            Work end time
            <input
              type="text"
              value={updateScheduleForm.workEndTime}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  workEndTime: event.target.value,
                })
              }
              placeholder="22:00:00"
            />
          </label>
          <label>
            Interval (min)
            <input
              type="number"
              min={1}
              value={updateScheduleForm.intervalMin}
              onChange={(event) =>
                setUpdateScheduleForm({
                  ...updateScheduleForm,
                  intervalMin: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={updateScheduleMutation.isPending}>
            {updateScheduleMutation.isPending ? 'Updating...' : 'Update schedule'}
          </button>
          {updateScheduleMutation.error && (
            <div className="status error">
              {getErrorMessage(updateScheduleMutation.error, 'Request failed.')}
            </div>
          )}
          {updateScheduleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(updateScheduleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            getScheduleMutation.mutate()
          }}
        >
          <div className="panel-title">Get schedule details</div>
          <label>
            Schedule ID
            <input
              type="number"
              min={1}
              value={getScheduleForm.id}
              onChange={(event) =>
                setGetScheduleForm({ id: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={getScheduleMutation.isPending}>
            {getScheduleMutation.isPending ? 'Loading...' : 'Get schedule'}
          </button>
          {getScheduleMutation.error && (
            <div className="status error">
              {getErrorMessage(getScheduleMutation.error, 'Request failed.')}
            </div>
          )}
          {getScheduleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(getScheduleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            assignDriverMutation.mutate()
          }}
        >
          <div className="panel-title">Assign driver</div>
          <label>
            Driver ID
            <input
              type="number"
              min={1}
              value={assignDriverForm.driverId}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
                  driverId: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Vehicle ID
            <input
              type="number"
              min={1}
              value={assignDriverForm.vehicleId}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
                  vehicleId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Fleet number
            <input
              type="text"
              value={assignDriverForm.fleetNumber}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
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
              value={assignDriverForm.transportTypeId}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={assignDriverForm.routeNumber}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
                  routeNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Direction
            <select
              value={assignDriverForm.direction}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
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
            Assigned at
            <input
              type="datetime-local"
              value={assignDriverForm.assignedAt}
              onChange={(event) =>
                setAssignDriverForm({
                  ...assignDriverForm,
                  assignedAt: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={assignDriverMutation.isPending}>
            {assignDriverMutation.isPending ? 'Assigning...' : 'Assign driver'}
          </button>
          {assignDriverMutation.error && (
            <div className="status error">
              {getErrorMessage(assignDriverMutation.error, 'Request failed.')}
            </div>
          )}
          {assignDriverMutation.data && (
            <pre className="result-block">
              {JSON.stringify(assignDriverMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            monitorMutation.mutate()
          }}
        >
          <div className="panel-title">Monitor vehicle</div>
          <label>
            Fleet number
            <input
              type="text"
              value={monitorForm.fleetNumber}
              onChange={(event) =>
                setMonitorForm({ fleetNumber: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={monitorMutation.isPending}>
            {monitorMutation.isPending ? 'Loading...' : 'Get monitoring'}
          </button>
          {monitorMutation.error && (
            <div className="status error">
              {getErrorMessage(monitorMutation.error, 'Request failed.')}
            </div>
          )}
          {monitorMutation.data && (
            <pre className="result-block">
              {JSON.stringify(monitorMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            deviationMutation.mutate()
          }}
        >
          <div className="panel-title">Detect deviation</div>
          <label>
            Fleet number
            <input
              type="text"
              value={deviationForm.fleetNumber}
              onChange={(event) =>
                setDeviationForm({ ...deviationForm, fleetNumber: event.target.value })
              }
              required
            />
          </label>
          <label>
            Current time (HH:MM or HH:MM:SS)
            <input
              type="text"
              value={deviationForm.currentTime}
              onChange={(event) =>
                setDeviationForm({
                  ...deviationForm,
                  currentTime: event.target.value,
                })
              }
              placeholder="10:15:00"
            />
          </label>
          <button type="submit" disabled={deviationMutation.isPending}>
            {deviationMutation.isPending ? 'Checking...' : 'Detect deviation'}
          </button>
          {deviationMutation.error && (
            <div className="status error">
              {getErrorMessage(deviationMutation.error, 'Request failed.')}
            </div>
          )}
          {deviationMutation.data && (
            <pre className="result-block">
              {JSON.stringify(deviationMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default DispatcherPage
