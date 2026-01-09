import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="px-4 py-20 md:py-32 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <Badge variant="outline" className="mb-4">
            Міський транспорт
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
            Керуй міським транспортом <br />
            <span className="text-primary">просто і ефективно</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-muted-foreground mb-10">
            Система управління міським транспортом з підтримкою ролей для пасажирів,
            водіїв, диспетчерів та адміністраторів. Контролюй маршрути, розклад та статистику в реальному часі.
          </p>
          <div className="flex items-center justify-center gap-x-4">
            <Button size="lg" asChild>
              <Link to="/register">Почати роботу</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/routes">Переглянути маршрути</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 lg:px-8 bg-muted/50">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Основні можливості
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Маршрути</CardTitle>
                <CardDescription>
                  Перегляд та управління всіма маршрутами міського транспорту
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Інтерактивна карта, інформація про зупинки, реальний час прибуття
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Розклад</CardTitle>
                <CardDescription>
                  Точний розклад руху транспорту для кожного маршруту
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Планування рейсів, відстеження затримок, статистика виконання
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Відстеження</CardTitle>
                <CardDescription>
                  Моніторинг транспорту в реальному часі на карті
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  GPS-трекінг, історія поїздок, аналітика маршрутів
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Готові почати?</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-lg">
                Приєднуйтесь до системи управління міським транспортом
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/register">Створити акаунт</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/20 hover:bg-primary-foreground/10" asChild>
                <Link to="/contacts">Зв'язатись з нами</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
