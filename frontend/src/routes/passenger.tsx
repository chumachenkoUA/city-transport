import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Loader2,
  CreditCard,
  Ticket,
  AlertTriangle,
  History,
  Wallet,
  CheckCircle2,
  User,
  Mail,
  Phone,
  CalendarDays,
  MessageSquarePlus,
  MessageSquare,
  Lightbulb,
  Send,
} from 'lucide-react'
import {
  getMyProfile,
  getMyCard,
  getMyTopUps,
  getMyTrips,
  getMyFines,
  payFine,
  topUpCard,
  createAppeal,
  createPassengerComplaint,
  type Fine,
  type PassengerCard,
} from '@/lib/passenger-api'
import { getTransportTypes } from '@/lib/guest-api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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

export const Route = createFileRoute('/passenger')({
  component: PassengerDashboard,
})

function PassengerDashboard() {
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['passenger-profile'],
    queryFn: getMyProfile,
  })

  const { data: card, isLoading: isLoadingCard } = useQuery({
    queryKey: ['passenger-card'],
    queryFn: getMyCard,
  })

  const { data: topUps } = useQuery({
    queryKey: ['passenger-top-ups'],
    queryFn: () => getMyTopUps(3),
  })

  const { data: trips, isLoading: isLoadingTrips } = useQuery({
    queryKey: ['passenger-trips'],
    queryFn: getMyTrips,
  })

  const { data: fines, isLoading: isLoadingFines } = useQuery({
    queryKey: ['passenger-fines'],
    queryFn: getMyFines,
  })

  const isLoading = isLoadingProfile || isLoadingCard || isLoadingTrips || isLoadingFines

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {profile ? `Вітаємо, ${profile.fullName.split(' ')[0]}!` : 'Пасажирський кабінет'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Керуйте своїми поїздками, карткою та штрафами в одному місці.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      {profile && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-primary/70" />
                <span className="text-sm font-semibold">{profile.fullName}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">{profile.phone}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">
                  З {new Date(profile.registeredAt).toLocaleDateString('uk-UA')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Section: Card & Balance */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-full lg:col-span-2 overflow-hidden relative border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm hover:shadow-lg transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
            <CreditCard className="w-36 h-36" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              Транспортна картка
            </CardTitle>
            <CardDescription className="mt-1">
              Інформація про баланс та поповнення
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!card ? (
              <div className="text-center py-8">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-muted mb-4">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">У вас немає активної картки</p>
                <Button variant="outline">Отримати картку</Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Номер картки</p>
                    <p className="text-2xl font-mono font-bold tracking-widest">{card.cardNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Баланс</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{card.balance} <span className="text-lg font-normal text-muted-foreground">грн</span></p>
                  </div>
                  <div className="w-full sm:w-auto">
                     <TopUpDialog card={card} />
                  </div>
                </div>
                {/* Історія останніх поповнень */}
                {topUps && topUps.length > 0 && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Останні поповнення</p>
                    <div className="space-y-2">
                      {topUps.map((topUp) => (
                        <div key={topUp.id} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            {new Date(topUp.toppedUpAt).toLocaleDateString('uk-UA', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="font-medium text-green-600">+{topUp.amount} грн</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <History className="h-5 w-5 text-blue-500" />
              </div>
               Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
             <div className="flex justify-between items-center py-4 border-b">
                <span className="text-muted-foreground text-sm">Всього поїздок</span>
                <span className="font-bold text-2xl">{trips?.length || 0}</span>
             </div>
             <div className="flex justify-between items-center py-4 border-b">
                <span className="text-muted-foreground text-sm">Всього штрафів</span>
                <span className="font-bold text-2xl">{fines?.length || 0}</span>
             </div>
             <div className="flex justify-between items-center py-4">
                <span className="text-muted-foreground text-sm">Очікують сплати</span>
                <span className={`font-bold text-2xl ${(fines?.filter(f => f.status === 'Очікує сплати').length || 0) > 0 ? 'text-destructive' : ''}`}>
                  {fines?.filter(f => f.status === 'Очікує сплати').length || 0}
                </span>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Trips and Fines */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trips History - Takes up 2 columns */}
        <Card className="lg:col-span-2 h-fit shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Ticket className="h-5 w-5 text-emerald-500" />
              </div>
              Історія поїздок
            </CardTitle>
            <CardDescription className="mt-1">
              Останні ваші поїздки громадським транспортом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-semibold">Дата</TableHead>
                    <TableHead className="font-semibold">Маршрут</TableHead>
                    <TableHead className="font-semibold">Транспорт</TableHead>
                    <TableHead className="text-right font-semibold">Вартість</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-40 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Ticket className="h-8 w-8 text-muted-foreground/50" />
                          <span>Історія поїздок порожня</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    trips?.map((trip) => (
                      <TableRow key={trip.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-sm">
                          {new Date(trip.purchasedAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{trip.routeNumber}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{trip.transportType}</TableCell>
                        <TableCell className="text-right font-semibold text-red-500/80">-{trip.cost} грн</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Fines Section - Takes up 1 column */}
        <Card className="h-fit shadow-sm hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              Штрафи
            </CardTitle>
            <CardDescription className="mt-1">
              Статус ваших штрафів та оплата
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fines?.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                 <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-3">
                   <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                 </div>
                 <p className="font-medium">У вас немає штрафів</p>
                 <p className="text-xs text-muted-foreground/70 mt-1">Так тримати!</p>
               </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-auto pr-1">
                {fines?.map((fine) => (
                  <FineItem key={fine.id} fine={fine} card={card} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Complaint/Suggestion Section */}
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <MessageSquarePlus className="h-5 w-5 text-blue-500" />
            </div>
            Скарга або пропозиція
          </CardTitle>
          <CardDescription className="mt-1">
            Маєте зауваження щодо роботи транспорту? Напишіть нам!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComplaintForm />
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

// --- Sub-components ---

function FineItem({ fine, card }: { fine: Fine, card: PassengerCard | null | undefined }) {
  const isPending = fine.status === 'Очікує сплати';
  const isPaid = fine.status === 'Сплачено' || fine.status === 'Оплачено' || fine.status === 'PAID';

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 relative overflow-hidden hover:shadow-md transition-shadow duration-200">
       {isPending && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-destructive to-destructive/70 rounded-l-xl"></div>}
       {isPaid && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-emerald-500/70 rounded-l-xl"></div>}

       <div className="flex justify-between items-start mb-3 pl-2">
          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">#{fine.id}</span>
          <Badge variant={isPending ? 'destructive' : isPaid ? 'secondary' : 'outline'} className="text-xs">
            {fine.status}
          </Badge>
       </div>

       <div className="pl-2 space-y-3">
          <div>
            <p className="text-2xl font-bold">{fine.amount} <span className="text-base font-normal text-muted-foreground">грн</span></p>
            <p className="text-sm text-muted-foreground mt-1">{fine.reason}</p>
          </div>

          <p className="text-xs text-muted-foreground/80">
             {new Date(fine.issuedAt).toLocaleString('uk-UA')}
          </p>

          {isPending && (
            <div className="flex gap-2 pt-2">
              <PayFineDialog fine={fine} card={card} />
              <AppealSheet fineId={fine.id} />
            </div>
          )}
       </div>
    </div>
  )
}

function PayFineDialog({ fine, card }: { fine: Fine, card: PassengerCard | null | undefined }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => payFine(fine.id, card!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-fines'] });
      queryClient.invalidateQueries({ queryKey: ['passenger-card'] }); // Update balance
      setOpen(false);
    },
  });

  const canPay = card && parseFloat(card.balance) >= parseFloat(fine.amount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1">Оплатити</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Оплата штрафу #{fine.id}</DialogTitle>
          <DialogDescription>
            Сума штрафу буде списана з вашої транспортної картки.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
           <div className="flex justify-between items-center p-3 bg-muted rounded-md">
              <span className="text-muted-foreground">Сума штрафу:</span>
              <span className="font-bold text-lg">{fine.amount} грн</span>
           </div>
           
           <div className="flex justify-between items-center p-3 border rounded-md">
              <span className="text-muted-foreground">Ваш баланс:</span>
              <span className={`font-bold text-lg ${canPay ? 'text-emerald-600' : 'text-destructive'}`}>
                 {card?.balance || 0} грн
              </span>
           </div>

           {!canPay && (
             <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertTriangle className="h-4 w-4" />
                <span>Недостатньо коштів на картці. Будь ласка, поповніть рахунок.</span>
             </div>
           )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Скасувати</Button>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={!canPay || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Підтвердити оплату
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppealSheet({ fineId }: { fineId: number }) {
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createAppeal(fineId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-fines'] })
      setOpen(false)
      setMessage('')
    },
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1">Оскаржити</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Оскарження штрафу #{fineId}</SheetTitle>
          <SheetDescription>
            Опишіть причину, чому ви вважаєте штраф помилковим.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6">
            <Label htmlFor="appeal-msg" className="mb-2 block">Повідомлення</Label>
            <Textarea 
              id="appeal-msg"
              placeholder="Я мав квиток, але..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px]"
            />
        </div>
        <SheetFooter>
          <Button 
            onClick={() => mutation.mutate()} 
            disabled={mutation.isPending || !message}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Надіслати скаргу
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function TopUpDialog({ card }: { card: PassengerCard }) {
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ cardNumber, value }: { cardNumber: string; value: number }) =>
      topUpCard(cardNumber, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-card'] })
      queryClient.invalidateQueries({ queryKey: ['passenger-top-ups'] })
      setAmount('')
      setOpen(false)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (val > 0) {
      mutation.mutate({ cardNumber: card.cardNumber, value: val })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">Поповнити картку</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
           <DialogTitle>Поповнення картки</DialogTitle>
           <DialogDescription>
             Введіть суму для поповнення балансу картки {card.cardNumber}
           </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
           <div className="space-y-2">
              <Label htmlFor="amount">Сума (грн)</Label>
              <Input 
                id="amount"
                type="number" 
                min="1" 
                step="1"
                placeholder="100" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
           </div>
           
           <DialogFooter>
             <Button type="submit" disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Поповнити
             </Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ComplaintForm() {
  const [type, setType] = useState<'complaint' | 'suggestion'>('complaint')
  const [message, setMessage] = useState('')
  const [routeNumber, setRouteNumber] = useState('')
  const [transportType, setTransportType] = useState('')

  const { data: transportTypes } = useQuery({
    queryKey: ['transportTypes'],
    queryFn: getTransportTypes,
  })

  const mutation = useMutation({
    mutationFn: () => createPassengerComplaint({
      type,
      message,
      routeNumber: routeNumber || undefined,
      transportType: transportType || undefined,
    }),
    onSuccess: () => {
      setMessage('')
      setRouteNumber('')
      setTransportType('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      mutation.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selection */}
      <div className="space-y-2">
        <Label>Тип звернення</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === 'complaint' ? 'default' : 'outline'}
            onClick={() => setType('complaint')}
            className="flex-1"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Скарга
          </Button>
          <Button
            type="button"
            variant={type === 'suggestion' ? 'default' : 'outline'}
            onClick={() => setType('suggestion')}
            className="flex-1"
          >
            <Lightbulb className="mr-2 h-4 w-4" />
            Пропозиція
          </Button>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="complaint-message">
          Текст звернення <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="complaint-message"
          placeholder={type === 'complaint'
            ? 'Опишіть вашу проблему детально...'
            : 'Поділіться вашою ідеєю...'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[120px]"
          required
        />
      </div>

      {/* Optional fields */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium text-muted-foreground">
          Додаткова інформація (опційно)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="transportType">Тип транспорту</Label>
            <Select value={transportType} onValueChange={setTransportType}>
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
      </div>

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
    </form>
  )
}