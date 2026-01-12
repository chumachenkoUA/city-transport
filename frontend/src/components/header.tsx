import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Bus, Menu, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ModeToggle } from '@/components/mode-toggle'
import { apiPost } from '@/lib/api'

const navigation = [
  { name: 'Головна', href: '/' },
  { name: 'Мапа', href: '/map' },
  { name: 'Контакти', href: '/contacts' },
]

const ROLE_ROUTES: Array<{ role: string; path: string; label: string }> = [
  { role: 'ct_manager_role', path: '/manager', label: 'Менеджер' },
  { role: 'ct_dispatcher_role', path: '/dispatcher', label: 'Диспетчер' },
  { role: 'ct_municipality_role', path: '/municipality', label: 'Мерія' },
  { role: 'ct_accountant_role', path: '/accountant', label: 'Бухгалтер' },
  { role: 'ct_controller_role', path: '/controller', label: 'Контролер' },
  { role: 'ct_driver_role', path: '/driver', label: 'Водій' },
  { role: 'ct_passenger_role', path: '/passenger', label: 'Пасажир' },
]

function getProfileInfo() {
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
  return match ?? null
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const profileInfo = getProfileInfo()
  const showLogout =
    !!profileInfo && profileInfo.path !== '/' && pathname.startsWith(profileInfo.path)

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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex lg:flex-1"
        >
          <Link to="/" className="-m-1.5 p-1.5 flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <Bus className="h-7 w-7 text-primary" />
            </motion.div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              City Transport
            </span>
          </Link>
        </motion.div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-m-2.5">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Меню</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="mt-6 flow-root">
                <div className="-my-6 divide-y divide-border">
                  <div className="space-y-2 py-6">
                    {navigation.map((item, index) => (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          to={item.href}
                          className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-foreground hover:bg-muted transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.name}
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  <div className="py-6 space-y-3">
                    <div className="flex justify-center pb-4">
                      <ModeToggle />
                    </div>
                    {profileInfo ? (
                      <>
                        <Button className="w-full" asChild>
                          <Link to={profileInfo.path}>
                            <User className="mr-2 h-4 w-4" />
                            {profileInfo.label}
                          </Link>
                        </Button>
                        {showLogout && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleLogout}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
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
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="hidden lg:flex lg:gap-x-1"
        >
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className="relative px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-lg"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary/10 rounded-lg"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${isActive ? 'text-primary font-semibold' : ''}`}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </motion.div>

        {/* Desktop auth buttons */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-3 lg:items-center"
        >
          <ModeToggle />
          {profileInfo ? (
            <>
              <Button asChild className="group">
                <Link to={profileInfo.path}>
                  <User className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                  {profileInfo.label}
                </Link>
              </Button>
              {showLogout && (
                <Button variant="outline" onClick={handleLogout} className="group">
                  <LogOut className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  Вийти
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Увійти</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Реєстрація</Link>
              </Button>
            </>
          )}
        </motion.div>
      </nav>
    </header>
  )
}
