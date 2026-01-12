import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Toaster } from '@/components/ui/sonner'
import { Header } from '@/components/header'
import { ThemeProvider } from '@/components/theme-provider'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Toaster position="bottom-right" richColors closeButton />
      </div>
      <TanStackRouterDevtools position="bottom-left" />
    </ThemeProvider>
  )
}
