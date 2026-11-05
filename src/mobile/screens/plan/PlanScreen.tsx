import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { WEEKDAYS } from '@/data/constants'
import type { Task } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useNow, useToday } from '@/hooks/useNow'
import { type AgendaItem, AGENDA_KIND_LABEL, buildAgenda } from '@/selectors/agenda'
import { isOverdue, sortTasks } from '@/selectors/tasks'
import { addDaysISO, eachDay, formatDate, minutesToTime, monthEndISO, monthStartISO, relativeDay, timeToMinutes, toISODate, weekStartISO } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn, groupBy, normalise } from '@/lib/utils'
import { useDatabase } from '@/store/store'
import { quickCreateTask, rescheduleMany } from '@/app/taskCommands'
import { editor } from '@/components/editor/editorStore'
import { layoutDay, toTimed } from '@/features/schedule/layout'
import { AgendaRow, openAgenda } from '../../components/AgendaRow'
import { InlineAdd } from '../../components/InlineAdd'
import { TaskRow } from '../../components/TaskRow'
import { Chips, SearchField, Segmented } from '../../ui/controls'
import { ActionCell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { useShowsHeaderAdd, useTabContext } from '../../nav/tabContext'

type Mode = 'calendar' | 'tasks'

export function PlanScreen() {
  // The mode lives in the shared tab context so links elsewhere (e.g. Today's "All Tasks") can open Plan on Tasks.
  const mode = useTabContext((s) => s.planMode)
  const setMode = (planMode: Mode) => useTabContext.getState().set({ planMode })
  const today = useToday()
  const [selected, setSelected] = useState(today)
  const showAdd = useShowsHeaderAdd()
  useEffect(() => useTabContext.getState().set({ planDate: selected }), [selected])
  return (
    <Screen
      title="Plan"
      large
      testId="screen-plan"
      trailing={
        showAdd && (
          <NavButton label={mode === 'calendar' ? 'New event' : 'New task'} testId="plan-add" onClick={() => (mode === 'calendar' ? editor.create('events', { date: selected }) : editor.create('tasks'))}>
            <Plus size={26} />
          </NavButton>
        )
      }
      header={
        <Segmented
          value={mode}
          onChange={setMode}
          ariaLabel="Plan view"
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'tasks', label: 'Tasks' },
          ]}
        />
      }
    >
      {mode === 'calendar' ? <CalendarView today={today} selected={selected} setSelected={setSelected} /> : <TasksView today={today} />}
    </Screen>
  )
}

/* -------------------------------------------------------------- calendar */

function useDayDots(start: string, end: string, today: string) {
  const db = useDatabase()
  return useMemo(() => {
    const items = buildAgenda(db, start, end, today)
    return groupBy(items, (i) => i.date)
  }, [db, start, end, today])
}

