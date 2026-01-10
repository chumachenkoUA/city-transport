import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyCard, topUpCard, type PassengerCard } from '@/lib/passenger-api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/passenger/cards')({
  component: CardsPage,
})

function CardsPage() {
  const { data: card, isLoading, error } = useQuery({
    queryKey: ['passenger-card'],
    queryFn: getMyCard,
  })

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (error) return <div className="text-red-500 p-4">Помилка завантаження картки. Спробуйте увійти ще раз.</div>

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-center">Моя транспортна картка</h2>
      
      {!card ? (
         <Card className="text-center py-8">
            <CardHeader>
               <CardTitle>Картка відсутня</CardTitle>
               <CardDescription>У вас ще немає транспортної картки. Зверніться до оператора для отримання.</CardDescription>
            </CardHeader>
         </Card>
      ) : (
         <PassengerCardItem card={card} />
      )}
    </div>
  )
}

function PassengerCardItem({ card }: { card: PassengerCard }) {
  const [amount, setAmount] = useState('')
  const queryClient = useQueryClient()
  
  const mutation = useMutation({
    mutationFn: (val: number) => topUpCard(card.cardNumber, val),
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['passenger-card'] })
       setAmount('')
       // Optional: show toast
    },
    onError: () => {
        // Optional: show error
    }
  })

  const handleTopUp = () => {
    const val = parseFloat(amount)
    if (val > 0) {
       mutation.mutate(val)
    }
  }

  return (
    <Card className="shadow-lg">
       <CardHeader className="text-center border-b bg-muted/20">
          <CardTitle className="text-3xl font-mono tracking-wider">{card.cardNumber}</CardTitle>
          <CardDescription>Транспортна картка</CardDescription>
       </CardHeader>
       <CardContent className="pt-6 space-y-6">
          <div className="text-center">
             <div className="text-sm text-muted-foreground uppercase tracking-wide">Баланс</div>
             <div className="text-4xl font-bold text-primary">{card.balance} <span className="text-xl font-normal text-muted-foreground">грн</span></div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg space-y-4">
             <label className="text-sm font-medium block">Поповнити рахунок</label>
             <div className="flex gap-2">
                <Input 
                   type="number" 
                   placeholder="Сума (напр. 100)" 
                   value={amount} 
                   onChange={e => setAmount(e.target.value)}
                   className="text-lg"
                />
                <Button 
                   onClick={handleTopUp} 
                   disabled={mutation.isPending || !amount || parseFloat(amount) <= 0}
                   size="lg"
                >
                   {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Поповнити'}
                </Button>
             </div>
          </div>
       </CardContent>
       <CardFooter className="justify-center text-xs text-muted-foreground border-t pt-4">
          Останнє використання: {card.lastUsedAt ? new Date(card.lastUsedAt).toLocaleString() : 'Ніколи'}
       </CardFooter>
    </Card>
  )
}
