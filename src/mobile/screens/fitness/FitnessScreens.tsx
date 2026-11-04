import { useMemo } from 'react'
import { Dumbbell, Footprints, Medal, Moon, Plus, Sunrise } from 'lucide-react'
import { INTENSITIES, TIMES_OF_DAY, WEEKDAYS, WORKOUT_TYPES } from '@/data/constants'
import type { Routine } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { fitnessSummary, personalRecords, routineCompletion, routineConsistency, routineScheduledOn, sleepMinutes, workoutWeekStreak } from '@/selectors/fitness'
import { addDaysISO, formatDate, relativeDay, weekStartISO } from '@/lib/dates'
import { formatMinutes, formatNumber } from '@/lib/format'
import { actions, useCollection, useDatabase } from '@/store/store'
import { Heatmap } from '@/components/charts/Heatmap'
import { editor } from '@/components/editor/editorStore'
import { NotesSection } from '../../components/NotesSection'
import { RecordScreen } from '../../components/RecordScreen'
import { StatGrid, StatTile } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { CheckCircle } from '../../ui/controls'
import { Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { actionSheet } from '../../ui/ActionSheet'

function toggleStep(r: Routine, date: string, stepId: string) {
  actions.update(
    'routines',
    r.id,
    (cur) => {
      const done = cur.log[date] ?? []
      const next = done.includes(stepId) ? done.filter((s) => s !== stepId) : [...done, stepId]
      const log = { ...cur.log }
      if (next.length) log[date] = next
      else delete log[date]
      return { log }
    },
    { action: 'logged' },
  )
}

function RoutineSection({ routine, today }: { routine: Routine; today: string }) {
  const c = routineCompletion(routine, today)
  const done = routine.log[today] ?? []
  return (
    <Section header={`${routine.name} · ${c.done}/${c.total}`} headerAction={<SeeAll label="Edit" onClick={() => editor.edit('routines', routine.id)} />} footer={c.complete ? 'Complete for today.' : undefined}>
      {routine.steps.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-4">
          <CheckCircle checked={done.includes(s.id)} label={`${s.title}: ${done.includes(s.id) ? 'done' : 'not done'}`} onToggle={() => toggleStep(routine, today, s.id)} size={22} testId="routine-step" />
          <span className={`ios-body py-[11px] ${done.includes(s.id) ? 'text-ink-subtle line-through' : 'text-ink'}`}>{s.title}</span>
        </div>
      ))}
    </Section>
  )
}

