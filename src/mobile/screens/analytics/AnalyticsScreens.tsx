import { type ReactNode, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Share } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { type DateRange, RANGE_PRESETS, type RangePreset, areaComparison, bucketUnitFor, hasAnyActivity, periodSummary, previousRange, resolveRange, trendSeries } from '@/selectors/analytics'
import { targetStatus } from '@/selectors/finance'
import { buildReport } from '@/selectors/report'
import { addDaysISO, addMonthsISO, diffDays, formatDate, monthEndISO, monthKey, monthStartISO, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { useDatabase } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { shareText } from '../../components/share'
import { ProgressLine, StatGrid, StatTile } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { Chips, Segmented } from '../../ui/controls'
import { Cell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

type Trend = ReturnType<typeof trendSeries>[number]
type Metric = 'tasks' | 'habits' | 'goals' | 'learning' | 'fitness' | 'money' | 'mood' | 'reading'
const METRICS: { value: Metric; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'habits', label: 'Habits' },
  { value: 'goals', label: 'Goals' },
  { value: 'learning', label: 'Learning' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'money', label: 'Money' },
  { value: 'mood', label: 'Mood' },
  { value: 'reading', label: 'Reading' },
]
// The custom range is chosen in a sheet; other presets apply directly.
const PRESETS = RANGE_PRESETS.filter((p) => p.value !== 'custom')

function CustomRangeSheet({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: DateRange; onApply: (r: DateRange) => void }) {
  const [start, setStart] = useState(value.start)
  const [end, setEnd] = useState(value.end)
  const valid = !!start && !!end && start <= end
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="auto"
      title="Custom Range"
      testId="custom-range-sheet"
      leading={<NavButton onClick={onClose}>Cancel</NavButton>}
      trailing={
        <NavButton bold disabled={!valid} onClick={() => { onApply({ start, end }); onClose() }} testId="custom-range-apply">
          Apply
        </NavButton>
      }
    >
      <Section footer={valid ? `${diffDays(start, end) + 1} days, compared with the ${diffDays(start, end) + 1} days before.` : 'The start must be on or before the end.'}>
        <label className="flex items-center gap-3 px-4 py-1.5">
          <span className="ios-body flex-1 text-ink">Starts</span>
          <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} className="rounded-[8px] bg-[var(--ios-fill)] px-2 text-ink" aria-label="Start date" />
        </label>
        <label className="flex items-center gap-3 px-4 py-1.5">
          <span className="ios-body flex-1 text-ink">Ends</span>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="rounded-[8px] bg-[var(--ios-fill)] px-2 text-ink" aria-label="End date" />
        </label>
      </Section>
    </Sheet>
  )
}

