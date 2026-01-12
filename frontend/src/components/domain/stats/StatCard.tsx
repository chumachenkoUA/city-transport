import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

const variants = {
  default: 'border-border',
  success: 'border-success/30 bg-success/5 dark:bg-success/10',
  warning: 'border-warning/30 bg-warning/5 dark:bg-warning/10',
  error: 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10',
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const getTrendVariant = () => {
    if (!trend) return 'secondary'
    if (trend.direction === 'up') return 'success'
    if (trend.direction === 'down') return 'destructive'
    return 'secondary'
  }

  return (
    <Card className={cn('relative overflow-hidden transition-all duration-200', variants[variant], className)}>
      {Icon && (
        <div className="absolute top-3 right-3 opacity-10 pointer-events-none">
          <Icon className="w-16 h-16" />
        </div>
      )}
      <CardContent className="pt-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-2 pt-1">
              <Badge variant={getTrendVariant()} className="text-xs">
                {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}%
              </Badge>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