export function FitnessScreen() {
  const db = useDatabase()
  const today = useToday()
  const fmt = useFormatters()
  const ws = db.settings.weekStartsOn
  const t = db.settings.targets
  const week = fitnessSummary(db, weekStartISO(today, ws), today)
  const streak = workoutWeekStreak(db.workouts, today, ws, 1)
  const recent = [...db.workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3)
  const lastSleep = [...db.sleep].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const todayActivity = db.dailyActivity.find((a) => a.date === today)
  const routines = db.routines.filter((r) => routineScheduledOn(r, today))
  const active = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of db.workouts) m.set(w.date, (m.get(w.date) ?? 0) + 1)
    for (const a of db.dailyActivity) if ((a.activeMinutes ?? 0) > 0 || (a.steps ?? 0) > 0) m.set(a.date, Math.max(m.get(a.date) ?? 0, 0.5))
    return m
  }, [db.workouts, db.dailyActivity])

  return (
    <Screen
      title="Fitness"
      large
      testId="screen-fitness"
      trailing={
        <NavButton
          label="Log"
          testId="fitness-add"
          onClick={() =>
            actionSheet({
              title: 'Log',
              options: [
                { label: 'Workout', onSelect: () => editor.create('workouts') },
                { label: 'Sleep', onSelect: () => editor.create('sleep') },
                { label: todayActivity ? 'Edit Today’s Activity' : 'Today’s Activity', onSelect: () => (todayActivity ? editor.edit('dailyActivity', todayActivity.id) : editor.create('dailyActivity')) },
                { label: 'Wellbeing Note', onSelect: () => editor.create('notes', { area: 'wellbeing' }) },
              ],
            })
          }
        >
          <Plus size={26} />
        </NavButton>
      }
    >
      <StatGrid>
        <StatTile label="Workouts this week" value={t.weeklyWorkouts ? `${week.workouts}/${t.weeklyWorkouts}` : week.workouts} sub={week.workoutMinutes ? formatMinutes(week.workoutMinutes) : undefined} tone="magenta" />
        <StatTile label="Weekly streak" value={`${streak} wk`} sub="weeks with a workout" tone="amber" />
        <StatTile label="Avg sleep" value={week.avgSleepMinutes === null ? '—' : formatMinutes(week.avgSleepMinutes)} sub={t.sleepHours ? `target ${t.sleepHours}h` : `${week.sleepNights} nights`} tone="violet" />
        <StatTile label="Active days" value={week.activeDays} sub="this week" tone="lime" />
      </StatGrid>

      {routines.map((r) => (
        <RoutineSection key={r.id} routine={r} today={today} />
      ))}

      <Section header="Recent workouts" headerAction={<SeeAll onClick={() => nav.push('more/fitness/workouts')} />}>
        {recent.length === 0 && <EmptyRow>No workouts yet.</EmptyRow>}
        {recent.map((w) => (
          <Cell key={w.id} title={w.title} subtitle={`${WORKOUT_TYPES.label(w.type)} · ${formatMinutes(w.durationMin)} · ${relativeDay(w.date, today)}`} chevron onClick={() => editor.edit('workouts', w.id)} />
        ))}
      </Section>

      <Section>
        <Cell icon={Moon} iconTone="violet" title="Sleep" detail={lastSleep ? formatMinutes(sleepMinutes(lastSleep)) : undefined} subtitle={lastSleep ? `${relativeDay(lastSleep.date, today)} · ${fmt.time(lastSleep.bedTime)}–${fmt.time(lastSleep.wakeTime)}` : 'Not logged'} chevron onClick={() => nav.push('more/fitness/sleep')} />
        <Cell icon={Footprints} iconTone="cyan" title="Activity" detail={todayActivity?.steps !== undefined ? `${formatNumber(todayActivity.steps)} steps` : undefined} subtitle={todayActivity ? 'Today' : 'Nothing logged today'} chevron onClick={() => nav.push('more/fitness/activity')} />
        <Cell icon={Sunrise} iconTone="amber" title="Routines" detail={db.routines.length || undefined} chevron onClick={() => nav.push('more/fitness/routines')} />
        <Cell icon={Medal} iconTone="warn" title="Personal Records" chevron onClick={() => nav.push('more/fitness/records')} />
        <Cell icon={Dumbbell} iconTone="magenta" title="All Workouts" detail={db.workouts.length || undefined} chevron onClick={() => nav.push('more/fitness/workouts')} />
      </Section>

      <Section header="Consistency" footer="Bright: a workout. Dim: activity only. About showing up — no appearance scores.">
        <div className="flex justify-center overflow-x-auto px-3 py-3">
          <Heatmap end={today} weeks={17} weekStartsOn={ws} cell={13} value={(d) => active.get(d) ?? 0} color="var(--color-chart-3)" label={(d, v) => `${formatDate(d, 'EEE d MMM')}: ${v >= 1 ? 'workout' : v > 0 ? 'activity' : 'nothing logged'}`} />
        </div>
      </Section>

      <NotesSection header="Wellbeing notes" filter={(n) => n.area === 'wellbeing' || n.area === 'health'} defaults={{ area: 'wellbeing' }} />
    </Screen>
  )
}

export function WorkoutsScreen() {
  const workouts = useCollection('workouts')
  const today = useToday()
  return (
    <RecordScreen
      title="Workouts"
      collection="workouts"
      testId="screen-workouts"
      items={[...workouts].sort((a, b) => (a.date < b.date ? 1 : -1))}
      search={(w) => `${w.title} ${w.notes ?? ''} ${w.exercises.map((e) => e.name).join(' ')}`}
      empty="No workouts logged yet."
      row={(w) => ({
        title: w.title,
        subtitle: `${WORKOUT_TYPES.label(w.type)} · ${INTENSITIES.label(w.intensity)} · ${relativeDay(w.date, today)}${w.exercises.length ? ` · ${w.exercises.length} exercises` : ''}`,
        detail: formatMinutes(w.durationMin),
      })}
    />
  )
}

