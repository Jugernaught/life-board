import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { AgendaItem } from '@/selectors/agenda'
import { useFormatters } from '@/hooks/useFormatters'
import { useNow } from '@/hooks/useNow'
import { formatDate, minutesToTime, timeToMinutes, toISODate, weekday } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useSettings } from '@/store/store'
import { editor } from '@/components/editor/editorStore'
import { AGENDA_ICONS, openAgendaItem } from '@/components/shared/AgendaList'
import { MIN_DURATION, layoutDay, snap, toTimed } from './layout'

const HOUR = 52 // px per hour
const GUTTER = 52

interface DragState {
  key: string
  id: string
  mode: 'move' | 'resize'
  originY: number
  originX: number
  start: number
  end: number
  date: string
  dayIndex: number
  /** Live preview. */
  previewStart: number
  previewEnd: number
  previewDay: number
  moved: boolean
}

/**
 * Day/week timeline. Calendar events can be dragged to move them (including
 * to another day in week view) and resized from their bottom edge; click an
 * empty slot to create an event there. Other dated items (tasks with a time,
 * timed exams…) are shown for context and open at their source.
 */
export function TimeGrid({ days, items, today }: { days: string[]; items: AgendaItem[]; today: string }) {
  const settings = useSettings()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const [drag, setDragState] = useState<DragState | null>(null)
  // The ref mirrors state so pointer-up handlers never act on a stale drag twice.
  const dragRef = useRef<DragState | null>(null)
  const setDrag = (d: DragState | null) => {
    dragRef.current = d
    setDragState(d)
  }
  const workStart = timeToMinutes(settings.workStart)
  const workEnd = timeToMinutes(settings.workEnd)

  useEffect(() => {
    // Start scrolled to just before working hours (or now, if that's later today).
    const el = scroller.current
    if (!el) return
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const target = days.includes(today) && nowMin > workStart + 120 ? nowMin - 120 : workStart - 60
    el.scrollTop = Math.max(0, (target / 60) * HOUR)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(',')])

  const allDay = (d: string) => items.filter((i) => i.date === d && (i.allDay || !i.startTime))
  const timed = useMemo(
    () =>
      days.map((d) =>
        layoutDay(
          items
            .filter((i) => i.date === d && !i.allDay && i.startTime)
            .map((i) => {
              if (drag && i.key === drag.key) return null
              return { item: i, ...toTimed(i) }
            })
            .filter(Boolean) as { item: AgendaItem; start: number; end: number }[],
        ),
      ),
    [days, items, drag],
  )

  const minutesFromEvent = (clientY: number) => {
    const rect = columnsRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return ((clientY - rect.top) / HOUR) * 60
  }
  const dayFromEvent = (clientX: number) => {
    const rect = columnsRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const w = rect.width / days.length
    return Math.max(0, Math.min(days.length - 1, Math.floor((clientX - rect.left) / w)))
  }

  const beginDrag = (e: React.PointerEvent, item: AgendaItem, start: number, end: number, mode: DragState['mode']) => {
    if (!item.editable || e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const dayIndex = days.indexOf(item.date)
    setDrag({ key: item.key, id: item.sourceId, mode, originY: e.clientY, originX: e.clientX, start, end, date: item.date, dayIndex, previewStart: start, previewEnd: end, previewDay: dayIndex, moved: false })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dy = ((e.clientY - drag.originY) / HOUR) * 60
    const moved = drag.moved || Math.abs(e.clientY - drag.originY) > 4 || Math.abs(e.clientX - drag.originX) > 4
    if (drag.mode === 'move') {
      const len = drag.end - drag.start
      const start = Math.max(0, Math.min(1440 - len, snap(drag.start + dy)))
      setDrag({ ...drag, moved, previewStart: start, previewEnd: start + len, previewDay: days.length > 1 ? dayFromEvent(e.clientX) : drag.dayIndex })
    } else {
      const end = Math.max(drag.start + MIN_DURATION, Math.min(1440, snap(drag.end + dy)))
      setDrag({ ...drag, moved, previewEnd: end })
    }
  }

  const endDrag = () => {
    const d = dragRef.current
    if (!d) return
    setDrag(null)
    if (!d.moved) {
      const item = items.find((i) => i.key === d.key)
      if (item) openAgendaItem(item, navigate)
      return
    }
    const date = days[d.previewDay] ?? d.date
    const endTime = d.previewEnd >= 1440 ? '23:59' : minutesToTime(d.previewEnd)
    actions.update('events', d.id, { date, startTime: minutesToTime(d.previewStart), endTime }, { detail: `Moved to ${formatDate(date, 'EEE d MMM')} ${minutesToTime(d.previewStart)}` })
  }

  const createAt = (dayIndex: number, clientY: number) => {
    const start = Math.max(0, Math.min(1410, snap(minutesFromEvent(clientY), 30)))
    editor.create('events', { date: days[dayIndex], startTime: minutesToTime(start), endTime: minutesToTime(Math.min(1439, start + 60)), allDay: false })
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todayIso = toISODate(now)
  const dragItem = drag ? items.find((i) => i.key === drag.key) : undefined

  return (
    <div className="panel overflow-hidden">
      {/* Day headers + all-day row */}
      <div className="flex border-b border-line bg-panel-2/40" style={{ paddingLeft: GUTTER }}>
        {days.map((d) => (
          <div key={d} className="min-w-0 flex-1 border-l border-line px-1.5 py-2 first:border-l-0">
            {days.length > 1 && (
              <p className={cn('mb-1 text-center text-[12px]', d === today ? 'text-accent' : 'text-ink-muted')}>
                <span className="eyebrow mr-1">{formatDate(d, 'EEE')}</span>
                <span className={cn('font-mono tabular', d === today && 'rounded bg-accent px-1 text-on-accent')}>{formatDate(d, 'd')}</span>
              </p>
            )}
            <div className="space-y-1">
              {allDay(d).map((i) => {
                const Icon = AGENDA_ICONS[i.kind]
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => openAgendaItem(i, navigate)}
                    className={cn('flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11.5px]', i.done && 'line-through opacity-60')}
                    style={{ background: toneTint(i.tone, 16), color: toneColor(i.tone) }}
                    title={i.title}
                  >
                    <Icon size={11} className="shrink-0" />
                    <span className="truncate text-ink">{i.title}</span>
                  </button>
                )
              })}
              {allDay(d).length === 0 && days.length === 1 && <p className="px-1 text-[11.5px] text-ink-subtle">No all-day items</p>}
            </div>
          </div>
        ))}
      </div>

      <div ref={scroller} className="relative max-h-[68vh] overflow-y-auto" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
        <div className="relative flex" style={{ height: 24 * HOUR }}>
          {/* Hour labels */}
          <div className="relative shrink-0" style={{ width: GUTTER }} aria-hidden>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[10.5px] text-ink-subtle tabular" style={{ top: h * HOUR }}>
                {h === 0 ? '' : fmt.time(`${String(h).padStart(2, '0')}:00`)}
              </span>
            ))}
          </div>
          <div ref={columnsRef} className="relative flex flex-1">
            {/* Hour lines */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR }} />
              ))}
            </div>
            {days.map((d, dayIndex) => {
              const isWorkDay = settings.workDays.includes(weekday(d))
              return (
                <div
                  key={d}
                  className="relative min-w-0 flex-1 cursor-cell border-l border-line first:border-l-0"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) createAt(dayIndex, e.clientY)
                  }}
                  role="presentation"
                  data-testid={`day-column-${d}`}
                >
                  {isWorkDay && workEnd > workStart && (
                    <div className="pointer-events-none absolute inset-x-0 bg-accent/[0.035]" style={{ top: (workStart / 60) * HOUR, height: ((workEnd - workStart) / 60) * HOUR }} aria-hidden />
                  )}
                  {timed[dayIndex].map((p) => (
                    <TimedBlock key={p.item.key} placed={p} onPointerDown={beginDrag} onOpen={(i) => openAgendaItem(i, navigate)} fmt={fmt} />
                  ))}
                  {drag && drag.previewDay === dayIndex && dragItem && (
                    <TimedBlock placed={{ item: dragItem, start: drag.previewStart, end: drag.previewEnd, column: 0, columns: 1 }} preview fmt={fmt} />
                  )}
                  {d === todayIso && (
                    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (nowMinutes / 60) * HOUR }} aria-hidden>
                      <div className="relative h-px bg-magenta shadow-[0_0_8px_var(--color-magenta)]">
                        <span className="absolute -top-1 -left-1 size-2 rounded-full bg-magenta" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-subtle">Click an empty slot to add an event · drag events to move them · drag the bottom edge to change their length.</p>
    </div>
  )
}

