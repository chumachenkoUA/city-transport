import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/routes')({
  component: RoutesPage,
})

function RoutesPage() {
  return (
    <div className="px-4 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">Маршрути</h1>
        <p className="text-muted-foreground">Список маршрутів міського транспорту (в розробці)</p>
      </div>
    </div>
  )
}
