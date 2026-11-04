/**
 * Plan My Day — a two-minute morning ritual: clear what's overdue, pick a
 * few priorities, look over the day, set an intention. Shared by the desktop
 * dialog and the iPhone sheet; everything here is pure except `finishPlan`.
 */
import { create } from 'zustand'
import { PRIORITY_RANK } from '@/data/constants'
import type { Task } from '@/data/types'
import { addDaysISO } from '@/lib/dates'
import { isOpen, sortTasks } from '@/selectors/tasks'
import { actions } from '@/store/store'

/** Most people can do about three things that matter in a day. */
export const SUGGESTED_PRIORITIES = 3

export const usePlanDay = create<{ open: boolean; /** Bumped on every open, so a reopened dialog always starts fresh. */ session: number; show: () => void; hide: () => void }>((set) => ({
  open: false,
  session: 0,
  show: () => set((s) => ({ open: true, session: s.session + 1 })),
  hide: () => set({ open: false }),
}))

export const planDay = { show: () => usePlanDay.getState().show() }

export const overdueTasks = (tasks: readonly Task[], today: string) => sortTasks(tasks.filter((t) => isOpen(t) && !!t.dueDate && t.dueDate < today))

/**
 * Tasks worth considering as today's priorities: already starred, due today,
 * and important ones due soon or without a date. Starred first, then most
 * important, then soonest.
 */
export function priorityCandidates(tasks: readonly Task[], today: string, limit = 12): Task[] {
  const soon = addDaysISO(today, 3)
  const important = (t: Task) => PRIORITY_RANK[t.priority] >= PRIORITY_RANK.high
  const picked = tasks.filter(
    (t) => isOpen(t) && (t.focusDate === today || (t.dueDate !== undefined && t.dueDate <= today) || (important(t) && (!t.dueDate || t.dueDate <= soon))),
  )
  return [...picked]
    .sort((a, b) => {
      const fa = a.focusDate === today ? 1 : 0
      const fb = b.focusDate === today ? 1 : 0
      if (fa !== fb) return fb - fa
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
      return (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : (a.dueDate ?? '9999') > (b.dueDate ?? '9999') ? 1 : 0
    })
    .slice(0, limit)
}

/** Which tasks change when today's priorities become exactly `selected`. */
export function priorityChanges(tasks: readonly Task[], selected: ReadonlySet<string>, today: string): { id: string; focusDate: string | undefined }[] {
  const out: { id: string; focusDate: string | undefined }[] = []
  for (const t of tasks) {
    const isOn = t.focusDate === today
    const want = selected.has(t.id)
    if (want && !isOn) out.push({ id: t.id, focusDate: today })
    else if (!want && isOn) out.push({ id: t.id, focusDate: undefined })
  }
  return out
}

export function finishPlan(tasks: readonly Task[], selected: ReadonlySet<string>, today: string, intention: string) {
  for (const c of priorityChanges(tasks, selected, today)) actions.update('tasks', c.id, { focusDate: c.focusDate })
  const text = intention.trim()
  actions.updateSettings({ planDayLast: today, intention: text ? { date: today, text } : undefined })
}

export type PlanStep = 'overdue' | 'priorities' | 'day' | 'intention'
export const planSteps = (hasOverdue: boolean): PlanStep[] => (hasOverdue ? ['overdue', 'priorities', 'day', 'intention'] : ['priorities', 'day', 'intention'])
export const STEP_TITLES: Record<PlanStep, string> = {
  overdue: 'Catch up',
  priorities: 'Pick your priorities',
  day: 'Your day',
  intention: 'Set an intention',
}
