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
  CalendarDays
} from 'lucide-react'
import {
  getMyProfile,
  getMyCard,
  getMyTrips,
  getMyFines,
  payFine,
  topUpCard,
  createAppeal,
  type Fine,
  type PassengerCard,
  type PassengerProfile
} from '@/lib/passenger-api'
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

export const Route = createFileRoute('/passenger/')({
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
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile ? `Вітаємо, ${profile.fullName.split(' ')[0]}!` : 'Пасажирський кабінет'}
          </h1>
          <p className="text-muted-foreground">
            Керуйте своїми поїздками, карткою та штрафами в одному місці.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      {profile && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{profile.fullName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{profile.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
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
        <Card className="col-span-full lg:col-span-2 overflow-hidden relative border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <CreditCard className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Транспортна картка
            </CardTitle>
            <CardDescription>
              Інформація про баланс та поповнення
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!card ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">У вас немає активної картки</p>
                <Button variant="outline">Отримати картку</Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Номер картки</p>
                  <p className="text-2xl font-mono font-bold tracking-wider">{card.cardNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Баланс</p>
                  <p className="text-4xl font-bold text-primary">{card.balance} <span className="text-lg font-normal text-muted-foreground">грн</span></p>
                </div>
                <div className="w-full sm:w-auto">
                   <TopUpDialog card={card} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card (Example) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <History className="h-5 w-5 text-blue-500" />
               Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Всього поїздок</span>
                <span className="font-bold text-lg">{trips?.length || 0}</span>
             </div>
             <Separator />
             <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Активних штрафів</span>
                <span className="font-bold text-lg text-destructive">
                  {fines?.filter(f => f.status === 'Очікує сплати').length || 0}
                </span>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Trips and Fines */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trips History - Takes up 2 columns */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-emerald-500" />
              Історія поїздок
            </CardTitle>
            <CardDescription>
              Останні ваші поїздки громадським транспортом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Маршрут</TableHead>
                    <TableHead>Транспорт</TableHead>
                    <TableHead className="text-right">Вартість</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                        Історія поїздок порожня
                      </TableCell>
                    </TableRow>
                  ) : (
                    trips?.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell className="font-medium">
                          {new Date(trip.startedAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{trip.routeNumber}</Badge>
                        </TableCell>
                        <TableCell>{trip.transportType}</TableCell>
                        <TableCell className="text-right font-medium">-{trip.cost} грн</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Fines Section - Takes up 1 column */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Штрафи
            </CardTitle>
            <CardDescription>
              Статус ваших штрафів та оплата
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fines?.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-lg">
                 <CheckCircle2 className="h-8 w-8 mb-2 text-emerald-500" />
                 <p>У вас немає штрафів</p>
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
    </div>
  )
}

// --- Sub-components ---

function FineItem({ fine, card }: { fine: Fine, card: PassengerCard | null | undefined }) {
  const isPending = fine.status === 'Очікує сплати';
  const isPaid = fine.status === 'Сплачено' || fine.status === 'Оплачено' || fine.status === 'PAID';

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 relative overflow-hidden">
       {isPending && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive"></div>}
       {isPaid && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>}
       
       <div className="flex justify-between items-start mb-2 pl-2">
          <span className="font-mono text-xs text-muted-foreground">#{fine.id}</span>
          <Badge variant={isPending ? 'destructive' : isPaid ? 'secondary' : 'outline'}>
            {fine.status}
          </Badge>
       </div>
       
       <div className="pl-2 space-y-3">
          <div>
            <p className="text-2xl font-bold">{fine.amount} грн</p>
            <p className="text-sm text-muted-foreground">{fine.reason}</p>
          </div>
          
          <p className="text-xs text-muted-foreground">
             {new Date(fine.issuedAt).toLocaleString('uk-UA')}
          </p>

          <div className="flex gap-2 pt-2">
            {isPending && (
              <>
                <PayFineDialog fine={fine} card={card} />
                <AppealSheet fineId={fine.id} />
              </>
            )}
          </div>
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