function TimedBlock({
  placed,
  onPointerDown,
  onOpen,
  preview,
  fmt,
}: {
  placed: { item: AgendaItem; start: number; end: number; column: number; columns: number }
  onPointerDown?: (e: React.PointerEvent, item: AgendaItem, start: number, end: number, mode: 'move' | 'resize') => void
  onOpen?: (item: AgendaItem) => void
  preview?: boolean
  fmt: ReturnType<typeof useFormatters>
}) {
  const { item, start, end, column, columns } = placed
  const top = (start / 60) * HOUR
  const height = Math.max(18, ((end - start) / 60) * HOUR - 2)
  const width = 100 / columns
  const Icon = AGENDA_ICONS[item.kind]
  const short = height < 34
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${fmt.time(minutesToTime(start))} to ${fmt.time(minutesToTime(end))}`}
      onPointerDown={(e) => onPointerDown?.(e, item, start, end, 'move')}
      onClick={() => !item.editable && onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(item)
        }
      }}
      className={cn(
        'group absolute z-[1] overflow-hidden rounded-md border px-1.5 text-left select-none',
        item.editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        preview && 'z-20 shadow-[0_0_20px_-4px_var(--color-accent)] ring-1 ring-accent',
        item.done && 'opacity-55',
      )}
      style={{
        top,
        height,
        left: `calc(${column * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        background: `linear-gradient(180deg, ${toneTint(item.tone, 26)}, ${toneTint(item.tone, 14)})`,
        borderColor: toneTint(item.tone, 45),
        borderLeft: `3px solid ${toneColor(item.tone)}`,
        touchAction: item.editable ? 'none' : 'auto',
      }}
      data-testid="timed-block"
    >
      <div className={cn('flex min-w-0 gap-1', short ? 'items-center' : 'flex-col pt-1')}>
        <span className="flex min-w-0 items-center gap-1 text-[12px] leading-tight font-medium text-ink">
          <Icon size={11} className="shrink-0" style={{ color: toneColor(item.tone) }} />
          <span className="truncate">{item.title}</span>
        </span>
        <span className="truncate font-mono text-[10.5px] text-ink-muted tabular">
          {fmt.time(minutesToTime(start))}–{fmt.time(end >= 1440 ? '23:59' : minutesToTime(end))}
        </span>
      </div>
      {item.editable && !preview && (
        <div
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
          onPointerDown={(e) => {
            e.stopPropagation()
            onPointerDown?.(e, item, start, end, 'resize')
          }}
          aria-hidden
        >
          <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-ink/50" />
        </div>
      )}
    </div>
  )
}
