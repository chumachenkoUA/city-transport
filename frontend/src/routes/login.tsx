import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

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

function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (credentials: any) => apiPost<LoginResponse>('/auth/login', credentials),
    onSuccess: (data) => {
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('roles', JSON.stringify(data.roles))
      
      // Redirect based on role
      if (data.roles.includes('ct_admin_role')) {
        navigate({ to: '/admin' })
      } else if (data.roles.includes('ct_manager_role')) {
        navigate({ to: '/manager' })
      } else if (data.roles.includes('ct_dispatcher_role')) {
        navigate({ to: '/dispatcher' })
      } else if (data.roles.includes('ct_municipality_role')) {
        navigate({ to: '/municipality' })
      } else if (data.roles.includes('ct_accountant_role')) {
        navigate({ to: '/accountant' })
      } else if (data.roles.includes('ct_controller_role')) {
        navigate({ to: '/controller' })
      } else if (data.roles.includes('ct_driver_role')) {
        navigate({ to: '/driver' })
      } else if (data.roles.includes('ct_passenger_role')) {
        navigate({ to: '/passenger' })
      } else {
        navigate({ to: '/' })
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Невірний логін або пароль')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate({ login, password })
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Вхід у систему</CardTitle>
          <CardDescription className="text-center">
            Введіть ваші дані для доступу до кабінету
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login">Логін</Label>
              <Input
                id="login"
                type="text"
                placeholder="passenger1"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Пароль</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Увійти
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Немає акаунту?{' '}
              <button 
                type="button" 
                className="text-primary hover:underline font-medium"
                onClick={() => navigate({ to: '/register' })}
              >
                Зареєструватися
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
