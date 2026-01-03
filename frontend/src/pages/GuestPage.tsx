import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

function GuestPage() {
  const [stopsNearForm, setStopsNearForm] = useState({
    lon: '',
    lat: '',
    radius: '',
    limit: '',
  })
  const [routesByStopForm, setRoutesByStopForm] = useState({ stopId: '' })
  const [routeStopsForm, setRouteStopsForm] = useState({
    routeId: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
  })
  const [routePointsForm, setRoutePointsForm] = useState({
    routeId: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
  })
  const [routesBetweenForm, setRoutesBetweenForm] = useState({
    lonA: '',
    latA: '',
    lonB: '',
    latB: '',
    radius: '',
  })
  const [scheduleForm, setScheduleForm] = useState({
    routeId: '',
    transportTypeId: '',
    routeNumber: '',
    direction: '',
  })
  const [complaintForm, setComplaintForm] = useState({
    userId: '',
    type: '',
    message: '',
    tripId: '',
  })

  const stopsNearMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, number> = {
        lon: Number(stopsNearForm.lon),
        lat: Number(stopsNearForm.lat),
      }
      if (stopsNearForm.radius) {
        params.radius = Number(stopsNearForm.radius)
      }
      if (stopsNearForm.limit) {
        params.limit = Number(stopsNearForm.limit)
      }
      const response = await api.get('/guest/stops/near', { params })
      return response.data
    },
  })

  const routesByStopMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(
        `/guest/stops/${routesByStopForm.stopId}/routes`,
      )
      return response.data
    },
  })

  const routeStopsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {}
      if (routeStopsForm.routeId) {
        params.routeId = Number(routeStopsForm.routeId)
      }
      if (routeStopsForm.transportTypeId) {
        params.transportTypeId = Number(routeStopsForm.transportTypeId)
      }
      if (routeStopsForm.routeNumber) {
        params.routeNumber = routeStopsForm.routeNumber
      }
      if (routeStopsForm.direction) {
        params.direction = routeStopsForm.direction
      }
      const response = await api.get('/guest/routes/stops', { params })
      return response.data
    },
  })

  const routePointsMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {}
      if (routePointsForm.routeId) {
        params.routeId = Number(routePointsForm.routeId)
      }
      if (routePointsForm.transportTypeId) {
        params.transportTypeId = Number(routePointsForm.transportTypeId)
      }
      if (routePointsForm.routeNumber) {
        params.routeNumber = routePointsForm.routeNumber
      }
      if (routePointsForm.direction) {
        params.direction = routePointsForm.direction
      }
      const response = await api.get('/guest/routes/points', { params })
      return response.data
    },
  })

  const routesBetweenMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, number> = {
        lonA: Number(routesBetweenForm.lonA),
        latA: Number(routesBetweenForm.latA),
        lonB: Number(routesBetweenForm.lonB),
        latB: Number(routesBetweenForm.latB),
      }
      if (routesBetweenForm.radius) {
        params.radius = Number(routesBetweenForm.radius)
      }
      const response = await api.get('/guest/routes/near', { params })
      return response.data
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, string | number> = {}
      if (scheduleForm.routeId) {
        params.routeId = Number(scheduleForm.routeId)
      }
      if (scheduleForm.transportTypeId) {
        params.transportTypeId = Number(scheduleForm.transportTypeId)
      }
      if (scheduleForm.routeNumber) {
        params.routeNumber = scheduleForm.routeNumber
      }
      if (scheduleForm.direction) {
        params.direction = scheduleForm.direction
      }
      const response = await api.get('/guest/routes/schedule', { params })
      return response.data
    },
  })

  const complaintMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        userId: Number(complaintForm.userId),
        type: complaintForm.type.trim(),
        message: complaintForm.message.trim(),
      }
      if (complaintForm.tripId) {
        payload.tripId = Number(complaintForm.tripId)
      }
      const response = await api.post('/guest/complaints', payload)
      return response.data
    },
  })

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Guest access</p>
          <h1>Search routes, stops, and schedules.</h1>
          <p className="hero-body">
            Use the public transport explorer to find stops nearby, route paths,
            and schedules.
          </p>
        </div>
        <span className="panel-chip">ct_guest_role</span>
      </header>

      <div className="role-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            stopsNearMutation.mutate()
          }}
        >
          <div className="panel-title">Stops near</div>
          <label>
            Longitude
            <input
              type="number"
              step="0.0000001"
              value={stopsNearForm.lon}
              onChange={(event) =>
                setStopsNearForm({ ...stopsNearForm, lon: event.target.value })
              }
              required
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="0.0000001"
              value={stopsNearForm.lat}
              onChange={(event) =>
                setStopsNearForm({ ...stopsNearForm, lat: event.target.value })
              }
              required
            />
          </label>
          <label>
            Radius (m)
            <input
              type="number"
              value={stopsNearForm.radius}
              onChange={(event) =>
                setStopsNearForm({
                  ...stopsNearForm,
                  radius: event.target.value,
                })
              }
              placeholder="500"
            />
          </label>
          <label>
            Limit
            <input
              type="number"
              value={stopsNearForm.limit}
              onChange={(event) =>
                setStopsNearForm({
                  ...stopsNearForm,
                  limit: event.target.value,
                })
              }
              placeholder="10"
            />
          </label>
          <button type="submit" disabled={stopsNearMutation.isPending}>
            {stopsNearMutation.isPending ? 'Searching...' : 'Find stops'}
          </button>
          {stopsNearMutation.error && (
            <div className="status error">
              {getErrorMessage(stopsNearMutation.error, 'Request failed.')}
            </div>
          )}
          {stopsNearMutation.data && (
            <pre className="result-block">
              {JSON.stringify(stopsNearMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            routesByStopMutation.mutate()
          }}
        >
          <div className="panel-title">Routes by stop</div>
          <label>
            Stop ID
            <input
              type="number"
              min={1}
              value={routesByStopForm.stopId}
              onChange={(event) =>
                setRoutesByStopForm({ stopId: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={routesByStopMutation.isPending}>
            {routesByStopMutation.isPending ? 'Loading...' : 'Find routes'}
          </button>
          {routesByStopMutation.error && (
            <div className="status error">
              {getErrorMessage(routesByStopMutation.error, 'Request failed.')}
            </div>
          )}
          {routesByStopMutation.data && (
            <pre className="result-block">
              {JSON.stringify(routesByStopMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            routeStopsMutation.mutate()
          }}
        >
          <div className="panel-title">Route stops</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={routeStopsForm.routeId}
              onChange={(event) =>
                setRouteStopsForm({ ...routeStopsForm, routeId: event.target.value })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={routeStopsForm.transportTypeId}
              onChange={(event) =>
                setRouteStopsForm({
                  ...routeStopsForm,
                  transportTypeId: event.target.value,
                })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={routeStopsForm.routeNumber}
              onChange={(event) =>
                setRouteStopsForm({
                  ...routeStopsForm,
                  routeNumber: event.target.value,
                })
              }
              placeholder="12"
            />
          </label>
          <label>
            Direction
            <select
              value={routeStopsForm.direction}
              onChange={(event) =>
                setRouteStopsForm({
                  ...routeStopsForm,
                  direction: event.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <button type="submit" disabled={routeStopsMutation.isPending}>
            {routeStopsMutation.isPending ? 'Loading...' : 'Get stops'}
          </button>
          {routeStopsMutation.error && (
            <div className="status error">
              {getErrorMessage(routeStopsMutation.error, 'Request failed.')}
            </div>
          )}
          {routeStopsMutation.data && (
            <pre className="result-block">
              {JSON.stringify(routeStopsMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            routePointsMutation.mutate()
          }}
        >
          <div className="panel-title">Route points</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={routePointsForm.routeId}
              onChange={(event) =>
                setRoutePointsForm({ ...routePointsForm, routeId: event.target.value })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={routePointsForm.transportTypeId}
              onChange={(event) =>
                setRoutePointsForm({
                  ...routePointsForm,
                  transportTypeId: event.target.value,
                })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={routePointsForm.routeNumber}
              onChange={(event) =>
                setRoutePointsForm({
                  ...routePointsForm,
                  routeNumber: event.target.value,
                })
              }
              placeholder="12"
            />
          </label>
          <label>
            Direction
            <select
              value={routePointsForm.direction}
              onChange={(event) =>
                setRoutePointsForm({
                  ...routePointsForm,
                  direction: event.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <button type="submit" disabled={routePointsMutation.isPending}>
            {routePointsMutation.isPending ? 'Loading...' : 'Get points'}
          </button>
          {routePointsMutation.error && (
            <div className="status error">
              {getErrorMessage(routePointsMutation.error, 'Request failed.')}
            </div>
          )}
          {routePointsMutation.data && (
            <pre className="result-block">
              {JSON.stringify(routePointsMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            routesBetweenMutation.mutate()
          }}
        >
          <div className="panel-title">Routes between points</div>
          <label>
            Point A lon
            <input
              type="number"
              step="0.0000001"
              value={routesBetweenForm.lonA}
              onChange={(event) =>
                setRoutesBetweenForm({
                  ...routesBetweenForm,
                  lonA: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Point A lat
            <input
              type="number"
              step="0.0000001"
              value={routesBetweenForm.latA}
              onChange={(event) =>
                setRoutesBetweenForm({
                  ...routesBetweenForm,
                  latA: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Point B lon
            <input
              type="number"
              step="0.0000001"
              value={routesBetweenForm.lonB}
              onChange={(event) =>
                setRoutesBetweenForm({
                  ...routesBetweenForm,
                  lonB: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Point B lat
            <input
              type="number"
              step="0.0000001"
              value={routesBetweenForm.latB}
              onChange={(event) =>
                setRoutesBetweenForm({
                  ...routesBetweenForm,
                  latB: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Radius (m)
            <input
              type="number"
              value={routesBetweenForm.radius}
              onChange={(event) =>
                setRoutesBetweenForm({
                  ...routesBetweenForm,
                  radius: event.target.value,
                })
              }
              placeholder="400"
            />
          </label>
          <button type="submit" disabled={routesBetweenMutation.isPending}>
            {routesBetweenMutation.isPending ? 'Searching...' : 'Find routes'}
          </button>
          {routesBetweenMutation.error && (
            <div className="status error">
              {getErrorMessage(routesBetweenMutation.error, 'Request failed.')}
            </div>
          )}
          {routesBetweenMutation.data && (
            <pre className="result-block">
              {JSON.stringify(routesBetweenMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            scheduleMutation.mutate()
          }}
        >
          <div className="panel-title">Route schedule</div>
          <label>
            Route ID
            <input
              type="number"
              min={1}
              value={scheduleForm.routeId}
              onChange={(event) =>
                setScheduleForm({ ...scheduleForm, routeId: event.target.value })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={scheduleForm.transportTypeId}
              onChange={(event) =>
                setScheduleForm({
                  ...scheduleForm,
                  transportTypeId: event.target.value,
                })
              }
              placeholder="Optional"
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={scheduleForm.routeNumber}
              onChange={(event) =>
                setScheduleForm({
                  ...scheduleForm,
                  routeNumber: event.target.value,
                })
              }
              placeholder="12"
            />
          </label>
          <label>
            Direction
            <select
              value={scheduleForm.direction}
              onChange={(event) =>
                setScheduleForm({
                  ...scheduleForm,
                  direction: event.target.value,
                })
              }
            >
              <option value="">Not set</option>
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <button type="submit" disabled={scheduleMutation.isPending}>
            {scheduleMutation.isPending ? 'Loading...' : 'Get schedule'}
          </button>
          {scheduleMutation.error && (
            <div className="status error">
              {getErrorMessage(scheduleMutation.error, 'Request failed.')}
            </div>
          )}
          {scheduleMutation.data && (
            <pre className="result-block">
              {JSON.stringify(scheduleMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            complaintMutation.mutate()
          }}
        >
          <div className="panel-title">Submit complaint</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={complaintForm.userId}
              onChange={(event) =>
                setComplaintForm({ ...complaintForm, userId: event.target.value })
              }
              required
            />
          </label>
          <label>
            Type
            <input
              type="text"
              value={complaintForm.type}
              onChange={(event) =>
                setComplaintForm({ ...complaintForm, type: event.target.value })
              }
              placeholder="Complaint or suggestion"
              required
            />
          </label>
          <label>
            Message
            <textarea
              rows={3}
              value={complaintForm.message}
              onChange={(event) =>
                setComplaintForm({ ...complaintForm, message: event.target.value })
              }
              required
            />
          </label>
          <label>
            Trip ID (optional)
            <input
              type="number"
              min={1}
              value={complaintForm.tripId}
              onChange={(event) =>
                setComplaintForm({ ...complaintForm, tripId: event.target.value })
              }
              placeholder="Optional"
            />
          </label>
          <button type="submit" disabled={complaintMutation.isPending}>
            {complaintMutation.isPending ? 'Submitting...' : 'Send complaint'}
          </button>
          {complaintMutation.error && (
            <div className="status error">
              {getErrorMessage(complaintMutation.error, 'Request failed.')}
            </div>
          )}
          {complaintMutation.data && (
            <pre className="result-block">
              {JSON.stringify(complaintMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default GuestPage
