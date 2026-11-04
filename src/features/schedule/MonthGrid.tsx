import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { AgendaItem } from '@/selectors/agenda'
import { useFormatters } from '@/hooks/useFormatters'
import { addDaysISO, eachDay, formatDate, monthEndISO, monthStartISO, weekStartISO } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn, groupBy } from '@/lib/utils'
import { actions, useSettings } from '@/store/store'
import { WEEKDAYS } from '@/data/constants'
import { editor } from '@/components/editor/editorStore'
import { openAgendaItem } from '@/components/shared/AgendaList'

export function monthGridRange(cursor: string, weekStartsOn: 0 | 1) {
  const start = weekStartISO(monthStartISO(cursor), weekStartsOn)
  const lastWeekStart = weekStartISO(monthEndISO(cursor), weekStartsOn)
  return { start, end: addDaysISO(lastWeekStart, 6) }
}

/** Month calendar. Drag an event chip onto another day to move it. */
export function MonthGrid({ cursor, items, today, onPickDay }: { cursor: string; items: AgendaItem[]; today: string; onPickDay: (d: string) => void }) {
  const settings = useSettings()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const [dragOver, setDragOver] = useState<string | null>(null)
  const { start, end } = monthGridRange(cursor, settings.weekStartsOn)
  const days = eachDay(start, end)
  const byDay = groupBy(items, (i) => i.date)
  const month = cursor.slice(0, 7)
  const headers = settings.weekStartsOn === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)]
  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-panel-2/40">
        {headers.map((d) => (
          <div key={d.value} className="eyebrow px-2 py-2 text-center">
            <span className="hidden sm:inline">{d.short}</span>
            <span className="sm:hidden">{d.short[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay[d] ?? []
          const inMonth = d.slice(0, 7) === month
          return (
            <div
              key={d}
              role="gridcell"
              aria-label={formatDate(d, 'EEEE d MMMM')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(d)
              }}
              onDragLeave={() => setDragOver((v) => (v === d ? null : v))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                const id = e.dataTransfer.getData('text/life-os-event')
                if (id) actions.update('events', id, { date: d }, { detail: `Moved to ${formatDate(d, 'EEE d MMM')}` })
              }}
              onDoubleClick={() => editor.create('events', { date: d })}
              className={cn(
                'group min-h-20 border-r border-b border-line p-1 transition-colors sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-ink/[0.015]',
                dragOver === d && 'bg-accent/10',
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(d)}
                className={cn(
                  'mb-1 flex size-6 items-center justify-center rounded-md font-mono text-[11.5px] tabular transition-colors hover:bg-panel-3',
                  d === today ? 'bg-accent text-on-accent hover:bg-accent' : inMonth ? 'text-ink-muted' : 'text-ink-subtle/50',
                )}
                aria-label={`Open ${formatDate(d, 'EEEE d MMMM')}`}
              >
                {formatDate(d, 'd')}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((i) => (
                  <button
                    key={i.key}
                    type="button"
                    draggable={i.editable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/life-os-event', i.sourceId)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      openAgendaItem(i, navigate)
                    }}
                    className={cn('hidden w-full items-center gap-1 truncate rounded px-1 py-px text-left text-[11px] sm:flex', i.editable && 'cursor-grab', i.done && 'line-through opacity-60')}
                    style={{ background: toneTint(i.tone, 14), color: 'var(--color-ink)' }}
                    title={`${i.title}${i.startTime ? ` · ${fmt.time(i.startTime)}` : ''}`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneColor(i.tone) }} />
                    {i.startTime && <span className="font-mono text-[10px] text-ink-subtle">{fmt.time(i.startTime)}</span>}
                    <span className="truncate">{i.title}</span>
                  </button>
                ))}
                {list.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                    {list.slice(0, 4).map((i) => (
                      <span key={i.key} className="size-1.5 rounded-full" style={{ background: toneColor(i.tone) }} />
                    ))}
                  </div>
                )}
                {list.length > 3 && (
                  <button type="button" onClick={() => onPickDay(d)} className="hidden px-1 text-[10.5px] text-ink-subtle hover:text-accent sm:block">
                    +{list.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-subtle">Double-click a day to add an event · drag events between days to move them · click a date to open it.</p>
    </div>
  )
}
