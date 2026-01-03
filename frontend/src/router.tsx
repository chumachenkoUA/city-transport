import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import App from './App'
import AccountantPage from './pages/AccountantPage'
import AdminPage from './pages/AdminPage'
import AuthPage from './pages/AuthPage'
import ControllerPage from './pages/ControllerPage'
import DispatcherPage from './pages/DispatcherPage'
import DriverPage from './pages/DriverPage'
import GuestPage from './pages/GuestPage'
import ManagerPage from './pages/ManagerPage'
import MunicipalityPage from './pages/MunicipalityPage'
import PassengerPage from './pages/PassengerPage'

const rootRoute = createRootRoute({
  component: App,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AuthPage,
})

const controllerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/controller',
  component: ControllerPage,
})

const guestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/guest',
  component: GuestPage,
})

const passengerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/passenger',
  component: PassengerPage,
})

const dispatcherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dispatcher',
  component: DispatcherPage,
})

const driverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/driver',
  component: DriverPage,
})

const accountantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accountant',
  component: AccountantPage,
})

const managerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manager',
  component: ManagerPage,
})

const municipalityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/municipality',
  component: MunicipalityPage,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
})

const routeTree = rootRoute.addChildren([
  authRoute,
  guestRoute,
  passengerRoute,
  controllerRoute,
  dispatcherRoute,
  driverRoute,
  accountantRoute,
  managerRoute,
  municipalityRoute,
  adminRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
