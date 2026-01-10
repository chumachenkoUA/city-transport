import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ModeToggle } from '@/components/mode-toggle'
import { apiPost } from '@/lib/api'

const navigation = [
  { name: 'Головна', href: '/' },
  { name: 'Мапа', href: '/map' },
  { name: 'Маршрути', href: '/routes' },
  { name: 'Розклад', href: '/schedule' },
  { name: 'Пасажир', href: '/passenger' },
  { name: 'Контакти', href: '/contacts' },
]

const ROLE_ROUTES: Array<{ role: string; path: string }> = [
  { role: 'ct_admin_role', path: '/admin' },
  { role: 'ct_manager_role', path: '/manager' },
  { role: 'ct_dispatcher_role', path: '/dispatcher' },
  { role: 'ct_municipality_role', path: '/municipality' },
  { role: 'ct_accountant_role', path: '/accountant' },
  { role: 'ct_controller_role', path: '/controller' },
  { role: 'ct_driver_role', path: '/driver' },
  { role: 'ct_passenger_role', path: '/passenger' },
]

function getProfileRoute() {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('token')
  if (!token) return null
  let roles: string[] = []
  try {
    const stored = localStorage.getItem('roles')
    roles = stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    roles = []
  }
  const match = ROLE_ROUTES.find((item) => roles.includes(item.role))
  return match?.path ?? '/'
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const profileRoute = getProfileRoute()
  const showLogout =
    !!profileRoute && profileRoute !== '/' && pathname.startsWith(profileRoute)

  const handleLogout = async () => {
    try {
      await apiPost('/auth/logout')
    } catch {
      // ignore logout errors to ensure local cleanup
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('roles')
    navigate({ to: '/' })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo */}
        <div className="flex lg:flex-1">
          <Link to="/" className="-m-1.5 p-1.5">
            <span className="text-2xl font-bold text-primary">City Transport</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="-m-2.5">
                <span>Меню</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="mt-6 flow-root">
                <div className="-my-6 divide-y divide-border">
                  <div className="space-y-2 py-6">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-foreground hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                  <div className="py-6 space-y-2">
                    <div className="flex justify-center pb-4">
                      <ModeToggle />
                    </div>
                    {profileRoute ? (
                      <>
                        <Button className="w-full" asChild>
                          <Link to={profileRoute}>Мій профіль</Link>
                        </Button>
                        {showLogout && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleLogout}
                          >
                            Вийти
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="outline" className="w-full" asChild>
                          <Link to="/login">Увійти</Link>
                        </Button>
                        <Button className="w-full" asChild>
                          <Link to="/register">Реєстрація</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="text-sm font-semibold leading-6 text-foreground hover:text-primary transition-colors"
              activeProps={{
                className: 'text-primary',
              }}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-3 lg:items-center">
          <ModeToggle />
          {profileRoute ? (
            <>
              <Button asChild>
                <Link to={profileRoute}>Мій профіль</Link>
              </Button>
              {showLogout && (
                <Button variant="outline" onClick={handleLogout}>
                  Вийти
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" asChild>
                <Link to="/login">Увійти</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Реєстрація</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
