import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarClock, Flame, Plus, Share, Sparkles, Sunrise, X } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import type { CollectionKey } from '@/data/types'
import { useNow, useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { periodSummary } from '@/selectors/analytics'
import { currentStreak, todaysHabits, toggleLog } from '@/selectors/habits'
import { tasksDueToday, todaysPriorities } from '@/selectors/tasks'
import { addDaysISO, eachDay, greetingFor, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { cn, truncate } from '@/lib/utils'
import { actions, useDatabase } from '@/store/store'
import { quickCreateTask, rescheduleMany } from '@/app/taskCommands'
import { ProgressRing } from '@/components/ui/display'
import { useUI } from '@/components/command/uiStore'
import { planDay } from '@/features/planday/model'
import { AgendaRow } from '../../components/AgendaRow'
import { CheckInCard } from '../../components/CheckInCard'
import { InlineAdd } from '../../components/InlineAdd'
import { StatGrid, StatTile } from '../../components/Stats'
import { TaskRow } from '../../components/TaskRow'
import { openRecord } from '../../editor/openRecord'
import { GettingStartedSection } from './GettingStarted'
import { nav } from '../../nav/navigator'
import { useShowsHeaderAdd } from '../../nav/tabContext'
import { CheckCircle } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'

const isStandalone = () => (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('life-os:m-install-hint') === 'dismissed'
    } catch {
      return false
    }
  })
  if (hidden || isStandalone() || !isIOS()) return null
  return (
    <div className="mx-4 mb-5 flex items-center gap-3 rounded-[12px] bg-[var(--ios-cell)] py-2.5 pr-2 pl-3" data-testid="install-hint">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent/15 text-accent">
        <Share size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ios-subhead font-semibold text-ink">Add to Home Screen</p>
        <p className="ios-footnote text-ink-subtle">Share › Add to Home Screen — full screen, offline, safer storage.</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="-m-1 flex size-8 shrink-0 items-center justify-center text-ink-subtle"
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem('life-os:m-install-hint', 'dismissed')
          } catch {
            // Hidden for this session only.
          }
        }}
      >
        <X size={18} />
      </button>
    </div>
  )
}

function Ring({ label, done, total, tone, onClick }: { label: string; done: number; total: number; tone: 'cyan' | 'lime' | 'magenta'; onClick: () => void }) {
  return (
    // A compact summary "widget": ring + count + label, three across.
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 active:opacity-60" aria-label={`${label}: ${done} of ${total}`}>
      <ProgressRing value={total ? (done / total) * 100 : 0} size={38} stroke={5} tone={tone}>
        <span className="sr-only">{total ? `${done}/${total}` : '—'}</span>
      </ProgressRing>
      <span className="min-w-0 text-left">
        <span className="block text-[17px] leading-tight font-semibold text-ink tabular-nums">{total ? `${done}/${total}` : '—'}</span>
        <span className="block truncate text-[12px] leading-tight text-ink-subtle">{label}</span>
      </span>
    </button>
  )
}

