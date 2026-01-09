import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/schedule')({
  component: SchedulePage,
})

function SchedulePage() {
  return (
    <div className="px-4 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">Розклад</h1>
        <p className="text-muted-foreground">Розклад руху транспорту (в розробці)</p>
      </div>
    </div>
  )
}
