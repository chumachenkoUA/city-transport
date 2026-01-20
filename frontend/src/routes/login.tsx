import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Bus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { FadeIn } from '@/components/ui/motion'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

interface LoginResponse {
  token: string
  user: {
    id: number
    login: string
    fullName: string
    email: string
    phone: string
  }
  roles: string[]
}

const ROLE_ROUTES = [
  { role: 'ct_manager_role', path: '/manager' },
  { role: 'ct_dispatcher_role', path: '/dispatcher' },
  { role: 'ct_municipality_role', path: '/municipality' },
  { role: 'ct_accountant_role', path: '/accountant' },
  { role: 'ct_controller_role', path: '/controller' },
  { role: 'ct_driver_role', path: '/driver' },
  { role: 'ct_passenger_role', path: '/passenger' },
] as const

function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (credentials: { login: string; password: string }) =>
      apiPost<LoginResponse>('/auth/login', credentials),
    onSuccess: (data) => {
      setIsSuccess(true)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('roles', JSON.stringify(data.roles))

      // Small delay for success animation
      setTimeout(() => {
        const route = ROLE_ROUTES.find(r => data.roles.includes(r.role))
        navigate({ to: route?.path ?? '/' })
      }, 500)
    },
    onError: (err: Error) => {
      setError(err.message || 'Невірний логін або пароль')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate({ login, password })
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-8">
      {/* Background decorations */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 left-20 h-80 w-80 rounded-full bg-gradient-to-tr from-emerald-500/20 to-transparent blur-3xl" />
      </div>

      <FadeIn animation="scaleUp" duration={0.4}>
        <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur-sm bg-background/95">
          <CardHeader className="space-y-4 text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
            >
              <Bus className="h-7 w-7 text-primary" />
            </motion.div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold">Вхід у систему</CardTitle>
              <CardDescription>
                Введіть ваші дані для доступу до кабінету
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}

                {isSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Alert className="border-green-500/50 bg-green-500/10 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>Успішний вхід! Перенаправлення...</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="login">Логін</Label>
                <Input
                  id="login"
                  type="text"
                  placeholder="passenger1"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  disabled={mutation.isPending || isSuccess}
                  className="transition-all focus:ring-2 focus:ring-primary/20"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={mutation.isPending || isSuccess}
                  className="transition-all focus:ring-2 focus:ring-primary/20"
                />
              </motion.div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="w-full"
              >
                <Button
                  type="submit"
                  className="w-full relative overflow-hidden"
                  disabled={mutation.isPending || isSuccess}
                  size="lg"
                >
                  <AnimatePresence mode="wait">
                    {mutation.isPending ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center"
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Вхід...
                      </motion.span>
                    ) : isSuccess ? (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Успішно!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        Увійти
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-sm text-center text-muted-foreground"
              >
                Немає акаунту?{' '}
                <button
                  type="button"
                  className="text-primary hover:underline font-medium transition-colors"
                  onClick={() => navigate({ to: '/register' })}
                >
                  Зареєструватися
                </button>
              </motion.div>
            </CardFooter>
          </form>
        </Card>
      </FadeIn>

      {/* Demo credentials hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2"
      >
        <Card className="bg-muted/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-2 px-4 text-xs text-muted-foreground">
            Демо: <span className="font-mono">passenger1</span> / <span className="font-mono">password</span>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
