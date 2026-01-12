import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/passenger')({
  component: PassengerLayout,
})

function PassengerLayout() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Outlet />
    </div>
  )
}