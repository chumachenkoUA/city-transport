import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyFines, createAppeal, type Fine } from '@/lib/passenger-api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/passenger/fines')({
  component: FinesPage,
})

function FinesPage() {
  const { data: fines, isLoading, error } = useQuery({
    queryKey: ['passenger-fines'],
    queryFn: getMyFines,
  })

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (error) return <div className="text-red-500 p-4">Помилка завантаження штрафів.</div>

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Мої штрафи</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {fines?.map(fine => (
          <FineItem key={fine.id} fine={fine} />
        ))}
        {fines?.length === 0 && (
           <p className="text-muted-foreground col-span-full">Штрафів не знайдено.</p>
        )}
      </div>
    </div>
  )
}

function FineItem({ fine }: { fine: Fine }) {
  const statusColors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    PENDING: "destructive",
    PAID: "secondary",
    APPEALED: "outline",
    CANCELLED: "outline",
  }

  const statusLabels: Record<string, string> = {
    PENDING: "Очікує сплати",
    PAID: "Сплачено",
    APPEALED: "Оскаржується",
    CANCELLED: "Анульовано",
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle>Штраф #{fine.id}</CardTitle>
          <Badge variant={statusColors[fine.status] || "default"}>
            {statusLabels[fine.status] || fine.status}
          </Badge>
        </div>
        <CardDescription>{new Date(fine.issuedAt).toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-lg font-bold">{fine.amount} грн</p>
          <p className="text-sm text-muted-foreground">{fine.reason}</p>
        </div>
      </CardContent>
      <CardFooter>
        {fine.status === 'PENDING' && (
          <AppealSheet fineId={fine.id} />
        )}
      </CardFooter>
    </Card>
  )
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
      alert('Скаргу надіслано')
    },
    onError: () => alert('Помилка надсилання скарги')
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">Оскаржити</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Оскарження штрафу #{fineId}</SheetTitle>
          <SheetDescription>
            Будь ласка, опишіть причину оскарження.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
            <Textarea 
            placeholder="Текст скарги..." 
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
            Надіслати
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
