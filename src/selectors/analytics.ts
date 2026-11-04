/**
 * Analytics: date ranges, time buckets and period summaries. Every number is
 * computed from stored records — when there is no data the value is 0 or
 * null and the UI says so; nothing is estimated or invented.
 */
import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { LIFE_AREAS, type LifeArea } from '@/data/constants'
import type { Database } from '@/data/types'
import {
  type WeekStart,
  addDaysISO,
  dateOfTimestamp,
  diffDays,
  eachDay,
  eachMonth,
  formatDate,
  formatMonthKey,
  isBetween,
  monthKey,
  parseISODate,
  toISODate,
  weekStartISO,
} from '@/lib/dates'
import { average, sum } from '@/lib/utils'
import { goalProgressOf } from '@/store/lifecycle'
import { completedInRange, createdInRange, dueInRangeStats } from './tasks'
import { completionRate, isDoneOn } from './habits'
import { fitnessSummary } from './fitness'
import { minutesInRange } from './learning'

export const RANGE_PRESETS = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]['value']

export interface DateRange {
  start: string
  end: string
}

export function resolveRange(preset: RangePreset, today: string, weekStartsOn: WeekStart, custom?: DateRange): DateRange {
  const t = parseISODate(today)
  switch (preset) {
    case 'this_week': {
      const start = weekStartISO(today, weekStartsOn)
      return { start, end: addDaysISO(start, 6) }
    }
    case 'last_week': {
      const start = addDaysISO(weekStartISO(today, weekStartsOn), -7)
      return { start, end: addDaysISO(start, 6) }
    }
    case 'last_7':
      return { start: addDaysISO(today, -6), end: today }
    case 'last_30':
      return { start: addDaysISO(today, -29), end: today }
    case 'last_90':
      return { start: addDaysISO(today, -89), end: today }
    case 'last_365':
      return { start: addDaysISO(today, -364), end: today }
    case 'this_month':
      return { start: toISODate(startOfMonth(t)), end: toISODate(endOfMonth(t)) }
    case 'last_month': {
      const m = subMonths(t, 1)
      return { start: toISODate(startOfMonth(m)), end: toISODate(endOfMonth(m)) }
    }
    case 'this_year':
      return { start: toISODate(startOfYear(t)), end: toISODate(endOfYear(t)) }
    case 'custom':
      if (custom && custom.start <= custom.end) return custom
      return { start: addDaysISO(today, -29), end: today }
  }
}

