import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contacts')({
  component: ContactsPage,
})

function ContactsPage() {
  return (
    <div className="px-4 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">Контакти</h1>
        <p className="text-muted-foreground">Контактна інформація (в розробці)</p>
      </div>
    </div>
  )
}
