import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import type { Database } from '@/data/types'
import { make } from '@/test/factories'
import { buildAgenda } from './agenda'
import { makeBuckets, periodSummary, previousRange, resolveRange } from './analytics'
import { courseGrade, moduleGrade } from './career'
import { advanceDate, budgetStatus, monthTotals, monthlyEquivalent, savingsProgress, targetStatus } from './finance'
import { personalRecords, routineCompletion, sleepMinutes } from './fitness'
import { completionRate, currentStreak, longestStreak, todaysHabits } from './habits'
import { projectProgress } from './projects'
import { searchDatabase } from './search'
import { upcomingOccasions } from './social'
import { tasksDueToday } from './tasks'

const TODAY = '2026-11-04' // a Wednesday

describe('habits', () => {
  const daily = make('habits', { name: 'Read', startDate: '2026-10-01', log: ['2026-11-01', '2026-11-02', '2026-11-03'] })
  it('counts the current streak without breaking on an unfinished today', () => {
    expect(currentStreak(daily, TODAY)).toBe(3)
    expect(currentStreak({ ...daily, log: [...daily.log, TODAY] }, TODAY)).toBe(4)
    expect(currentStreak({ ...daily, log: ['2026-11-01'] }, TODAY)).toBe(0)
  })
  it('only counts scheduled days for specific-day habits', () => {
    // Mondays (1) and Wednesdays (3): 2026-10-26 Mon, 10-28 Wed, 11-02 Mon, 11-04 Wed
    const h = make('habits', { name: 'Gym', schedule: 'days', days: [1, 3], startDate: '2026-10-01', log: ['2026-10-26', '2026-10-28', '2026-11-02'] })
    expect(currentStreak(h, TODAY)).toBe(3)
    expect(completionRate(h, '2026-10-26', '2026-11-03', TODAY)).toMatchObject({ done: 3, expected: 3, rate: 1 })
  })
  it('handles times-per-week habits by week', () => {
    const h = make('habits', { name: 'Run', schedule: 'weekly', timesPerWeek: 2, startDate: '2026-10-01', log: ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-30', '2026-11-03'] })
    // weeks of 19 Oct and 26 Oct met (2 each); current week has 1 → not yet counted
    expect(currentStreak(h, TODAY, 1)).toBe(2)
    expect(longestStreak(h, TODAY, 1)).toBe(2)
  })
  it('reports today’s habits and completion', () => {
    const r = todaysHabits([daily, make('habits', { name: 'Archived', startDate: '2026-10-01', archived: true })], TODAY)
    expect(r.total).toBe(1)
    expect(r.done).toBe(0)
  })
})

describe('finance', () => {
  const tx = [
    make('transactions', { kind: 'income', amount: 200000, date: '2026-11-01', category: 'Salary' }),
    make('transactions', { kind: 'expense', amount: 5000, date: '2026-11-02', category: 'Groceries' }),
    make('transactions', { kind: 'expense', amount: 7000, date: '2026-11-10', category: 'Eating Out' }),
    make('transactions', { kind: 'expense', amount: 9999, date: '2026-10-31', category: 'Groceries' }),
  ]
  it('totals a month', () => {
    expect(monthTotals(tx, '2026-11')).toMatchObject({ income: 200000, expenses: 12000, net: 188000, count: 3 })
  })
  it('tracks budgets for a category and for total spending', () => {
    expect(budgetStatus(make('budgets', { category: 'Groceries', limit: 5500 }), tx, '2026-11')).toMatchObject({ spent: 5000, state: 'warn' })
    expect(budgetStatus(make('budgets', { category: '*', limit: 10000 }), tx, '2026-11')).toMatchObject({ spent: 12000, state: 'over', remaining: -2000 })
  })
  it('works out savings progress and the monthly amount needed', () => {
    const g = make('savingsGoals', { name: 'Fund', target: 100000, targetDate: '2027-03-04', contributions: [{ id: 'a', date: '2026-10-01', amount: 30000 }, { id: 'b', date: '2026-10-15', amount: -5000 }] })
    const p = savingsProgress(g, TODAY)
    expect(p.saved).toBe(25000)
    expect(p.pct).toBe(25)
    expect(p.perMonthNeeded).toBe(18750) // 75,000 over 4 months
  })
  it('advances recurring dates and computes monthly equivalents', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceDate('2026-11-04', 'fortnightly')).toBe('2026-11-18')
    expect(monthlyEquivalent({ amount: 1200, frequency: 'yearly' })).toBe(100)
  })
  it('evaluates financial targets', () => {
    expect(targetStatus(make('financialTargets', { name: 'Save', metric: 'monthly_savings', amount: 100000 }), tx, '2026-11').met).toBe(true)
    expect(targetStatus(make('financialTargets', { name: 'Eat out', metric: 'max_category_spending', category: 'Eating Out', amount: 5000 }), tx, '2026-11')).toMatchObject({ actual: 7000, met: false })
  })
})