export default function TodayScreen() {
  const db = useDatabase()
  const today = useToday()
  const now = useNow()
  const { showQuickAdd } = useUI()
  const ws = db.settings.weekStartsOn

  const { overdue, today: dueToday } = tasksDueToday(db.tasks, today)
  const priorities = todaysPriorities(db.tasks, today)
  const habits = todaysHabits(db.habits, today, ws)
  const upNext = useMemo(() => {
    const nowHM = format(now, 'HH:mm')
    return buildAgenda(db, today, addDaysISO(today, 1), today).filter((i) => i.sourceKey !== 'tasks' && (i.date !== today || i.allDay || (i.endTime ?? i.startTime ?? '') >= nowHM))
  }, [db, today, now])
  const week = useMemo(() => {
    const start = weekStartISO(today, ws)
    const elapsed = eachDay(start, today).length
    const prevStart = addDaysISO(start, -7)
    return {
      cur: periodSummary(db, { start, end: today }, today, ws),
      prev: periodSummary(db, { start: prevStart, end: addDaysISO(prevStart, elapsed - 1) }, today, ws),
    }
  }, [db, today, ws])
  const dueAll = [...overdue, ...dueToday]
  const dueDone = db.tasks.filter((t) => t.status === 'done' && t.dueDate === today).length
  const name = db.settings.displayName
  const planned = db.settings.planDayLast === today
  const showAdd = useShowsHeaderAdd()
  const intention = db.settings.intention?.date === today ? db.settings.intention.text : undefined

  return (
    <Screen
      title="Today"
      large
      subtitle={
        <>
          {format(now, 'EEEE d MMMM')} · {greetingFor(now)}
          {name ? `, ${name}` : ''}
        </>
      }
      trailing={
        showAdd && (
          <NavButton onClick={() => showQuickAdd()} label="New" testId="today-add">
            <Plus size={26} />
          </NavButton>
        )
      }
      testId="screen-today"
    >
      <div className="mx-4 mb-7 flex rounded-[12px] bg-[var(--ios-cell)] px-1.5 py-2.5" data-testid="today-rings">
        <Ring label="Priorities" done={priorities.filter((p) => p.status === 'done').length} total={priorities.length} tone="cyan" onClick={() => document.getElementById('today-priorities')?.scrollIntoView({ behavior: 'smooth' })} />
        <Ring label="Habits" done={habits.done} total={habits.total} tone="lime" onClick={() => nav.push('habits')} />
        <Ring label="Due today" done={dueDone} total={dueDone + dueAll.length} tone="magenta" onClick={() => nav.push('plan')} />
      </div>

      {intention ? (
        <button type="button" onClick={() => planDay.show()} className="mx-4 mb-5 flex w-[calc(100%-2rem)] items-start gap-2 text-left" data-testid="m-today-intention">
          <Sparkles size={16} className="mt-[3px] shrink-0 text-accent" aria-hidden />
          <span className="ios-body text-ink">{intention}</span>
        </button>
      ) : null}

      <div id="today-priorities">
        <Section
          header="Today's priorities"
          headerAction={
            !planned && (
              <button type="button" onClick={() => planDay.show()} className="ios-subhead -mx-2 -my-3 flex min-h-11 items-center gap-1 px-2 text-accent active:opacity-50" data-testid="m-plan-day">
                <Sunrise size={15} aria-hidden /> Plan Your Day
              </button>
            )
          } footer={priorities.length ? undefined : 'Pick the few things that matter most. Swipe a task left and tap Priority, or add one here.'}>
          {priorities.map((t) => (
            <TaskRow key={t.id} task={t} today={today} />
          ))}
          <InlineAdd placeholder="Add a priority" testId="add-priority" onAdd={(title) => actions.create('tasks', { title, focusDate: today, dueDate: today, priority: 'high' })} />
        </Section>
      </div>

      <Section header={overdue.length ? `Due · ${overdue.length} overdue` : 'Due today'} headerAction={<SeeAll label="All Tasks" onClick={() => nav.push('plan')} />}>
        {dueAll.length === 0 && <EmptyRow>{dueDone ? `All done — ${dueDone} completed today.` : 'Nothing due today.'}</EmptyRow>}
        {dueAll.map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
        {overdue.length > 1 && (
          <ActionCell icon={CalendarClock} testId="m-today-overdue-to-today" onClick={() => rescheduleMany(overdue, today, today)}>
            Move {overdue.length} Overdue to Today
          </ActionCell>
        )}
        <InlineAdd placeholder="Add a task for today" testId="add-today-task" onAdd={(title) => quickCreateTask(title, { dueDate: today })} />
      </Section>

      <Section header="Up next" headerAction={<SeeAll label="Calendar" onClick={() => nav.push('plan')} />}>
        {upNext.length === 0 ? <EmptyRow>Nothing else scheduled today or tomorrow.</EmptyRow> : upNext.slice(0, 6).map((i) => <AgendaRow key={i.key} item={i} />)}
      </Section>

      <Section header="Habits" headerAction={<SeeAll label="All Habits" onClick={() => nav.push('habits')} />}>
        {habits.items.length === 0 && <EmptyRow>{db.habits.length ? 'No habits scheduled today.' : 'No habits yet — add one in the Habits tab.'}</EmptyRow>}
        {habits.items.map(({ habit, done, weekly }) => {
          const streak = currentStreak(habit, today, ws)
          return (
            <div key={habit.id} className="flex items-center gap-3 px-4">
              <CheckCircle checked={done} color={toneColor(habit.color)} label={`${habit.name}: ${done ? 'done' : 'not done'} today`} onToggle={() => actions.update('habits', habit.id, (h) => ({ log: toggleLog(h.log, today) }), { action: 'logged' })} testId="today-habit" />
              <button type="button" className="min-w-0 flex-1 py-[11px] text-left" onClick={() => openRecord('habits', habit.id)}>
                <span className={cn('ios-body block truncate', done ? 'text-ink-subtle' : 'text-ink')}>{habit.name}</span>
                {weekly && <span className="ios-footnote text-ink-subtle">{weekly.count} of {weekly.target} this week</span>}
              </button>
              {streak > 0 && (
                <span className="ios-subhead inline-flex items-center gap-0.5 text-[var(--color-amber)] tabular-nums" aria-label={`${streak} streak`}>
                  <Flame size={15} />
                  {streak}
                </span>
              )}
            </div>
          )
        })}
      </Section>

      <CheckInCard today={today} />

      {/* Setting-up help comes after the day itself. */}
      <GettingStartedSection />
      <InstallHint />

      <Section header="This week" plain>
        <StatGrid className="!mx-0 !mb-0">
          <StatTile label="Tasks done" value={week.cur.tasksCompleted} current={week.cur.tasksCompleted} previous={week.prev.tasksCompleted} tone="cyan" />
          <StatTile label="Habits" value={week.cur.habitRate === null ? '—' : `${Math.round(week.cur.habitRate * 100)}%`} sub={`${week.cur.habitCheckIns} check-ins`} tone="lime" />
          <StatTile label="Workouts" value={week.cur.workouts} current={week.cur.workouts} previous={week.prev.workouts} tone="magenta" />
          <StatTile label="Learning" value={formatMinutes(week.cur.learningMinutes)} current={week.cur.learningMinutes} previous={week.prev.learningMinutes} format={formatMinutes} tone="violet" />
        </StatGrid>
        <p className="ios-footnote mt-1.5 px-4 text-ink-subtle">Compared with the same days last week.</p>
      </Section>

      <Section header="Recent activity">
        {db.activity.length === 0 && <EmptyRow>Everything you add, complete or change is logged here.</EmptyRow>}
        {db.activity.slice(0, 5).map((a) => {
          const key = a.collection as CollectionKey
          const exists = a.action !== 'deleted' && (db[key] as { id: string }[] | undefined)?.some((r) => r.id === a.entityId)
          return (
            <Cell
              key={a.id}
              title={truncate(a.label, 48)}
              subtitle={`${a.action[0].toUpperCase()}${a.action.slice(1)} ${COLLECTIONS[key]?.singular.toLowerCase() ?? 'record'}`}
              detail={<span className="ios-footnote">{format(new Date(a.at), 'HH:mm')}</span>}
              onClick={exists ? () => openRecord(key, a.entityId) : undefined}
            />
          )
        })}
      </Section>
    </Screen>
  )
}