function WeekStrip({ selected, setSelected, today }: { selected: string; setSelected: (d: string) => void; today: string }) {
  const db = useDatabase()
  const ws = db.settings.weekStartsOn
  const start = weekStartISO(selected, ws)
  const days = eachDay(start, addDaysISO(start, 6))
  const dots = useDayDots(days[0], days[6], today)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className="grid grid-cols-7 px-2 select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = swipe.current
        swipe.current = null
        if (!s) return
        const dx = e.clientX - s.x
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) setSelected(addDaysISO(selected, dx < 0 ? 7 : -7))
      }}
      data-testid="week-strip"
    >
      {days.map((d) => {
        const isSel = d === selected
        const isToday = d === today
        return (
          <button key={d} type="button" onClick={() => setSelected(d)} className="flex flex-col items-center gap-1 py-1" aria-label={formatDate(d, 'EEEE d MMMM')} aria-pressed={isSel}>
            <span className="text-[11px] font-medium text-ink-subtle uppercase">{formatDate(d, 'EEEEE')}</span>
            <span
              className={cn(
                'flex size-9 items-center justify-center rounded-full text-[19px] tabular-nums',
                isSel ? (isToday ? 'bg-[var(--ios-system-red)] font-semibold text-white' : 'bg-ink font-semibold text-[var(--ios-cell)]') : isToday ? 'font-semibold text-[var(--ios-system-red)]' : 'text-ink',
              )}
            >
              {Number(d.slice(8))}
            </span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dots[d]?.length ? 'var(--color-ink-subtle)' : 'transparent' }} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

function MonthGrid({ selected, setSelected, today }: { selected: string; setSelected: (d: string) => void; today: string }) {
  const db = useDatabase()
  const ws = db.settings.weekStartsOn
  const start = weekStartISO(monthStartISO(selected), ws)
  const end = addDaysISO(weekStartISO(monthEndISO(selected), ws), 6)
  const days = eachDay(start, end)
  const dots = useDayDots(start, end, today)
  const headers = ws === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)]
  const month = selected.slice(0, 7)
  return (
    <div className="px-2 pb-2" data-testid="month-grid">
      <div className="grid grid-cols-7">
        {headers.map((h) => (
          <span key={h.value} className="py-1 text-center text-[11px] font-medium text-ink-subtle uppercase">
            {h.short[0]}
          </span>
        ))}
        {days.map((d) => (
          <button key={d} type="button" onClick={() => setSelected(d)} className="flex flex-col items-center py-1" aria-label={formatDate(d, 'EEEE d MMMM')}>
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-[16px] tabular-nums',
                d === selected ? 'bg-ink font-semibold text-[var(--ios-cell)]' : d === today ? 'font-semibold text-[var(--ios-system-red)]' : d.slice(0, 7) === month ? 'text-ink' : 'text-ink-subtle/50',
              )}
            >
              {Number(d.slice(8))}
            </span>
            <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
              {(dots[d] ?? []).slice(0, 3).map((i) => (
                <span key={i.key} className="size-1.5 rounded-full" style={{ background: toneColor(i.tone) }} />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const HOUR = 56

function DayTimeline({ day, items }: { day: string; items: AgendaItem[] }) {
  const fmt = useFormatters()
  const db = useDatabase()
  const now = useNow()
  const box = useRef<HTMLDivElement>(null)
  const timed = layoutDay(items.filter((i) => !i.allDay && i.startTime).map((i) => ({ item: i, ...toTimed(i) })))
  const workStart = timeToMinutes(db.settings.workStart)
  useEffect(() => {
    // Bring the working morning into view.
    box.current?.querySelector(`[data-hour="${Math.max(0, Math.floor(workStart / 60) - 1)}"]`)?.scrollIntoView({ block: 'start' })
  }, [day, workStart])
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = day === toISODate(now)
  return (
    <div ref={box} className="relative mx-4 mb-7 overflow-hidden rounded-[12px] bg-[var(--ios-cell)]" style={{ height: 24 * HOUR }} data-testid="day-timeline">
      {Array.from({ length: 24 }, (_, h) => (
        <button
          key={h}
          type="button"
          data-hour={h}
          aria-label={`Add event at ${fmt.time(`${String(h).padStart(2, '0')}:00`)}`}
          onClick={() => editor.create('events', { date: day, allDay: false, startTime: minutesToTime(h * 60), endTime: minutesToTime(Math.min(1439, h * 60 + 60)) })}
          className="absolute inset-x-0 flex items-start border-t-[0.5px] border-[var(--color-line)] text-left active:bg-[var(--ios-fill)]"
          style={{ top: h * HOUR, height: HOUR }}
        >
          <span className="ios-caption w-14 -translate-y-2 bg-[var(--ios-cell)] pr-2 text-right text-ink-subtle tabular-nums">{h === 0 ? '' : fmt.time(`${String(h).padStart(2, '0')}:00`)}</span>
        </button>
      ))}
      {timed.map((p) => {
        const w = (100 - 0) / p.columns
        return (
          <button
            key={p.item.key}
            type="button"
            onClick={() => openAgenda(p.item)}
            className="absolute overflow-hidden rounded-[6px] px-1.5 py-1 text-left"
            style={{
              top: (p.start / 60) * HOUR + 1,
              height: Math.max(22, ((p.end - p.start) / 60) * HOUR - 2),
              left: `calc(58px + (100% - 62px) * ${(p.column * w) / 100})`,
              width: `calc((100% - 62px) * ${w / 100} - 2px)`,
              background: toneTint(p.item.tone, 22),
              borderLeft: `3px solid ${toneColor(p.item.tone)}`,
            }}
          >
            <span className="ios-footnote block truncate font-semibold text-ink">{p.item.title}</span>
            <span className="ios-caption block truncate text-ink-subtle">
              {fmt.time(p.item.startTime)} · {AGENDA_KIND_LABEL[p.item.kind]}
            </span>
          </button>
        )
      })}
      {isToday && (
        <div className="pointer-events-none absolute right-0 left-[52px] z-10 h-0.5 bg-[var(--ios-system-red)]" style={{ top: (nowMin / 60) * HOUR }} aria-hidden>
          <span className="absolute -top-[4px] -left-1 size-2.5 rounded-full bg-[var(--ios-system-red)]" />
        </div>
      )}
    </div>
  )
}

function CalendarView({ today, selected, setSelected }: { today: string; selected: string; setSelected: (d: string) => void }) {
  const db = useDatabase()
  const [monthOpen, setMonthOpen] = useState(false)
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const items = useMemo(() => buildAgenda(db, selected, selected, today, { includeDone: true }), [db, selected, today])
  const nonTask = items.filter((i) => i.sourceKey !== 'tasks')
  const allDay = nonTask.filter((i) => i.allDay)
  const timed = nonTask.filter((i) => !i.allDay)
  const dayTasks = useMemo(() => sortTasks(db.tasks.filter((t) => t.dueDate === selected)), [db.tasks, selected])
  const step = monthOpen ? 'month' : 'week'
  const move = (dir: -1 | 1) => setSelected(monthOpen ? `${formatDate(addDaysISO(monthStartISO(selected), dir * 32), 'yyyy-MM')}-01` : addDaysISO(selected, dir * 7))

  return (
    <div>
      <div className="mb-1 flex items-center px-3">
        <button type="button" onClick={() => setMonthOpen((v) => !v)} className="ios-headline flex h-11 items-center gap-1 px-1 text-ink" aria-expanded={monthOpen} data-testid="month-toggle">
          {formatDate(selected, 'MMMM yyyy')}
          <ChevronDown size={18} className={cn('text-accent transition-transform', monthOpen && 'rotate-180')} />
        </button>
        <div className="flex-1" />
        <button type="button" aria-label={`Previous ${step}`} onClick={() => move(-1)} className="flex size-11 items-center justify-center text-accent">
          <ChevronLeft size={22} />
        </button>
        <button type="button" aria-label={`Next ${step}`} onClick={() => move(1)} className="flex size-11 items-center justify-center text-accent">
          <ChevronRight size={22} />
        </button>
        {selected !== today && (
          <button type="button" onClick={() => setSelected(today)} className="ios-body h-11 px-2 text-accent">
            Today
          </button>
        )}
      </div>
      <div className="mx-4 mb-5 rounded-[12px] bg-[var(--ios-cell)] py-2">
        {monthOpen ? (
          <MonthGrid
            selected={selected}
            today={today}
            setSelected={(d) => {
              setSelected(d)
              setMonthOpen(false)
            }}
          />
        ) : (
          <WeekStrip selected={selected} setSelected={setSelected} today={today} />
        )}
      </div>
      <div className="mb-4 flex items-center justify-between px-4">
        <div className="min-w-0">
          <h2 className="ios-title2 truncate text-ink">{['Today', 'Tomorrow', 'Yesterday'].includes(relativeDay(selected, today)) ? relativeDay(selected, today) : formatDate(selected, 'EEE d MMM')}</h2>
          <p className="ios-footnote text-ink-subtle">{formatDate(selected, 'EEEE d MMMM')}</p>
        </div>
        <Segmented
          className="w-40"
          value={view}
          onChange={setView}
          ariaLabel="Day view"
          options={[
            { value: 'list', label: 'List' },
            { value: 'timeline', label: 'Hours' },
          ]}
        />
      </div>
      {view === 'list' ? (
        <Section header="Schedule">
          {nonTask.length === 0 && <EmptyRow>Nothing scheduled. Tap + to add an event or time block.</EmptyRow>}
          {[...allDay, ...timed].map((i) => (
            <AgendaRow key={i.key} item={i} />
          ))}
        </Section>
      ) : (
        <>
          {allDay.length > 0 && (
            <Section header="All-day">
              {allDay.map((i) => (
                <AgendaRow key={i.key} item={i} />
              ))}
            </Section>
          )}
          <DayTimeline day={selected} items={timed} />
        </>
      )}
      <Section header={`Tasks due ${selected === today ? 'today' : formatDate(selected, 'EEE d MMM')}`}>
        {dayTasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
        <InlineAdd placeholder="Add a task for this day" onAdd={(title) => quickCreateTask(title, { dueDate: selected })} />
      </Section>
    </div>
  )
}

/* ----------------------------------------------------------------- tasks */

type Scope = 'today' | 'upcoming' | 'overdue' | 'someday' | 'all' | 'done'

function TasksView({ today }: { today: string }) {
  const db = useDatabase()
  const [scope, setScope] = useState<Scope>('today')
  const [query, setQuery] = useState('')
  const scopes: Record<Scope, (t: Task) => boolean> = {
    today: (t) => t.status !== 'done' && (t.dueDate === today || t.focusDate === today || isOverdue(t, today)),
    upcoming: (t) => t.status !== 'done' && !!t.dueDate && t.dueDate > today,
    overdue: (t) => isOverdue(t, today),
    someday: (t) => t.status !== 'done' && !t.dueDate,
    all: (t) => t.status !== 'done',
    done: (t) => t.status === 'done',
  }
  const counts = Object.fromEntries((Object.keys(scopes) as Scope[]).map((s) => [s, db.tasks.filter(scopes[s]).length])) as Record<Scope, number>
  const q = normalise(query)
  const list = sortTasks(db.tasks.filter(scopes[scope]).filter((t) => !q || normalise(`${t.title} ${t.notes ?? ''} ${t.tags.join(' ')}`).includes(q)))
  const shown = scope === 'done' ? [...list].sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1)).slice(0, 200) : list
  const grouped = scope === 'upcoming' || scope === 'all' ? groupBy(shown, (t) => t.dueDate ?? '') : null
  const groupKeys = grouped ? Object.keys(grouped).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b))) : []

  return (
    <div>
      <div className="mb-3 px-4">
        <Chips
          value={scope}
          onChange={setScope}
          ariaLabel="Task list"
          options={[
            { value: 'today', label: 'Today', count: counts.today },
            { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'someday', label: 'No Date', count: counts.someday },
            { value: 'all', label: 'All', count: counts.all },
            { value: 'done', label: 'Completed' },
          ]}
        />
      </div>
      <div className="mb-4 px-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search tasks" />
      </div>
      {grouped ? (
        groupKeys.length === 0 ? (
          <Section>
            <EmptyRow>{q ? 'No tasks match.' : 'No tasks here.'}</EmptyRow>
          </Section>
        ) : (
          groupKeys.map((k) => (
            <Section key={k || 'none'} header={k ? `${relativeDay(k, today)} · ${formatDate(k, 'EEE d MMM')}` : 'No date'}>
              {grouped[k].map((t) => (
                <TaskRow key={t.id} task={t} today={today} />
              ))}
            </Section>
          ))
        )
      ) : (
        <Section footer={scope === 'done' && list.length > 200 ? 'Showing the 200 most recent.' : undefined}>
          {shown.length === 0 && <EmptyRow>{q ? 'No tasks match.' : scope === 'today' ? 'Nothing due today.' : scope === 'overdue' ? 'Nothing overdue.' : 'No tasks here.'}</EmptyRow>}
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
          {(scope === 'overdue' || scope === 'today') && shown.filter((t) => isOverdue(t, today)).length > 1 && (
            <ActionCell icon={CalendarClock} testId="m-overdue-to-today" onClick={() => rescheduleMany(shown.filter((t) => isOverdue(t, today)), today, today)}>
              Move {shown.filter((t) => isOverdue(t, today)).length} Overdue to Today
            </ActionCell>
          )}
          {(scope === 'today' || scope === 'someday') && (
            <InlineAdd placeholder="New task" testId="tasks-inline-add" onAdd={(title) => quickCreateTask(title, scope === 'today' ? { dueDate: today } : {})} />
          )}
        </Section>
      )}
    </div>
  )
}
