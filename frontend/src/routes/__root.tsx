import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Header } from '@/components/header'
import { ThemeProvider } from "@/components/theme-provider"


export const Route = createRootRoute({
  component: () => (
    <>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <Header />
            <Outlet />
            <TanStackRouterDevtools />
        </ThemeProvider>

    </>
  ),
})
