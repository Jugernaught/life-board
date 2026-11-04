import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { formatDistanceToNowStrict } from 'date-fns'
import { Activity, BookOpen, Flame, HeartHandshake, NotebookPen, Pin, Plus, Repeat, Smile, StickyNote, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ENERGY_SCALE, MOOD_SCALE } from '@/data/constants'
import { COLLECTIONS, hrefFor } from '@/data/registry'
import type { ActivityEntry, CollectionKey, WidgetSize } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { periodSummary } from '@/selectors/analytics'
import { budgetStatus, monthTotals } from '@/selectors/finance'
import { currentStreak, todaysHabits, toggleLog } from '@/selectors/habits'
import { mediaProgress } from '@/selectors/media'
import { peopleToReconnect, upcomingOccasions } from '@/selectors/social'
import { completedInRange } from '@/selectors/tasks'
import { addDaysISO, eachDay, formatDate, monthKey, relativeDay, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { cn, truncate } from '@/lib/utils'
import { actions, useCollection, useDatabase, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Delta, EmptyState, ProgressBar, ProgressRing } from '@/components/ui/display'
import { Checkbox } from '@/components/ui/inputs'
import { ScaleInput } from '@/components/ui/pickers'
import { ChartTooltip, Legend, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { editor } from '@/components/editor/editorStore'
import { toast } from '@/components/ui/toast'
import { useState } from 'react'
import { Widget, type WidgetProps } from './Widget'

export function HabitsWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const habits = useCollection('habits')
  const settings = useSettings()
  const navigate = useNavigate()
  const { items, done, total } = todaysHabits(habits, today, settings.weekStartsOn)
  return (
    <Widget
      title="Habits today"
      icon={Repeat}
      size={size}
      testId="widget-habits"
      actions={
        <Button size="xs" variant="ghost" onClick={() => navigate('/goals?tab=habits')}>
          Manage
        </Button>
      }
    >
      {total === 0 ? (
        <EmptyState compact icon={Repeat} title={habits.length ? 'No habits scheduled today' : 'No habits yet'} description={habits.length ? 'Enjoy the rest day.' : 'Small daily actions compound.'} action={!habits.length && <Button size="sm" icon={Plus} onClick={() => editor.create('habits')}>Add habit</Button>} />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3">
            <ProgressRing value={(done / total) * 100} size={52} label={`${done} of ${total} habits done`}>
              <span className="font-mono text-[12px] text-ink tabular">
                {done}/{total}
              </span>
            </ProgressRing>
            <p className="text-[12.5px] text-ink-muted">{done === total ? 'Everything checked off today.' : `${total - done} left to check off today.`}</p>
          </div>
          <ul className="space-y-1">
            {items.map(({ habit, done: isDone, weekly }) => {
              const streak = currentStreak(habit, today, settings.weekStartsOn)
              return (
                <li key={habit.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-panel-3/40">
                  <Checkbox
                    checked={isDone}
                    tone={toneColor(habit.color)}
                    onChange={() => actions.update('habits', habit.id, (h) => ({ log: toggleLog(h.log, today) }), { action: 'logged' })}
                    label={<span className="sr-only">Mark {habit.name} as {isDone ? 'not done' : 'done'} today</span>}
                  />
                  <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', isDone ? 'text-ink-subtle' : 'text-ink')}>{habit.name}</span>
                  {weekly && (
                    <span className="font-mono text-[11px] text-ink-subtle tabular">
                      {weekly.count}/{weekly.target} wk
                    </span>
                  )}
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-amber tabular" title={`${streak} ${habit.schedule === 'weekly' ? 'week' : 'day'} streak`}>
                      <Flame size={12} />
                      {streak}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Widget>
  )
}

export function WeeklyWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const week = useMemo(() => {
    const start = weekStartISO(today, db.settings.weekStartsOn)
    const end = addDaysISO(start, 6)
    const prevStart = addDaysISO(start, -7)
    const prevEnd = addDaysISO(start, -1)
    // Compare like-for-like: this week so far vs the same days last week.
    const elapsed = eachDay(start, today).length
    const prevSameDays = addDaysISO(prevStart, elapsed - 1)
    const cur = periodSummary(db, { start, end: today }, today, db.settings.weekStartsOn)
    const prev = periodSummary(db, { start: prevStart, end: prevSameDays }, today, db.settings.weekStartsOn)
    const days = eachDay(start, end).map((d) => ({
      date: d,
      label: formatDate(d, 'EEE'),
      tasks: d <= today ? completedInRange(db.tasks, d, d).length : null,
      habits: d <= today ? db.habits.reduce((n, h) => n + (h.log.includes(d) ? 1 : 0), 0) : null,
    }))
    return { cur, prev, days, start, end, prevEnd }
  }, [db, today])
  const { cur, prev, days } = week
  const hasChart = days.some((d) => (d.tasks ?? 0) + (d.habits ?? 0) > 0)
  const stats = [
    { label: 'Tasks completed', value: String(cur.tasksCompleted), current: cur.tasksCompleted, previous: prev.tasksCompleted },
    { label: 'Habit check-ins', value: String(cur.habitCheckIns), current: cur.habitCheckIns, previous: prev.habitCheckIns, sub: cur.habitRate === null ? undefined : `${Math.round(cur.habitRate * 100)}% of scheduled` },
    { label: 'Workouts', value: String(cur.workouts), current: cur.workouts, previous: prev.workouts, sub: cur.workoutMinutes ? formatMinutes(cur.workoutMinutes) : undefined },
    { label: 'Learning', value: formatMinutes(cur.learningMinutes), current: cur.learningMinutes, previous: prev.learningMinutes, format: formatMinutes },
    { label: 'Journal entries', value: String(cur.journalEntries), current: cur.journalEntries, previous: prev.journalEntries },
    { label: 'Spending', value: fmt.money(cur.expenses, { showPence: false }), current: cur.expenses, previous: prev.expenses, invert: true, format: (n: number) => fmt.money(n, { showPence: false }) },
  ]
  return (
    <Widget title="This week" icon={Activity} size={size} testId="widget-weekly" eyebrow={`${formatDate(week.start, 'd MMM')} – ${formatDate(week.end, 'd MMM')} · vs same days last week`}>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-panel-2/30 p-3">
              <p className="eyebrow truncate">{s.label}</p>
              <p className="mt-1.5 font-display text-[20px] leading-none font-semibold text-ink tabular">{s.value}</p>
              <div className="mt-1.5 min-h-4">
                <Delta current={s.current} previous={s.previous} invert={s.invert} format={s.format} />
              </div>
              {s.sub && <p className="mt-0.5 truncate text-[11px] text-ink-subtle">{s.sub}</p>}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <Legend
            className="mb-2"
            items={[
              { label: 'Tasks done', color: series(0) },
              { label: 'Habit check-ins', color: series(1) },
            ]}
          />
          <div className="h-44">
            {hasChart ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} barGap={2} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} width={40} />
                  <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatLabel={(_l, row) => formatDate(String(row?.date ?? ''), 'EEEE d MMM')} />} />
                  <Bar dataKey="tasks" name="Tasks done" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="habits" name="Habit check-ins" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState compact title="Nothing recorded yet this week" description="Complete tasks or check off habits to see your week take shape." />
            )}
          </div>
        </div>
      </div>
    </Widget>
  )
}

const ACTION_VERB: Record<ActivityEntry['action'], string> = {
  created: 'Added',
  updated: 'Updated',
  deleted: 'Deleted',
  completed: 'Completed',
  reopened: 'Reopened',
  restored: 'Restored',
  logged: 'Logged',
}
const ACTION_TONE: Record<ActivityEntry['action'], string> = {
  created: 'var(--color-accent)',
  updated: 'var(--color-info)',
  deleted: 'var(--color-bad)',
  completed: 'var(--color-ok)',
  reopened: 'var(--color-warn)',
  restored: 'var(--color-violet)',
  logged: 'var(--color-lime)',
}

export function ActivityFeed({ entries, limit = 12, compact }: { entries: ActivityEntry[]; limit?: number; compact?: boolean }) {
  const navigate = useNavigate()
  const db = useDatabase()
  return (
    <ol className="relative space-y-0.5">
      {entries.slice(0, limit).map((a) => {
        const key = a.collection as CollectionKey
        const exists = a.action !== 'deleted' && COLLECTIONS[key] && (db[key] as { id: string }[] | undefined)?.some((r) => r.id === a.entityId)
        const meta = COLLECTIONS[key]
        return (
          <li key={a.id}>
            <button
              type="button"
              disabled={!exists}
              onClick={() => exists && navigate(hrefFor(key, a.entityId))}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-panel-3/50 disabled:cursor-default"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: ACTION_TONE[a.action], boxShadow: `0 0 6px ${ACTION_TONE[a.action]}` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">
                  <span className="text-ink-muted">{ACTION_VERB[a.action]} </span>
                  {meta ? meta.singular.toLowerCase() : 'record'} <span className="font-medium">{truncate(a.label, 60)}</span>
                </span>
                {!compact && a.detail && <span className="block truncate text-[11.5px] text-ink-subtle">{a.detail}</span>}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-ink-subtle" title={new Date(a.at).toLocaleString()}>
                {Date.now() - Date.parse(a.at) < 60_000 ? 'just now' : formatDistanceToNowStrict(new Date(a.at), { addSuffix: false })}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function ActivityWidget({ size }: WidgetProps & { size: WidgetSize }) {
  const db = useDatabase()
  return (
    <Widget title="Recent activity" icon={Activity} size={size} testId="widget-activity">
      {db.activity.length === 0 ? (
        <EmptyState compact icon={Activity} title="No activity yet" description="Everything you add, complete or change is logged here." />
      ) : (
        <div className="-mx-2 max-h-80 overflow-y-auto">
          <ActivityFeed entries={db.activity} limit={15} />
        </div>
      )}
    </Widget>
  )
}

export function NotesWidget({ size }: WidgetProps & { size: WidgetSize }) {
  const notes = useCollection('notes')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const q = query.toLowerCase()
    return [...notes]
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1))
  }, [notes, query])
  return (
    <Widget
      title="Notes"
      icon={StickyNote}
      size={size}
      testId="widget-notes"
      actions={
        <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('notes')}>
          Note
        </Button>
      }
    >
      {notes.length === 0 ? (
        <EmptyState compact icon={StickyNote} title="No notes yet" description="Capture ideas, links and reminders." />
      ) : (
        <>
          {notes.length > 5 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter notes…"
              aria-label="Filter notes"
              className="mb-2 h-8 w-full rounded-md border border-line bg-panel-2/50 px-2.5 text-[12.5px] outline-none focus:border-accent/50"
            />
          )}
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {list.slice(0, 30).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => editor.edit('notes', n.id)} className="w-full rounded-lg border border-line bg-panel-2/30 px-3 py-2 text-left transition-colors hover:border-line-strong">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    {n.pinned && <Pin size={11} className="shrink-0 text-accent" />}
                    <span className="truncate">{n.title}</span>
                  </span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-subtle">{n.body}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Widget>
  )
}

export function FinanceWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const navigate = useNavigate()
  const month = monthKey(today)
  const totals = monthTotals(db.transactions, month)
  const total = db.budgets.find((b) => b.category === '*')
  const status = total ? budgetStatus(total, db.transactions, month) : null
  return (
    <Widget title="Money this month" icon={Wallet} size={size} testId="widget-finance" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/finance')}>Finances</Button>}>
      {totals.count === 0 ? (
        <EmptyState compact icon={Wallet} title="No transactions this month" action={<Button size="sm" icon={Plus} onClick={() => editor.create('transactions')}>Log transaction</Button>} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['In', totals.income],
              ['Out', totals.expenses],
              ['Net', totals.net],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-lg border border-line bg-panel-2/30 px-1 py-2">
                <p className="eyebrow">{label}</p>
                <p className={cn('mt-1 truncate font-mono text-[13px] tabular', label === 'Net' && (v as number) < 0 ? 'text-bad' : 'text-ink')}>{fmt.money(v as number, { showPence: false })}</p>
              </div>
            ))}
          </div>
          {status && (
            <div>
              <div className="mb-1 flex justify-between text-[12px] text-ink-muted">
                <span>Monthly budget</span>
                <span className="font-mono tabular">
                  {fmt.money(status.spent, { showPence: false })} / {fmt.money(status.budget.limit, { showPence: false })}
                </span>
              </div>
              <ProgressBar value={status.ratio * 100} tone={status.state === 'over' ? 'bad' : status.state === 'warn' ? 'warn' : 'ok'} size="sm" label="Budget used" />
            </div>
          )}
        </div>
      )}
    </Widget>
  )
}

export function CheckInWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const checkIns = useCollection('checkIns')
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()
  const latest = [...checkIns].filter((c) => c.date === today).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  return (
    <Widget title="Check-in" icon={Smile} size={size} testId="widget-checkin">
      {latest && (
        <p className="mb-3 rounded-lg border border-line bg-panel-2/30 px-3 py-2 text-[12.5px] text-ink-muted">
          Latest today: mood <span className="text-ink">{MOOD_SCALE[latest.mood - 1]?.label}</span>, energy <span className="text-ink">{ENERGY_SCALE[latest.energy - 1]?.label}</span>
        </p>
      )}
      <p className="mb-1.5 text-[12px] text-ink-muted">Mood</p>
      <ScaleInput value={mood} onChange={setMood} options={MOOD_SCALE} label="Mood" />
      <p className="mt-3 mb-1.5 text-[12px] text-ink-muted">Energy</p>
      <ScaleInput value={energy} onChange={setEnergy} options={ENERGY_SCALE} label="Energy" />
      <Button
        variant="primary"
        size="sm"
        className="mt-3 w-full"
        disabled={!mood || !energy}
        onClick={() => {
          actions.create('checkIns', { date: today, at: new Date().toISOString(), mood: mood as number, energy: energy as number })
          setMood(undefined)
          setEnergy(undefined)
          toast({ title: 'Check-in saved' })
        }}
      >
        Save check-in
      </Button>
    </Widget>
  )
}

