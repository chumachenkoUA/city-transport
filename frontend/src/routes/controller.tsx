import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  checkControllerCard,
  issueControllerFine,
  type ControllerCardDetails,
} from '@/lib/controller-api'

export const Route = createFileRoute('/controller')({
  component: ControllerPage,
})

type FineFormState = {
  cardNumber: string
  fleetNumber: string
  routeNumber: string
  checkedAt: string
  amount: string
  reason: string
}

function ControllerPage() {
  const [cardNumber, setCardNumber] = useState('')
  const [cardDetails, setCardDetails] = useState<ControllerCardDetails | null>(null)
  const [fineForm, setFineForm] = useState<FineFormState>({
    cardNumber: '',
    fleetNumber: '',
    routeNumber: '',
    checkedAt: '',
    amount: '',
    reason: '',
  })
  const [fineResult, setFineResult] = useState<number | null>(null)

  const checkMutation = useMutation({
    mutationFn: (value: string) => checkControllerCard(value),
    onSuccess: (data) => {
      setCardDetails(data)
      setFineForm((prev) =>
        prev.cardNumber ? prev : { ...prev, cardNumber: data.cardNumber }
      )
    },
  })

  const fineMutation = useMutation({
    mutationFn: issueControllerFine,
    onSuccess: (data) => {
      setFineResult(data.fineId)
      setFineForm((prev) => ({
        ...prev,
        amount: '',
        reason: '',
        fleetNumber: '',
        routeNumber: '',
        checkedAt: '',
      }))
    },
  })

  const formattedBalance = useMemo(() => {
    if (!cardDetails) return '—'
    const balance = Number(cardDetails.balance)
    if (Number.isNaN(balance)) return cardDetails.balance
    return `${balance.toFixed(2)} ₴`
  }, [cardDetails])

  const handleCheckCard = () => {
    const trimmed = cardNumber.trim()
    if (!trimmed) return
    setFineResult(null)
    checkMutation.mutate(trimmed)
  }

  const handleIssueFine = () => {
    if (!fineForm.cardNumber || !fineForm.amount || !fineForm.reason) return
    setFineResult(null)
    fineMutation.mutate({
      cardNumber: fineForm.cardNumber.trim(),
      fleetNumber: fineForm.fleetNumber.trim() || undefined,
      routeNumber: fineForm.routeNumber.trim() || undefined,
      checkedAt: fineForm.checkedAt ? new Date(fineForm.checkedAt).toISOString() : undefined,
      amount: Number(fineForm.amount),
      reason: fineForm.reason.trim(),
      status: 'Очікує сплати',
    })
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Панель контролера</h1>
          <p className="text-muted-foreground">
            Перевірка транспортних карток та реєстрація штрафів.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Перевірка транспортної картки</CardTitle>
              <CardDescription>Остання поїздка та статус картки</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">Номер картки</Label>
                <div className="flex gap-2">
                  <Input
                    id="card-number"
                    placeholder="CARD-0001"
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                  />
                  <Button onClick={handleCheckCard} disabled={checkMutation.isPending}>
                    {checkMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Перевірити
                  </Button>
                </div>
              </div>

              {checkMutation.error && (
                <p className="text-sm text-red-500">Не вдалося перевірити картку.</p>
              )}

              {cardDetails && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">ID {cardDetails.id}</Badge>
                    <Badge variant="outline">{cardDetails.cardNumber}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Баланс:</span> {formattedBalance}
                  </div>
                  <div>
                    <span className="font-medium">Остання поїздка:</span>{' '}
                    {formatDateTime(cardDetails.lastUsageAt)}
                  </div>
                  <div>
                    <span className="font-medium">Маршрут:</span>{' '}
                    {cardDetails.lastRouteNumber ?? '—'}
                  </div>
                  <div>
                    <span className="font-medium">Тип транспорту:</span>{' '}
                    {cardDetails.lastTransportType ?? '—'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Реєстрація штрафу</CardTitle>
              <CardDescription>Створення запису про порушення</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fine-card">Номер картки</Label>
                  <Input
                    id="fine-card"
                    value={fineForm.cardNumber}
                    onChange={(event) =>
                      setFineForm((prev) => ({ ...prev, cardNumber: event.target.value }))
                    }
                    placeholder="CARD-0001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fine-amount">Сума штрафу</Label>
                  <Input
                    id="fine-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={fineForm.amount}
                    onChange={(event) =>
                      setFineForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fine-fleet">Номер транспорту</Label>
                  <Input
                    id="fine-fleet"
                    value={fineForm.fleetNumber}
                    onChange={(event) =>
                      setFineForm((prev) => ({ ...prev, fleetNumber: event.target.value }))
                    }
                    placeholder="1001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fine-route">Номер маршруту</Label>
                  <Input
                    id="fine-route"
                    value={fineForm.routeNumber}
                    onChange={(event) =>
                      setFineForm((prev) => ({ ...prev, routeNumber: event.target.value }))
                    }
                    placeholder="12А"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fine-time">Час перевірки</Label>
                  <Input
                    id="fine-time"
                    type="datetime-local"
                    value={fineForm.checkedAt}
                    onChange={(event) =>
                      setFineForm((prev) => ({ ...prev, checkedAt: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fine-reason">Причина</Label>
                <Textarea
                  id="fine-reason"
                  value={fineForm.reason}
                  onChange={(event) =>
                    setFineForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  placeholder="Опишіть порушення"
                />
              </div>

              {fineMutation.error && (
                <p className="text-sm text-red-500">Не вдалося створити штраф.</p>
              )}

              {fineResult && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Штраф створено. ID: {fineResult}
                </div>
              )}

              <Button onClick={handleIssueFine} disabled={fineMutation.isPending}>
                {fineMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Зареєструвати
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