function TargetsSection({ range, today }: { range: DateRange; today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const t = db.settings.targets
  const s = periodSummary(db, range, today, db.settings.weekStartsOn)
  const weeks = Math.max(1, (diffDays(range.start, range.end < today ? range.end : today) + 1) / 7)
  const steps = db.dailyActivity.filter((a) => a.date >= range.start && a.date <= range.end && a.steps !== undefined)
  const avgSteps = steps.length ? steps.reduce((n, a) => n + (a.steps ?? 0), 0) / steps.length : null
  const year = today.slice(0, 4)
  const books = db.media.filter((m) => m.type === 'book' && m.status === 'completed' && m.completedDate?.startsWith(year)).length
  const rows: { label: string; actual: string; target: string; pct: number | null; tone?: 'ok' | 'warn' }[] = []
  if (t.weeklyWorkouts) rows.push({ label: 'Workouts per week', actual: (s.workouts / weeks).toFixed(1), target: String(t.weeklyWorkouts), pct: (s.workouts / weeks / t.weeklyWorkouts) * 100 })
  if (t.weeklyLearningMinutes) rows.push({ label: 'Learning per week', actual: formatMinutes(s.learningMinutes / weeks), target: formatMinutes(t.weeklyLearningMinutes), pct: (s.learningMinutes / weeks / t.weeklyLearningMinutes) * 100 })
  if (t.sleepHours) rows.push({ label: 'Average sleep', actual: s.avgSleepMinutes === null ? '—' : formatMinutes(s.avgSleepMinutes), target: `${t.sleepHours}h`, pct: s.avgSleepMinutes === null ? null : (s.avgSleepMinutes / 60 / t.sleepHours) * 100 })
  if (t.dailySteps) rows.push({ label: 'Daily steps', actual: avgSteps === null ? '—' : Math.round(avgSteps).toLocaleString(), target: t.dailySteps.toLocaleString(), pct: avgSteps === null ? null : (avgSteps / t.dailySteps) * 100 })
  if (t.weeklyJournalEntries) rows.push({ label: 'Journal entries per week', actual: (s.journalEntries / weeks).toFixed(1), target: String(t.weeklyJournalEntries), pct: (s.journalEntries / weeks / t.weeklyJournalEntries) * 100 })
  if (t.yearlyReading) rows.push({ label: `Books in ${year}`, actual: String(books), target: String(t.yearlyReading), pct: (books / t.yearlyReading) * 100 })
  for (const f of db.financialTargets.map((x) => targetStatus(x, db.transactions, monthKey(today)))) {
    rows.push({ label: `${f.target.name} (this month)`, actual: fmt.money(f.actual, { showPence: false }), target: fmt.money(f.target.amount, { showPence: false }), pct: Math.max(0, f.ratio * 100), tone: f.met ? 'ok' : 'warn' })
  }
  for (const g of db.goals.filter((x) => x.status === 'active' && x.progressMode === 'numeric' && x.targetValue !== undefined)) {
    const start = g.startValue ?? 0
    const pct = g.targetValue === start ? 0 : (((g.currentValue ?? start) - start) / ((g.targetValue as number) - start)) * 100
    rows.push({ label: g.title, actual: `${g.currentValue ?? start}`, target: `${g.targetValue} ${g.unit ?? ''}`.trim(), pct: Math.max(0, pct) })
  }
  return (
    <Section header="Targets" footer={rows.length ? 'Only targets you set: Settings → Targets, financial targets in Finances, numeric goals in Goals.' : undefined}>
      {rows.length === 0 && (
        <Cell title="No targets set" subtitle="Set personal targets to track them here." chevron onClick={() => nav.push('more/settings/targets')} />
      )}
      {rows.map((r) => (
        <div key={r.label} className="px-4 py-2.5">
          <div className="mb-1.5 flex justify-between gap-2">
            <span className="ios-subhead min-w-0 truncate text-ink">{r.label}</span>
            <span className="ios-footnote shrink-0 text-ink-subtle tabular-nums">
              {r.actual} / {r.target}
            </span>
          </div>
          <ProgressLine value={r.pct === null ? null : Math.min(100, r.pct)} tone={r.tone ?? (r.pct !== null && r.pct >= 100 ? 'ok' : undefined)} />
        </div>
      ))}
    </Section>
  )
}

function TrendChart({ metric, data, unit }: { metric: Metric; data: Trend[]; unit: 'day' | 'week' | 'month' }) {
  const fmt = useFormatters()
  const per = unit === 'day' ? 'per day' : unit === 'week' ? 'per week' : 'per month'
  const bucketCol = { label: unit === 'month' ? 'Month' : unit === 'week' ? 'Week of' : 'Day', value: (r: Trend) => r.label }
  const tip = (format?: (v: number) => string) => (p: object) => <ChartTooltip {...p} formatValue={format} formatLabel={(_l, row) => (unit === 'month' ? formatDate(String(row?.start), 'MMMM yyyy') : unit === 'week' ? `Week of ${formatDate(String(row?.key), 'd MMM')}` : formatDate(String(row?.key), 'EEE d MMM'))} />
  const any = (key: keyof Trend) => data.some((d) => typeof d[key] === 'number' && (d[key] as number) > 0)
  const margin = { top: 8, right: 4, left: -22, bottom: 0 }
  const x = <XAxis dataKey="label" {...axisProps} minTickGap={14} />
  const bar = (key: keyof Trend, name: string, i: number) => <Bar dataKey={key} name={name} fill={series(i)} radius={[4, 4, 0, 0]} maxBarSize={14} />
  const common = { rows: data, height: 200 }
  let card: ReactNode = null
  switch (metric) {
    case 'tasks':
      card = (
        <ChartCard title="Tasks" description={`Added vs completed ${per}`} legend={[{ label: 'Completed', color: series(0) }, { label: 'Added', color: series(3) }]} columns={[bucketCol, { label: 'Done', value: (r) => r.tasksCompleted, align: 'right' }, { label: 'Added', value: (r) => r.tasksCreated, align: 'right' }]} empty={!any('tasksCompleted') && !any('tasksCreated')} {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={2} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis allowDecimals={false} {...axisProps} /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />{bar('tasksCompleted', 'Completed', 0)}{bar('tasksCreated', 'Added', 3)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'habits':
      card = (
        <ChartCard title="Habit consistency" description={`% of scheduled habits done ${per}`} columns={[bucketCol, { label: 'Consistency', value: (r) => (r.habitRate === null ? '—' : `${r.habitRate}%`), align: 'right' }, { label: 'Check-ins', value: (r) => r.habitCheckIns, align: 'right' }]} empty={!data.some((d) => d.habitRate !== null)} emptyHint="Add habits and check in to see consistency." {...common}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} /><Tooltip content={tip((v) => `${v}%`)} /><Line type="monotone" dataKey="habitRate" name="Consistency" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls /></LineChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'goals':
      card = (
        <ChartCard title="Goals & milestones" description={`Completed ${per}`} legend={[{ label: 'Goals', color: series(2) }, { label: 'Milestones', color: series(4) }]} columns={[bucketCol, { label: 'Goals', value: (r) => r.goalsCompleted, align: 'right' }, { label: 'Milestones', value: (r) => r.milestonesDone, align: 'right' }]} empty={!any('goalsCompleted') && !any('milestonesDone')} emptyHint="Complete goals or tick off milestones to see this chart." {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={2} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis allowDecimals={false} {...axisProps} /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />{bar('goalsCompleted', 'Goals', 2)}{bar('milestonesDone', 'Milestones', 4)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'learning':
      card = (
        <ChartCard title="Learning time" description={`Minutes ${per}`} columns={[bucketCol, { label: 'Learning', value: (r) => formatMinutes(r.learningMinutes), align: 'right' }]} empty={!any('learningMinutes')} {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ ...margin, left: -14 }}><CartesianGrid {...gridProps} />{x}<YAxis {...axisProps} /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip((v) => formatMinutes(v))} />{bar('learningMinutes', 'Learning', 5)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'fitness':
      card = (
        <ChartCard title="Workouts" description={`Sessions ${per}`} columns={[bucketCol, { label: 'Workouts', value: (r) => r.workouts, align: 'right' }, { label: 'Minutes', value: (r) => r.workoutMinutes, align: 'right' }, { label: 'Sleep (h)', value: (r) => r.sleepHours ?? '—', align: 'right' }]} empty={!any('workouts')} {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis allowDecimals={false} {...axisProps} /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />{bar('workouts', 'Workouts', 1)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'money':
      card = (
        <ChartCard title="Income and spending" description={per[0].toUpperCase() + per.slice(1)} legend={[{ label: 'Income', color: series(0) }, { label: 'Spending', color: series(1) }]} columns={[bucketCol, { label: 'In', value: (r) => fmt.money(r.income), align: 'right' }, { label: 'Out', value: (r) => fmt.money(r.expenses), align: 'right' }, { label: 'Net', value: (r) => fmt.money(r.net), align: 'right' }]} empty={!any('income') && !any('expenses')} {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={2} margin={{ ...margin, left: 0 }}><CartesianGrid {...gridProps} />{x}<YAxis tickFormatter={(v) => fmt.money(v, { compact: true })} width={48} {...axisProps} /><ReferenceLine y={0} stroke="var(--color-line-strong)" /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip((v) => fmt.money(v))} />{bar('income', 'Income', 0)}{bar('expenses', 'Spending', 1)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'mood':
      card = (
        <ChartCard title="Mood & energy" description={`Average check-in ${per} (1–5)`} legend={[{ label: 'Mood', color: series(1) }, { label: 'Energy', color: series(4) }]} columns={[bucketCol, { label: 'Mood', value: (r) => r.avgMood?.toFixed(1) ?? '—', align: 'right' }, { label: 'Energy', value: (r) => r.avgEnergy?.toFixed(1) ?? '—', align: 'right' }]} empty={!data.some((d) => d.avgMood !== null)} {...common} rows={data.filter((d) => d.avgMood !== null)}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} /><Tooltip content={tip((v) => Number(v).toFixed(1))} /><Line type="monotone" dataKey="avgMood" name="Mood" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls /><Line type="monotone" dataKey="avgEnergy" name="Energy" stroke={series(4)} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: series(4), strokeWidth: 0 }} connectNulls /></LineChart></ResponsiveContainer>
        </ChartCard>
      )
      break
    case 'reading':
      card = (
        <ChartCard title="Reading & media" description={`Items finished ${per}`} columns={[bucketCol, { label: 'Finished', value: (r) => r.mediaCompleted, align: 'right' }]} empty={!any('mediaCompleted')} {...common}>
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={margin}><CartesianGrid {...gridProps} />{x}<YAxis allowDecimals={false} {...axisProps} /><Tooltip cursor={{ fill: 'var(--color-line)' }} content={tip()} />{bar('mediaCompleted', 'Finished', 2)}</BarChart></ResponsiveContainer>
        </ChartCard>
      )
      break
  }
  return <div data-testid="analytics-chart">{card}</div>
}

export function AnalyticsScreen() {
  const db = useDatabase()
  const today = useToday()
  const fmt = useFormatters()
  const ws = db.settings.weekStartsOn
  const [preset, setPreset] = useState<RangePreset>('last_30')
  const [custom, setCustom] = useState<DateRange>(() => ({ start: addDaysISO(today, -29), end: today }))
  const [pickCustom, setPickCustom] = useState(false)
  const [metric, setMetric] = useState<Metric>('tasks')
  const range = resolveRange(preset, today, ws, custom)
  const prev = previousRange(range)
  const unit = bucketUnitFor(range)
  const data = useMemo(() => trendSeries(db, range, unit, today, ws), [db, range.start, range.end, unit, today, ws]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = periodSummary(db, range, today, ws)
  const p = periodSummary(db, prev, today, ws)
  const areas = useMemo(() => areaComparison(db, range).filter((a) => a.tasksDone + a.habitCheckIns + a.goalsCompleted + a.events > 0), [db, range.start, range.end]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxArea = Math.max(1, ...areas.map((a) => a.tasksDone + a.habitCheckIns))
  const money = (n: number) => fmt.money(n, { showPence: false })
  const nothing = !hasAnyActivity(s) && !hasAnyActivity(p)

  return (
    <Screen title="Analytics" large testId="screen-analytics">
      <div className="mb-1 px-4">
        <Chips<RangePreset | 'custom'>
          ariaLabel="Date range"
          value={preset}
          onChange={(v) => (v === 'custom' ? setPickCustom(true) : setPreset(v))}
          options={[...PRESETS.map((r) => ({ value: r.value, label: r.label })), { value: 'custom', label: preset === 'custom' ? `${formatDate(range.start, 'd MMM')} – ${formatDate(range.end, 'd MMM')}` : 'Custom…' }]}
        />
      </div>
      <p className="ios-footnote mb-4 px-4 text-ink-subtle" data-testid="analytics-range">
        {formatDate(range.start, 'd MMM')} – {formatDate(range.end, 'd MMM yyyy')}, compared with {formatDate(prev.start, 'd MMM')} – {formatDate(prev.end, 'd MMM')}.
      </p>

      {nothing ? (
        <Section footer="Analytics are calculated only from what you record — tasks, habits, workouts, study time, money, journal entries and more.">
          <EmptyRow>Nothing recorded in this range. Try a longer range, or start logging.</EmptyRow>
        </Section>
      ) : (
        <StatGrid>
          <StatTile label="Tasks completed" value={s.tasksCompleted} current={s.tasksCompleted} previous={p.tasksCompleted} tone="cyan" />
          <StatTile label="Habit consistency" value={s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`} current={Math.round((s.habitRate ?? 0) * 100)} previous={p.habitRate === null ? undefined : Math.round(p.habitRate * 100)} format={(n) => `${n} pts`} tone="lime" />
          <StatTile label="Goals & milestones" value={s.goalsCompleted + s.milestonesDone + s.careerMilestonesDone} current={s.goalsCompleted + s.milestonesDone + s.careerMilestonesDone} previous={p.goalsCompleted + p.milestonesDone + p.careerMilestonesDone} tone="magenta" />
          <StatTile label="Learning" value={formatMinutes(s.learningMinutes)} current={s.learningMinutes} previous={p.learningMinutes} format={formatMinutes} tone="violet" />
          <StatTile label="Workouts" value={s.workouts} current={s.workouts} previous={p.workouts} tone="magenta" />
          <StatTile label="Average sleep" value={s.avgSleepMinutes === null ? '—' : formatMinutes(s.avgSleepMinutes)} current={s.avgSleepMinutes ?? undefined} previous={p.avgSleepMinutes ?? undefined} format={formatMinutes} tone="violet" />
          <StatTile label="Income" value={money(s.income)} current={s.income} previous={p.income} format={money} tone="ok" />
          <StatTile label="Spending" value={money(s.expenses)} current={s.expenses} previous={p.expenses} format={money} invert tone="warn" />
          <StatTile label="Journal entries" value={s.journalEntries} current={s.journalEntries} previous={p.journalEntries} tone="amber" />
          <StatTile label="Average mood" value={s.avgMood === null ? '—' : `${s.avgMood.toFixed(1)}/5`} current={s.avgMood ?? undefined} previous={p.avgMood ?? undefined} format={(n) => n.toFixed(1)} tone="cyan" />
        </StatGrid>
      )}

      <Section>
        <Cell icon={FileText} iconTone="cyan" title="Weekly & Monthly Reports" subtitle="Plain-language summary you can share" chevron onClick={() => nav.push('more/analytics/report')} testId="analytics-report" />
      </Section>

      <TargetsSection range={range} today={today} />

      <Section header="Trends" plain>
        <div className="mb-3">
          <Chips ariaLabel="Chart" value={metric} onChange={setMetric} options={METRICS} />
        </div>
        <TrendChart metric={metric} data={data} unit={unit} />
      </Section>

      <Section header="By area of life" footer="Tasks completed and habit check-ins in this range.">
        {areas.length === 0 && <EmptyRow>No tasks completed or habit check-ins in this range.</EmptyRow>}
        {areas.map((a) => (
          <div key={a.area} className="px-4 py-2.5">
            <div className="mb-1.5 flex justify-between gap-2">
              <span className="ios-subhead text-ink">{a.label}</span>
              <span className="ios-footnote text-ink-subtle tabular-nums">
                {a.tasksDone} tasks · {a.habitCheckIns} check-ins{a.avgGoalProgress !== null ? ` · goals ${Math.round(a.avgGoalProgress)}%` : ''}
              </span>
            </div>
            <ProgressLine value={((a.tasksDone + a.habitCheckIns) / maxArea) * 100} />
          </div>
        ))}
      </Section>

      <CustomRangeSheet key={`${custom.start}-${custom.end}-${pickCustom}`} open={pickCustom} onClose={() => setPickCustom(false)} value={custom} onApply={(r) => { setCustom(r); setPreset('custom') }} />
    </Screen>
  )
}

export function ReportScreen() {
  const db = useDatabase()
  const today = useToday()
  const ws = db.settings.weekStartsOn
  const [kind, setKind] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(today)
  const range: DateRange = kind === 'week' ? { start: weekStartISO(anchor, ws), end: addDaysISO(weekStartISO(anchor, ws), 6) } : { start: monthStartISO(anchor), end: monthEndISO(anchor) }
  const report = useMemo(() => buildReport(db, range, today, ws, kind), [db, range.start, range.end, today, ws, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const step = (d: -1 | 1) => setAnchor((a) => (kind === 'week' ? addDaysISO(a, 7 * d) : addMonthsISO(a, d)))
  const share = async () => {
    const result = await shareText(report.title, report.markdown)
    if (result === 'copied') toast({ title: 'Report copied', description: 'Paste it into Notes, Mail or Messages.' })
    if (result === 'failed') toast({ title: 'Couldn’t share the report', description: 'Sharing and the clipboard are both unavailable here.', tone: 'warning' })
  }
  return (
    <Screen
      title="Report"
      testId="screen-report"
      trailing={
        <NavButton label="Share report" onClick={share} testId="report-share">
          <Share size={22} />
        </NavButton>
      }
      header={
        <div className="flex items-center gap-2 px-4 pb-2">
          <button type="button" onClick={() => step(-1)} aria-label={`Previous ${kind}`} className="flex size-11 items-center justify-center text-accent">
            <ChevronLeft size={24} />
          </button>
          <Segmented className="flex-1" value={kind} onChange={(k) => { setKind(k); setAnchor(today) }} ariaLabel="Report type" options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
          <button type="button" onClick={() => step(1)} disabled={range.end >= today} aria-label={`Next ${kind}`} className="flex size-11 items-center justify-center text-accent disabled:text-ink-subtle disabled:opacity-40">
            <ChevronRight size={24} />
          </button>
        </div>
      }
    >
      <div className="px-4 pt-2 pb-5">
        <h2 className="ios-title2 text-ink" data-testid="report-title">
          {report.title}
        </h2>
        <p className="ios-footnote mt-1 text-ink-subtle">Compared with the previous {kind}. Every figure comes from records you entered.</p>
      </div>
      {report.sections.map((sec) => (
        <Section key={sec.title} header={sec.title}>
          {sec.lines.length === 0 ? (
            <EmptyRow>Nothing recorded.</EmptyRow>
          ) : (
            <ul className="px-4 py-2" data-selectable>
              {sec.lines.map((l, i) => (
                <li key={i} className="ios-subhead flex gap-2 py-1 text-ink">
                  <span className="text-ink-subtle" aria-hidden>
                    •
                  </span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
      {report.review && (
        <Section header="Reflection">
          <div className="space-y-2 px-4 py-3" data-selectable>
            {(
              [
                ['Wins', report.review.wins],
                ['Challenges', report.review.challenges],
                ['Lessons', report.review.lessons],
                ['Next focus', report.review.focus],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <p key={k} className="ios-subhead text-ink">
                  <span className="font-semibold">{k}: </span>
                  {v}
                </p>
              ))}
          </div>
        </Section>
      )}
    </Screen>
  )
}
