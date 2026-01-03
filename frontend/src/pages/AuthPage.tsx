import type { CSSProperties, FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuthStore } from '../store/auth'

type AuthMode = 'login' | 'register'

type LoginPayload = {
  login: string
  password: string
}

type RegisterPayload = {
  login: string
  password: string
  email: string
  phone: string
  fullName: string
}

function AuthPage() {
  const navigate = useNavigate()
  const { user, roles, setAuth } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loginForm, setLoginForm] = useState<LoginPayload>({
    login: '',
    password: '',
  })
  const [registerForm, setRegisterForm] = useState<RegisterPayload>({
    login: '',
    password: '',
    email: '',
    phone: '',
    fullName: '',
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

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const response = await api.post('/auth/login', payload)
      return response.data
    },
    onSuccess: (data) => {
      const apiUser = data.user
      const nextUser = apiUser
        ? {
            id: apiUser.id,
            login: apiUser.login,
            fullName: apiUser.fullName,
            email: apiUser.email,
            phone: apiUser.phone,
            registeredAt: apiUser.registeredAt,
          }
        : { login: loginForm.login }

      const nextRoles: string[] = data.roles ?? []
      setAuth(nextUser, nextRoles, data.token ?? null)
      setSuccess('Login successful.')
      setError('')

      if (nextRoles.includes('ct_controller_role')) {
        navigate({ to: '/controller' })
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Login failed.'))
      setSuccess('')
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await api.post('/auth/register', payload)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Registration complete. You can log in now.')
      setError('')
      setLoginForm({ login: registerForm.login, password: '' })
      setMode('login')
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Registration failed.'))
      setSuccess('')
    },
  })

  const handleModeChange = (next: AuthMode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loginMutation.mutate({
      login: loginForm.login,
      password: loginForm.password,
    })
  }

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    registerMutation.mutate(registerForm)
  }

  const isLoading = loginMutation.isPending || registerMutation.isPending

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="hero-kicker">Unified access</p>
        <h1>A role-based system for routes, schedules, and services.</h1>
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
            {roles.includes('ct_controller_role') && (
              <Link className="ghost" to="/controller">
                Open controller workspace
              </Link>
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
                <button type="submit" disabled={isLoading}>
                  {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
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
                <button type="submit" disabled={isLoading}>
                  {registerMutation.isPending
                    ? 'Creating account...'
                    : 'Create account'}
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
  )
}

export default AuthPage
