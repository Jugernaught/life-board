import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Tone } from '@/data/constants'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'

/** A grid of compact statistic tiles (2 per row on iPhone). */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-4 mb-7 grid grid-cols-2 gap-2.5', className)}>{children}</div>
}

export function StatTile({ label, value, sub, tone, current, previous, invert, format = (n) => n.toLocaleString(), onClick, testId }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  /** With `previous`, shows the change since the previous period. */
  current?: number
  previous?: number
  /** A rise is bad (e.g. spending). */
  invert?: boolean
  /** Formats the size of the change (minutes, money…). */
  format?: (n: number) => string
  onClick?: () => void
  testId?: string
}) {
  const showDelta = typeof current === 'number' && typeof previous === 'number' && !(current === 0 && previous === 0) && current !== previous
  const up = (current ?? 0) > (previous ?? 0)
  const good = invert ? !up : up
  const body = (
    <>
      <span className="ios-footnote block font-medium" style={{ color: tone ? toneColor(tone) : 'var(--color-ink-subtle)' }}>
        {label}
      </span>
      <span className="ios-title2 mt-1 block truncate text-ink tabular-nums">{value}</span>
      <span className="ios-caption mt-0.5 flex min-h-4 items-center gap-1 truncate text-ink-subtle">
        {showDelta && (
          <span className="inline-flex items-center" style={{ color: good ? 'var(--color-ok)' : 'var(--color-bad)' }} aria-label={`${up ? 'up' : 'down'} ${format(Math.abs((current ?? 0) - (previous ?? 0)))} on the previous period`} role="img">
            {up ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}
            {format(Math.abs((current ?? 0) - (previous ?? 0)))}
          </span>
        )}
        {showDelta && sub ? <span aria-hidden>·</span> : null}
        {sub}
      </span>
    </>
  )
  const cls = 'block w-full rounded-[12px] bg-[var(--ios-cell)] px-3.5 py-3 text-left'
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'ios-press')} data-testid={testId}>
      {body}
    </button>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  )
}

/**
 * Thin progress line for list rows. Decorative by default (rows show the
 * number as text); pass `label` when the line is the only place it appears.
 */
export function ProgressLine({ value, tone, className, label }: { value: number | null; tone?: Tone; className?: string; label?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value))
  const a11y = label ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value === null ? undefined : Math.round(pct) } : { 'aria-hidden': true }
  return (
    <span className={cn('block h-1 overflow-hidden rounded-full bg-[var(--ios-fill)]', className)} {...a11y}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: tone ? toneColor(tone) : 'var(--color-accent)' }} />
    </span>
  )
}
