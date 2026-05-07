import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { InboxIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon | React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const iconNode =
    !icon
      ? <InboxIcon className="h-8 w-8 text-muted-foreground" />
      : typeof icon === 'function'
        ? React.createElement(icon as LucideIcon, { className: 'h-8 w-8 text-muted-foreground' })
        : icon

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 gap-3 text-center', className)}>
      <div className="rounded-full bg-muted p-4">
        {iconNode}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
