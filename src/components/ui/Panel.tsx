import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

export interface PanelProps {
  title?: ReactNode
  eyebrow?: ReactNode
  icon?: IconType
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  hud?: boolean
  padded?: boolean
  id?: string
}

/** The standard glass card with an optional header row. */
export function Panel({ title, eyebrow, icon: Icon, actions, children, className, bodyClassName, hud, padded = true, id }: PanelProps) {
  return (
    <section id={id} className={cn('panel flex min-w-0 flex-col', hud && 'hud', className)}>
      {(title || actions || eyebrow) && (
        <header className="flex min-h-12 items-center gap-2.5 px-4 pt-3.5 pb-2">
          {Icon && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius-control)-2px)] bg-accent/12 text-accent">
              <Icon size={14} strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
            {title && <h2 className="title truncate text-[14.5px] font-semibold text-ink">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', padded && 'px-4 pb-4', !title && !actions && padded && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  )
}
