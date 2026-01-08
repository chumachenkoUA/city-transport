import { createFileRoute } from '@tanstack/react-router'
import { ComponentExample } from '@/components/component-example'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-4">City Transport</h1>
      <ComponentExample />
      <Button>Click Me</Button>
    </div>
  )
}
