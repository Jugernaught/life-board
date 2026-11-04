import { addDaysISO, eachDay, formatDate, weekStartISO, weekday } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Calendar heatmap (weeks as columns, weekdays as rows). Single-hue scale:
 * more saturated = more activity. Cells can be clickable (e.g. to back-fill
 * a habit) and every cell has a text label for screen readers.
 */
export function Heatmap({
  end,
  weeks = 20,
  weekStartsOn = 1,
  value,
  max = 1,
  onToggle,
  color = 'var(--color-accent)',
  label,
  isActive,
  cell = 12,
}: {
  end: string
  weeks?: number
  weekStartsOn?: 0 | 1
  value: (date: string) => number
  max?: number
  onToggle?: (date: string) => void
  color?: string
  label: (date: string, v: number) => string
  /** Days that count (e.g. scheduled days); others render dimmed. */
  isActive?: (date: string) => boolean
  cell?: number
}) {
  const lastWeek = weekStartISO(end, weekStartsOn)
  const first = addDaysISO(lastWeek, -7 * (weeks - 1))
  const days = eachDay(first, addDaysISO(lastWeek, 6))
  const cols: string[][] = []
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7))
  const rowLabels = weekStartsOn === 1 ? ['M', '', 'W', '', 'F', '', 'S'] : ['S', '', 'T', '', 'T', '', 'S']
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="grid" aria-label="Activity calendar">
      <div className="flex shrink-0 flex-col gap-[3px] pt-4" aria-hidden>
        {rowLabels.map((l, i) => (
          <span key={i} className="font-mono text-[9px] leading-none text-ink-subtle" style={{ height: cell }}>
            {l}
          </span>
        ))}
      </div>
      {cols.map((col) => (
        <div key={col[0]} className="flex shrink-0 flex-col gap-[3px]" role="row">
          <span className="h-3.5 font-mono text-[9px] leading-none text-ink-subtle" aria-hidden>
            {Number(col[0].slice(8)) <= 7 ? formatDate(col[0], 'MMM') : ''}
          </span>
          {col.map((d) => {
            const future = d > end
            const v = future ? 0 : value(d)
            const intensity = max > 0 ? Math.min(1, v / max) : 0
            const active = isActive ? isActive(d) : true
            const style = {
              width: cell,
              height: cell,
              background: v > 0 ? `color-mix(in oklab, ${color} ${Math.round(30 + intensity * 70)}%, transparent)` : undefined,
              boxShadow: v > 0 && intensity >= 1 ? `0 0 6px -1px ${color}` : undefined,
            }
            const cls = cn('rounded-[3px] transition-transform', v === 0 && (active ? 'bg-ink/[0.07]' : 'bg-ink/[0.025]'), future && 'opacity-0', onToggle && !future && 'cursor-pointer hover:scale-125 hover:ring-1 hover:ring-accent/60')
            const text = label(d, v)
            return onToggle && !future ? (
              <button key={d} type="button" role="gridcell" aria-label={text} title={text} className={cls} style={style} onClick={() => onToggle(d)} data-date={d} data-weekday={weekday(d)} />
            ) : (
              <span key={d} role="gridcell" aria-label={future ? undefined : text} title={future ? undefined : text} className={cls} style={style} />
            )
          })}
        </div>
      ))}
    </div>
  )
}
