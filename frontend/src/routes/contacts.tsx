import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/motion'
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageSquare,
  Lightbulb,
  Send,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Bus,
  Facebook,
  Instagram,
} from 'lucide-react'
import { submitComplaint, getTransportTypes } from '@/lib/guest-api'

export const Route = createFileRoute('/contacts')({
  component: ContactsPage,
})

const faqItems = [
  {
    question: 'Як дізнатися розклад руху?',
    answer:
      'Розклад доступний на сторінці "Мапа". Оберіть зупинку та перегляньте список маршрутів з часом прибуття. Також можна скористатися плануванням маршруту.',
  },
  {
    question: 'Як поповнити проїзну картку?',
    answer:
      'Поповнити картку можна в особистому кабінеті пасажира, у касах метро, термінали самообслуговування або через мобільний додаток.',
  },
  {
    question: 'Що робити, якщо я загубив речі в транспорті?',
    answer:
      'Зверніться на гарячу лінію 0-800-500-000 або заповніть форму звернення на цій сторінці з детальним описом втрачених речей та маршруту.',
  },
  {
    question: 'Як оскаржити штраф?',
    answer:
      'Оскаржити штраф можна в особистому кабінеті пасажира протягом 10 днів з моменту його виписування. Додайте пояснення та підтверджуючі документи.',
  },
  {
    question: 'Чи є пільги на проїзд?',
    answer:
      'Так, пільги передбачені для пенсіонерів, студентів, учнів, осіб з інвалідністю та інших категорій громадян. Детальніше на сайті міської ради.',
  },
]

const contactInfo = [
  {
    icon: Phone,
    title: 'Гаряча лінія',
    value: '0-800-500-000',
    description: 'Безкоштовно по Україні',
  },
  {
    icon: Mail,
    title: 'Email',
    value: 'support@citytransport.lviv.ua',
    description: 'Відповідь протягом 24 годин',
  },
  {
    icon: MapPin,
    title: 'Адреса',
    value: 'м. Львів, пл. Ринок, 1',
    description: 'Центральний офіс',
  },
  {
    icon: Clock,
    title: 'Графік роботи',
    value: 'Пн-Пт: 8:00 - 20:00',
    description: 'Сб-Нд: 9:00 - 18:00',
  },
]

function ContactsPage() {
  const [type, setType] = useState<'complaint' | 'suggestion'>('complaint')
  const [message, setMessage] = useState('')
  const [contactInfoField, setContactInfoField] = useState('')
  const [routeNumber, setRouteNumber] = useState('')
  const [transportType, setTransportType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  const { data: transportTypes } = useQuery({
    queryKey: ['transportTypes'],
    queryFn: getTransportTypes,
  })

  const mutation = useMutation({
    mutationFn: () =>
      submitComplaint({
        type,
        message,
        contactInfo: contactInfoField || undefined,
        routeNumber: routeNumber || undefined,
        transportType: transportType || undefined,
        vehicleNumber: vehicleNumber || undefined,
      }),
    onSuccess: () => {
      setMessage('')
      setContactInfoField('')
      setRouteNumber('')
      setTransportType('')
      setVehicleNumber('')
      toast.success('Звернення надіслано', {
        description: 'Дякуємо! Ми розглянемо ваше звернення найближчим часом.',
      })
    },
    onError: () => {
      toast.error('Помилка', {
        description: 'Не вдалося надіслати звернення. Спробуйте пізніше.',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      toast.error('Помилка', {
        description: 'Введіть текст звернення.',
      })
      return
    }
    mutation.mutate()
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/5 to-background px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <FadeIn animation="fadeInUp">
            <Badge variant="outline" className="mb-4">
              Підтримка 24/7
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Зв'яжіться з нами
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Маєте питання, пропозицію чи скаргу? Ми завжди готові допомогти та
              покращити якість транспортних послуг.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Stagger staggerDelay={0.1}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contactInfo.map((item) => (
                <StaggerItem key={item.title} animation="fadeInUp">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-4 p-6">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {item.title}
                        </p>
                        <p className="font-semibold">{item.value}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Complaint Form */}
            <FadeIn animation="fadeInUp">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Надіслати звернення
                  </CardTitle>
                  <CardDescription>
                    Заповніть форму, і ми обов'язково розглянемо ваше звернення
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    {/* Type Selection */}
                    <div className="space-y-2">
                      <Label>Тип звернення</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={type === 'complaint' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setType('complaint')}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Скарга
                        </Button>
                        <Button
                          type="button"
                          variant={type === 'suggestion' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setType('suggestion')}
                        >
                          <Lightbulb className="mr-2 h-4 w-4" />
                          Пропозиція
                        </Button>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message">
                        Текст звернення <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder={
                          type === 'complaint'
                            ? 'Опишіть вашу проблему детально...'
                            : 'Поділіться вашою ідеєю...'
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[120px]"
                        required
                      />
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2">
                      <Label htmlFor="contact">Контактна інформація</Label>
                      <Input
                        id="contact"
                        type="text"
                        placeholder="Email або телефон для зворотного зв'язку"
                        value={contactInfoField}
                        onChange={(e) => setContactInfoField(e.target.value)}
                      />
                    </div>

                    {/* Optional Fields */}
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        Додаткова інформація (опційно)
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="transportType">Тип транспорту</Label>
                          <Select
                            value={transportType}
                            onValueChange={setTransportType}
                          >
                            <SelectTrigger id="transportType">
                              <SelectValue placeholder="Оберіть тип" />
                            </SelectTrigger>
                            <SelectContent>
                              {transportTypes?.map((t) => (
                                <SelectItem key={t.id} value={t.name}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="routeNumber">Номер маршруту</Label>
                          <Input
                            id="routeNumber"
                            placeholder="Напр. 3А"
                            value={routeNumber}
                            onChange={(e) => setRouteNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleNumber">
                          Номер транспортного засобу
                        </Label>
                        <Input
                          id="vehicleNumber"
                          placeholder="Напр. ВС 1234 АА"
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!message.trim() || mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : mutation.isSuccess ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {mutation.isPending
                        ? 'Надсилання...'
                        : mutation.isSuccess
                          ? 'Надіслано!'
                          : 'Надіслати звернення'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </FadeIn>

            {/* FAQ Section */}
            <FadeIn animation="fadeInUp" delay={0.2}>
              <div className="space-y-6">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-bold">
                    <HelpCircle className="h-6 w-6 text-primary" />
                    Часті питання
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Відповіді на найпопулярніші запитання
                  </p>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {/* Social Links */}
                <Card className="mt-8">
                  <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                    <Bus className="h-10 w-10 text-primary" />
                    <div>
                      <h3 className="font-semibold">Слідкуйте за нами</h3>
                      <p className="text-sm text-muted-foreground">
                        Оперативні новини та оновлення
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href="https://facebook.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Facebook"
                        >
                          <Facebook className="h-5 w-5" />
                        </a>
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href="https://instagram.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Instagram"
                        >
                          <Instagram className="h-5 w-5" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </div>
  )
}