/** The range of equal length immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const days = diffDays(range.start, range.end) + 1
  return { start: addDaysISO(range.start, -days), end: addDaysISO(range.start, -1) }
}

export type BucketUnit = 'day' | 'week' | 'month'

export interface Bucket {
  key: string
  start: string
  end: string
  label: string
}

export function bucketUnitFor(range: DateRange): BucketUnit {
  const days = diffDays(range.start, range.end) + 1
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

export function makeBuckets(range: DateRange, unit: BucketUnit, weekStartsOn: WeekStart): Bucket[] {
  if (unit === 'day') return eachDay(range.start, range.end).map((d) => ({ key: d, start: d, end: d, label: formatDate(d, 'd MMM') }))
  if (unit === 'week') {
    const out: Bucket[] = []
    let start = weekStartISO(range.start, weekStartsOn)
    while (start <= range.end) {
      const end = addDaysISO(start, 6)
      out.push({ key: start, start: start < range.start ? range.start : start, end: end > range.end ? range.end : end, label: formatDate(start, 'd MMM') })
      start = addDaysISO(start, 7)
    }
    return out
  }
  return eachMonth(range.start, range.end).map((m) => {
    const start = `${m}-01`
    const end = toISODate(endOfMonth(parseISODate(start)))
    return { key: m, start: start < range.start ? range.start : start, end: end > range.end ? range.end : end, label: formatMonthKey(m, 'MMM yy') }
  })
}

type Db = Database

export interface PeriodSummary {
  tasksCompleted: number
  tasksCreated: number
  tasksDue: number
  tasksDueDone: number
  tasksOnTime: number
  habitRate: number | null
  habitCheckIns: number
  goalsCompleted: number
  goalsActive: number
  goalsAvgProgress: number | null
  milestonesDone: number
  learningMinutes: number
  studySessions: number
  workouts: number
  workoutMinutes: number
  activeDays: number
  avgSleepMinutes: number | null
  income: number
  expenses: number
  net: number
  journalEntries: number
  checkIns: number
  avgMood: number | null
  avgEnergy: number | null
  mediaCompleted: number
  careerMilestonesDone: number
  applicationsSent: number
  assessmentsGraded: number
  projectsCompleted: number
  eventsAttended: number
}

const stampIn = (ts: string | undefined, r: DateRange) => !!ts && isBetween(dateOfTimestamp(ts), r.start, r.end)

export function periodSummary(db: Db, range: DateRange, today: string, weekStartsOn: WeekStart): PeriodSummary {
  const due = dueInRangeStats(db.tasks, range.start, range.end)
  const habits = db.habits.filter((h) => !h.archived || h.log.some((d) => isBetween(d, range.start, range.end)))
  const rates = habits.map((h) => completionRate(h, range.start, range.end, today, weekStartsOn)).filter((r) => r.expected > 0)
  const fit = fitnessSummary(db, range.start, range.end)
  const tx = db.transactions.filter((t) => isBetween(t.date, range.start, range.end))
  const checkIns = db.checkIns.filter((c) => isBetween(c.date, range.start, range.end))
  const activeGoals = db.goals.filter((g) => g.status === 'active')
  const projectMilestones = db.projects.flatMap((p) => p.milestones).filter((m) => m.done && stampIn(m.doneAt, range)).length
  const goalMilestones = db.goals.flatMap((g) => g.milestones).filter((m) => m.done && stampIn(m.doneAt, range)).length
  return {
    tasksCompleted: completedInRange(db.tasks, range.start, range.end).length,
    tasksCreated: createdInRange(db.tasks, range.start, range.end).length,
    tasksDue: due.due,
    tasksDueDone: due.done,
    tasksOnTime: due.onTime,
    habitRate: rates.length ? sum(rates.map((r) => r.done)) / sum(rates.map((r) => r.expected)) : null,
    habitCheckIns: sum(db.habits.map((h) => h.log.filter((d) => isBetween(d, range.start, range.end)).length)),
    goalsCompleted: db.goals.filter((g) => g.status === 'completed' && stampIn(g.completedAt, range)).length,
    goalsActive: activeGoals.length,
    goalsAvgProgress: activeGoals.length ? average(activeGoals.map((g) => goalProgressOf(g))) : null,
    milestonesDone: projectMilestones + goalMilestones,
    learningMinutes: minutesInRange(db.studySessions, range.start, range.end),
    studySessions: db.studySessions.filter((s) => isBetween(s.date, range.start, range.end)).length,
    workouts: fit.workouts,
    workoutMinutes: fit.workoutMinutes,
    activeDays: fit.activeDays,
    avgSleepMinutes: fit.avgSleepMinutes,
    income: sum(tx.filter((t) => t.kind === 'income').map((t) => t.amount)),
    expenses: sum(tx.filter((t) => t.kind === 'expense').map((t) => t.amount)),
    net: sum(tx.map((t) => (t.kind === 'income' ? t.amount : -t.amount))),
    journalEntries: db.journal.filter((j) => isBetween(j.date, range.start, range.end)).length,
    checkIns: checkIns.length,
    avgMood: checkIns.length ? average(checkIns.map((c) => c.mood)) : null,
    avgEnergy: checkIns.length ? average(checkIns.map((c) => c.energy)) : null,
    mediaCompleted: db.media.filter((m) => m.status === 'completed' && m.completedDate && isBetween(m.completedDate, range.start, range.end)).length,
    careerMilestonesDone: db.careerMilestones.filter((m) => m.done && stampIn(m.doneAt, range)).length,
    applicationsSent: db.applications.filter((a) => a.appliedDate && isBetween(a.appliedDate, range.start, range.end)).length,
    assessmentsGraded: db.assessments.filter((a) => a.status === 'graded' && isBetween(a.dueDate, range.start, range.end)).length,
    projectsCompleted: db.projects.filter((p) => p.status === 'completed' && stampIn(p.completedAt, range)).length,
    eventsAttended: db.events.filter((e) => isBetween(e.date, range.start, range.end) && e.date <= today).length,
  }
}

/** One row per bucket with the main activity metrics, for trend charts. */
export function trendSeries(db: Db, range: DateRange, unit: BucketUnit, today: string, weekStartsOn: WeekStart) {
  return makeBuckets(range, unit, weekStartsOn).map((b) => {
    const s = periodSummary(db, { start: b.start, end: b.end }, today, weekStartsOn)
    return {
      ...b,
      tasksCompleted: s.tasksCompleted,
      tasksCreated: s.tasksCreated,
      habitRate: s.habitRate === null ? null : Math.round(s.habitRate * 100),
      habitCheckIns: s.habitCheckIns,
      learningMinutes: s.learningMinutes,
      workouts: s.workouts,
      workoutMinutes: s.workoutMinutes,
      income: s.income,
      expenses: s.expenses,
      net: s.net,
      journalEntries: s.journalEntries,
      avgMood: s.avgMood,
      avgEnergy: s.avgEnergy,
      mediaCompleted: s.mediaCompleted,
      sleepHours: s.avgSleepMinutes === null ? null : Math.round((s.avgSleepMinutes / 60) * 10) / 10,
    }
  })
}

