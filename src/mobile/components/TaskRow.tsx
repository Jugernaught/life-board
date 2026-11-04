import { CalendarDays, Clock, FolderKanban, Star, Trash2 } from 'lucide-react'
import type { Task } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { CheckCircle } from '../ui/controls'
import { SwipeRow } from '../ui/SwipeRow'

const PRIORITY_MARKS: Record<Task['priority'], string> = { low: '', medium: '', high: '!!', urgent: '!!!' }

/**
 * A task row in the style of Reminders: tap the circle to complete, tap the
 * row to edit, swipe left for Priority / Delete.
 */
export function TaskRow({ task, today, showProject = true }: { task: Task; today: string; showProject?: boolean }) {
  const fmt = useFormatters()
  const projects = useCollection('projects')
  const done = task.status === 'done'
  const overdue = !done && !!task.dueDate && task.dueDate < today
  const focused = task.focusDate === today
  const project = showProject && task.projectId ? projects.find((p) => p.id === task.projectId) : undefined
  const meta = [
    task.dueDate && { icon: CalendarDays, text: relativeDay(task.dueDate, today), bad: overdue },
    task.dueTime && { icon: Clock, text: fmt.time(task.dueTime) },
    project && { icon: FolderKanban, text: project.name },
  ].filter(Boolean) as { icon: typeof Clock; text: string; bad?: boolean }[]
  return (
    <SwipeRow
      testId="m-task-row"
      actions={[
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
                <span key={m.text} className={cn('inline-flex items-center gap-1', m.bad && 'text-bad')}>
                  <m.icon size={12} />
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
