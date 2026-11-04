import type { DailyActivity, Routine, SleepLog, Workout, ExerciseEntry } from '@/data/types'
import { type WeekStart, addDaysISO, eachDay, isBetween, spanMinutes, weekStartISO, weekday } from '@/lib/dates'
import { average, sum } from '@/lib/utils'

export const sleepMinutes = (s: Pick<SleepLog, 'bedTime' | 'wakeTime'>) => spanMinutes(s.bedTime, s.wakeTime)

export function workoutsInRange(workouts: Workout[], start: string, end: string) {
  return workouts.filter((w) => isBetween(w.date, start, end))
}

export function fitnessSummary(data: { workouts: Workout[]; sleep: SleepLog[]; dailyActivity: DailyActivity[] }, start: string, end: string) {
  const w = workoutsInRange(data.workouts, start, end)
  const s = data.sleep.filter((x) => isBetween(x.date, start, end))
  const a = data.dailyActivity.filter((x) => isBetween(x.date, start, end))
  const steps = a.map((x) => x.steps).filter((v): v is number => typeof v === 'number')
  return {
    workouts: w.length,
    workoutMinutes: sum(w.map((x) => x.durationMin)),
    activeDays: new Set([...w.map((x) => x.date), ...a.filter((x) => (x.activeMinutes ?? 0) > 0 || (x.steps ?? 0) > 0).map((x) => x.date)]).size,
    sleepNights: s.length,
    avgSleepMinutes: s.length ? average(s.map(sleepMinutes)) : null,
    avgSleepQuality: s.some((x) => x.quality) ? average(s.filter((x) => x.quality).map((x) => x.quality as number)) : null,
    avgSteps: steps.length ? average(steps) : null,
    activeMinutes: sum(a.map((x) => x.activeMinutes ?? 0)),
  }
}

/** Workouts per week for the last `weeks` weeks (oldest first). */
export function weeklyWorkoutSeries(workouts: Workout[], today: string, weeks: number, weekStartsOn: WeekStart) {
  const thisWeek = weekStartISO(today, weekStartsOn)
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDaysISO(thisWeek, -7 * (weeks - 1 - i))
    const end = addDaysISO(start, 6)
    const list = workoutsInRange(workouts, start, end)
    return { week: start, count: list.length, minutes: sum(list.map((w) => w.durationMin)) }
  })
}

/** Consecutive weeks (ending this week or last) with at least `target` workouts. */
export function workoutWeekStreak(workouts: Workout[], today: string, weekStartsOn: WeekStart, target = 1) {
  let week = weekStartISO(today, weekStartsOn)
  let streak = 0
  if (workoutsInRange(workouts, week, addDaysISO(week, 6)).length >= target) streak++
  week = addDaysISO(week, -7)
  for (let i = 0; i < 520; i++) {
    if (workoutsInRange(workouts, week, addDaysISO(week, 6)).length < target) break
    streak++
    week = addDaysISO(week, -7)
  }
  return streak
}

export interface PersonalRecord {
  exercise: string
  bestWeightKg?: { value: number; date: string; reps?: number }
  bestDistanceKm?: { value: number; date: string }
  mostReps?: { value: number; date: string }
  longestMin?: { value: number; date: string }
  sessions: number
  lastDate: string
}

/** Best efforts per exercise, derived from every logged workout. */
export function personalRecords(workouts: Workout[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>()
  for (const w of workouts) {
    for (const e of w.exercises as ExerciseEntry[]) {
      const key = e.name.trim().toLowerCase()
      if (!key) continue
      const rec = map.get(key) ?? { exercise: e.name.trim(), sessions: 0, lastDate: w.date }
      rec.sessions++
      if (w.date > rec.lastDate) rec.lastDate = w.date
      if (e.weightKg && (!rec.bestWeightKg || e.weightKg > rec.bestWeightKg.value)) rec.bestWeightKg = { value: e.weightKg, date: w.date, reps: e.reps }
      if (e.distanceKm && (!rec.bestDistanceKm || e.distanceKm > rec.bestDistanceKm.value)) rec.bestDistanceKm = { value: e.distanceKm, date: w.date }
      if (e.reps && (!rec.mostReps || e.reps > rec.mostReps.value)) rec.mostReps = { value: e.reps, date: w.date }
      if (e.durationMin && (!rec.longestMin || e.durationMin > rec.longestMin.value)) rec.longestMin = { value: e.durationMin, date: w.date }
      map.set(key, rec)
    }
  }
  return [...map.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1))
}

export const routineScheduledOn = (r: Routine, date: string) => r.active && r.days.includes(weekday(date))

export function routineCompletion(r: Routine, date: string) {
  const done = (r.log[date] ?? []).filter((id) => r.steps.some((s) => s.id === id)).length
  const total = r.steps.length
  return { done, total, complete: total > 0 && done >= total, ratio: total ? done / total : 0 }
}

/** Share of scheduled routine-days fully completed in a range. */
export function routineConsistency(routines: Routine[], start: string, end: string, today: string) {
  let scheduled = 0
  let completed = 0
  for (const day of eachDay(start, end < today ? end : today)) {
    for (const r of routines) {
      if (!routineScheduledOn(r, day) || !r.steps.length || day < r.createdAt.slice(0, 10)) continue
      scheduled++
      if (routineCompletion(r, day).complete) completed++
    }
  }
  return { scheduled, completed, rate: scheduled ? completed / scheduled : null }
}