/** Activity per life area within a range — for category comparisons. */
export function areaComparison(db: Db, range: DateRange) {
  const rows = LIFE_AREAS.list.map((a) => ({ area: a.value as LifeArea, label: a.label, tasksDone: 0, habitCheckIns: 0, goalsCompleted: 0, events: 0, activeGoals: 0, avgGoalProgress: null as number | null }))
  const byArea = new Map(rows.map((r) => [r.area, r]))
  for (const t of completedInRange(db.tasks, range.start, range.end)) byArea.get(t.area)!.tasksDone++
  for (const h of db.habits) byArea.get(h.area)!.habitCheckIns += h.log.filter((d) => isBetween(d, range.start, range.end)).length
  for (const g of db.goals) {
    const row = byArea.get(g.area)!
    if (g.status === 'completed' && stampIn(g.completedAt, range)) row.goalsCompleted++
    if (g.status === 'active') row.activeGoals++
  }
  for (const e of db.events) if (isBetween(e.date, range.start, range.end)) byArea.get(e.area)!.events++
  for (const row of rows) {
    const goals = db.goals.filter((g) => g.area === row.area && g.status === 'active')
    row.avgGoalProgress = goals.length ? average(goals.map((g) => goalProgressOf(g))) : null
  }
  return rows
}

/** Monthly totals for the last N months — used by the monthly report. */
export function monthsBack(today: string, count: number): string[] {
  const start = toISODate(subMonths(startOfMonth(parseISODate(today)), count - 1))
  return eachMonth(start, today)
}

export function hasAnyActivity(s: PeriodSummary): boolean {
  return Object.entries(s).some(([k, v]) => !['goalsActive', 'goalsAvgProgress'].includes(k) && typeof v === 'number' && v !== 0)
}

/** Habit grid data: for each day in range, whether each habit was done. */
export function habitMatrix(db: Db, range: DateRange) {
  const days = eachDay(range.start, range.end)
  return db.habits
    .filter((h) => !h.archived)
    .map((h) => ({ habit: h, days: days.map((d) => ({ date: d, done: isDoneOn(h, d) })) }))
}

export { monthKey }
