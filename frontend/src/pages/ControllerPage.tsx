import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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

  if (!user || !hasAccess) {
    return (
      <main className="page-shell flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-2xl font-bold text-slate-800">Обмежений доступ</h2>
          <p className="mt-2 text-slate-600">Увійдіть під акаунтом контролера.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="flex flex-col gap-2">
        <div className="badge badge-error w-fit">ct-controller</div>
        <h1 className="text-3xl font-bold text-slate-900">Контроль оплати</h1>
        <p className="text-slate-500 max-w-2xl">
          Перевірка транспортних карток та оформлення штрафів.
        </p>
      </header>

      <div className="grid-dashboard lg:grid-cols-2">
        {/* Card Check */}
        <section className="card">
          <div className="card-header">
            <h2>Перевірка картки</h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setLookupError('')
              setFineError('')
              setFineStatus('')
              lookupMutation.mutate(cardLookup.cardNumber.trim())
            }}
            className="flex flex-col gap-4"
          >
            <div className="form-group">
              <label>Номер картки</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cardLookup.cardNumber}
                  onChange={(event) =>
                    setCardLookup({ cardNumber: event.target.value })
                  }
                  className="input flex-1"
                  placeholder="CARD-XXXX"
                  required
                />
                <button type="submit" disabled={lookupMutation.isPending} className="btn btn-secondary whitespace-nowrap">
                  {lookupMutation.isPending ? 'Пошук...' : 'Знайти'}
                </button>
              </div>
            </div>
            
            {lookupError && (
              <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100 text-center">
                {lookupError}
              </div>
            )}
            
            {lastTrip && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Остання поїздка</span>
                  <span>{new Date(lastTrip.purchasedAt).toLocaleString('uk-UA')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-emerald-700 block uppercase tracking-wider text-[10px]">Маршрут</span>
                    {lastTrip.transportType} №{lastTrip.routeNumber}
                  </div>
                  <div>
                    <span className="text-emerald-700 block uppercase tracking-wider text-[10px]">Транспорт</span>
                    {lastTrip.fleetNumber}
                  </div>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* Issue Fine */}
        <section className="card">
          <div className="card-header">
            <h2>Оформлення штрафу</h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setFineError('')
              setFineStatus('')
              issueFineMutation.mutate()
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-group">
                <label>Номер картки</label>
                <input
                  value={fineForm.cardNumber}
                  onChange={(e) => setFineForm({ ...fineForm, cardNumber: e.target.value })}
                  className="input"
                  placeholder="CARD-XXXX"
                  required
                />
              </div>
              <div className="form-group">
                <label>Сума (₴)</label>
                <input
                  type="number" step="0.01"
                  value={fineForm.amount}
                  onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })}
                  className="input"
                  placeholder="100.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-group">
                <label>Бортовий №</label>
                <input
                  value={fineForm.fleetNumber}
                  onChange={(e) => setFineForm({ ...fineForm, fleetNumber: e.target.value })}
                  className="input"
                  placeholder="AB-001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Маршрут</label>
                <input
                  value={fineForm.routeNumber}
                  onChange={(e) => setFineForm({ ...fineForm, routeNumber: e.target.value })}
                  className="input"
                  placeholder="12"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Причина</label>
              <input
                value={fineForm.reason}
                onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value })}
                className="input"
                placeholder="Безквитковий проїзд"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-group">
                <label>Статус</label>
                <select
                  value={fineForm.status}
                  onChange={(e) => setFineForm({ ...fineForm, status: e.target.value })}
                  className="select"
                >
                  <option value="Очікує сплати">Очікує сплати</option>
                  <option value="В процесі">В процесі</option>
                  <option value="Оплачено">Оплачено</option>
                </select>
              </div>
              <div className="form-group">
                <label>Час фіксації</label>
                <input
                  type="datetime-local"
                  value={fineForm.checkedAt}
                  onChange={(e) => setFineForm({ ...fineForm, checkedAt: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <button type="submit" disabled={issueFineMutation.isPending} className="btn btn-danger w-full mt-2">
              {issueFineMutation.isPending ? 'Оформлення...' : 'Виписати штраф'}
            </button>

            {fineError && (
              <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100 text-center">
                {fineError}
              </div>
            )}
            {fineStatus && (
              <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl border border-emerald-100 text-center">
                {fineStatus}
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}

export default ControllerPage