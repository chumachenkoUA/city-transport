'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  FileX,
  Search,
  FolderOpen,
  Users,
  Bus,
  Map,
  Calendar,
  Receipt,
  AlertCircle,
  Inbox,
  type LucideIcon,
} from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  variant?: 'default' | 'compact'
}

const iconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 15,
    },
  },
}

const contentVariants = {
  initial: { y: 10, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      delay: 0.1,
      duration: 0.3,
    },
  },
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact'

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      <motion.div
        variants={iconVariants}
        className={cn(
          'rounded-full bg-muted flex items-center justify-center mb-4',
          isCompact ? 'h-12 w-12' : 'h-16 w-16'
        )}
      >
        <Icon className={cn('text-muted-foreground', isCompact ? 'h-6 w-6' : 'h-8 w-8')} />
      </motion.div>
      <motion.div variants={contentVariants} className="space-y-2">
        <h3
          className={cn(
            'font-semibold text-foreground',
            isCompact ? 'text-base' : 'text-lg'
          )}
        >
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              'text-muted-foreground max-w-sm',
              isCompact ? 'text-sm' : 'text-base'
            )}
          >
            {description}
          </p>
        )}
        {action && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pt-4"
          >
            <Button onClick={action.onClick} size={isCompact ? 'sm' : 'default'}>
              {action.label}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

// Pre-configured empty states for common scenarios
export function NoDataFound({
  title = 'Дані не знайдено',
  description = 'Спробуйте змінити параметри пошуку або фільтри',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={FileX} title={title} description={description} {...props} />
}

export function NoSearchResults({
  title = 'Нічого не знайдено',
  description = 'Спробуйте інший пошуковий запит',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Search} title={title} description={description} {...props} />
}

export function EmptyFolder({
  title = 'Папка порожня',
  description = 'Тут поки немає жодних файлів',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={FolderOpen} title={title} description={description} {...props} />
}

export function NoUsers({
  title = 'Користувачів не знайдено',
  description = 'Додайте першого користувача',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Users} title={title} description={description} {...props} />
}

export function NoVehicles({
  title = 'Транспорт відсутній',
  description = 'Додайте транспортний засіб',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Bus} title={title} description={description} {...props} />
}

export function NoRoutes({
  title = 'Маршрути відсутні',
  description = 'Створіть новий маршрут',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Map} title={title} description={description} {...props} />
}

export function NoSchedules({
  title = 'Розклад відсутній',
  description = 'Створіть новий розклад',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Calendar} title={title} description={description} {...props} />
}

export function NoTransactions({
  title = 'Транзакції відсутні',
  description = 'Тут будуть відображатися ваші транзакції',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={Receipt} title={title} description={description} {...props} />
}

export function ErrorState({
  title = 'Щось пішло не так',
  description = 'Спробуйте оновити сторінку',
  ...props
}: Partial<EmptyStateProps>) {
  return <EmptyState icon={AlertCircle} title={title} description={description} {...props} />
}
