import { createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createPassengerComplaint } from '@/lib/passenger-api'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/contacts')({
  component: ContactsPage,
})

function ContactsPage() {
  const [description, setDescription] = useState('')
  // Optional fields
  const [routeId, setRouteId] = useState('')
  const [stopId, setStopId] = useState('')

  const mutation = useMutation({
    mutationFn: () => createPassengerComplaint({
      description,
      routeId: routeId ? Number(routeId) : undefined,
      stopId: stopId ? Number(stopId) : undefined,
    }),
    onSuccess: () => {
      setDescription('')
      setRouteId('')
      setStopId('')
      alert('Ваше звернення надіслано!')
    },
    onError: (err: any) => {
        // Simple error handling
        if (err?.status === 401 || err?.status === 403) {
            alert('Будь ласка, увійдіть як пасажир, щоб подати скаргу.')
        } else {
            alert('Помилка надсилання звернення.')
        }
    }
  })

  return (
    <div className="px-4 py-12 lg:px-8 container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Контакти та Підтримка</h1>
      
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="text-xl font-semibold mb-4">Наші контакти</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Ми завжди раді допомогти вам. Зв'яжіться з нами будь-яким зручним способом.</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Телефон:</span> 0-800-500-000
              </li>
              <li className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Email:</span> support@citytransport.com
              </li>
              <li className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Адреса:</span> м. Київ, вул. Хрещатик, 1
              </li>
            </ul>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Надіслати звернення</CardTitle>
            <CardDescription>
              Є скарга чи пропозиція? Напишіть нам.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
               <label className="text-sm font-medium">Текст звернення</label>
               <Textarea 
                 placeholder="Опишіть вашу ситуацію..." 
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="min-h-[120px]"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium">ID Маршруту (опційно)</label>
                 <Input 
                   type="number"
                   placeholder="Напр. 101"
                   value={routeId}
                   onChange={(e) => setRouteId(e.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">ID Зупинки (опційно)</label>
                 <Input 
                   type="number"
                   placeholder="Напр. 55"
                   value={stopId}
                   onChange={(e) => setStopId(e.target.value)}
                 />
               </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={() => mutation.mutate()}
              disabled={!description || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Надіслати
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}