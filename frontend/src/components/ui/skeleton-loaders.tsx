'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Base shimmer skeleton with animation
function Shimmer({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[shimmer_1.5s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
      {...props}
    />
  )
}

// Card skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="space-y-2">
        <Shimmer className="h-5 w-1/3" />
        <Shimmer className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
        <Shimmer className="h-4 w-4/6" />
      </CardContent>
    </Card>
  )
}

// Table skeleton
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-md border">
      {/* Header */}
      <div className="flex border-b bg-muted/50 p-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex border-b last:border-0 p-4 gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Shimmer
              key={colIndex}
              className="h-4 flex-1"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Stats card skeleton (for dashboard)
export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Shimmer className="h-8 w-24 mb-1" />
        <Shimmer className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-around h-[200px] gap-2 pt-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Shimmer
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// List item skeleton
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b last:border-0">
      <Shimmer className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-4 w-1/3" />
        <Shimmer className="h-3 w-2/3" />
      </div>
      <Shimmer className="h-8 w-20 rounded-md" />
    </div>
  )
}

// List skeleton
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="rounded-md border">
      {Array.from({ length: items }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  )
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Shimmer className="h-10 w-full rounded-md" />
    </div>
  )
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Shimmer className="h-16 w-16 rounded-full" />
      <div className="space-y-2">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-4 w-48" />
        <Shimmer className="h-3 w-24" />
      </div>
    </div>
  )
}

// Dashboard skeleton (combines multiple)
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton rows={5} cols={4} />
    </div>
  )
}

// Page header skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Shimmer className="h-8 w-48" />
      <Shimmer className="h-4 w-72" />
    </div>
  )
}

// Tabs skeleton
export function TabsSkeleton({ tabs = 4 }: { tabs?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-2">
        {Array.from({ length: tabs }).map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <CardSkeleton />
    </div>
  )
}

// Map skeleton
export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative rounded-lg overflow-hidden bg-muted', className)}>
      <Shimmer className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Завантаження карти...</div>
      </div>
    </div>
  )
}

export { Shimmer }
