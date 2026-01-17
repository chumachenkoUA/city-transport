import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [formData, setFormData] = useState({
    login: '',
    email: '',
    phone: '',
    fullName: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => apiPost('/auth/register', data),
    onSuccess: () => {
      toast.success('Реєстрація успішна!', {
        description: 'Тепер ви можете увійти в систему',
      })
      navigate({ to: '/login' })
    },
    onError: (err: any) => {
      setError(err.message || 'Помилка при реєстрації. Перевірте введені дані.')
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate(formData)
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12 bg-muted/30">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Реєстрація пасажира</CardTitle>
          <CardDescription className="text-center">
            Створіть акаунт для доступу до всіх можливостей
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-md border border-destructive/20 text-center">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="login">Логін</Label>
                <Input
                  id="login"
                  name="login"
                  type="text"
                  placeholder="ivan_petrenko"
                  value={formData.login}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">ПІБ</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Іван Петренко"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ivan@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефону</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+380XXXXXXXXX"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль (мін. 8 символів)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
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
              Зареєструватися
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Вже маєте акаунт?{' '}
              <button 
                type="button" 
                className="text-primary hover:underline font-medium"
                onClick={() => navigate({ to: '/login' })}
              >
                Увійти
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
