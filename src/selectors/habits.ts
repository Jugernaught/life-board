/**
 * Habit maths. A habit is "scheduled" on a day depending on its schedule:
 *  - daily: every day
 *  - days: on chosen weekdays
 *  - weekly: N times per week, any days
 * Streaks for daily/day habits count consecutive scheduled days completed;
 * for weekly habits they count consecutive weeks where the target was met.
 * Today never breaks a streak — you still have time to complete it.
 */
import type { Habit } from '@/data/types'
import { type WeekStart, addDaysISO, diffDays, eachDay, weekStartISO, weekday } from '@/lib/dates'

export const isDoneOn = (habit: Habit, date: string) => habit.log.includes(date)

export function isScheduledOn(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false
  if (habit.schedule === 'days') return habit.days.includes(weekday(date))
  return true // daily, and weekly habits can be done any day
}

function weekCount(habit: Habit, weekStart: string): number {
  const end = addDaysISO(weekStart, 6)
  return habit.log.filter((d) => d >= weekStart && d <= end).length
}

export function currentStreak(habit: Habit, today: string, weekStartsOn: WeekStart = 1): number {
  if (habit.schedule === 'weekly') {
    let week = weekStartISO(today, weekStartsOn)
    let streak = 0
    // The current week only counts once the target is already met.
    if (weekCount(habit, week) >= habit.timesPerWeek) streak++
    week = addDaysISO(week, -7)
    while (addDaysISO(week, 6) >= habit.startDate && weekCount(habit, week) >= habit.timesPerWeek) {
      streak++
      week = addDaysISO(week, -7)
    }
    return streak
  }
  let streak = 0
  let day = today
  if (isScheduledOn(habit, day) && !isDoneOn(habit, day)) day = addDaysISO(day, -1)
  const set = new Set(habit.log)
  for (let i = 0; i < 3660 && day >= habit.startDate; i++) {
    if (isScheduledOn(habit, day)) {
      if (!set.has(day)) break
      streak++
    }
    day = addDaysISO(day, -1)
  }
  return streak
}

export function longestStreak(habit: Habit, today: string, weekStartsOn: WeekStart = 1): number {
  if (!habit.log.length) return 0
  if (habit.schedule === 'weekly') {
    let best = 0
    let run = 0
    let week = weekStartISO(habit.startDate, weekStartsOn)
    const last = weekStartISO(today, weekStartsOn)
    while (week <= last) {
      if (weekCount(habit, week) >= habit.timesPerWeek) best = Math.max(best, ++run)
      else if (week !== last) run = 0
      week = addDaysISO(week, 7)
    }
    return best
  }
  const set = new Set(habit.log)
  let best = 0
  let run = 0
  for (const day of eachDay(habit.startDate, today)) {
    if (!isScheduledOn(habit, day)) continue
    if (set.has(day)) best = Math.max(best, ++run)
    else if (day !== today) run = 0
  }
  return best
}

/**
 * Share of opportunities completed in [start, end] (clamped to the habit's
 * start date and today). Returns null when there was nothing to complete.
 */
export function completionRate(habit: Habit, start: string, end: string, today: string, weekStartsOn: WeekStart = 1): { done: number; expected: number; rate: number | null } {
  const from = start > habit.startDate ? start : habit.startDate
  const to = end < today ? end : today
  if (to < from) return { done: 0, expected: 0, rate: null }
  if (habit.schedule === 'weekly') {
    // Expected completions pro-rated by the number of days covered.
    const days = diffDays(from, to) + 1
    const expected = Math.max(1, Math.round((habit.timesPerWeek * days) / 7))
    const done = habit.log.filter((d) => d >= from && d <= to).length
    void weekStartsOn
    return { done: Math.min(done, expected), expected, rate: Math.min(1, done / expected) }
  }
  const days = eachDay(from, to).filter((d) => isScheduledOn(habit, d))
  const set = new Set(habit.log)
  const done = days.filter((d) => set.has(d)).length
  return { done, expected: days.length, rate: days.length ? done / days.length : null }
}

/** Habits that are relevant today, and how many are done. */
export function todaysHabits(habits: Habit[], today: string, weekStartsOn: WeekStart = 1) {
  const active = habits.filter((h) => !h.archived && h.startDate <= today)
  const items = active
    .filter((h) => isScheduledOn(h, today))
    .map((h) => ({
      habit: h,
      done: isDoneOn(h, today),
      weekly: h.schedule === 'weekly' ? { count: weekCount(h, weekStartISO(today, weekStartsOn)), target: h.timesPerWeek } : undefined,
    }))
  return { items, done: items.filter((i) => i.done).length, total: items.length }
}

export function toggleLog(log: string[], date: string): string[] {
  return log.includes(date) ? log.filter((d) => d !== date) : [...log, date].sort()
}

/** Per-day completion share across all active habits, for consistency charts. */
export function dailyHabitSeries(habits: Habit[], start: string, end: string, today: string) {
  return eachDay(start, end < today ? end : today).map((date) => {
    const scheduled = habits.filter((h) => !h.archived && h.schedule !== 'weekly' && isScheduledOn(h, date))
    const done = scheduled.filter((h) => isDoneOn(h, date)).length
    const weeklyDone = habits.filter((h) => !h.archived && h.schedule === 'weekly' && isDoneOn(h, date)).length
    return { date, scheduled: scheduled.length, done, weeklyDone, rate: scheduled.length ? done / scheduled.length : null }
  })
}
