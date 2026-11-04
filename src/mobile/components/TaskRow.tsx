import { CalendarClock, CalendarDays, Clock, FolderKanban, ListChecks, Repeat, Star, Trash2 } from 'lucide-react'
import { PRIORITIES } from '@/data/constants'
import type { Task } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { formatDate, relativeDay } from '@/lib/dates'
import { describeRepeat } from '@/lib/recurrence'
import { rescheduleOptions, subtaskProgress } from '@/lib/taskOps'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { duplicateTask, reschedule, rescheduleToPickedDate } from '@/app/taskCommands'
import { actionSheet } from '../ui/ActionSheet'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { CheckCircle } from '../ui/controls'
import { SwipeRow } from '../ui/SwipeRow'

const PRIORITY_MARKS: Record<Task['priority'], string> = { low: '', medium: '', high: '!!', urgent: '!!!' }

const iosTitle = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** "Later" — the reschedule choices as an action sheet. */
export function rescheduleSheet(task: Task, today: string, weekStartsOn: 0 | 1) {
  const moves = rescheduleOptions(today, weekStartsOn, task.dueDate)
  actionSheet({
    title: 'Reschedule',
    message: task.title,
    options: [
      ...moves.map((m) => ({
        label: m.date && (m.id === 'weekend' || m.id === 'next-week') ? `${iosTitle(m.label)} (${formatDate(m.date, 'EEE d MMM')})` : iosTitle(m.label),
        destructive: m.id === 'none',
        onSelect: () => reschedule(task, m.date, today),
      })),
      { label: 'Pick a Date…', onSelect: () => void rescheduleToPickedDate(task, today) },
    ],
  })
}

/** Long-press menu: everything you can do to a task without opening it. */
export function taskActionSheet(task: Task, today: string, weekStartsOn: 0 | 1) {
  const done = task.status === 'done'
  const focused = task.focusDate === today
  const nextPriority = task.priority === 'high' || task.priority === 'urgent' ? 'medium' : 'high'
  actionSheet({
    title: task.title,
    options: [
      { label: done ? 'Mark Not Done' : 'Complete', onSelect: () => actions.update('tasks', task.id, { status: done ? 'todo' : 'done' }) },
      ...(done ? [] : [{ label: 'Reschedule…', onSelect: () => rescheduleSheet(task, today, weekStartsOn) }]),
      { label: focused ? "Remove from Today's Priorities" : "Add to Today's Priorities", onSelect: () => actions.update('tasks', task.id, { focusDate: focused ? undefined : today }) },
      { label: `Set Priority: ${PRIORITIES.label(nextPriority)}`, onSelect: () => actions.update('tasks', task.id, { priority: nextPriority }) },
      { label: 'Edit…', onSelect: () => editor.edit('tasks', task.id) },
      { label: 'Duplicate', onSelect: () => duplicateTask(task) },
      { label: 'Delete', destructive: true, onSelect: () => void deleteRecord('tasks', task.id) },
    ],
  })
}

/**
 * A task row in the style of Reminders: tap the circle to complete, tap the
 * row to edit, swipe left for Later / Priority / Delete, press and hold for
 * every action.
 */
export function TaskRow({ task, today, showProject = true }: { task: Task; today: string; showProject?: boolean }) {
  const fmt = useFormatters()
  const projects = useCollection('projects')
  const done = task.status === 'done'
  const overdue = !done && !!task.dueDate && task.dueDate < today
  const focused = task.focusDate === today
  const project = showProject && task.projectId ? projects.find((p) => p.id === task.projectId) : undefined
  const { weekStartsOn } = useSettings()
  const subs = subtaskProgress(task)
  const meta = [
    task.dueDate && { icon: CalendarDays, text: relativeDay(task.dueDate, today), bad: overdue },
    task.dueTime && { icon: Clock, text: fmt.time(task.dueTime) },
    task.repeat && { icon: Repeat, text: describeRepeat(task.repeat) },
    subs.total > 0 && { icon: ListChecks, text: `${subs.done}/${subs.total}`, label: `Subtasks ${subs.done} of ${subs.total} done` },
    project && { icon: FolderKanban, text: project.name },
  ].filter(Boolean) as { icon: typeof Clock; text: string; bad?: boolean; label?: string }[]
  return (
    <SwipeRow
      testId="m-task-row"
      onLongPress={() => taskActionSheet(task, today, weekStartsOn)}
      actions={[
        ...(done ? [] : [{ label: 'Later', icon: CalendarClock, tone: 'info' as const, onAction: () => rescheduleSheet(task, today, weekStartsOn) }]),
        { label: focused ? 'Unstar' : 'Priority', icon: Star, tone: 'amber', onAction: () => actions.update('tasks', task.id, { focusDate: focused ? undefined : today }) },
        { label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('tasks', task.id) },
      ]}
    >
      <div className="flex items-start gap-3 px-4">
        <div className="pt-[10px]">
          <CheckCircle checked={done} label={`${done ? 'Mark not done' : 'Complete'}: ${task.title}`} onToggle={() => actions.update('tasks', task.id, { status: done ? 'todo' : 'done' })} />
        </div>
        <button type="button" onClick={() => editor.edit('tasks', task.id)} className="min-w-0 flex-1 py-[11px] text-left">
          <span className={cn('ios-body block', done ? 'text-ink-subtle' : 'text-ink')}>
            {PRIORITY_MARKS[task.priority] && !done && <span className="mr-1 font-semibold text-bad">{PRIORITY_MARKS[task.priority]}</span>}
            {task.title}
          </span>
          {meta.length > 0 && (
            <span className="ios-footnote mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-ink-subtle">
              {meta.map((m) => (
                <span key={m.text} className={cn('inline-flex items-center gap-1', m.bad && 'text-bad')} aria-label={m.label}>
                  <m.icon size={12} aria-hidden />
                  {m.text}
                </span>
              ))}
            </span>
          )}
        </button>
        {focused && !done && <Star size={16} className="mt-[14px] shrink-0 fill-[var(--color-amber)] text-[var(--color-amber)]" aria-label="Today's priority" />}
      </div>
    </SwipeRow>
  )
}
