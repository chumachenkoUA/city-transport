import type { CSSProperties, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

type AuthMode = 'login' | 'register'

type UserProfile = {
  login: string
  fullName?: string
  email?: string
  phone?: string
  registeredAt?: string
}

type LastTrip = {
  cardId: number
  cardNumber: string
  tripId: number
  purchasedAt: string
  routeId: number
  routeNumber: string
  transportType: string
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function App() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [user, setUser] = useState<UserProfile | null>(null)
  const [lastTrip, setLastTrip] = useState<LastTrip | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [fineStatus, setFineStatus] = useState('')
  const [fineError, setFineError] = useState('')
  const [fineLoading, setFineLoading] = useState(false)
  const [loginForm, setLoginForm] = useState({
    login: '',
    password: '',
  })
  const [registerForm, setRegisterForm] = useState({
    login: '',
    password: '',
    email: '',
    phone: '',
    fullName: '',
  })
  const [cardLookup, setCardLookup] = useState({
    cardNumber: '',
  })
  const [fineForm, setFineForm] = useState({
    cardNumber: '',
    tripId: '',
    amount: '',
    reason: '',
    status: 'Очікує сплати',
    issuedAt: '',
  })

  const features = useMemo(
    () => [
      {
        title: 'PostgreSQL-native access',
        body: 'Login uses real DB credentials and role membership.',
      },
      {
        title: 'Role-aware UI',
        body: 'Once logged in, we render interfaces by your role.',
      },
      {
        title: 'Transport-grade data',
        body: 'Routes, stops, schedules, and tickets are first-class data.',
      },
    ],
    [],
  )

  const handleModeChange = (next: AuthMode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setLookupError('')
    setFineError('')
    setFineStatus('')

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        login: loginForm.login,
        password: loginForm.password,
      })
      const apiUser = response.data.user
      setUser(
        apiUser
          ? {
              login: apiUser.login,
              fullName: apiUser.fullName,
              email: apiUser.email,
              phone: apiUser.phone,
              registeredAt: apiUser.registeredAt,
            }
          : { login: loginForm.login },
      )
      setRoles(response.data.roles ?? [])
      setSuccess('Login successful.')
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) || err.message
        : 'Login failed.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await axios.post(`${API_URL}/auth/register`, registerForm)
      setSuccess('Registration complete. You can log in now.')
      setLoginForm({ login: registerForm.login, password: '' })
      setMode('login')
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) || err.message
        : 'Registration failed.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLookupLoading(true)
    setLookupError('')
    setLastTrip(null)

    try {
      const response = await axios.get(
        `${API_URL}/controller/cards/${encodeURIComponent(
          cardLookup.cardNumber.trim(),
        )}/last-trip`,
      )
      const data = response.data as LastTrip
      setLastTrip(data)
      setFineForm((current) => ({
        ...current,
        cardNumber: data.cardNumber,
        tripId: data.tripId.toString(),
      }))
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) || err.message
        : 'Lookup failed.'
      setLookupError(message)
    } finally {
      setLookupLoading(false)
    }
  }

  const handleIssueFine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFineLoading(true)
    setFineError('')
    setFineStatus('')

    try {
      const payload: Record<string, string | number> = {
        cardNumber: fineForm.cardNumber.trim(),
        tripId: Number(fineForm.tripId),
        amount: Number(fineForm.amount),
        reason: fineForm.reason.trim(),
      }
      if (fineForm.status) {
        payload.status = fineForm.status
      }
      if (fineForm.issuedAt) {
        payload.issuedAt = new Date(fineForm.issuedAt).toISOString()
      }

      const response = await axios.post(`${API_URL}/controller/fines`, payload)
      const fine = response.data as FineResponse
      setFineStatus(
        `Fine #${fine.id} issued · ${fine.amount} ₴ · ${fine.status}`,
      )
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) || err.message
        : 'Fine creation failed.'
      setFineError(message)
    } finally {
      setFineLoading(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setRoles([])
    setSuccess('')
    setError('')
    setLastTrip(null)
    setLookupError('')
    setFineError('')
    setFineStatus('')
    setLoginForm({ login: '', password: '' })
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <div className="brand-title">City Transport</div>
            <div className="brand-subtitle">Operations & passenger platform</div>
          </div>
        </div>
        <div className="api-pill">API: {API_URL.replace(/^https?:\/\//, '')}</div>
      </header>

      <main className="auth-shell">
        <section className="auth-hero">
          <p className="hero-kicker">Unified access</p>
          <h1>
            A role-based system for routes, schedules, and passenger services.
          </h1>
          <p className="hero-body">
            Sign in with your database login. We use PostgreSQL roles to protect
            access and surface only the interfaces you need.
          </p>
          <ul className="hero-list">
            {features.map((feature, index) => (
              <li
                key={feature.title}
                className="hero-item"
                style={{ '--delay': `${index * 120}ms` } as CSSProperties}
              >
                <span>{feature.title}</span>
                <p>{feature.body}</p>
              </li>
            ))}
          </ul>
          <div className="hero-note">
            PostGIS enabled for proximity search, routing, and live tracking.
          </div>
        </section>

        <section className="auth-card">
          {user ? (
            <div className="session">
              <div className="session-header">
                <h2>Welcome, {user.fullName || user.login}</h2>
                <p>Active roles</p>
              </div>
              <div className="role-grid">
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <span key={role} className="role-pill">
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="role-pill muted">No role mapping</span>
                )}
              </div>
              <button className="ghost" onClick={handleLogout} type="button">
                Sign out
              </button>

              {roles.includes('ct_controller_role') && (
                <div className="role-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Controller panel</h3>
                      <p>Verify a card and issue a fine.</p>
                    </div>
                    <span className="panel-chip">ct_controller_role</span>
                  </div>

                  <form className="panel" onSubmit={handleLookup}>
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
                    <button type="submit" disabled={lookupLoading}>
                      {lookupLoading ? 'Searching...' : 'Find last trip'}
                    </button>
                    {lookupError && (
                      <div className="status error">{lookupError}</div>
                    )}
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
                          <span>{lastTrip.vehicleId}</span>
                        </div>
                        <div>
                          <strong>Purchased</strong>
                          <span>
                            {new Date(lastTrip.purchasedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </form>

                  <form className="panel" onSubmit={handleIssueFine}>
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
                      Trip ID
                      <input
                        type="number"
                        min={1}
                        value={fineForm.tripId}
                        onChange={(event) =>
                          setFineForm({
                            ...fineForm,
                            tripId: event.target.value,
                          })
                        }
                        placeholder="1"
                        required
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
                      Issued at
                      <input
                        type="datetime-local"
                        value={fineForm.issuedAt}
                        onChange={(event) =>
                          setFineForm({
                            ...fineForm,
                            issuedAt: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button type="submit" disabled={fineLoading}>
                      {fineLoading ? 'Issuing...' : 'Issue fine'}
                    </button>
                    {fineError && (
                      <div className="status error">{fineError}</div>
                    )}
                    {fineStatus && (
                      <div className="status success">{fineStatus}</div>
                    )}
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'tab active' : 'tab'}
                  onClick={() => handleModeChange('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'tab active' : 'tab'}
                  onClick={() => handleModeChange('register')}
                >
                  Register
                </button>
              </div>

              {mode === 'login' ? (
                <form className="form" onSubmit={handleLogin}>
                  <label>
                    Login
                    <input
                      type="text"
                      value={loginForm.login}
                      onChange={(event) =>
                        setLoginForm({
                          ...loginForm,
                          login: event.target.value,
                        })
                      }
                      placeholder="db login"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm({
                          ...loginForm,
                          password: event.target.value,
                        })
                      }
                      placeholder="••••••••"
                      required
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              ) : (
                <form className="form" onSubmit={handleRegister}>
                  <label>
                    Login
                    <input
                      type="text"
                      value={registerForm.login}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          login: event.target.value,
                        })
                      }
                      placeholder="login"
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          email: event.target.value,
                        })
                      }
                      placeholder="email@example.com"
                      required
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          phone: event.target.value,
                        })
                      }
                      placeholder="+380..."
                      required
                    />
                  </label>
                  <label>
                    Full name
                    <input
                      type="text"
                      value={registerForm.fullName}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          fullName: event.target.value,
                        })
                      }
                      placeholder="Full name"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(event) =>
                        setRegisterForm({
                          ...registerForm,
                          password: event.target.value,
                        })
                      }
                      placeholder="At least 8 characters"
                      required
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>
                </form>
              )}
            </>
          )}

          {(error || success) && (
            <div className={error ? 'status error' : 'status success'}>
              {error || success}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
