import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type LastTrip = {
  cardId: number
  cardNumber: string
  tripId: number
  purchasedAt: string
  routeId: number
  routeNumber: string
  transportType: string
  fleetNumber: string
  vehicleId: number
  driverId: number
}

type FineResponse = {
  id: number
  status: string
  amount: string
  reason: string
  tripId: number
  issuedAt: string
}

function ControllerPage() {
  const { user, roles } = useAuthStore()
  const hasAccess = roles.includes('ct_controller_role')

  const [lastTrip, setLastTrip] = useState<LastTrip | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [fineStatus, setFineStatus] = useState('')
  const [fineError, setFineError] = useState('')
  const [cardLookup, setCardLookup] = useState({
    cardNumber: '',
  })
  const [fineForm, setFineForm] = useState({
    cardNumber: '',
    fleetNumber: '',
    routeNumber: '',
    amount: '',
    reason: '',
    status: 'Очікує сплати',
    checkedAt: '',
  })

  const lookupMutation = useMutation({
    mutationFn: async (cardNumber: string) => {
      const response = await api.get(
        `/controller/cards/${encodeURIComponent(cardNumber)}/last-trip`,
      )
      return response.data as LastTrip
    },
    onSuccess: (data) => {
      setLastTrip(data)
      setLookupError('')
      setFineForm((current) => ({
        ...current,
        cardNumber: data.cardNumber,
        fleetNumber: data.fleetNumber,
        routeNumber: data.routeNumber,
      }))
    },
    onError: (err) => {
      setLookupError(getErrorMessage(err, 'Lookup failed.'))
      setLastTrip(null)
    },
  })

  const issueFineMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = {
        cardNumber: fineForm.cardNumber.trim(),
        amount: Number(fineForm.amount),
        reason: fineForm.reason.trim(),
      }
      if (fineForm.fleetNumber.trim()) {
        payload.fleetNumber = fineForm.fleetNumber.trim()
      }
      if (fineForm.routeNumber.trim()) {
        payload.routeNumber = fineForm.routeNumber.trim()
      }
      if (fineForm.status) {
        payload.status = fineForm.status
      }
      if (fineForm.checkedAt) {
        payload.checkedAt = new Date(fineForm.checkedAt).toISOString()
      }

      const response = await api.post('/controller/fines', payload)
      return response.data as FineResponse
    },
    onSuccess: (fine) => {
      setFineStatus(`Fine #${fine.id} issued · ${fine.amount} ₴ · ${fine.status}`)
      setFineError('')
    },
    onError: (err) => {
      setFineError(getErrorMessage(err, 'Fine creation failed.'))
      setFineStatus('')
    },
  })

  if (!user) {
    return (
      <main className="controller-shell">
        <div className="panel">
          <div className="panel-title">Controller access</div>
          <p className="hero-body">
            Sign in with a controller account to access this workspace.
          </p>
          <Link to="/" className="ghost">
            Go to login
          </Link>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="controller-shell">
        <div className="panel">
          <div className="panel-title">No access</div>
          <p className="hero-body">
            This account does not have controller permissions.
          </p>
          <Link to="/" className="ghost">
            Back to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="controller-shell">
      <header className="controller-header">
        <div>
          <p className="hero-kicker">Controller desk</p>
          <h1>Verify transport cards and issue fines.</h1>
          <p className="hero-body">
            Search the latest passenger trip and create a fine for the active
            vehicle run.
          </p>
        </div>
        <span className="panel-chip">ct_controller_role</span>
      </header>

      <div className="controller-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            setLookupError('')
            setFineError('')
            setFineStatus('')
            lookupMutation.mutate(cardLookup.cardNumber.trim())
          }}
        >
          <div className="panel-title">Card check</div>
          <label>
            Card number
            <input
              type="text"
              value={cardLookup.cardNumber}
              onChange={(event) =>
                setCardLookup({ cardNumber: event.target.value })
              }
              placeholder="CARD-0001"
              required
            />
          </label>
          <button type="submit" disabled={lookupMutation.isPending}>
            {lookupMutation.isPending ? 'Searching...' : 'Find last trip'}
          </button>
          {lookupError && <div className="status error">{lookupError}</div>}
          {lastTrip && (
            <div className="result">
              <div>
                <strong>Route</strong>
                <span>
                  {lastTrip.transportType} №{lastTrip.routeNumber}
                </span>
              </div>
              <div>
                <strong>Trip ID</strong>
                <span>{lastTrip.tripId}</span>
              </div>
              <div>
                <strong>Vehicle</strong>
                <span>{lastTrip.fleetNumber}</span>
              </div>
              <div>
                <strong>Purchased</strong>
                <span>{new Date(lastTrip.purchasedAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            setFineError('')
            setFineStatus('')
            issueFineMutation.mutate()
          }}
        >
          <div className="panel-title">Issue a fine</div>
          <label>
            Card number
            <input
              type="text"
              value={fineForm.cardNumber}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  cardNumber: event.target.value,
                })
              }
              placeholder="CARD-0001"
              required
            />
          </label>
          <label>
            Fleet number
            <input
              type="text"
              value={fineForm.fleetNumber}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  fleetNumber: event.target.value,
                })
              }
              placeholder="AB-001"
              required
            />
          </label>
          <label>
            Route number (optional)
            <input
              type="text"
              value={fineForm.routeNumber}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  routeNumber: event.target.value,
                })
              }
              placeholder="12"
            />
          </label>
          <label>
            Amount (₴)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={fineForm.amount}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  amount: event.target.value,
                })
              }
              placeholder="100.00"
              required
            />
          </label>
          <label>
            Reason
            <input
              type="text"
              value={fineForm.reason}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  reason: event.target.value,
                })
              }
              placeholder="No valid ticket"
              required
            />
          </label>
          <label>
            Status
            <select
              value={fineForm.status}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  status: event.target.value,
                })
              }
            >
              <option value="Очікує сплати">Очікує сплати</option>
              <option value="В процесі">В процесі</option>
              <option value="Оплачено">Оплачено</option>
              <option value="Відмінено">Відмінено</option>
              <option value="Прострочено">Прострочено</option>
            </select>
          </label>
          <label>
            Check time
            <input
              type="datetime-local"
              value={fineForm.checkedAt}
              onChange={(event) =>
                setFineForm({
                  ...fineForm,
                  checkedAt: event.target.value,
                })
              }
            />
            <span className="field-hint">
              Use a time that falls within the active trip window.
            </span>
          </label>
          <button type="submit" disabled={issueFineMutation.isPending}>
            {issueFineMutation.isPending ? 'Issuing...' : 'Issue fine'}
          </button>
          {fineError && <div className="status error">{fineError}</div>}
          {fineStatus && <div className="status success">{fineStatus}</div>}
        </form>
      </div>
    </main>
  )
}

export default ControllerPage
