import { PRIORITY_RANK } from '@/data/constants'
import type { Task } from '@/data/types'
import { dateOfTimestamp, isBetween } from '@/lib/dates'

export const isOpen = (t: Task) => t.status !== 'done'
export const isOverdue = (t: Task, today: string) => isOpen(t) && !!t.dueDate && t.dueDate < today

export function tasksDueToday(tasks: Task[], today: string): { overdue: Task[]; today: Task[] } {
  const open = tasks.filter(isOpen)
  return {
    overdue: sortTasks(open.filter((t) => t.dueDate && t.dueDate < today)),
    today: sortTasks(open.filter((t) => t.dueDate === today)),
  }
}

/** Tasks picked as today's priorities (open ones first, completed ones kept so progress is visible). */
export function todaysPriorities(tasks: Task[], today: string): Task[] {
  return sortTasks(tasks.filter((t) => t.focusDate === today))
}

/** Open first; then by due date, priority, and creation. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1
    const ad = a.dueDate ?? '9999-12-31'
    const bd = b.dueDate ?? '9999-12-31'
    if (ad !== bd) return ad < bd ? -1 : 1
    const at = a.dueTime ?? '99:99'
    const bt = b.dueTime ?? '99:99'
    if (at !== bt) return at < bt ? -1 : 1
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (pr) return pr
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

export function completedInRange(tasks: Task[], start: string, end: string): Task[] {
  return tasks.filter((t) => t.status === 'done' && t.completedAt && isBetween(dateOfTimestamp(t.completedAt), start, end))
}

export function createdInRange(tasks: Task[], start: string, end: string): Task[] {
  return tasks.filter((t) => isBetween(dateOfTimestamp(t.createdAt), start, end))
}

/** Tasks that were due within the range, and how many of them were finished on or before the due date. */
export function dueInRangeStats(tasks: Task[], start: string, end: string) {
  const due = tasks.filter((t) => t.dueDate && isBetween(t.dueDate, start, end))
  const onTime = due.filter((t) => t.status === 'done' && t.completedAt && dateOfTimestamp(t.completedAt) <= (t.dueDate as string))
  return { due: due.length, done: due.filter((t) => t.status === 'done').length, onTime: onTime.length }
}
