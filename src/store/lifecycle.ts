/**
 * Domain rules applied whenever a record is created or updated, no matter
 * which screen made the change. Keeping them here (instead of in each form)
 * means a task ticked off in a widget and a task completed in its edit form
 * behave identically.
 */
import type { ActivityAction, CollectionKey, Collections } from '@/data/types'
import { todayISO } from '@/lib/dates'

type AnyRecord = Record<string, unknown>

export function onCreate<K extends CollectionKey>(key: K, record: Collections[K], now: string): Collections[K] {
  const r = { ...record } as AnyRecord
  switch (key) {
    case 'tasks':
      if (r.status === 'done' && !r.completedAt) r.completedAt = now
      break
    case 'projects':
      if (r.status === 'completed' && !r.completedAt) r.completedAt = now
      break
    case 'goals':
      if (r.status === 'completed' && !r.completedAt) r.completedAt = now
      r.history = [{ at: now, progress: Number(r.progress ?? 0) }]
      break
    case 'applications':
      if (!(r.statusHistory as unknown[])?.length) r.statusHistory = [{ status: r.status, at: now }]
      break
    case 'skills':
      if (!(r.levelHistory as unknown[])?.length) r.levelHistory = [{ date: todayISO(), level: r.level ?? 0 }]
      break
    case 'careerMilestones':
      if (r.done && !r.doneAt) r.doneAt = now
      break
    case 'media':
    case 'learningCourses':
      finishedDate(key, r)
      break
  }
  return r as Collections[K]
}

/**
 * Library items and courses carry the day they were finished. Set it when
 * they're marked completed (keeping a date you chose), clear it when they go
 * back to "want to" — the same rule the forms use, so every path agrees.
 */
function finishedDate(key: 'media' | 'learningCourses', r: AnyRecord) {
  if (r.status === 'completed') r.completedDate = r.completedDate ?? todayISO()
  else if (key === 'learningCourses' || r.status === 'want') r.completedDate = undefined
}

export function onUpdate<K extends CollectionKey>(
  key: K,
  prev: Collections[K],
  next: Collections[K],
  now: string,
): { record: Collections[K]; action: ActivityAction; detail?: string } {
  const p = prev as AnyRecord
  const r = { ...next } as AnyRecord
  let action: ActivityAction = 'updated'
  let detail: string | undefined

  const completion = (doneField: string, isDone: (v: unknown) => boolean, stampField: string) => {
    const was = isDone(p[doneField])
    const is = isDone(r[doneField])
    if (!was && is) {
      r[stampField] = r[stampField] && r[stampField] !== p[stampField] ? r[stampField] : now
      action = 'completed'
    } else if (was && !is) {
      r[stampField] = undefined
      action = 'reopened'
    }
  }

  switch (key) {
    case 'tasks':
      completion('status', (v) => v === 'done', 'completedAt')
      break
    case 'projects':
      completion('status', (v) => v === 'completed', 'completedAt')
      if (p.status !== r.status && action === 'updated') detail = `Status → ${String(r.status).replace('_', ' ')}`
      break
    case 'goals': {
      completion('status', (v) => v === 'completed', 'completedAt')
      const progressChanged =
        p.status !== r.status ||
        p.progress !== r.progress ||
        p.currentValue !== r.currentValue ||
        JSON.stringify(p.milestones) !== JSON.stringify(r.milestones)
      if (progressChanged) {
        const history = [...((r.history as { at: string; progress: number }[]) ?? [])]
        const value = goalProgressOf(r)
        const last = history[history.length - 1]
        // Collapse several edits on the same day into one history point.
        if (last && last.at.slice(0, 10) === now.slice(0, 10)) history[history.length - 1] = { at: now, progress: value }
        else history.push({ at: now, progress: value })
        r.history = history
        if (action === 'updated') detail = `Progress ${Math.round(value)}%`
      }
      break
    }
    case 'applications':
      if (p.status !== r.status) {
        r.statusHistory = [...((r.statusHistory as unknown[]) ?? []), { status: r.status, at: now }]
        detail = `Status → ${String(r.status)}`
      }
      break
    case 'skills':
      if (p.level !== r.level) {
        const history = [...((r.levelHistory as { date: string; level: number }[]) ?? [])]
        const today = todayISO()
        const last = history[history.length - 1]
        if (last && last.date === today) history[history.length - 1] = { date: today, level: Number(r.level) }
        else history.push({ date: today, level: Number(r.level) })
        r.levelHistory = history
        detail = `Proficiency → ${String(r.level)}/5`
      }
      break
    case 'careerMilestones':
      completion('done', (v) => v === true, 'doneAt')
      break
    case 'media':
    case 'learningCourses':
      if (p.status !== r.status) {
        finishedDate(key, r)
        if (r.status === 'completed') action = 'completed'
        else if (p.status === 'completed') action = 'reopened'
      }
      break
  }
  return { record: r as Collections[K], action, detail }
}

/** Progress (0–100) of a goal, whatever way it is tracked. */
export function goalProgressOf(goal: AnyRecord): number {
  if (goal.status === 'completed') return 100
  switch (goal.progressMode) {
    case 'milestones': {
      const ms = (goal.milestones as { done: boolean }[]) ?? []
      return ms.length ? (ms.filter((m) => m.done).length / ms.length) * 100 : 0
    }
    case 'numeric': {
      const start = Number(goal.startValue ?? 0)
      const target = Number(goal.targetValue)
      const current = Number(goal.currentValue ?? start)
      if (!Number.isFinite(target) || target === start) return 0
      return Math.min(100, Math.max(0, ((current - start) / (target - start)) * 100))
    }
    default:
      return Math.min(100, Math.max(0, Number(goal.progress ?? 0)))
  }
}
