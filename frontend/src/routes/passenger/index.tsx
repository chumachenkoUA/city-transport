import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/passenger/')({
  component: PassengerDashboard,
})

function PassengerDashboard() {
  return (
    <div className="space-y-6">
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Транспортні картки</CardTitle>
            <CardDescription>Керування балансом та картками</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/passenger/cards">Перейти</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Історія поїздок</CardTitle>
            <CardDescription>Перегляд минулих поїздок</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild className="w-full" variant="outline">
              <Link to="/passenger/trips">Переглянути</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Штрафи</CardTitle>
            <CardDescription>Перевірка та оскарження штрафів</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild className="w-full" variant="outline">
              <Link to="/passenger/fines">Перевірити</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
         <Card>
            <CardHeader>
               <CardTitle>Планування маршруту</CardTitle>
               <CardDescription>Знайти оптимальний маршрут</CardDescription>
            </CardHeader>
            <CardContent>
               <Button asChild className="w-full" variant="secondary">
                  <Link to="/map">Відкрити карту</Link>
               </Button>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
