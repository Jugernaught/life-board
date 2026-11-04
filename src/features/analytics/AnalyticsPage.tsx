import { useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, Copy, FileText, Printer, Target } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { APPLICATION_STATUSES } from '@/data/constants'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { type DateRange, RANGE_PRESETS, type RangePreset, areaComparison, bucketUnitFor, hasAnyActivity, periodSummary, previousRange, resolveRange, trendSeries } from '@/selectors/analytics'
import { targetStatus } from '@/selectors/finance'
import { projectProgress } from '@/selectors/projects'
import { buildReport } from '@/selectors/report'
import { addDaysISO, addMonthsISO, diffDays, formatDate, monthEndISO, monthKey, monthStartISO, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { truncate } from '@/lib/utils'
import { useDatabase } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Delta, EmptyState, ProgressBar } from '@/components/ui/display'
import { Input, Segmented, Select } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { toast } from '@/components/ui/toast'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { WeeklyReviewPanel } from '@/components/shared/WeeklyReviewPanel'

const TABS = [
  { id: 'trends', label: 'Trends', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'review', label: 'Weekly review', icon: ClipboardCheck },
] as const

type Trend = ReturnType<typeof trendSeries>[number]

function TargetsPanel({ range, today }: { range: DateRange; today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const t = db.settings.targets
  const s = periodSummary(db, range, today, db.settings.weekStartsOn)
  const weeks = Math.max(1, (diffDays(range.start, range.end < today ? range.end : today) + 1) / 7)
  const steps = db.dailyActivity.filter((a) => a.date >= range.start && a.date <= range.end && a.steps !== undefined)
  const avgSteps = steps.length ? steps.reduce((n, a) => n + (a.steps ?? 0), 0) / steps.length : null
  const year = today.slice(0, 4)
  const booksThisYear = db.media.filter((m) => m.type === 'book' && m.status === 'completed' && m.completedDate?.startsWith(year)).length
  const rows: { label: string; actual: string; target: string; pct: number | null }[] = []
  if (t.weeklyWorkouts) rows.push({ label: 'Workouts per week', actual: (s.workouts / weeks).toFixed(1), target: String(t.weeklyWorkouts), pct: (s.workouts / weeks / t.weeklyWorkouts) * 100 })
  if (t.weeklyLearningMinutes) rows.push({ label: 'Learning per week', actual: formatMinutes(s.learningMinutes / weeks), target: formatMinutes(t.weeklyLearningMinutes), pct: (s.learningMinutes / weeks / t.weeklyLearningMinutes) * 100 })
  if (t.sleepHours) rows.push({ label: 'Average sleep', actual: s.avgSleepMinutes === null ? '—' : formatMinutes(s.avgSleepMinutes), target: `${t.sleepHours}h`, pct: s.avgSleepMinutes === null ? null : (s.avgSleepMinutes / 60 / t.sleepHours) * 100 })
  if (t.dailySteps) rows.push({ label: 'Average daily steps', actual: avgSteps === null ? '—' : Math.round(avgSteps).toLocaleString(), target: t.dailySteps.toLocaleString(), pct: avgSteps === null ? null : (avgSteps / t.dailySteps) * 100 })
  if (t.weeklyJournalEntries) rows.push({ label: 'Journal entries per week', actual: (s.journalEntries / weeks).toFixed(1), target: String(t.weeklyJournalEntries), pct: (s.journalEntries / weeks / t.weeklyJournalEntries) * 100 })
  if (t.yearlyReading) rows.push({ label: `Books in ${year}`, actual: String(booksThisYear), target: String(t.yearlyReading), pct: (booksThisYear / t.yearlyReading) * 100 })
  const month = monthKey(today)
  const fin = db.financialTargets.map((x) => targetStatus(x, db.transactions, month))
  const numericGoals = db.goals.filter((g) => g.status === 'active' && g.progressMode === 'numeric' && g.targetValue !== undefined)
  return (
    <Panel title="Progress against targets" icon={Target} eyebrow="Your targets only · set them in Settings → Targets">
      {rows.length === 0 && fin.length === 0 && numericGoals.length === 0 ? (
        <p className="text-[13px] text-ink-subtle">No targets set yet. Add personal targets in Settings, financial targets in Finances, or numeric goals in Goals.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between gap-2 text-[13px]">
                <span className="text-ink">{r.label}</span>
                <span className="font-mono text-[12px] text-ink-muted tabular">
                  {r.actual} / {r.target}
                </span>
              </div>
              <ProgressBar value={r.pct === null ? null : Math.min(100, r.pct)} tone={r.pct !== null && r.pct >= 100 ? 'ok' : undefined} size="sm" label={r.label} />
            </div>
          ))}
          {fin.map((f) => (
            <div key={f.target.id}>
              <div className="mb-1 flex justify-between gap-2 text-[13px]">
                <span className="text-ink">{f.target.name} <span className="text-ink-subtle">(this month)</span></span>
                <span className="font-mono text-[12px] text-ink-muted tabular">
                  {fmt.money(f.actual, { showPence: false })} / {fmt.money(f.target.amount, { showPence: false })}
                </span>
              </div>
              <ProgressBar value={Math.max(0, Math.min(100, f.ratio * 100))} tone={f.met ? 'ok' : 'warn'} size="sm" label={f.target.name} />
            </div>
          ))}
          {numericGoals.map((g) => {
            const start = g.startValue ?? 0
            const pct = g.targetValue === start ? 0 : (((g.currentValue ?? start) - start) / ((g.targetValue as number) - start)) * 100
            return (
              <div key={g.id}>
                <div className="mb-1 flex justify-between gap-2 text-[13px]">
                  <span className="truncate text-ink">{g.title}</span>
                  <span className="font-mono text-[12px] text-ink-muted tabular">
                    {g.currentValue ?? start} / {g.targetValue} {g.unit}
                  </span>
                </div>
                <ProgressBar value={Math.max(0, Math.min(100, pct))} size="sm" label={g.title} />
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function Comparison({ range, today }: { range: DateRange; today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const prev = previousRange(range)
  const s = periodSummary(db, range, today, db.settings.weekStartsOn)
  const p = periodSummary(db, prev, today, db.settings.weekStartsOn)
  const money = (n: number) => fmt.money(n, { showPence: false })
  const cards: { label: string; value: string; cur: number; prev: number; fmt?: (n: number) => string; invert?: boolean }[] = [
    { label: 'Tasks completed', value: String(s.tasksCompleted), cur: s.tasksCompleted, prev: p.tasksCompleted },
    { label: 'Habit consistency', value: s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`, cur: Math.round((s.habitRate ?? 0) * 100), prev: Math.round((p.habitRate ?? 0) * 100), fmt: (n) => `${n} pts` },
    { label: 'Goals completed', value: String(s.goalsCompleted), cur: s.goalsCompleted, prev: p.goalsCompleted },
    { label: 'Milestones reached', value: String(s.milestonesDone + s.careerMilestonesDone), cur: s.milestonesDone + s.careerMilestonesDone, prev: p.milestonesDone + p.careerMilestonesDone },
    { label: 'Learning time', value: formatMinutes(s.learningMinutes), cur: s.learningMinutes, prev: p.learningMinutes, fmt: formatMinutes },
    { label: 'Workouts', value: String(s.workouts), cur: s.workouts, prev: p.workouts },
    { label: 'Average sleep', value: s.avgSleepMinutes === null ? '—' : formatMinutes(s.avgSleepMinutes), cur: s.avgSleepMinutes ?? 0, prev: p.avgSleepMinutes ?? 0, fmt: formatMinutes },
    { label: 'Income', value: money(s.income), cur: s.income, prev: p.income, fmt: money },
    { label: 'Spending', value: money(s.expenses), cur: s.expenses, prev: p.expenses, fmt: money, invert: true },
    { label: 'Journal entries', value: String(s.journalEntries), cur: s.journalEntries, prev: p.journalEntries },
    { label: 'Average mood', value: s.avgMood === null ? '—' : `${s.avgMood.toFixed(1)}/5`, cur: s.avgMood ?? 0, prev: p.avgMood ?? 0, fmt: (n) => n.toFixed(1) },
    { label: 'Finished reading/watching', value: String(s.mediaCompleted), cur: s.mediaCompleted, prev: p.mediaCompleted },
  ]
  return (
    <Panel title="This period vs previous" eyebrow={`${formatDate(range.start, 'd MMM')} – ${formatDate(range.end, 'd MMM yyyy')} compared with ${formatDate(prev.start, 'd MMM')} – ${formatDate(prev.end, 'd MMM yyyy')}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-line bg-panel-2/30 p-3">
            <p className="eyebrow truncate">{c.label}</p>
            <p className="mt-1.5 truncate font-display text-[19px] leading-none font-semibold text-ink tabular">{c.value}</p>
            <div className="mt-1.5">
              <Delta current={c.cur} previous={c.prev} format={c.fmt} invert={c.invert} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function TrendsTab({ range, today }: { range: DateRange; today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const ws = db.settings.weekStartsOn
  const unit = bucketUnitFor(range)
  const data = useMemo(() => trendSeries(db, range, unit, today, ws), [db, range, unit, today, ws])
  const areas = useMemo(() => areaComparison(db, range).filter((a) => a.tasksDone + a.habitCheckIns + a.goalsCompleted + a.events + a.activeGoals > 0), [db, range])
  const projects = useMemo(
    () =>
      db.projects
        .filter((p) => p.status !== 'completed')
        .map((p) => ({ name: truncate(p.name, 20), full: p.name, ...projectProgress(p, db.tasks) }))
        .filter((p) => p.pct !== null),
    [db.projects, db.tasks],
  )
  const appStatus = APPLICATION_STATUSES.list.map((s) => ({ status: s.label, count: db.applications.filter((a) => a.status === s.value).length })).filter((r) => r.count)
  const s = periodSummary(db, range, today, ws)
  const unitLabel = unit === 'day' ? 'per day' : unit === 'week' ? 'per week' : 'per month'
  const money = (n: number) => fmt.money(n, { compact: true })
  const tip = (format?: (v: number) => string) => (p: object) => <ChartTooltip {...p} formatValue={format} formatLabel={(_l, row) => (unit === 'month' ? formatDate(String(row?.start), 'MMMM yyyy') : unit === 'week' ? `Week of ${formatDate(String(row?.key), 'd MMM')}` : formatDate(String(row?.key), 'EEE d MMM'))} />
  const any = (key: keyof Trend) => data.some((d) => typeof d[key] === 'number' && (d[key] as number) > 0)
  const bucketCol = { label: unit === 'month' ? 'Month' : unit === 'week' ? 'Week of' : 'Day', value: (r: Trend) => r.label }

  if (!hasAnyActivity(s) && !db.goals.length && !db.projects.length) {
    return (
      <div className="space-y-4">
        <Panel>
          <EmptyState icon={BarChart3} title="No activity recorded in this range" description="Analytics are calculated only from what you record — tasks, habits, workouts, study time, transactions, journal entries and more. Try a longer date range, or start logging." />
        </Panel>
        <TargetsPanel range={range} today={today} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Comparison range={range} today={today} />
      <TargetsPanel range={range} today={today} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Task completion"
          description={`Tasks added vs completed ${unitLabel}`}
          legend={[
            { label: 'Completed', color: series(0) },
            { label: 'Added', color: series(3) },
          ]}
          rows={data}
          columns={[bucketCol, { label: 'Completed', value: (r) => r.tasksCompleted, align: 'right' }, { label: 'Added', value: (r) => r.tasksCreated, align: 'right' }]}
          empty={!any('tasksCompleted') && !any('tasksCreated')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />
              <Bar dataKey="tasksCompleted" name="Completed" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="tasksCreated" name="Added" fill={series(3)} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Goal completion"
          description={`Goals completed and milestones reached ${unitLabel}`}
          legend={[
            { label: 'Goals completed', color: series(2) },
            { label: 'Milestones reached', color: series(4) },
          ]}
          rows={data}
          columns={[bucketCol, { label: 'Goals completed', value: (r) => r.goalsCompleted, align: 'right' }, { label: 'Milestones', value: (r) => r.milestonesDone, align: 'right' }]}
          empty={!any('goalsCompleted') && !any('milestonesDone')}
          emptyHint="Complete goals or tick off project, goal or career milestones to see this chart."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />
              <Bar dataKey="goalsCompleted" name="Goals completed" fill={series(2)} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="milestonesDone" name="Milestones reached" fill={series(4)} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Habit consistency"
          description={`% of scheduled habits completed ${unitLabel}`}
          rows={data}
          columns={[bucketCol, { label: 'Consistency', value: (r) => (r.habitRate === null ? '—' : `${r.habitRate}%`), align: 'right' }, { label: 'Check-ins', value: (r) => r.habitCheckIns, align: 'right' }]}
          empty={!data.some((d) => d.habitRate !== null)}
          emptyHint="Add habits and check in to see consistency."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} />
              <Tooltip content={tip((v) => `${v}%`)} />
              <Line type="monotone" dataKey="habitRate" name="Consistency" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Time invested in learning"
          description={`Minutes ${unitLabel}`}
          rows={data}
          columns={[bucketCol, { label: 'Learning', value: (r) => formatMinutes(r.learningMinutes), align: 'right' }]}
          empty={!any('learningMinutes')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip((v) => formatMinutes(v))} />
              <Bar dataKey="learningMinutes" name="Learning" fill={series(5)} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Fitness consistency"
          description={`Workouts ${unitLabel}`}
          rows={data}
          columns={[bucketCol, { label: 'Workouts', value: (r) => r.workouts, align: 'right' }, { label: 'Minutes', value: (r) => r.workoutMinutes, align: 'right' }, { label: 'Avg sleep (h)', value: (r) => r.sleepHours ?? '—', align: 'right' }]}
          empty={!any('workouts')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />
              <Bar dataKey="workouts" name="Workouts" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Financial trends"
          description={`Income and spending ${unitLabel}`}
          legend={[
            { label: 'Income', color: series(0) },
            { label: 'Spending', color: series(1) },
          ]}
          rows={data}
          columns={[bucketCol, { label: 'Income', value: (r) => fmt.money(r.income), align: 'right' }, { label: 'Spending', value: (r) => fmt.money(r.expenses), align: 'right' }, { label: 'Net', value: (r) => fmt.money(r.net), align: 'right' }]}
          empty={!any('income') && !any('expenses')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis tickFormatter={money} width={52} {...axisProps} />
              <ReferenceLine y={0} stroke="var(--color-line-strong)" />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip((v) => fmt.money(v))} />
              <Bar dataKey="income" name="Income" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="expenses" name="Spending" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Mood & energy"
          description={`Average check-in ${unitLabel} (1–5)`}
          legend={[
            { label: 'Mood', color: series(1) },
            { label: 'Energy', color: series(4) },
          ]}
          rows={data.filter((d) => d.avgMood !== null)}
          columns={[bucketCol, { label: 'Mood', value: (r) => r.avgMood?.toFixed(1) ?? '—', align: 'right' }, { label: 'Energy', value: (r) => r.avgEnergy?.toFixed(1) ?? '—', align: 'right' }]}
          empty={!data.some((d) => d.avgMood !== null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} />
              <Tooltip content={tip((v) => Number(v).toFixed(1))} />
              <Line type="monotone" dataKey="avgMood" name="Mood" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls />
              <Line type="monotone" dataKey="avgEnergy" name="Energy" stroke={series(4)} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: series(4), strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Reading & media"
          description={`Items finished ${unitLabel}`}
          rows={data}
          columns={[bucketCol, { label: 'Finished', value: (r) => r.mediaCompleted, align: 'right' }]}
          empty={!any('mediaCompleted')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={16} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />
              <Bar dataKey="mediaCompleted" name="Finished" fill={series(2)} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Project progress"
          description="Current completion of open projects"
          rows={projects}
          columns={[{ label: 'Project', value: (r) => r.full }, { label: 'Done', value: (r) => `${r.done}/${r.total}`, align: 'right' }, { label: 'Progress', value: (r) => `${Math.round(r.pct ?? 0)}%`, align: 'right' }]}
          empty={projects.length === 0}
          height={Math.max(160, projects.length * 30)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projects} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} />
              <YAxis type="category" dataKey="name" width={130} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${Math.round(v)}%`} formatLabel={(_l, r) => String(r?.full)} />} />
              <Bar dataKey="pct" name="Progress" fill={series(0)} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Category comparison"
          description="Tasks completed and habit check-ins by life area, this range"
          legend={[
            { label: 'Tasks completed', color: series(0) },
            { label: 'Habit check-ins', color: series(1) },
          ]}
          rows={areas}
          columns={[
            { label: 'Area', value: (r) => r.label },
            { label: 'Tasks done', value: (r) => r.tasksDone, align: 'right' },
            { label: 'Habit check-ins', value: (r) => r.habitCheckIns, align: 'right' },
            { label: 'Goals completed', value: (r) => r.goalsCompleted, align: 'right' },
            { label: 'Active goals', value: (r) => r.activeGoals, align: 'right' },
            { label: 'Avg goal progress', value: (r) => (r.avgGoalProgress === null ? '—' : `${Math.round(r.avgGoalProgress)}%`), align: 'right' },
            { label: 'Events', value: (r) => r.events, align: 'right' },
          ]}
          empty={areas.length === 0}
          height={Math.max(180, areas.length * 36)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={areas} layout="vertical" barGap={2} margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" allowDecimals={false} {...axisProps} />
              <YAxis type="category" dataKey="label" width={150} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 11.5 }} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} />} />
              <Bar dataKey="tasksDone" name="Tasks completed" fill={series(0)} radius={[0, 4, 4, 0]} maxBarSize={10} />
              <Bar dataKey="habitCheckIns" name="Habit check-ins" fill={series(1)} radius={[0, 4, 4, 0]} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Career milestones & applications"
          description={`${s.careerMilestonesDone} milestones completed and ${s.applicationsSent} applications sent in this range · all applications by status below`}
          rows={appStatus}
          columns={[{ label: 'Status', value: (r) => r.status }, { label: 'Applications', value: (r) => r.count, align: 'right' }]}
          empty={appStatus.length === 0 && s.careerMilestonesDone === 0}
          emptyHint="Track applications and career milestones in Career & Education."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={appStatus} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="status" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 10 }} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} />} />
              <Bar dataKey="count" name="Applications" fill={series(3)} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function ReportsTab({ today }: { today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const ws = db.settings.weekStartsOn
  const [kind, setKind] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today)
  const range: DateRange = kind === 'week' ? { start: weekStartISO(anchor, ws), end: addDaysISO(weekStartISO(anchor, ws), 6) } : { start: monthStartISO(anchor), end: monthEndISO(anchor) }
  const report = useMemo(() => buildReport(db, range, today, ws, kind), [db, range.start, range.end, today, ws, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const history = useMemo(() => {
    const count = kind === 'week' ? 8 : 6
    return Array.from({ length: count }, (_, i) => {
      const a = kind === 'week' ? addDaysISO(range.start, -7 * (count - 1 - i)) : addMonthsISO(range.start, -(count - 1 - i))
      const r = kind === 'week' ? { start: a, end: addDaysISO(a, 6) } : { start: monthStartISO(a), end: monthEndISO(a) }
      return { range: r, s: periodSummary(db, r, today, ws) }
    })
  }, [db, kind, range.start, today, ws])
  const step = (d: -1 | 1) => setAnchor((a) => (kind === 'week' ? addDaysISO(a, 7 * d) : addMonthsISO(a, d)))
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown)
      toast({ title: 'Report copied as Markdown' })
    } catch {
      toast({ title: 'Clipboard not available', description: 'Your browser blocked clipboard access.', tone: 'warning' })
    }
  }
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={(k) => { setKind(k); setAnchor(today) }} ariaLabel="Report type" options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
        <IconButton icon={ChevronLeft} label="Previous period" onClick={() => step(-1)} />
        <IconButton icon={ChevronRight} label="Next period" onClick={() => step(1)} disabled={range.end >= today} />
        <div className="flex-1" />
        <Button size="sm" icon={Copy} onClick={copy}>
          Copy Markdown
        </Button>
        <Button size="sm" variant="primary" icon={Printer} onClick={() => window.print()}>
          Print / save PDF
        </Button>
      </div>
      <article className="panel p-5 sm:p-7" aria-label={report.title}>
        <p className="eyebrow text-accent/80">ATLAS report · generated {new Date().toLocaleDateString()}</p>
        <h2 className="mt-2 font-display text-[22px] font-semibold text-ink">{report.title}</h2>
        <p className="mt-1 text-[13px] text-ink-subtle">Compared with the previous {kind === 'week' ? 'week' : 'month'}. Every figure comes from records you entered.</p>
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {report.sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-2 border-b border-line pb-1.5 font-display text-[14px] font-semibold tracking-wide text-ink">{sec.title}</h3>
              {sec.lines.length ? (
                <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                  {sec.lines.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-subtle">Nothing recorded.</p>
              )}
            </section>
          ))}
          {report.review && (
            <section className="md:col-span-2">
              <h3 className="mb-2 border-b border-line pb-1.5 font-display text-[14px] font-semibold tracking-wide text-ink">Your reflection</h3>
              <dl className="grid gap-3 text-[13.5px] sm:grid-cols-2">
                {(['wins', 'challenges', 'lessons', 'focus'] as const).map((k) =>
                  report.review?.[k] ? (
                    <div key={k}>
                      <dt className="eyebrow">{k === 'focus' ? 'Next focus' : k}</dt>
                      <dd className="mt-1 whitespace-pre-line text-ink-muted">{report.review[k]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </section>
          )}
        </div>
      </article>
      <Panel title="Historical comparison" eyebrow={kind === 'week' ? 'Last 8 weeks' : 'Last 6 months'}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-subtle">
                <th className="py-2 pr-3 font-medium">{kind === 'week' ? 'Week of' : 'Month'}</th>
                {['Tasks', 'Habits', 'Goals', 'Workouts', 'Learning', 'Sleep', 'Spending', 'Journal', 'Finished'].map((h) => (
                  <th key={h} className="px-2 py-2 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(({ range: r, s }) => (
                <tr key={r.start} className={`border-b border-line/60 ${r.start === range.start ? 'bg-accent/5' : ''}`}>
                  <td className="py-2 pr-3 text-ink">{kind === 'week' ? formatDate(r.start, 'd MMM') : formatDate(r.start, 'MMM yyyy')}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.tasksCompleted}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.goalsCompleted}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.workouts}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{formatMinutes(s.learningMinutes)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.avgSleepMinutes === null ? '—' : formatMinutes(s.avgSleepMinutes)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{fmt.money(s.expenses, { showPence: false })}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.journalEntries}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{s.mediaCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

export default function AnalyticsPage() {
  const today = useToday()
  const db = useDatabase()
  const [tab, setTab] = useTabParam(TABS, 'trends')
  const [preset, setPreset] = useState<RangePreset>('last_30')
  const [custom, setCustom] = useState<DateRange>({ start: addDaysISO(today, -29), end: today })
  const range = resolveRange(preset, today, db.settings.weekStartsOn, custom)
  return (
    <div>
      <PageHeader
        section="analytics"
        description="Understand how you're progressing across every area — calculated only from what you've recorded. No single “life score”."
        actions={
          tab === 'trends' && (
            <div className="flex flex-wrap items-center gap-2">
              <Select size="sm" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} aria-label="Date range" className="w-40">
                {RANGE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              {preset === 'custom' && (
                <>
                  <Input type="date" value={custom.start} max={custom.end} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, start: e.target.value }))} aria-label="Start date" className="h-8 w-38 text-[13px]" />
                  <span className="text-ink-subtle">–</span>
                  <Input type="date" value={custom.end} min={custom.start} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, end: e.target.value }))} aria-label="End date" className="h-8 w-38 text-[13px]" />
                </>
              )}
            </div>
          )
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="no-print mb-5" />
      {tab === 'trends' && <TrendsTab range={range} today={today} />}
      {tab === 'reports' && <ReportsTab today={today} />}
      {tab === 'review' && <WeeklyReviewPanel today={today} />}
    </div>
  )
}
