/**
 * Everyday task operations shared by desktop and iPhone: reschedule targets,
 * subtask progress. Pure apart from rescheduleTask.
 */
import type { Task } from '@/data/types'
import { actions } from '@/store/store'
import { type ISODate, type WeekStart, addDaysISO, weekStartISO, weekday } from './dates'

export interface RescheduleOption {
  id: 'today' | 'tomorrow' | 'weekend' | 'next-week' | 'none'
  label: string
  date?: ISODate
}

/** "Today, Tomorrow, This weekend, Next week, No due date" — skipping ones that mean the same day. */
export function rescheduleOptions(today: ISODate, weekStartsOn: WeekStart, current?: ISODate): RescheduleOption[] {
  const tomorrow = addDaysISO(today, 1)
  const wd = weekday(today)
  // Saturday of this week (or today if it's already the weekend).
  const weekend = wd === 6 || wd === 0 ? today : addDaysISO(today, 6 - wd)
  const nextWeek = addDaysISO(weekStartISO(today, weekStartsOn), 7)
  const list: RescheduleOption[] = [
    { id: 'today', label: 'Today', date: today },
    { id: 'tomorrow', label: 'Tomorrow', date: tomorrow },
  ]
  if (weekend !== today && weekend !== tomorrow) list.push({ id: 'weekend', label: 'This weekend', date: weekend })
  if (nextWeek !== tomorrow) list.push({ id: 'next-week', label: 'Next week', date: nextWeek })
  if (current) list.push({ id: 'none', label: 'Remove due date' })
  return list.filter((o) => o.id === 'none' || o.date !== current)
}

export function subtaskProgress(task: Pick<Task, 'checklist'>): { done: number; total: number } {
  const list = task.checklist ?? []
  return { done: list.filter((c) => c.done).length, total: list.length }
}

export function rescheduleTask(id: string, date: ISODate | undefined) {
  return actions.update('tasks', id, { dueDate: date, ...(date ? {} : { dueTime: undefined, remindBefore: undefined }) })
}
