import { motion } from 'framer-motion'
import { CalendarDays, Clock, FolderKanban, Star } from 'lucide-react'
import { PRIORITIES } from '@/data/constants'
import type { Task } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { Badge } from '@/components/ui/display'
import { Checkbox } from '@/components/ui/inputs'
import { Menu } from '@/components/ui/Menu'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'

/** A task row with a completion checkbox, shared by every task list in the app. */
export function TaskItem({ task, today, showProject = true, compact, showFocus = true }: { task: Task; today: string; showProject?: boolean; compact?: boolean; showFocus?: boolean }) {
  const fmt = useFormatters()
  const projects = useCollection('projects')
  const project = showProject && task.projectId ? projects.find((p) => p.id === task.projectId) : undefined
  const done = task.status === 'done'
  const overdue = !done && !!task.dueDate && task.dueDate < today
  const focused = task.focusDate === today
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('group flex items-start gap-3 rounded-lg px-2 transition-colors hover:bg-panel-3/50', compact ? 'py-1.5' : 'py-2')}
      data-testid="task-item"
    >
      <div className="pt-0.5">
        <Checkbox
          checked={done}
          onChange={(v) => actions.update('tasks', task.id, { status: v ? 'done' : 'todo' })}
          label={<span className="sr-only">{done ? 'Mark as not done' : 'Mark as done'}: {task.title}</span>}
        />
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => editor.edit('tasks', task.id)}>
        <p className={cn('truncate text-[14px] transition-colors', done ? 'text-ink-subtle line-through' : 'text-ink')}>{task.title}</p>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-subtle">
            {task.dueDate && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'text-bad')}>
                <CalendarDays size={12} />
                {relativeDay(task.dueDate, today)}
              </span>
            )}
            {task.dueTime && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {fmt.time(task.dueTime)}
              </span>
            )}
            {project && (
              <span className="inline-flex items-center gap-1">
                <FolderKanban size={12} />
                {project.name}
              </span>
            )}
          </div>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {task.priority !== 'medium' && task.priority !== 'low' && !done && <Badge tone={PRIORITIES.tone(task.priority)}>{PRIORITIES.label(task.priority)}</Badge>}
        {showFocus && !done && (
          <button
            type="button"
            onClick={() => actions.update('tasks', task.id, { focusDate: focused ? undefined : today })}
            className={cn('rounded p-1 transition-colors', focused ? 'text-amber' : 'text-ink-subtle/0 group-hover:text-ink-subtle hover:!text-amber focus-visible:text-ink-subtle')}
            aria-label={focused ? "Remove from today's priorities" : "Add to today's priorities"}
            title={focused ? "Remove from today's priorities" : "Add to today's priorities"}
          >
            <Star size={14} className={focused ? 'fill-amber' : ''} />
          </button>
        )}
        <Menu
          items={[
            { label: 'Edit', onSelect: () => editor.edit('tasks', task.id) },
            { label: focused ? "Remove from today's priorities" : "Make a priority today", onSelect: () => actions.update('tasks', task.id, { focusDate: focused ? undefined : today }) },
            { label: 'Due today', onSelect: () => actions.update('tasks', task.id, { dueDate: today }) },
            'divider',
            { label: 'Delete', danger: true, onSelect: () => void deleteRecord('tasks', task.id) },
          ]}
        />
      </div>
    </motion.div>
  )
}
