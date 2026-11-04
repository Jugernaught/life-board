/**
 * Shared chart building blocks so every chart in LIFE OS reads the same:
 * a validated colour-blind-safe series palette, recessive grid and axes,
 * an HTML legend, a branded tooltip, and a table view for every chart.
 */
import { type ReactNode, useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/display'
import { IconButton } from '@/components/ui/Button'

/** Series colours in fixed order (never cycled by rank). */
export const SERIES = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)']
export const series = (i: number) => SERIES[Math.min(i, SERIES.length - 1)]

export const axisProps = {
  stroke: 'var(--color-line-strong)',
  tick: { fill: 'var(--color-ink-subtle)', fontSize: 11, fontFamily: 'var(--font-mono)' },
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = { stroke: 'var(--color-line)', strokeDasharray: '3 4', vertical: false } as const

interface TooltipRow {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: unknown
  payload?: Record<string, unknown>
}

/** Tooltip content renderer. Values use ink colours; the swatch carries identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (v) => String(v),
  formatLabel = (l) => String(l),
}: {
  active?: boolean
  payload?: readonly TooltipRow[]
  label?: unknown
  formatValue?: (v: number, name: string) => string
  formatLabel?: (label: unknown, payload?: Record<string, unknown>) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="float min-w-36 rounded-[var(--radius-control)] px-3 py-2 text-[12px]">
      <p className="mb-1.5 font-mono text-[11px] text-ink-subtle">{formatLabel(label, payload[0]?.payload)}</p>
      <div className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span className="size-2 rounded-sm" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="font-mono text-ink tabular">{formatValue(Number(p.value), String(p.name))}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)} aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value && <span className="font-mono text-ink tabular">{i.value}</span>}
        </li>
      ))}
    </ul>
  )
}

export interface TableColumn<T> {
  label: string
  value: (row: T) => ReactNode
  align?: 'left' | 'right'
}

/**
 * A chart panel with title, optional legend, empty state and a chart/table
 * toggle — the table view shows the exact numbers behind the chart.
 */
export function ChartCard<T>({
  title,
  description,
  legend,
  rows,
  columns,
  empty,
  emptyHint,
  height = 240,
  children,
  className,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  legend?: { label: string; color: string; value?: string }[]
  rows: T[]
  columns: TableColumn<T>[]
  empty?: boolean
  emptyHint?: ReactNode
  height?: number
  children: ReactNode
  className?: string
  actions?: ReactNode
}) {
  const [table, setTable] = useState(false)
  return (
    <section className={cn('panel flex min-w-0 flex-col p-4', className)}>
      <header className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[14.5px] font-semibold tracking-wide text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] text-ink-subtle">{description}</p>}
        </div>
        {actions}
        {!empty && <IconButton icon={table ? BarChart3 : Table2} label={table ? 'Show chart' : 'Show data table'} size="xs" onClick={() => setTable((t) => !t)} aria-pressed={table} />}
      </header>
      {legend && legend.length > 1 && !empty && !table && <Legend items={legend} className="mb-3" />}
      {empty ? (
        <div style={{ minHeight: height }} className="flex items-center justify-center">
          <EmptyState compact title="No data yet" description={emptyHint ?? 'This chart fills in from what you record.'} />
        </div>
      ) : table ? (
        <div className="overflow-auto" style={{ maxHeight: height + 40 }}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-ink-subtle">
                {columns.map((c) => (
                  <th key={c.label} className={cn('py-1.5 pr-3 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60">
                  {columns.map((c) => (
                    <td key={c.label} className={cn('py-1.5 pr-3 text-ink-muted', c.align === 'right' && 'text-right font-mono tabular')}>
                      {c.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} className="min-w-0">
          {children}
        </div>
      )}
    </section>
  )
}
