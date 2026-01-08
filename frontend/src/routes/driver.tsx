import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/driver')({
  component: DriverPage,
})

function DriverPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-6">Driver Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>My Routes</CardTitle>
            <CardDescription>View your assigned routes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No routes assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Today's schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No scheduled trips</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
