import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { API_URL } from './lib/api'
import { useAuthStore } from './store/auth'
import './App.css'

function App() {
  const navigate = useNavigate()
  const { user, roles, clear } = useAuthStore()
  const roleLinks = [
    { to: '/', label: 'Auth' },
    { to: '/guest', label: 'Guest' },
    { to: '/passenger', label: 'Passenger', role: 'ct_passenger_role' },
    { to: '/controller', label: 'Controller', role: 'ct_controller_role' },
    { to: '/dispatcher', label: 'Dispatcher', role: 'ct_dispatcher_role' },
    { to: '/driver', label: 'Driver', role: 'ct_driver_role' },
    { to: '/accountant', label: 'Accountant', role: 'ct_accountant_role' },
    { to: '/manager', label: 'Manager', role: 'ct_manager_role' },
    { to: '/municipality', label: 'Municipality', role: 'ct_municipality_role' },
    { to: '/admin', label: 'Admin', role: 'ct_admin_role' },
  ]

  const handleSignOut = () => {
    clear()
    navigate({ to: '/' })
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
        <nav className="topbar-nav">
          {roleLinks
            .filter((item) => !item.role || roles.includes(item.role))
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="topbar-actions">
          <div className="api-pill">
            API: {API_URL.replace(/^https?:\/\//, '')}
          </div>
          <div className="session-mini">
            {user ? (
              <>
                <span>
                  Signed in as <strong>{user.fullName || user.login}</strong>
                </span>
                <button
                  className="ghost small"
                  type="button"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <span>Guest session</span>
            )}
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default App