export function ReadingWidget({ size }: WidgetProps & { size: WidgetSize }) {
  const media = useCollection('media')
  const navigate = useNavigate()
  const current = media.filter((m) => m.status === 'in_progress')
  return (
    <Widget title="Now reading & watching" icon={BookOpen} size={size} testId="widget-reading" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/library')}>Library</Button>}>
      {current.length === 0 ? (
        <EmptyState compact icon={BookOpen} title="Nothing in progress" description="Mark a book, film or podcast as In Progress to see it here." />
      ) : (
        <ul className="space-y-2.5">
          {current.slice(0, 5).map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => editor.edit('media', m.id)} className="w-full text-left">
                <p className="truncate text-[13.5px] text-ink">{m.title}</p>
                <p className="truncate text-[11.5px] text-ink-subtle">{m.creator}</p>
                {mediaProgress(m) !== null && <ProgressBar value={mediaProgress(m)} size="xs" className="mt-1.5" showValue label={`${m.title} progress`} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}

export function SocialWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const people = useCollection('people')
  const dates = useCollection('importantDates')
  const navigate = useNavigate()
  const due = peopleToReconnect(people, today).slice(0, 4)
  const occasions = upcomingOccasions(dates, today, 30).slice(0, 4)
  return (
    <Widget title="Stay connected" icon={HeartHandshake} size={size} testId="widget-social" actions={<Button size="xs" variant="ghost" onClick={() => navigate('/social')}>Social</Button>}>
      {due.length === 0 && occasions.length === 0 ? (
        <EmptyState compact icon={HeartHandshake} title="Nothing due" description="Reconnect reminders and occasions in the next 30 days appear here." />
      ) : (
        <div className="space-y-3">
          {due.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Reconnect</p>
              {due.map(({ person, daysSince }) => (
                <div key={person.id} className="flex items-center justify-between gap-2 py-1 text-[13px]">
                  <span className="truncate text-ink">{person.name}</span>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => actions.update('people', person.id, (p) => ({ lastContact: today, contactLog: [...p.contactLog.filter((d) => d !== today), today] }), { action: 'logged', detail: 'Got in touch' })}
                    title={daysSince === null ? 'Never logged' : `${daysSince} days since last contact`}
                  >
                    Done
                  </Button>
                </div>
              ))}
            </div>
          )}
          {occasions.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Occasions</p>
              {occasions.map((o) => (
                <div key={o.item.id} className="flex items-center justify-between gap-2 py-1 text-[13px]">
                  <span className="truncate text-ink">{o.item.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-subtle">{relativeDay(o.next, today)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Widget>
  )
}

export { NotebookPen }