describe('career', () => {
  const m = make('modules', { name: 'Maths', credits: 20 })
  const m2 = make('modules', { name: 'Stats', credits: 10 })
  const course = make('academicCourses', { name: 'BSc' })
  const a = [
    make('assessments', { title: 'CW', moduleId: m.id, dueDate: '2026-10-01', weight: 40, status: 'graded', score: 70 }),
    make('assessments', { title: 'Exam', moduleId: m.id, dueDate: '2026-12-01', weight: 60, status: 'graded', score: 60 }),
    make('assessments', { title: 'Quiz', moduleId: m2.id, dueDate: '2026-10-01', status: 'graded', score: 90 }),
  ]
  it('weights module grades', () => {
    expect(moduleGrade(m.id, a).grade).toBeCloseTo(64)
    expect(moduleGrade(m2.id, a).grade).toBe(90)
  })
  it('weights course averages by credits', () => {
    const c1 = { ...m, courseId: course.id }
    const c2 = { ...m2, courseId: course.id }
    expect(courseGrade(course.id, [c1, c2], a)).toBeCloseTo((64 * 20 + 90 * 10) / 30)
  })
})

describe('projects, fitness, tasks', () => {
  it('computes project progress from tasks and milestones', () => {
    const p = make('projects', { name: 'X', milestones: [{ id: 'm', title: 'M', done: true }] })
    const tasks = [make('tasks', { title: 'a', projectId: p.id, status: 'done' }), make('tasks', { title: 'b', projectId: p.id })]
    expect(projectProgress(p, tasks)).toMatchObject({ done: 2, total: 3 })
    expect(projectProgress({ ...p, milestones: [] }, []).pct).toBeNull()
  })
  it('finds personal records and routine completion', () => {
    const w = [make('workouts', { title: 'A', date: '2026-11-01', durationMin: 30, exercises: [{ id: '1', name: 'Squat', weightKg: 60, reps: 5 }] }), make('workouts', { title: 'B', date: '2026-11-03', durationMin: 30, exercises: [{ id: '2', name: 'squat', weightKg: 70, reps: 3 }] })]
    const rec = personalRecords(w)
    expect(rec).toHaveLength(1)
    expect(rec[0].bestWeightKg).toMatchObject({ value: 70, reps: 3 })
    expect(sleepMinutes({ bedTime: '23:00', wakeTime: '06:30' })).toBe(450)
    const r = make('routines', { name: 'AM', steps: [{ id: 's1', title: 'a' }, { id: 's2', title: 'b' }], log: { [TODAY]: ['s1'] } })
    expect(routineCompletion(r, TODAY)).toMatchObject({ done: 1, total: 2, complete: false })
  })
  it('splits overdue and due-today tasks', () => {
    const r = tasksDueToday([make('tasks', { title: 'late', dueDate: '2026-11-01' }), make('tasks', { title: 'now', dueDate: TODAY }), make('tasks', { title: 'done', dueDate: TODAY, status: 'done' })], TODAY)
    expect(r.overdue.map((t) => t.title)).toEqual(['late'])
    expect(r.today.map((t) => t.title)).toEqual(['now'])
  })
})

function dbWith(partial: Partial<Database>): Database {
  return { ...createEmptyDatabase(), ...partial }
}

