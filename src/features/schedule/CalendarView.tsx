import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CalendarCheck2, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { buildAgenda } from '@/selectors/agenda'
import { sortTasks } from '@/selectors/tasks'
import { addDaysISO, addMonthsISO, eachDay, formatDate, weekStartISO } from '@/lib/dates'
import { useDatabase } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { Segmented, Switch } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { AgendaList } from '@/components/shared/AgendaList'
import { TaskItem } from '@/components/shared/TaskItem'
import { editor } from '@/components/editor/editorStore'
import { MonthGrid, monthGridRange } from './MonthGrid'
import { TimeGrid } from './TimeGrid'

export type CalendarMode = 'day' | 'week' | 'month'

export function CalendarView({ today }: { today: string }) {
  const db = useDatabase()
  const ws = db.settings.weekStartsOn
  const [mode, setMode] = useState<CalendarMode>(() => (typeof window !== 'undefined' && window.innerWidth < 700 && db.settings.defaultCalendarView === 'week' ? 'day' : db.settings.defaultCalendarView))
  const [cursor, setCursor] = useState(today)
  const [showDone, setShowDone] = useState(true)

  const range = useMemo(() => {
    if (mode === 'day') return { start: cursor, end: cursor }
    if (mode === 'week') {
      const start = weekStartISO(cursor, ws)
      return { start, end: addDaysISO(start, 6) }
    }
    return monthGridRange(cursor, ws)
  }, [mode, cursor, ws])

  const items = useMemo(() => buildAgenda(db, range.start, range.end, today, { includeDone: showDone }), [db, range, today, showDone])
  const upcoming = useMemo(() => buildAgenda(db, today, addDaysISO(today, 14), today), [db, today])
  const dayTasks = useMemo(() => sortTasks(db.tasks.filter((t) => t.dueDate === cursor)), [db.tasks, cursor])

  const step = (dir: -1 | 1) => setCursor((c) => (mode === 'day' ? addDaysISO(c, dir) : mode === 'week' ? addDaysISO(c, 7 * dir) : addMonthsISO(c, dir)))
  const label = mode === 'day' ? formatDate(cursor, 'EEEE d MMMM yyyy') : mode === 'week' ? `${formatDate(range.start, 'd MMM')} – ${formatDate(range.end, 'd MMM yyyy')}` : formatDate(cursor, 'MMMM yyyy')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCursor(today)} icon={CalendarCheck2}>
          Today
        </Button>
        <div className="flex items-center">
          <IconButton icon={ChevronLeft} label={`Previous ${mode}`} onClick={() => step(-1)} />
          <IconButton icon={ChevronRight} label={`Next ${mode}`} onClick={() => step(1)} />
        </div>
        <h2 className="order-first w-full min-w-0 truncate font-display text-[17px] font-semibold text-ink sm:order-none sm:w-auto sm:flex-1" aria-live="polite">
          {label}
        </h2>
        <div className="hidden items-center gap-2 text-[12.5px] text-ink-muted sm:flex">
          <Switch checked={showDone} onChange={setShowDone} label="Show completed" />
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          ariaLabel="Calendar view"
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('events', { date: mode === 'month' && cursor.slice(0, 7) !== today.slice(0, 7) ? cursor : mode === 'day' ? cursor : today })}>
          Event
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {mode === 'month' ? (
            <MonthGrid
              cursor={cursor}
              items={items}
              today={today}
              onPickDay={(d) => {
                setCursor(d)
                setMode('day')
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <div className={mode === 'week' ? 'min-w-[720px]' : undefined}>
                <TimeGrid days={mode === 'day' ? [cursor] : eachDay(range.start, range.end)} items={items} today={today} />
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-4" aria-label="Day details and upcoming commitments">
          {mode === 'day' && (
            <Panel
              title={`Tasks due ${cursor === today ? 'today' : formatDate(cursor, 'EEE d MMM')}`}
              actions={<IconButton icon={Plus} label="Add task for this day" size="xs" onClick={() => editor.create('tasks', { dueDate: cursor })} />}
            >
              {dayTasks.length === 0 ? (
                <p className="py-2 text-[12.5px] text-ink-subtle">No tasks due this day.</p>
              ) : (
                <div className="-mx-2">
                  <AnimatePresence initial={false}>
                    {dayTasks.map((t) => (
                      <TaskItem key={t.id} task={t} today={today} compact />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Panel>
          )}
          <Panel title="Upcoming commitments" eyebrow="Next 14 days · everything dated">
            {upcoming.length === 0 ? (
              <EmptyState compact title="Nothing coming up" description="Events, deadlines, exams, interviews, occasions and payments appear here." />
            ) : (
              <div className="-mx-2 max-h-[60vh] overflow-y-auto">
                <AgendaList items={upcoming} today={today} />
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
