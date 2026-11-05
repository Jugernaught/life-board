import { useMemo } from 'react'
import { Activity, Dumbbell, Footprints, HeartPulse, LayoutDashboard, Moon, Plus, Sunrise } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useToday } from '@/hooks/useNow'
import { fitnessSummary, routineConsistency, routineScheduledOn, sleepMinutes, weeklyWorkoutSeries, workoutWeekStreak } from '@/selectors/fitness'
import { addDaysISO, eachDay, formatDate, weekStartISO } from '@/lib/dates'
import { formatMinutes, formatNumber } from '@/lib/format'
import { useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { Heatmap } from '@/components/charts/Heatmap'
import { PageHeader } from '@/components/layout/PageHeader'
import { NotesPanel } from '@/components/shared/NotesPanel'
import { editor } from '@/components/editor/editorStore'
import { ActivityTab, SleepTab, WorkoutsTab } from './LogsTabs'
import { RoutineChecklist, RoutinesTab } from './RoutinesTab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'activity', label: 'Activity', icon: Footprints },
  { id: 'sleep', label: 'Sleep', icon: Moon },
  { id: 'routines', label: 'Routines', icon: Sunrise },
  { id: 'wellbeing', label: 'Wellbeing notes', icon: HeartPulse },
] as const

function Overview({ today }: { today: string }) {
  const db = useDatabase()
  const ws = db.settings.weekStartsOn
  const t = db.settings.targets
  const weekStart = weekStartISO(today, ws)
  const week = fitnessSummary(db, weekStart, today)
  const routineWeek = routineConsistency(db.routines, weekStart, today, today)
  const weekly = useMemo(() => weeklyWorkoutSeries(db.workouts, today, 12, ws).map((w) => ({ ...w, label: formatDate(w.week, 'd MMM') })), [db.workouts, today, ws])
  const nights = useMemo(
    () =>
      eachDay(addDaysISO(today, -29), today).map((d) => {
        const s = db.sleep.find((x) => x.date === d)
        return { date: d, hours: s ? Math.round((sleepMinutes(s) / 60) * 10) / 10 : null }
      }),
    [db.sleep, today],
  )
  const steps = useMemo(() => eachDay(addDaysISO(today, -29), today).map((d) => ({ date: d, steps: db.dailyActivity.find((a) => a.date === d)?.steps ?? null })), [db.dailyActivity, today])
  const streak = workoutWeekStreak(db.workouts, today, ws, 1)
  const activeDaySet = useMemo(() => {
    const set = new Map<string, number>()
    for (const w of db.workouts) set.set(w.date, (set.get(w.date) ?? 0) + 1)
    for (const a of db.dailyActivity) if ((a.activeMinutes ?? 0) > 0 || (a.steps ?? 0) > 0) set.set(a.date, Math.max(set.get(a.date) ?? 0, 0.5))
    return set
  }, [db.workouts, db.dailyActivity])
  const todaysRoutines = db.routines.filter((r) => routineScheduledOn(r, today))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Workouts this week" value={t.weeklyWorkouts ? `${week.workouts}/${t.weeklyWorkouts}` : week.workouts} icon={Dumbbell} tone="magenta" sub={formatMinutes(week.workoutMinutes)} />
        <Stat label="Weekly streak" value={`${streak} wk`} icon={Activity} tone="amber" sub="Weeks with ≥1 workout" />
        <Stat label="Active days" value={week.activeDays} tone="lime" sub="This week" />
        <Stat label="Avg sleep" value={week.avgSleepMinutes === null ? '—' : formatMinutes(week.avgSleepMinutes)} icon={Moon} tone="violet" sub={t.sleepHours ? `Target ${t.sleepHours}h` : `${week.sleepNights} nights logged`} />
        <Stat label="Routines done" value={routineWeek.rate === null ? '—' : `${Math.round(routineWeek.rate * 100)}%`} icon={Sunrise} tone="cyan" sub={`${routineWeek.completed}/${routineWeek.scheduled} this week`} className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Workouts per week"
          description="Last 12 weeks"
          rows={weekly}
          columns={[
            { label: 'Week of', value: (r) => formatDate(r.week, 'd MMM yyyy') },
            { label: 'Workouts', value: (r) => r.count, align: 'right' },
            { label: 'Minutes', value: (r) => r.minutes, align: 'right' },
          ]}
          empty={!weekly.some((w) => w.count)}
          emptyHint="Log workouts to see your consistency."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={12} />
              <YAxis allowDecimals={false} {...axisProps} />
              {t.weeklyWorkouts && <ReferenceLine y={t.weeklyWorkouts} stroke="var(--color-ink-subtle)" strokeDasharray="4 4" label={{ value: 'Target', fill: 'var(--color-ink-subtle)', fontSize: 10, position: 'insideTopRight' }} />}
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatLabel={(_l, r) => `Week of ${formatDate(String(r?.week), 'd MMM')}`} />} />
              <Bar dataKey="count" name="Workouts" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Sleep duration"
          description="Last 30 nights"
          rows={nights.filter((n) => n.hours !== null)}
          columns={[
            { label: 'Morning of', value: (r) => formatDate(r.date, 'EEE d MMM') },
            { label: 'Hours', value: (r) => r.hours, align: 'right' },
          ]}
          empty={!nights.some((n) => n.hours !== null)}
          emptyHint="Log sleep to see your pattern."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nights} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'd MMM')} {...axisProps} minTickGap={24} />
              <YAxis domain={[0, 'dataMax + 1']} {...axisProps} />
              {t.sleepHours && <ReferenceLine y={t.sleepHours} stroke="var(--color-ink-subtle)" strokeDasharray="4 4" />}
              <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}h`} formatLabel={(l) => formatDate(String(l), 'EEE d MMM')} />} />
              <Line type="monotone" dataKey="hours" name="Sleep" stroke={series(3)} strokeWidth={2} dot={{ r: 3, fill: series(3), strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Daily steps"
          description="Last 30 days"
          rows={steps.filter((s) => s.steps !== null)}
          columns={[
            { label: 'Date', value: (r) => formatDate(r.date, 'EEE d MMM') },
            { label: 'Steps', value: (r) => formatNumber(r.steps ?? 0), align: 'right' },
          ]}
          empty={!steps.some((s) => s.steps !== null)}
          emptyHint="Log daily activity to see steps."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={steps} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'd')} {...axisProps} minTickGap={8} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} {...axisProps} width={36} />
              {t.dailySteps && <ReferenceLine y={t.dailySteps} stroke="var(--color-ink-subtle)" strokeDasharray="4 4" />}
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => formatNumber(v)} formatLabel={(l) => formatDate(String(l), 'EEE d MMM')} />} />
              <Bar dataKey="steps" name="Steps" fill={series(0)} radius={[3, 3, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Panel title="Consistency" eyebrow="Days with a workout or logged activity · last 22 weeks">
          <Heatmap end={today} weeks={22} weekStartsOn={ws} value={(d) => activeDaySet.get(d) ?? 0} max={1} color="var(--color-chart-3)" label={(d, v) => `${formatDate(d, 'EEE d MMM')}: ${v >= 1 ? `${v} workout${v === 1 ? '' : 's'}` : v > 0 ? 'activity logged' : 'nothing logged'}`} />
          <p className="mt-3 text-[12px] text-ink-subtle">Bright = workout logged · dim = activity only. Focus is on showing up, not on any score.</p>
        </Panel>
      </div>
      {todaysRoutines.length > 0 && (
        <Panel title="Today's routines" icon={Sunrise}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {todaysRoutines.map((r) => (
              <RoutineChecklist key={r.id} routine={r} date={today} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

export default function FitnessPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'overview')
  return (
    <div>
      <PageHeader
        section="fitness"
        description="Log workouts, activity and sleep, and keep routines on track. Built around consistency and wellbeing — no appearance-based scores."
        actions={
          <>
            <Button icon={Plus} onClick={() => editor.create('sleep')}>
              Sleep
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => editor.create('workouts')}>
              Workout
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'overview' && <Overview today={today} />}
      {tab === 'workouts' && <WorkoutsTab />}
      {tab === 'activity' && <ActivityTab today={today} />}
      {tab === 'sleep' && <SleepTab today={today} />}
      {tab === 'routines' && <RoutinesTab today={today} />}
      {tab === 'wellbeing' && (
        <NotesPanel
          title="Wellbeing notes"
          filter={(n) => n.area === 'wellbeing' || n.area === 'health'}
          defaults={{ area: 'wellbeing' }}
          emptyText="Notes on how you feel, energy, recovery, what helps — private to you."
          limit={200}
        />
      )}
    </div>
  )
}
