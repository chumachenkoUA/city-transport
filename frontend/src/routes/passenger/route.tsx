import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/passenger')({
  component: PassengerLayout,
})

function PassengerLayout() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight">Кабінет Пасажира</h1>
          <nav className="flex space-x-4">
            <Link
              to="/passenger"
              className="text-sm font-medium transition-colors hover:text-primary data-[status=active]:text-primary"
              activeOptions={{ exact: true }}
            >
              Головна
            </Link>
            <Link
              to="/passenger/cards"
              className="text-sm font-medium transition-colors hover:text-primary data-[status=active]:text-primary"
            >
              Картки
            </Link>
            <Link
              to="/passenger/trips"
              className="text-sm font-medium transition-colors hover:text-primary data-[status=active]:text-primary"
            >
              Історія
            </Link>
            <Link
              to="/passenger/fines"
              className="text-sm font-medium transition-colors hover:text-primary data-[status=active]:text-primary"
            >
              Штрафи
            </Link>
          </nav>
        </div>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
