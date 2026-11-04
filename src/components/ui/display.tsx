import type { ComponentType, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { Tone } from '@/data/constants'
import { toneColor, toneTint } from '@/lib/tone'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number; style?: React.CSSProperties }>

export function Badge({ tone = 'muted', children, dot, className, title }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 truncate rounded-md border px-2 text-[11.5px] leading-none font-medium whitespace-nowrap', className)}
      style={{ color: toneColor(tone), background: toneTint(tone, 12), borderColor: toneTint(tone, 26) }}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneColor(tone), boxShadow: `0 0 6px ${toneColor(tone)}` }} />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function ProgressBar({
  value,
  tone,
  size = 'md',
  className,
  label,
  showValue,
  max = 100,
}: {
  value: number | null | undefined
  tone?: Tone
  size?: 'xs' | 'sm' | 'md'
  className?: string
  label?: string
  showValue?: boolean
  max?: number
}) {
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  const h = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2'
  const fill = tone ? toneColor(tone) : 'linear-gradient(90deg, var(--color-accent), var(--color-accent-2))'
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn('relative flex-1 overflow-hidden rounded-full bg-ink/[0.07]', h)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null || value === undefined ? undefined : Math.round(pct)}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: fill, boxShadow: pct > 0 ? `0 0 10px -1px ${tone ? toneColor(tone) : 'var(--color-accent)'}` : undefined }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
      {showValue && <span className="w-10 shrink-0 text-right font-mono text-[11.5px] text-ink-muted tabular">{value === null || value === undefined ? '—' : `${Math.round(pct)}%`}</span>}
    </div>
  )
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  tone,
  children,
  label,
}: {
  value: number | null
  size?: number
  stroke?: number
  tone?: Tone
  children?: ReactNode
  label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value))
  const color = tone ? toneColor(tone) : 'var(--color-accent)'
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? (value === null ? 'No data' : `${Math.round(pct)}%`)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink/[0.08]" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          style={{ filter: pct > 0 ? `drop-shadow(0 0 4px ${color})` : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children ?? <span className="font-mono text-[11px] text-ink tabular">{value === null ? '—' : `${Math.round(pct)}%`}</span>}</div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: IconType
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12', className)}>
      {Icon && (
        <div className={cn('relative flex items-center justify-center rounded-xl border border-line bg-panel-2/70 text-accent', compact ? 'size-10' : 'size-14')}>
          <div className="absolute inset-0 rounded-xl bg-accent/5 blur-md" />
          <Icon size={compact ? 18 : 24} strokeWidth={1.6} className="relative" />
        </div>
      )}
      <div className="max-w-sm">
        <p className={cn('font-medium text-ink', compact ? 'text-[13.5px]' : 'text-[15px]')}>{title}</p>
        {description && <p className={cn('mt-1 text-ink-subtle', compact ? 'text-[12.5px]' : 'text-[13.5px]')}>{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-panel-3/80 px-1 font-mono text-[10.5px] text-ink-muted', className)}>
      {children}
    </kbd>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink/[0.06]', className)} />
}

export function Delta({ current, previous, format = (n) => String(Math.round(n)), invert, className }: { current: number; previous: number; format?: (n: number) => string; invert?: boolean; className?: string }) {
  const diff = current - previous
  if (current === 0 && previous === 0)
    return (
      <span className={cn('font-mono text-[11px] text-ink-subtle/70', className)} title="Nothing recorded in either period">
        —
      </span>
    )
  const up = diff > 0
  const good = invert ? !up : up
  const Icon = diff === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight
  const pct = previous !== 0 ? Math.round((diff / Math.abs(previous)) * 100) : null
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-mono text-[11px] tabular', className)}
      style={{ color: diff === 0 ? 'var(--color-ink-subtle)' : good ? 'var(--color-ok)' : 'var(--color-bad)' }}
      title={`Previous period: ${format(previous)}`}
    >
      <Icon size={12} />
      {diff === 0 ? 'same' : `${up ? '+' : '−'}${format(Math.abs(diff))}${pct !== null ? ` (${up ? '+' : '−'}${Math.abs(pct)}%)` : ''}`}
    </span>
  )
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'cyan',
  className,
  children,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: IconType
  tone?: Tone
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('panel min-w-0 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        {Icon && <Icon size={15} className="shrink-0" style={{ color: toneColor(tone) }} />}
      </div>
      <p className="mt-2 truncate font-display text-[26px] leading-none font-semibold tracking-tight text-ink tabular">{value}</p>
      {sub && <div className="mt-1.5 truncate text-[12px] text-ink-subtle">{sub}</div>}
      {children}
    </div>
  )
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: toneColor(tone), boxShadow: `0 0 6px ${toneColor(tone)}` }} />
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent', className)} aria-label="Loading" />
}
