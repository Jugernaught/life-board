import type { ComponentType, ReactNode } from 'react'
import { useId } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

export interface TabDef<T extends string = string> {
  id: T
  label: ReactNode
  icon?: IconType
  count?: number
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: readonly TabDef<T>[]; value: T; onChange: (id: T) => void; className?: string }) {
  const group = useId()
  return (
    <div className={cn('no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <div role="tablist" className="flex min-w-max items-center gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = t.id === value
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={cn(
                'relative z-0 flex h-10 items-center gap-2 px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors',
                active ? 'text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {Icon && <Icon size={15} className={active ? 'text-accent' : ''} />}
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && <span className="rounded bg-ink/[0.07] px-1.5 py-px font-mono text-[10.5px] text-ink-muted">{t.count}</span>}
              {active && (
                <motion.span
                  layoutId={`tab-bg-${group}`}
                  className="absolute inset-x-0.5 inset-y-1.5 -z-10 rounded-[var(--tab-radius)] bg-[var(--tab-active-bg)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              {active && (
                <motion.span
                  layoutId={`tab-${group}`}
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent shadow-[var(--glow-sm)]"
                  style={{ opacity: 'var(--tab-underline)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Keep the active tab in the URL (?tab=…) so it survives refresh and can be linked to. */
export function useTabParam<T extends string>(tabs: readonly { id: T }[], fallback: T): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as T | null
  const value = raw && tabs.some((t) => t.id === raw) ? raw : fallback
  const set = (t: T) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (t === fallback) next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )
  }
  return [value, set]
}
