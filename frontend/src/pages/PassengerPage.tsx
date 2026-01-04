import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'
import styles from './PassengerPage.module.scss'

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
    stopId: '',
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

  if (!user || !hasAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-slate-800">Доступ обмежено</h2>
          <p className="mt-2 text-slate-600">Увійдіть як пасажир.</p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.badge}>Passenger</span>
          <h1 className="mt-2">Особистий кабінет</h1>
          <p>Керування карткою, поїздки та штрафи.</p>
        </div>
        <div className="text-right text-sm text-slate-500 hidden md:block">
          <div>User ID: {user.id}</div>
          <div>{user.email}</div>
        </div>
      </header>

      <div className={styles.grid}>
        
        {/* Find Stops */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Зупинки поруч</h2>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); stopsNearMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <div className={styles.formGroup}>
              <label>Координати (Lon / Lat)</label>
              <div className="flex gap-2">
                <input
                  type="number" step="0.000001"
                  value={stopsNearForm.lon}
                  onChange={(e) => setStopsNearForm({ ...stopsNearForm, lon: e.target.value })}
                  className={styles.input}
                  placeholder="Lon" required
                />
                <input
                  type="number" step="0.000001"
                  value={stopsNearForm.lat}
                  onChange={(e) => setStopsNearForm({ ...stopsNearForm, lat: e.target.value })}
                  className={styles.input}
                  placeholder="Lat" required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="number" placeholder="Радіус (м)"
                value={stopsNearForm.radius}
                onChange={(e) => setStopsNearForm({ ...stopsNearForm, radius: e.target.value })}
                className={styles.input}
              />
              <input
                type="number" placeholder="Ліміт"
                value={stopsNearForm.limit}
                onChange={(e) => setStopsNearForm({ ...stopsNearForm, limit: e.target.value })}
                className={styles.input}
              />
            </div>
            <button type="submit" disabled={stopsNearMutation.isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
              {stopsNearMutation.isPending ? 'Пошук...' : 'Знайти'}
            </button>
            
            {stopsNearMutation.error && (
              <div className={styles.statusError}>{getErrorMessage(stopsNearMutation.error)}</div>
            )}
            {stopsNearMutation.data && (
              <div className={styles.resultBlock}>
                {JSON.stringify(stopsNearMutation.data, null, 2)}
              </div>
            )}
          </form>
        </section>

        {/* Transport Card */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Транспортна картка</h2>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); cardMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <div className={styles.formGroup}>
              <label>User ID</label>
              <input
                type="number"
                value={cardForm.userId}
                onChange={(e) => setCardForm({ userId: e.target.value })}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={cardMutation.isPending} className={`${styles.btn} ${styles.btnSecondary}`}>
              Перевірити баланс
            </button>
            {cardMutation.data && (
              <div className={styles.resultBlock}>
                {JSON.stringify(cardMutation.data, null, 2)}
              </div>
            )}
          </form>

          <hr className="border-slate-100 my-2" />

          <form
            onSubmit={(e) => { e.preventDefault(); topUpMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <h3 className="text-sm font-semibold text-slate-700">Поповнення</h3>
            <div className={styles.formGroup}>
              <label>Номер картки</label>
              <input
                value={topUpForm.cardNumber}
                onChange={(e) => setTopUpForm({ ...topUpForm, cardNumber: e.target.value })}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Сума</label>
              <input
                type="number" step="0.01"
                value={topUpForm.amount}
                onChange={(e) => setTopUpForm({ ...topUpForm, amount: e.target.value })}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={topUpMutation.isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
              Поповнити
            </button>
            {topUpMutation.data && (
              <div className="text-xs text-emerald-600 mt-2 text-center">
                Успішно поповнено!
              </div>
            )}
          </form>
        </section>

        {/* Trips History */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Історія поїздок</h2>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); tripsMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <div className={styles.formGroup}>
              <label>User ID</label>
              <input
                type="number"
                value={tripsForm.userId}
                onChange={(e) => setTripsForm({ userId: e.target.value })}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={tripsMutation.isPending} className={`${styles.btn} ${styles.btnSecondary}`}>
              Завантажити історію
            </button>
            {tripsMutation.data && (
              <div className={styles.resultBlock}>
                {JSON.stringify(tripsMutation.data, null, 2)}
              </div>
            )}
          </form>
        </section>

        {/* Routes Search */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Пошук маршруту (A → B)</h2>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); routesBetweenMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className={styles.formGroup}>
                <label>A (Lon/Lat)</label>
                <input value={routesBetweenForm.lonA} onChange={e => setRoutesBetweenForm({...routesBetweenForm, lonA: e.target.value})} className={styles.input} placeholder="Lon" />
                <input value={routesBetweenForm.latA} onChange={e => setRoutesBetweenForm({...routesBetweenForm, latA: e.target.value})} className={styles.input} placeholder="Lat" />
              </div>
              <div className={styles.formGroup}>
                <label>B (Lon/Lat)</label>
                <input value={routesBetweenForm.lonB} onChange={e => setRoutesBetweenForm({...routesBetweenForm, lonB: e.target.value})} className={styles.input} placeholder="Lon" />
                <input value={routesBetweenForm.latB} onChange={e => setRoutesBetweenForm({...routesBetweenForm, latB: e.target.value})} className={styles.input} placeholder="Lat" />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Радіус пошуку</label>
              <input type="number" value={routesBetweenForm.radius} onChange={e => setRoutesBetweenForm({...routesBetweenForm, radius: e.target.value})} className={styles.input} placeholder="700" />
            </div>
            <button type="submit" disabled={routesBetweenMutation.isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
              Знайти варіанти
            </button>
            {routesBetweenMutation.data && (
              <div className={styles.resultBlock}>
                {JSON.stringify(routesBetweenMutation.data, null, 2)}
              </div>
            )}
          </form>
        </section>

        {/* Fines */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Штрафи</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => finesMutation.mutate()} 
              disabled={finesMutation.isPending}
              className={`${styles.btn} ${styles.btnSecondary} text-xs`}
            >
              Мої штрафи
            </button>
          </div>
          
          {finesMutation.data && (
            <div className={styles.resultBlock}>
              {JSON.stringify(finesMutation.data, null, 2)}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold mb-2">Оскарження</h3>
            <form
              onSubmit={(e) => { e.preventDefault(); appealMutation.mutate() }}
              className="flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <input placeholder="Fine ID" value={appealForm.fineId} onChange={e => setAppealForm({...appealForm, fineId: e.target.value})} className={styles.input} />
              </div>
              <textarea 
                placeholder="Причина оскарження..." 
                value={appealForm.message} 
                onChange={e => setAppealForm({...appealForm, message: e.target.value})} 
                className={styles.input} 
                rows={2}
              />
              <button type="submit" disabled={appealMutation.isPending} className={`${styles.btn} ${styles.btnSecondary}`}>
                Надіслати
              </button>
              {appealMutation.data && (
                <div className="text-xs text-emerald-600 mt-1">Оскарження подано.</div>
              )}
            </form>
          </div>
        </section>

        {/* Complaints */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Скарги</h2>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); complaintMutation.mutate() }}
            className="flex flex-col gap-3"
          >
            <div className={styles.formGroup}>
              <label>Тип</label>
              <select value={complaintForm.type} onChange={e => setComplaintForm({...complaintForm, type: e.target.value})} className={styles.input}>
                <option value="">Оберіть...</option>
                <option value="Скарга">Скарга</option>
                <option value="Пропозиція">Пропозиція</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Текст</label>
              <textarea 
                value={complaintForm.message} 
                onChange={e => setComplaintForm({...complaintForm, message: e.target.value})} 
                className={styles.input}
                rows={3}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Trip ID (опціонально)</label>
              <input 
                type="number" 
                value={complaintForm.tripId} 
                onChange={e => setComplaintForm({...complaintForm, tripId: e.target.value})} 
                className={styles.input} 
              />
            </div>
            <button type="submit" disabled={complaintMutation.isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
              Відправити
            </button>
            {complaintMutation.isSuccess && (
              <div className="text-xs text-emerald-600 text-center">Дякуємо за відгук!</div>
            )}
          </form>
        </section>

      </div>
    </main>
  )
}

export default PassengerPage