export function RecordsScreen() {
  const workouts = useCollection('workouts')
  const fmt = useFormatters()
  const records = useMemo(() => personalRecords(workouts), [workouts])
  return (
    <Screen title="Personal Records" testId="screen-records">
      <Section footer="Best efforts from the exercises you log in workouts.">
        {records.length === 0 && <EmptyRow>Add exercises to a workout (e.g. Squat 3×5 at 60 kg) to see records.</EmptyRow>}
        {records.map((r) => (
          <Cell
            key={r.exercise}
            title={r.exercise}
            subtitle={`${r.sessions}× · last ${fmt.shortDate(r.lastDate)}`}
            detail={r.bestWeightKg ? `${r.bestWeightKg.value} kg${r.bestWeightKg.reps ? ` × ${r.bestWeightKg.reps}` : ''}` : r.bestDistanceKm ? `${r.bestDistanceKm.value} km` : r.mostReps ? `${r.mostReps.value} reps` : r.longestMin ? `${r.longestMin.value} min` : undefined}
          />
        ))}
      </Section>
    </Screen>
  )
}

export function ActivityScreen() {
  const logs = useCollection('dailyActivity')
  const target = useDatabase().settings.targets.dailySteps
  return (
    <RecordScreen
      title="Activity"
      collection="dailyActivity"
      testId="screen-activity"
      items={[...logs].sort((a, b) => (a.date < b.date ? 1 : -1))}
      empty="Log steps, active minutes or distance by hand from your phone or watch."
      footer={target ? `Daily step target: ${formatNumber(target)}.` : undefined}
      row={(a) => ({
        title: formatDate(a.date, 'EEEE d MMM'),
        subtitle: [a.activeMinutes !== undefined ? `${a.activeMinutes} active min` : null, a.distanceKm !== undefined ? `${a.distanceKm} km` : null, a.notes].filter(Boolean).join(' · ') || undefined,
        detail: a.steps !== undefined ? `${formatNumber(a.steps)}${target && a.steps >= target ? ' ✓' : ''}` : undefined,
      })}
    />
  )
}

export function SleepScreen() {
  const sleep = useCollection('sleep')
  const fmt = useFormatters()
  const target = useDatabase().settings.targets.sleepHours
  return (
    <RecordScreen
      title="Sleep"
      collection="sleep"
      testId="screen-sleep"
      items={[...sleep].sort((a, b) => (a.date < b.date ? 1 : -1))}
      empty="Log when you went to bed and woke up; duration is worked out for you."
      footer={target ? `Target: ${target} hours a night.` : undefined}
      row={(s) => ({
        title: formatDate(s.date, 'EEEE d MMM'),
        subtitle: `${fmt.time(s.bedTime)} → ${fmt.time(s.wakeTime)}${s.quality ? ` · ${'★'.repeat(s.quality)}` : ''}`,
        detail: <span style={{ color: target && sleepMinutes(s) < target * 60 ? 'var(--color-warn)' : undefined }}>{formatMinutes(sleepMinutes(s))}</span>,
      })}
    />
  )
}

export function RoutinesScreen() {
  const routines = useCollection('routines')
  const today = useToday()
  return (
    <RecordScreen
      title="Routines"
      collection="routines"
      testId="screen-routines"
      items={routines}
      empty="Build a morning, evening or workout routine as a checklist, on the days you choose."
      row={(r) => {
        const cons = routineConsistency([r], addDaysISO(today, -29), today, today)
        return {
          title: r.name,
          subtitle: `${TIMES_OF_DAY.label(r.timeOfDay)} · ${r.days.length === 7 ? 'Every day' : WEEKDAYS.filter((d) => r.days.includes(d.value)).map((d) => d.short).join(' ')} · ${r.steps.length} steps${r.active ? '' : ' · Paused'}`,
          detail: cons.rate === null ? undefined : `${Math.round(cons.rate * 100)}%`,
        }
      }}
      footer="Percent = days fully completed in the last 30 days. Today’s routines appear on the Fitness screen."
    />
  )
}