describe('agenda', () => {
  it('pulls dated items from every section, sorted, excluding finished ones', () => {
    const mod = make('modules', { name: 'Maths', code: 'MA1' })
    const db = dbWith({
      events: [make('events', { title: 'Call', date: TODAY, startTime: '10:00', endTime: '11:00' })],
      tasks: [make('tasks', { title: 'Due', dueDate: TODAY }), make('tasks', { title: 'Finished', dueDate: TODAY, status: 'done' })],
      modules: [mod],
      assessments: [make('assessments', { title: 'Exam', kind: 'exam', moduleId: mod.id, dueDate: '2026-11-05' })],
      importantDates: [make('importantDates', { title: 'Birthday', date: '1990-11-06', recurring: true })],
      recurring: [make('recurring', { name: 'Rent', amount: 100000, category: 'Housing', frequency: 'weekly', nextDate: TODAY })],
    })
    const items = buildAgenda(db, TODAY, '2026-11-11', TODAY)
    expect(items.map((i) => i.title)).toEqual(['Due', 'Rent', 'Call', 'Exam', 'Birthday', 'Rent'])
    expect(items.find((i) => i.title === 'Exam')?.subtitle).toContain('MA1')
    expect(items.filter((i) => i.editable).map((i) => i.title)).toEqual(['Call'])
  })
  it('finds upcoming occasions with years', () => {
    const r = upcomingOccasions([make('importantDates', { title: 'B', kind: 'birthday', date: '2000-11-10' })], TODAY)
    expect(r[0]).toMatchObject({ next: '2026-11-10', inDays: 6, years: 26 })
  })
})

describe('analytics', () => {
  it('resolves ranges and previous ranges', () => {
    expect(resolveRange('this_week', TODAY, 1)).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(resolveRange('last_month', TODAY, 1)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(resolveRange('last_7', TODAY, 1)).toEqual({ start: '2026-10-29', end: TODAY })
    expect(previousRange({ start: '2026-11-02', end: '2026-11-08' })).toEqual({ start: '2026-10-26', end: '2026-11-01' })
  })
  it('makes day, week and month buckets clamped to the range', () => {
    expect(makeBuckets({ start: '2026-11-01', end: '2026-11-03' }, 'day', 1)).toHaveLength(3)
    const weeks = makeBuckets({ start: '2026-11-04', end: '2026-11-20' }, 'week', 1)
    expect(weeks[0]).toMatchObject({ start: '2026-11-04', end: '2026-11-08' })
    expect(weeks.at(-1)).toMatchObject({ start: '2026-11-16', end: '2026-11-20' })
  })
  it('summarises only recorded activity', () => {
    const empty = periodSummary(createEmptyDatabase(), { start: '2026-11-01', end: TODAY }, TODAY, 1)
    expect(empty.tasksCompleted).toBe(0)
    expect(empty.habitRate).toBeNull()
    expect(empty.avgMood).toBeNull()
    const db = dbWith({
      tasks: [make('tasks', { title: 'a', status: 'done', completedAt: '2026-11-02T10:00:00.000Z' })],
      studySessions: [make('studySessions', { date: '2026-11-02', durationMin: 45 })],
      checkIns: [make('checkIns', { date: '2026-11-02', at: '2026-11-02T10:00:00.000Z', mood: 4, energy: 2 })],
    })
    const s = periodSummary(db, { start: '2026-11-01', end: TODAY }, TODAY, 1)
    expect(s).toMatchObject({ tasksCompleted: 1, learningMinutes: 45, avgMood: 4, avgEnergy: 2 })
  })
})

describe('search', () => {
  it('ranks title matches above body matches', () => {
    const db = dbWith({
      tasks: [make('tasks', { title: 'Call the bank', notes: '' }), make('tasks', { title: 'Groceries', notes: 'remember the bank card' })],
      journal: [make('journal', { date: TODAY, body: 'Went to the bank today' })],
    })
    const r = searchDatabase(db, 'bank')
    expect(r[0].title).toBe('Call the bank')
    expect(r).toHaveLength(3)
    expect(decodeURIComponent(r.find((x) => x.key === 'journal')?.href ?? '')).toContain('open=journal:')
  })
})
