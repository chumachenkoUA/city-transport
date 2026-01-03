import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

function PassengerPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_passenger_role')

  const [stopsNearForm, setStopsNearForm] = useState({
    lon: '',
    lat: '',
    radius: '',
    limit: '',
  })
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
  const [cardForm, setCardForm] = useState({
    userId: '',
  })
  const [topUpForm, setTopUpForm] = useState({
    cardNumber: '',
    amount: '',
    toppedUpAt: '',
  })
  const [tripsForm, setTripsForm] = useState({ userId: '' })
  const [finesForm, setFinesForm] = useState({ userId: '' })
  const [fineForm, setFineForm] = useState({ userId: '', fineId: '' })
  const [appealForm, setAppealForm] = useState({
    userId: '',
    fineId: '',
    message: '',
  })
  const [complaintForm, setComplaintForm] = useState({
    userId: '',
    type: '',
    message: '',
    tripId: '',
  })

  useEffect(() => {
    if (user?.id) {
      setCardForm({ userId: String(user.id) })
      setTripsForm({ userId: String(user.id) })
      setFinesForm({ userId: String(user.id) })
      setFineForm((current) => ({ ...current, userId: String(user.id) }))
      setAppealForm((current) => ({ ...current, userId: String(user.id) }))
      setComplaintForm((current) => ({ ...current, userId: String(user.id) }))
    }
  }, [user])

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
      const response = await api.get('/passenger/stops/near', { params })
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
      const response = await api.get('/passenger/routes/stops', { params })
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
      const response = await api.get('/passenger/routes/points', { params })
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
      const response = await api.get('/passenger/routes/near', { params })
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
      const response = await api.get('/passenger/routes/schedule', { params })
      return response.data
    },
  })

  const cardMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/passenger/${cardForm.userId}/card`)
      return response.data
    },
  })

  const topUpMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        amount: Number(topUpForm.amount),
      }
      if (topUpForm.toppedUpAt) {
        payload.toppedUpAt = new Date(topUpForm.toppedUpAt).toISOString()
      }
      const response = await api.post(
        `/passenger/cards/${topUpForm.cardNumber}/top-up`,
        payload,
      )
      return response.data
    },
  })

  const tripsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/passenger/${tripsForm.userId}/trips`)
      return response.data
    },
  })

  const finesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/passenger/${finesForm.userId}/fines`)
      return response.data
    },
  })

  const fineMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(
        `/passenger/${fineForm.userId}/fines/${fineForm.fineId}`,
      )
      return response.data
    },
  })

  const appealMutation = useMutation({
    mutationFn: async () => {
      const payload = { message: appealForm.message.trim() }
      const response = await api.post(
        `/passenger/${appealForm.userId}/fines/${appealForm.fineId}/appeals`,
        payload,
      )
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
      const response = await api.post('/passenger/complaints', payload)
      return response.data
    },
  })

  if (!user) {
    return (
      <main className="role-shell">
        <div className="panel">
          <div className="panel-title">Passenger access</div>
          <p className="hero-body">Sign in with a passenger account.</p>
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
            This account does not have passenger permissions.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="role-shell">
      <header className="role-header">
        <div>
          <p className="hero-kicker">Passenger desk</p>
          <h1>Cards, trips, fines, and route info.</h1>
          <p className="hero-body">
            Manage your transport card, review trips and fines, and browse
            routes.
          </p>
        </div>
        <span className="panel-chip">ct_passenger_role</span>
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
            cardMutation.mutate()
          }}
        >
          <div className="panel-title">Transport card</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={cardForm.userId}
              onChange={(event) => setCardForm({ userId: event.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={cardMutation.isPending}>
            {cardMutation.isPending ? 'Loading...' : 'Get card'}
          </button>
          {cardMutation.error && (
            <div className="status error">
              {getErrorMessage(cardMutation.error, 'Request failed.')}
            </div>
          )}
          {cardMutation.data && (
            <pre className="result-block">
              {JSON.stringify(cardMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            topUpMutation.mutate()
          }}
        >
          <div className="panel-title">Top up card</div>
          <label>
            Card number
            <input
              type="text"
              value={topUpForm.cardNumber}
              onChange={(event) =>
                setTopUpForm({ ...topUpForm, cardNumber: event.target.value })
              }
              required
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={topUpForm.amount}
              onChange={(event) =>
                setTopUpForm({ ...topUpForm, amount: event.target.value })
              }
              required
            />
          </label>
          <label>
            Topped at
            <input
              type="datetime-local"
              value={topUpForm.toppedUpAt}
              onChange={(event) =>
                setTopUpForm({ ...topUpForm, toppedUpAt: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={topUpMutation.isPending}>
            {topUpMutation.isPending ? 'Processing...' : 'Top up'}
          </button>
          {topUpMutation.error && (
            <div className="status error">
              {getErrorMessage(topUpMutation.error, 'Request failed.')}
            </div>
          )}
          {topUpMutation.data && (
            <pre className="result-block">
              {JSON.stringify(topUpMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            tripsMutation.mutate()
          }}
        >
          <div className="panel-title">Trips history</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={tripsForm.userId}
              onChange={(event) => setTripsForm({ userId: event.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={tripsMutation.isPending}>
            {tripsMutation.isPending ? 'Loading...' : 'Get trips'}
          </button>
          {tripsMutation.error && (
            <div className="status error">
              {getErrorMessage(tripsMutation.error, 'Request failed.')}
            </div>
          )}
          {tripsMutation.data && (
            <pre className="result-block">
              {JSON.stringify(tripsMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            finesMutation.mutate()
          }}
        >
          <div className="panel-title">Fines list</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={finesForm.userId}
              onChange={(event) => setFinesForm({ userId: event.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={finesMutation.isPending}>
            {finesMutation.isPending ? 'Loading...' : 'Get fines'}
          </button>
          {finesMutation.error && (
            <div className="status error">
              {getErrorMessage(finesMutation.error, 'Request failed.')}
            </div>
          )}
          {finesMutation.data && (
            <pre className="result-block">
              {JSON.stringify(finesMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            fineMutation.mutate()
          }}
        >
          <div className="panel-title">Fine details</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={fineForm.userId}
              onChange={(event) =>
                setFineForm({ ...fineForm, userId: event.target.value })
              }
              required
            />
          </label>
          <label>
            Fine ID
            <input
              type="number"
              min={1}
              value={fineForm.fineId}
              onChange={(event) =>
                setFineForm({ ...fineForm, fineId: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={fineMutation.isPending}>
            {fineMutation.isPending ? 'Loading...' : 'Get fine'}
          </button>
          {fineMutation.error && (
            <div className="status error">
              {getErrorMessage(fineMutation.error, 'Request failed.')}
            </div>
          )}
          {fineMutation.data && (
            <pre className="result-block">
              {JSON.stringify(fineMutation.data, null, 2)}
            </pre>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            appealMutation.mutate()
          }}
        >
          <div className="panel-title">Submit appeal</div>
          <label>
            User ID
            <input
              type="number"
              min={1}
              value={appealForm.userId}
              onChange={(event) =>
                setAppealForm({ ...appealForm, userId: event.target.value })
              }
              required
            />
          </label>
          <label>
            Fine ID
            <input
              type="number"
              min={1}
              value={appealForm.fineId}
              onChange={(event) =>
                setAppealForm({ ...appealForm, fineId: event.target.value })
              }
              required
            />
          </label>
          <label>
            Message
            <textarea
              rows={3}
              value={appealForm.message}
              onChange={(event) =>
                setAppealForm({ ...appealForm, message: event.target.value })
              }
              required
            />
          </label>
          <button type="submit" disabled={appealMutation.isPending}>
            {appealMutation.isPending ? 'Submitting...' : 'Send appeal'}
          </button>
          {appealMutation.error && (
            <div className="status error">
              {getErrorMessage(appealMutation.error, 'Request failed.')}
            </div>
          )}
          {appealMutation.data && (
            <pre className="result-block">
              {JSON.stringify(appealMutation.data, null, 2)}
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

export default PassengerPage
