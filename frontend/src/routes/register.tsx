import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Реєстрація</h1>
        <p className="text-center text-muted-foreground">Сторінка реєстрації (в розробці)</p>
      </div>
    </div>
  )
}
