import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardCheck, Flame, LayoutTemplate, Minus, Plus, Trophy } from 'lucide-react'
import { GOAL_HORIZONS, GOAL_STATUSES, HABIT_SCHEDULES, LIFE_AREAS, WEEKDAYS, type GoalHorizon } from '@/data/constants'
import type { Goal, Habit } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { periodSummary } from '@/selectors/analytics'
import { completionRate, currentStreak, isDoneOn, isScheduledOn, longestStreak, toggleLog } from '@/selectors/habits'
import { addDaysISO, dateOfTimestamp, eachDay, formatDate, isBetween, relativeDay, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { cn, debounce } from '@/lib/utils'
import { goalProgressOf } from '@/store/lifecycle'
import { actions, useCollection, useDatabase, useRecord, useSettings } from '@/store/store'
import { ProgressRing } from '@/components/ui/display'
import { Heatmap } from '@/components/charts/Heatmap'
import { editor } from '@/components/editor/editorStore'
import { templates } from '@/features/start/model'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { checklistAdd, checklistRows } from '../../components/Checklist'
import { StatGrid, StatTile } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { useShowsHeaderAdd, useTabContext } from '../../nav/tabContext'
import { CheckCircle, Chips, Segmented, StarRating } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'

function scheduleText(h: Habit) {
  if (h.schedule === 'daily') return 'Every day'
  if (h.schedule === 'weekly') return `${h.timesPerWeek}× a week`
  return WEEKDAYS.filter((d) => h.days.includes(d.value)).map((d) => d.short).join(' ')
}

const toggleHabit = (h: Habit, date: string) => actions.update('habits', h.id, (cur) => ({ log: toggleLog(cur.log, date) }), { action: 'logged' })

/** Last seven days as tappable dots — back-fill a missed check-in. */
function WeekDots({ habit, today }: { habit: Habit; today: string }) {
  const days = eachDay(addDaysISO(today, -6), today)
  const color = toneColor(habit.color)
  return (
    <div className="flex gap-1" role="group" aria-label={`${habit.name}, last 7 days`}>
      {days.map((d) => {
        const done = isDoneOn(habit, d)
        const scheduled = isScheduledOn(habit, d)
        return (
          <button
            key={d}
            type="button"
            disabled={d < habit.startDate || habit.archived}
            onClick={() => toggleHabit(habit, d)}
            aria-pressed={done}
            aria-label={`${formatDate(d, 'EEEE')}: ${done ? 'done' : 'not done'}`}
            className="flex size-7 items-center justify-center disabled:opacity-30"
          >
            <span className="flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold" style={{ background: done ? color : 'transparent', border: done ? 'none' : `1.5px ${scheduled ? 'solid' : 'dashed'} var(--color-line-strong)`, color: done ? 'var(--ios-cell)' : 'var(--color-ink-subtle)' }}>
              {formatDate(d, 'EEEEE')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HabitRow({ habit, today }: { habit: Habit; today: string }) {
  const ws = useSettings().weekStartsOn
  const done = isDoneOn(habit, today)
  const streak = currentStreak(habit, today, ws)
  return (
    <div className="px-4 py-2" data-testid="m-habit-row">
      <div className="flex items-center gap-3">
        <CheckCircle checked={done} color={toneColor(habit.color)} size={28} label={`${habit.name}: ${done ? 'done' : 'not done'} today`} onToggle={() => toggleHabit(habit, today)} />
        <button type="button" onClick={() => nav.push(`habits/habit/${habit.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={cn('ios-body block truncate', done ? 'text-ink-subtle' : 'text-ink')}>{habit.name}</span>
            <span className="ios-footnote flex items-center gap-2 text-ink-subtle">
              {scheduleText(habit)}
              {streak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[var(--color-amber)]">
                  <Flame size={12} /> {streak}
                  {habit.schedule === 'weekly' ? ' wk' : ''}
                </span>
              )}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-subtle opacity-60" />
        </button>
      </div>
      <div className="mt-1 pl-[42px]">
        <WeekDots habit={habit} today={today} />
      </div>
    </div>
  )
}

function GoalRow({ goal, today }: { goal: Goal; today: string }) {
  const pct = goalProgressOf(goal)
  return (
    <button type="button" onClick={() => nav.push(`habits/goal/${goal.id}`)} className="ios-press flex w-full items-center gap-3 px-4 py-3 text-left" data-testid="m-goal-row">
      <ProgressRing value={pct} size={40} stroke={4} tone={goal.status === 'completed' ? 'ok' : undefined}>
        <span className="text-[10.5px] font-semibold text-ink tabular-nums">{Math.round(pct)}</span>
      </ProgressRing>
      <span className="min-w-0 flex-1">
        <span className={cn('ios-body block truncate text-ink', goal.status === 'completed' && 'text-ink-subtle line-through')}>{goal.title}</span>
        <span className="ios-footnote block truncate text-ink-subtle">
          {GOAL_HORIZONS.label(goal.horizon)} · {LIFE_AREAS.label(goal.area)}
          {goal.targetDate ? ` · ${relativeDay(goal.targetDate, today)}` : ''}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-subtle opacity-60" />
    </button>
  )
}

export function HabitsScreen() {
  const [seg, setSeg] = useState<'habits' | 'goals'>('habits')
  const showAdd = useShowsHeaderAdd()
  useEffect(() => useTabContext.getState().set({ habitsSegment: seg }), [seg])
  const today = useToday()
  const habits = useCollection('habits')
  const goals = useCollection('goals')
  const [goalFilter, setGoalFilter] = useState<'active' | 'completed' | 'all' | GoalHorizon>('active')
  const active = habits.filter((h) => !h.archived)
  const dueToday = active.filter((h) => isScheduledOn(h, today))
  const notToday = active.filter((h) => !isScheduledOn(h, today))
  const archived = habits.filter((h) => h.archived)
  const shownGoals = goals
    .filter((g) => (goalFilter === 'active' ? g.status === 'active' : goalFilter === 'completed' ? g.status === 'completed' : goalFilter === 'all' ? true : g.horizon === goalFilter && g.status === 'active'))
    .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))
  return (
    <Screen
      title="Habits"
      large
      testId="screen-habits"
      trailing={
        showAdd && (
          <NavButton label={seg === 'habits' ? 'New habit' : 'New goal'} testId="habits-add" onClick={() => editor.create(seg === 'habits' ? 'habits' : 'goals')}>
            <Plus size={26} />
          </NavButton>
        )
      }
      header={
        <Segmented
          value={seg}
          onChange={setSeg}
          ariaLabel="Habits or goals"
          options={[
            { value: 'habits', label: 'Habits' },
            { value: 'goals', label: 'Goals' },
          ]}
        />
      }
    >
      <Section>
        <Cell icon={ClipboardCheck} iconTone="violet" title="Weekly Review" subtitle="What you recorded, and your reflection" chevron onClick={() => nav.push('habits/review')} />
        {/* Ready-made habits and routines stay reachable after the getting-started guide is gone. */}
        <Cell icon={LayoutTemplate} iconTone="violet" title="Starter Templates" subtitle="Ready-made habits and routines" chevron onClick={() => templates.show()} testId="m-habits-templates" />
      </Section>
      {seg === 'habits' ? (
        <>
          <Section header="Today" footer={active.length ? 'Tap a day to back-fill a check-in. Open a habit for its full history.' : undefined}>
            {active.length === 0 && <EmptyRow>No habits yet. Tap + to add one — daily, on chosen days, or a number of times a week.</EmptyRow>}
            {active.length > 0 && dueToday.length === 0 && <EmptyRow>No habits scheduled today.</EmptyRow>}
            {dueToday.map((h) => (
              <HabitRow key={h.id} habit={h} today={today} />
            ))}
          </Section>
          {notToday.length > 0 && (
            <Section header="Not scheduled today">
              {notToday.map((h) => (
                <HabitRow key={h.id} habit={h} today={today} />
              ))}
            </Section>
          )}
          {archived.length > 0 && (
            <Section header="Archived">
              {archived.map((h) => (
                <Cell key={h.id} title={h.name} subtitle={`${h.log.length} check-ins`} chevron onClick={() => nav.push(`habits/habit/${h.id}`)} />
              ))}
            </Section>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 px-4">
            <Chips
              value={goalFilter}
              onChange={setGoalFilter}
              ariaLabel="Goal filter"
              options={[
                { value: 'active', label: 'Active', count: goals.filter((g) => g.status === 'active').length },
                ...GOAL_HORIZONS.list.map((h) => ({ value: h.value, label: h.label })),
                { value: 'completed', label: 'Completed' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          <Section>
            {shownGoals.length === 0 && <EmptyRow>{goals.length ? 'No goals here.' : 'No goals yet. Tap + to set one — track it by %, milestones or a number.'}</EmptyRow>}
            {shownGoals.map((g) => (
              <GoalRow key={g.id} goal={g} today={today} />
            ))}
          </Section>
        </>
      )}
    </Screen>
  )
}

export function HabitDetailScreen({ params }: { params: Record<string, string> }) {
  const habit = useRecord('habits', params.id)
  const today = useToday()
  const ws = useSettings().weekStartsOn
  if (!habit) return <MissingScreen title="Habit" />
  const rate = completionRate(habit, addDaysISO(today, -29), today, today, ws)
  return (
    <Screen title={habit.name} trailing={<NavButton onClick={() => editor.edit('habits', habit.id)}>Edit</NavButton>} testId="screen-habit">
      <div className="px-4 pt-2 pb-5">
        <p className="ios-title2 text-ink">{habit.name}</p>
        <p className="ios-subhead mt-0.5 text-ink-subtle">
          {scheduleText(habit)} · {LIFE_AREAS.label(habit.area)} · {HABIT_SCHEDULES.label(habit.schedule)}
        </p>
        {habit.description && <p className="ios-subhead mt-2 text-ink-muted">{habit.description}</p>}
      </div>
      <StatGrid>
        <StatTile label="Current streak" value={<span className="inline-flex items-center gap-1"><Flame size={20} className="text-[var(--color-amber)]" />{currentStreak(habit, today, ws)}</span>} sub={habit.schedule === 'weekly' ? 'weeks' : 'days'} />
        <StatTile label="Best streak" value={<span className="inline-flex items-center gap-1"><Trophy size={18} className="text-[var(--color-violet)]" />{longestStreak(habit, today, ws)}</span>} sub={habit.schedule === 'weekly' ? 'weeks' : 'days'} />
        <StatTile label="Last 30 days" value={rate.rate === null ? '—' : `${Math.round(rate.rate * 100)}%`} sub={`${rate.done} of ${rate.expected}`} tone="lime" />
        <StatTile label="All check-ins" value={habit.log.length} sub={`since ${formatDate(habit.startDate, 'd MMM')}`} />
      </StatGrid>
      <Section header="Last 7 days">
        <div className="flex justify-center py-2">
          <WeekDots habit={habit} today={today} />
        </div>
      </Section>
      <Section header="History" footer="Tap any day to add or remove a check-in.">
        <div className="flex justify-center overflow-x-auto px-3 py-3">
          <Heatmap
            end={today}
            weeks={17}
            weekStartsOn={ws}
            cell={13}
            value={(d) => (isDoneOn(habit, d) ? 1 : 0)}
            isActive={(d) => isScheduledOn(habit, d)}
            color={toneColor(habit.color)}
            onToggle={habit.archived ? undefined : (d) => d >= habit.startDate && toggleHabit(habit, d)}
            label={(d, v) => `${formatDate(d, 'EEE d MMM')}: ${v ? 'done' : 'not done'}`}
          />
        </div>
      </Section>
      <Section>
        <ActionCell onClick={() => actions.update('habits', habit.id, { archived: !habit.archived })}>{habit.archived ? 'Restore Habit' : 'Archive Habit'}</ActionCell>
        <ActionCell destructive onClick={async () => { if (await deleteRecord('habits', habit.id)) nav.pop() }}>
          Delete Habit
        </ActionCell>
      </Section>
    </Screen>
  )
}

export function GoalDetailScreen({ params }: { params: Record<string, string> }) {
  const goal = useRecord('goals', params.id)
  const today = useToday()
  const [value, setValue] = useState<string>('')
  useEffect(() => {
    if (goal?.progressMode === 'numeric') setValue(String(goal.currentValue ?? goal.startValue ?? 0))
  }, [goal?.id, goal?.currentValue, goal?.progressMode, goal?.startValue])
  if (!goal) return <MissingScreen title="Goal" />
  const pct = goalProgressOf(goal)
  const update = (patch: Partial<Goal>) => actions.update('goals', goal.id, patch)
  const commitNumeric = (n: number) => Number.isFinite(n) && update({ currentValue: n })
  return (
    <Screen title="Goal" trailing={<NavButton onClick={() => editor.edit('goals', goal.id)}>Edit</NavButton>} testId="screen-goal">
      <div className="flex flex-col items-center px-6 pt-3 pb-6 text-center">
        <ProgressRing value={pct} size={128} stroke={12} tone={goal.status === 'completed' ? 'ok' : 'cyan'} label={`${Math.round(pct)}% complete`}>
          <span className="text-[30px] font-bold text-ink tabular-nums">{Math.round(pct)}%</span>
        </ProgressRing>
        <h2 className="ios-title2 mt-4 text-ink">{goal.title}</h2>
        <p className="ios-subhead mt-1 text-ink-subtle">
          {GOAL_HORIZONS.label(goal.horizon)} · {LIFE_AREAS.label(goal.area)}
          {goal.targetDate ? ` · target ${formatDate(goal.targetDate, 'd MMM yyyy')}` : ''}
        </p>
        {goal.status !== 'active' && <p className="ios-footnote mt-1 font-semibold" style={{ color: goal.status === 'completed' ? 'var(--color-ok)' : 'var(--color-warn)' }}>{GOAL_STATUSES.label(goal.status)}</p>}
        {goal.description && <p className="ios-subhead mt-3 text-ink-muted">{goal.description}</p>}
      </div>

      {goal.status === 'active' && goal.progressMode === 'manual' && (
        <Section header="Progress">
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" aria-label="Decrease by 10%" onClick={() => update({ progress: Math.max(0, goal.progress - 10) })} className="flex size-11 items-center justify-center rounded-full bg-[var(--ios-fill)] text-accent">
              <Minus size={20} />
            </button>
            <input type="range" min={0} max={100} step={5} value={goal.progress} onChange={(e) => update({ progress: Number(e.target.value) })} className="h-2 flex-1 accent-[var(--color-accent)]" aria-label="Progress percent" />
            <button type="button" aria-label="Increase by 10%" onClick={() => update({ progress: Math.min(100, goal.progress + 10) })} className="flex size-11 items-center justify-center rounded-full bg-[var(--ios-fill)] text-accent">
              <Plus size={20} />
            </button>
          </div>
        </Section>
      )}
      {goal.status === 'active' && goal.progressMode === 'numeric' && (
        <Section header="Progress" footer={`From ${goal.startValue ?? 0} to ${goal.targetValue} ${goal.unit ?? ''}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" aria-label="Decrease by 1" onClick={() => commitNumeric((goal.currentValue ?? goal.startValue ?? 0) - 1)} className="flex size-11 items-center justify-center rounded-full bg-[var(--ios-fill)] text-accent">
              <Minus size={20} />
            </button>
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => commitNumeric(Number(value))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              aria-label={`Current value${goal.unit ? ` in ${goal.unit}` : ''}`}
              className="min-w-0 flex-1 bg-[var(--ios-fill)] text-center text-[22px] font-semibold text-ink tabular-nums outline-none"
            />
            <button type="button" aria-label="Increase by 1" onClick={() => commitNumeric((goal.currentValue ?? goal.startValue ?? 0) + 1)} className="flex size-11 items-center justify-center rounded-full bg-[var(--ios-fill)] text-accent">
              <Plus size={20} />
            </button>
          </div>
        </Section>
      )}
      <Section header="Milestones" footer={goal.progressMode === 'milestones' ? 'Progress is the share of milestones completed.' : undefined}>
        {checklistRows(goal.milestones, (milestones) => update({ milestones }), today)}
        {checklistAdd(goal.milestones, (milestones) => update({ milestones }), 'Add a milestone')}
      </Section>
      <Section>
        {goal.status === 'active' ? (
          <ActionCell onClick={() => update({ status: 'completed' })} testId="goal-complete">Mark as Complete</ActionCell>
        ) : (
          <ActionCell onClick={() => update({ status: 'active' })}>Reactivate Goal</ActionCell>
        )}
        <ActionCell destructive onClick={async () => { if (await deleteRecord('goals', goal.id)) nav.pop() }}>
          Delete Goal
        </ActionCell>
      </Section>
    </Screen>
  )
}

const REVIEW_FIELDS = [
  { key: 'wins', label: 'Wins', placeholder: 'What went well?' },
  { key: 'challenges', label: 'Challenges', placeholder: 'What got in the way?' },
  { key: 'lessons', label: 'Lessons', placeholder: 'What did you learn?' },
  { key: 'focus', label: 'Focus for next week', placeholder: 'The one to three things that matter most.' },
] as const

export function WeeklyReviewScreen() {
  const db = useDatabase()
  const today = useToday()
  const ws = db.settings.weekStartsOn
  const [weekStart, setWeekStart] = useState(() => weekStartISO(today, ws))
  const weekEnd = addDaysISO(weekStart, 6)
  const existing = db.weeklyReviews.find((r) => r.weekStart === weekStart)
  const [draft, setDraft] = useState<Record<string, string | number | undefined>>({})
  const idRef = useRef<string | undefined>(existing?.id)
  useEffect(() => {
    idRef.current = existing?.id
    setDraft({ wins: existing?.wins, challenges: existing?.challenges, lessons: existing?.lessons, focus: existing?.focus, rating: existing?.rating })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])
  const save = useMemo(
    () =>
      debounce((ws: string, d: Record<string, string | number | undefined>) => {
        const clean = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v]))
        if (idRef.current) actions.update('weeklyReviews', idRef.current, clean)
        else if (Object.values(clean).some((v) => v !== undefined)) idRef.current = actions.create('weeklyReviews', { weekStart: ws, ...clean }).id
      }, 600),
    [],
  )
  useEffect(() => () => save.flush(), [save, weekStart])
  const change = (k: string, v: string | number | undefined) => {
    const next = { ...draft, [k]: v }
    setDraft(next)
    save(weekStart, next)
  }
  const s = useMemo(() => periodSummary(db, { start: weekStart, end: weekEnd }, today, ws), [db, weekStart, weekEnd, today, ws])
  const goalsDone = db.goals.filter((g) => g.status === 'completed' && g.completedAt && isBetween(dateOfTimestamp(g.completedAt), weekStart, weekEnd))
  return (
    <Screen title="Weekly Review" testId="screen-review">
      <div className="flex items-center px-2 pt-2 pb-3">
        <button type="button" aria-label="Previous week" onClick={() => setWeekStart(addDaysISO(weekStart, -7))} className="flex size-11 items-center justify-center text-accent">
          <ChevronLeft size={24} />
        </button>
        <p className="ios-headline flex-1 text-center text-ink">
          {formatDate(weekStart, 'd MMM')} – {formatDate(weekEnd, 'd MMM yyyy')}
        </p>
        <button type="button" aria-label="Next week" disabled={addDaysISO(weekStart, 7) > today} onClick={() => setWeekStart(addDaysISO(weekStart, 7))} className="flex size-11 items-center justify-center text-accent disabled:opacity-30">
          <ChevronRight size={24} />
        </button>
      </div>
      <Section header="What you recorded" plain>
        <StatGrid className="!mx-0 !mb-0">
          <StatTile label="Tasks done" value={s.tasksCompleted} tone="cyan" />
          <StatTile label="Habits" value={s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`} sub={`${s.habitCheckIns} check-ins`} tone="lime" />
          <StatTile label="Workouts" value={s.workouts} sub={s.workoutMinutes ? formatMinutes(s.workoutMinutes) : undefined} tone="magenta" />
          <StatTile label="Learning" value={formatMinutes(s.learningMinutes)} tone="violet" />
          <StatTile label="Journal" value={s.journalEntries} sub={s.avgMood ? `mood ${s.avgMood.toFixed(1)}/5` : undefined} />
          <StatTile label="Goals done" value={s.goalsCompleted} sub={goalsDone.map((g) => g.title).join(', ') || undefined} tone="ok" />
        </StatGrid>
      </Section>
      <Section header="How was the week?">
        <div className="px-4 py-2.5">
          <StarRating value={draft.rating as number | undefined} onChange={(v) => change('rating', v)} label="Week rating" />
        </div>
      </Section>
      {REVIEW_FIELDS.map((f) => (
        <Section key={f.key} header={f.label}>
          <textarea
            value={(draft[f.key] as string) ?? ''}
            onChange={(e) => change(f.key, e.target.value)}
            placeholder={f.placeholder}
            aria-label={f.label}
            rows={3}
            className="ios-body block w-full resize-none bg-transparent px-4 py-3 text-ink outline-none placeholder:text-ink-subtle"
          />
        </Section>
      ))}
      <p className="ios-footnote -mt-4 px-8 text-ink-subtle">Saved automatically.</p>
    </Screen>
  )
}

export function MissingScreen({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <div className="px-8 pt-16 text-center">
        <p className="ios-headline text-ink">Not found</p>
        <p className="ios-subhead mt-1 text-ink-subtle">This {title.toLowerCase()} may have been deleted.</p>
      </div>
    </Screen>
  )
}

