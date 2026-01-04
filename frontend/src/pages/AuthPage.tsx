import type { FormEvent } from 'react'
import { useState } from 'react'
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

  const ROLE_REDIRECTS: Record<string, string> = {
    ct_admin_role: '/admin',
    ct_controller_role: '/controller',
    ct_passenger_role: '/passenger',
    ct_driver_role: '/driver',
    ct_dispatcher_role: '/dispatcher',
    ct_manager_role: '/manager',
    ct_municipality_role: '/municipality',
    ct_accountant_role: '/accountant',
  }

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
      setSuccess('Успішний вхід.')
      setError('')

      for (const role of nextRoles) {
        if (ROLE_REDIRECTS[role]) {
          navigate({ to: ROLE_REDIRECTS[role] })
          return
        }
      }
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Помилка входу.'))
      setSuccess('')
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await api.post('/auth/register', payload)
      return response.data
    },
    onSuccess: () => {
      setSuccess('Реєстрація успішна. Увійдіть у систему.')
      setError('')
      setLoginForm({ login: registerForm.login, password: '' })
      setMode('login')
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Помилка реєстрації.'))
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
    loginMutation.mutate(loginForm)
  }

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    registerMutation.mutate(registerForm)
  }

  const isLoading = loginMutation.isPending || registerMutation.isPending

  const handleLogout = () => {
    useAuthStore.getState().clear()
    navigate({ to: '/' })
  }

  return (
    <div className="relative min-h-screen w-full bg-slate-900 overflow-hidden flex items-center justify-center font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Blobs Animation */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-20 w-[500px] h-[500px] bg-pink-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-12 p-6 items-center">
        {/* Left Side: Brand & Info */}
        <div className="hidden lg:block space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-300 text-xs font-medium mb-6 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
              City Transport System v2.0
            </div>
            <h1 className="text-6xl font-bold tracking-tight text-white leading-[1.1]">
              Рухайся містом <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">вільно.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 max-w-md leading-relaxed">
              Інтелектуальна платформа для керування міським трафіком. Розклади в реальному часі, електронні квитки та GPS-моніторинг.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-indigo-400 text-2xl mb-2">🚌</div>
              <h3 className="font-semibold text-white">GPS Трекінг</h3>
              <p className="text-xs text-slate-400 mt-1">Слідкуйте за транспортом онлайн.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="text-emerald-400 text-2xl mb-2">🎫</div>
              <h3 className="font-semibold text-white">E-Квиток</h3>
              <p className="text-xs text-slate-400 mt-1">Безконтактна оплата проїзду.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden">
            {/* Glossy effect */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80"></div>

            {user ? (
              <div className="text-center space-y-8 py-4 animate-in fade-in zoom-in duration-300">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-md opacity-60 animate-pulse"></div>
                  <div className="relative h-full w-full bg-slate-900 rounded-full flex items-center justify-center border-2 border-white/20 text-3xl font-bold text-white shadow-xl">
                    {user.login[0].toUpperCase()}
                  </div>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white">З поверненням!</h2>
                  <p className="text-slate-400 mt-1">{user.fullName || user.login}</p>
                </div>
                
                <div className="space-y-3">
                  {roles.map(role => ROLE_REDIRECTS[role] && (
                    <Link 
                      key={role} 
                      to={ROLE_REDIRECTS[role]} 
                      className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all cursor-pointer"
                    >
                      <span className="font-medium text-slate-200 group-hover:text-white">
                        {role.replace('ct_', '').replace('_role', '').toUpperCase()} Dashboard
                      </span>
                      <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
                    </Link>
                  ))}
                </div>

                <button 
                  onClick={handleLogout} 
                  className="text-sm text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Вийти з акаунту
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center lg:text-left">
                  <h2 className="text-2xl font-bold text-white">
                    {mode === 'login' ? 'Вхід у кабінет' : 'Створити акаунт'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {mode === 'login' ? 'Введіть свої дані для продовження' : 'Приєднуйтесь до цифрової транспортної мережі'}
                  </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-black/20 p-1 rounded-xl mb-6 backdrop-blur-md">
                  <button
                    onClick={() => handleModeChange('login')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      mode === 'login'
                        ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    Вхід
                  </button>
                  <button
                    onClick={() => handleModeChange('register')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      mode === 'register'
                        ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    Реєстрація
                  </button>
                </div>

                {/* Forms */}
                {mode === 'login' ? (
                  <form className="space-y-5 animate-in slide-in-from-right-8 fade-in duration-300" onSubmit={handleLogin}>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Логін</label>
                      <input
                        type="text"
                        value={loginForm.login}
                        onChange={(e) => setLoginForm({ ...loginForm, login: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 focus:bg-black/30 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                        placeholder="user123"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Пароль</label>
                      <input
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder-slate-500 focus:bg-black/30 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isLoading} 
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-900/50 hover:shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none mt-2"
                    >
                      {isLoading ? 'Вхід...' : 'Увійти'}
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4 animate-in slide-in-from-left-8 fade-in duration-300" onSubmit={handleRegister}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Логін</label>
                        <input
                          value={registerForm.login}
                          onChange={(e) => setRegisterForm({ ...registerForm, login: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:bg-black/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Ім'я</label>
                        <input
                          value={registerForm.fullName}
                          onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:bg-black/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                          placeholder="Іван"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Email</label>
                      <input
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:bg-black/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Телефон</label>
                      <input
                        type="tel"
                        value={registerForm.phone}
                        onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:bg-black/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                        placeholder="+380..."
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Пароль</label>
                      <input
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:bg-black/30 focus:border-indigo-500/50 outline-none transition-all text-sm"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isLoading} 
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-900/50 hover:shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none mt-2"
                    >
                      {isLoading ? 'Реєстрація...' : 'Зареєструватися'}
                    </button>
                  </form>
                )}

                {/* Status Messages */}
                {(error || success) && (
                  <div className={`mt-4 p-3 rounded-xl text-sm text-center font-medium border animate-in fade-in slide-in-from-bottom-2 ${error ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {error || success}
                  </div>
                )}

                {/* Footer Links */}
                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                  <Link to="/guest" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Я просто хочу знайти маршрут →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage