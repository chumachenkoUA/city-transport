import { Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from './store/auth'
import { cn } from './lib/utils'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, roles, clear } = useAuthStore()
  
  // Сторінки, які займають весь екран і не потребують стандартного лейауту
  const isFullScreenPage = location.pathname === '/' || location.pathname === '/guest'

  const roleLinks = [
    { to: '/', label: 'Головна' },
    { to: '/guest', label: 'Гість' },
    { to: '/passenger', label: 'Пасажир', role: 'ct_passenger_role' },
    { to: '/controller', label: 'Контролер', role: 'ct_controller_role' },
    { to: '/dispatcher', label: 'Диспетчер', role: 'ct_dispatcher_role' },
    { to: '/driver', label: 'Водій', role: 'ct_driver_role' },
    { to: '/accountant', label: 'Бухгалтер', role: 'ct_accountant_role' },
    { to: '/municipality', label: 'Мерія', role: 'ct_municipality_role' },
  ]

  const handleSignOut = () => {
    clear()
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-accent/30 bg-background text-text">
      {/* Показуємо навігацію тільки якщо це НЕ повноекранна сторінка */}
      {!isFullScreenPage && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 pointer-events-none">
          <header className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl px-2 py-2 shadow-2xl shadow-black/50 flex items-center justify-between gap-4 transition-all duration-300 hover:bg-surface/90">
            
            <div className="flex items-center gap-3 pl-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold leading-none text-white tracking-tight">City Transport</div>
              </div>
            </div>
            
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade">
              {roleLinks
                .filter((item) => !item.role || roles.includes(item.role))
                .map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
                        isActive 
                          ? 'bg-white/10 text-white shadow-inner shadow-white/5' 
                          : 'text-muted hover:text-white hover:bg-white/5'
                      )
                    }
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>

            <div className="flex items-center gap-2 pr-2 border-l border-white/10 pl-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-muted">
                    {user.login[0].toUpperCase()}
                  </div>
                  <button
                    className="p-2 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-400/10 transition-colors cursor-pointer"
                    type="button"
                    onClick={handleSignOut}
                    title="Вихід"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  </button>
                </div>
              ) : (
                <Link to="/" className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors">
                  Увійти
                </Link>
              )}
            </div>
          </header>
        </div>
      )}
      
      {/* Main Container: для повноекранних сторінок прибираємо відступи та обмеження ширини */}
      <main className={!isFullScreenPage ? 'flex-1 w-full max-w-7xl mx-auto pt-28 pb-12 px-4' : 'w-full h-screen overflow-hidden'}>
        <Outlet />
      </main>
    </div>
  )
}

export default App
