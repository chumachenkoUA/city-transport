import { createFileRoute, Link } from '@tanstack/react-router'
import { MapPin, Clock, Shield, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/motion'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Typewriter } from '@/components/ui/typewriter'
import { GlowingOrb } from '@/components/ui/animated-gradient'
import { ScrollProgress } from '@/components/ui/scroll-progress'
import { TiltCard } from '@/components/ui/tilt-card'
import { MiniMap } from '@/components/mini-map'

const featureCards = [
  {
    title: 'Маршрутна мережа',
    description: 'Сучасна мапа зупинок та маршрутів для всіх ролей.',
    detail:
      'Керуйте геометрією маршрутів, змінами зупинок і швидким доступом до карти.',
    tags: ['Карта', 'Зупинки', 'Схеми'],
    icon: MapPin,
  },
  {
    title: 'Оперативний розклад',
    description: 'Злагоджені рейси та контроль затримок у реальному часі.',
    detail:
      'Плануйте графіки, реагуйте на події та тримайте пасажирів у курсі.',
    tags: ['Розклад', 'Події', 'Затримки'],
    icon: Clock,
  },
  {
    title: 'Якість сервісу',
    description: 'Аналітика для міста та сервіс для пасажирів.',
    detail:
      'Вимірюйте стабільність руху, швидко знаходьте вузькі місця та покращуйте сервіс.',
    tags: ['Аналітика', 'Сервіс', 'Контроль'],
    icon: Shield,
  },
]

const stats = [
  { value: 150, suffix: '+', label: 'Маршрутів' },
  { value: 2500, suffix: '+', label: 'Зупинок' },
  { value: 500, suffix: '+', label: 'Транспорту' },
  { value: 99.5, suffix: '%', label: 'Uptime' },
]

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="flex flex-col">
      <ScrollProgress />
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pb-16 pt-16 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <GlowingOrb className="absolute -top-20 right-10" color="bg-emerald-500/20" size="lg" />
          <GlowingOrb className="absolute -bottom-24 left-8" color="bg-amber-500/20" size="lg" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(80,120,255,0.12),_transparent_55%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <FadeIn animation="fadeInUp" duration={0.6}>
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Міський транспорт</Badge>
                  <Badge variant="secondary">Єдина платформа</Badge>
                </div>
                <h1 className="text-4xl font-semibold tracking-tight leading-[1.3] sm:text-5xl lg:text-6xl">
                  Міський транспорт, що працює{' '}
                  <span className="text-primary inline-block min-w-[200px] sm:min-w-[280px]">
                    <Typewriter
                      words={['швидко', 'надійно', 'зручно', 'ефективно']}
                      typingSpeed={80}
                      deletingSpeed={40}
                      delayBetweenWords={2500}
                    />
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Обʼєднуйте пасажирський сервіс, операційний контроль та аналітику в
                  одному середовищі. Всі ролі, дані та маршрути синхронізовані між
                  собою.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" asChild>
                    <Link to="/register">Почати роботу</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/map">Мапа маршрутів</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="secondary">Маршрути</Badge>
                  <Badge variant="secondary">Розклад</Badge>
                  <Badge variant="secondary">Контроль руху</Badge>
                  <Badge variant="secondary">Пасажирські сервіси</Badge>
                </div>
              </div>
            </FadeIn>

            <FadeIn animation="fadeInUp" delay={0.2} duration={0.6}>
              <Link to="/map" className="block group">
                <Card className="overflow-hidden bg-background/70 backdrop-blur transition-shadow hover:shadow-xl">
                  <div className="relative h-[300px] sm:h-[350px] lg:h-[400px]">
                    <MiniMap />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Карта маршрутів</p>
                        <p className="text-xs text-muted-foreground">Натисніть для перегляду</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative border-y bg-muted/30 px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Stagger staggerDelay={0.15}>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <StaggerItem key={stat.label} animation="scaleUp">
                  <div className="text-center">
                    <div className="text-3xl font-bold tracking-tight sm:text-4xl">
                      <AnimatedCounter
                        value={stat.value}
                        suffix={stat.suffix}
                        duration={2}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-16 lg:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(120deg,_rgba(15,23,42,0.08),_transparent_60%)]"
        />
        <div className="mx-auto max-w-7xl space-y-10">
          <FadeIn animation="fadeInUp">
            <div className="space-y-3">
              <Badge variant="outline">Основні можливості</Badge>
              <h2 className="text-3xl font-semibold tracking-tight">
                Від маршруту до сервісу за кілька кліків
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Візуалізуйте мережу, тримайте розклад під контролем і збирайте
                сигнал від пасажирів без зайвих інструментів.
              </p>
            </div>
          </FadeIn>

          <Stagger staggerDelay={0.1}>
            <div className="grid gap-6 md:grid-cols-3">
              {featureCards.map((feature) => (
                <StaggerItem key={feature.title} animation="fadeInUp">
                  <TiltCard tiltAmount={8} scale={1.02} glareOpacity={0.1}>
                    <Card className="h-full transition-shadow hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle>{feature.title}</CardTitle>
                        <CardDescription>{feature.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {feature.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                          {feature.detail}
                        </p>
                      </CardContent>
                    </Card>
                  </TiltCard>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn animation="scaleUp">
            <Card className="relative overflow-hidden border-border/60">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-primary/15 via-transparent to-emerald-500/15"
              />
              <CardHeader className="relative text-center">
                <CardTitle className="text-3xl">Готові почати?</CardTitle>
                <CardDescription className="text-lg">
                  Приєднуйтесь до системи управління міським транспортом
                </CardDescription>
              </CardHeader>
              <CardContent className="relative flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/register">Створити акаунт</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/contacts">Зв'язатись з нами</Link>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
