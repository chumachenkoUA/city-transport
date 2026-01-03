import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function MunicipalityPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_municipality_role')

  const [stopForm, setStopForm] = useState({
    name: '',
    lon: '',
    lat: '',
  })
  const [routeForm, setRouteForm] = useState({
    transportTypeId: '',
    number: '',
    direction: 'forward',
    isActive: 'true',
    stopsJson: '',
    pointsJson: '',
  })
  const [flowQuery, setFlowQuery] = useState({
    from: '',
    to: '',
    routeNumber: '',
    transportTypeId: '',
  })
  const [complaintsQuery, setComplaintsQuery] = useState({
    from: '',
    to: '',
    routeNumber: '',
    transportTypeId: '',
    fleetNumber: '',
  })

  const createStopMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: stopForm.name,
        lon: Number(stopForm.lon),
        lat: Number(stopForm.lat),
      }
      const response = await api.post('/municipality/stops', payload)
      return response.data
    },
  })

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        transportTypeId: Number(routeForm.transportTypeId),
        number: routeForm.number,
        direction: routeForm.direction,
        isActive: routeForm.isActive === 'true',
        stops: JSON.parse(routeForm.stopsJson || '[]'),
        points: JSON.parse(routeForm.pointsJson || '[]'),
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
      return response.data
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
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Municipality access</div>
          <p className="hero-body">Sign in with a municipality account.</p>
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
            This account does not have municipality permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Municipality desk</p>
          <h1>Route planning and analytics.</h1>
          <p className="hero-body">
            Create stops, define routes, and review passenger flow data.
          </p>
        </div>
        <span className="panel-chip">ct_municipality_role</span>
      </header>

      <div className="role-grid">
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
              value={stopForm.name}
              onChange={(event) =>
                setStopForm({ ...stopForm, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="0.0000001"
              value={stopForm.lon}
              onChange={(event) =>
                setStopForm({ ...stopForm, lon: event.target.value })
              }
              required
            />
          </label>
          <label>
            Latitude
            <input
              type="number"
              step="0.0000001"
              value={stopForm.lat}
              onChange={(event) =>
                setStopForm({ ...stopForm, lat: event.target.value })
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
            createRouteMutation.mutate()
          }}
        >
          <div className="panel-title">Create route</div>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={routeForm.transportTypeId}
              onChange={(event) =>
                setRouteForm({
                  ...routeForm,
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
              value={routeForm.number}
              onChange={(event) =>
                setRouteForm({ ...routeForm, number: event.target.value })
              }
              required
            />
          </label>
          <label>
            Direction
            <select
              value={routeForm.direction}
              onChange={(event) =>
                setRouteForm({ ...routeForm, direction: event.target.value })
              }
            >
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </label>
          <label>
            Active
            <select
              value={routeForm.isActive}
              onChange={(event) =>
                setRouteForm({ ...routeForm, isActive: event.target.value })
              }
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
          <label>
            Stops JSON (array)
            <textarea
              rows={5}
              value={routeForm.stopsJson}
              onChange={(event) =>
                setRouteForm({ ...routeForm, stopsJson: event.target.value })
              }
              placeholder='[{"stopId":1},{"stopId":2,"distanceToNextKm":1.2}]'
              required
            />
          </label>
          <label>
            Points JSON (array)
            <textarea
              rows={5}
              value={routeForm.pointsJson}
              onChange={(event) =>
                setRouteForm({ ...routeForm, pointsJson: event.target.value })
              }
              placeholder='[{"lon":30.5,"lat":50.4},{"lon":30.6,"lat":50.45}]'
              required
            />
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
            flowMutation.mutate()
          }}
        >
          <div className="panel-title">Passenger flow</div>
          <label>
            From
            <input
              type="date"
              value={flowQuery.from}
              onChange={(event) =>
                setFlowQuery({ ...flowQuery, from: event.target.value })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={flowQuery.to}
              onChange={(event) =>
                setFlowQuery({ ...flowQuery, to: event.target.value })
              }
              required
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={flowQuery.routeNumber}
              onChange={(event) =>
                setFlowQuery({ ...flowQuery, routeNumber: event.target.value })
              }
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={flowQuery.transportTypeId}
              onChange={(event) =>
                setFlowQuery({
                  ...flowQuery,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={flowMutation.isPending}>
            {flowMutation.isPending ? 'Loading...' : 'Get flow'}
          </button>
          {flowMutation.error && (
            <div className="status error">
              {getErrorMessage(flowMutation.error, 'Request failed.')}
            </div>
          )}
          {flowMutation.data && (
            <pre className="result-block">
              {JSON.stringify(flowMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            complaintsMutation.mutate()
          }}
        >
          <div className="panel-title">Complaints analysis</div>
          <label>
            From
            <input
              type="date"
              value={complaintsQuery.from}
              onChange={(event) =>
                setComplaintsQuery({
                  ...complaintsQuery,
                  from: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={complaintsQuery.to}
              onChange={(event) =>
                setComplaintsQuery({
                  ...complaintsQuery,
                  to: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Route number
            <input
              type="text"
              value={complaintsQuery.routeNumber}
              onChange={(event) =>
                setComplaintsQuery({
                  ...complaintsQuery,
                  routeNumber: event.target.value,
                })
              }
            />
          </label>
          <label>
            Transport type ID
            <input
              type="number"
              min={1}
              value={complaintsQuery.transportTypeId}
              onChange={(event) =>
                setComplaintsQuery({
                  ...complaintsQuery,
                  transportTypeId: event.target.value,
                })
              }
            />
          </label>
          <label>
            Fleet number
            <input
              type="text"
              value={complaintsQuery.fleetNumber}
              onChange={(event) =>
                setComplaintsQuery({
                  ...complaintsQuery,
                  fleetNumber: event.target.value,
                })
              }
            />
          </label>
          <button type="submit" disabled={complaintsMutation.isPending}>
            {complaintsMutation.isPending ? 'Loading...' : 'Get complaints'}
          </button>
          {complaintsMutation.error && (
            <div className="status error">
              {getErrorMessage(complaintsMutation.error, 'Request failed.')}
            </div>
          )}
          {complaintsMutation.data && (
            <pre className="result-block">
              {JSON.stringify(complaintsMutation.data, null, 2)}
            </pre>
          )}
        </form>
      </div>
    </main>
  )
}

export default MunicipalityPage
