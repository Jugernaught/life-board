import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CalendarClock, CalendarDays, CalendarX, Clock, Copy, FolderKanban, ListChecks, Pencil, Repeat, Star, Trash2 } from 'lucide-react'
import { PRIORITIES } from '@/data/constants'
import type { Task } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { formatDate, relativeDay } from '@/lib/dates'
import { describeRepeat } from '@/lib/recurrence'
import { rescheduleOptions, subtaskProgress } from '@/lib/taskOps'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { duplicateTask, reschedule, rescheduleToPickedDate, setSubtasks } from '@/app/taskCommands'
import { Checklist } from './Checklist'
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
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const subs = subtaskProgress(task)
  const moves = rescheduleOptions(today, settings.weekStartsOn, task.dueDate)
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('group rounded-lg px-2 transition-colors hover:bg-panel-3/50', compact ? 'py-1.5' : 'py-2')}
      data-testid="task-item"
    >
      <div className="flex items-start gap-3">
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
            {task.repeat && (
              <span className="inline-flex items-center gap-1" title={describeRepeat(task.repeat)} data-testid="task-repeat">
                <Repeat size={12} />
                {describeRepeat(task.repeat)}
              </span>
            )}
            {task.remindBefore !== undefined && task.dueTime && !done && (
              <span className="inline-flex items-center gap-1" title="Reminder set">
                <Bell size={12} />
                <span className="sr-only">Reminder set</span>
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
      {subs.total > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Subtasks: ${subs.done} of ${subs.total} done. ${open ? 'Hide' : 'Show'}`}
          data-testid="task-subtasks"
          className={cn(
            'mt-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-[11.5px] tabular transition-colors hover:bg-panel-3',
            subs.done === subs.total ? 'text-ok' : 'text-ink-muted',
          )}
        >
          <ListChecks size={13} />
          {subs.done}/{subs.total}
        </button>
      )}
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
            { label: 'Edit', icon: Pencil, onSelect: () => editor.edit('tasks', task.id) },
            { label: focused ? "Remove from today's priorities" : 'Make a priority today', icon: Star, onSelect: () => actions.update('tasks', task.id, { focusDate: focused ? undefined : today }) },
            'divider',
            ...(done
              ? []
              : moves.map((m) => ({
                  label: m.id === 'none' ? m.label : `Move to ${m.label.toLowerCase()}`,
                  icon: m.id === 'none' ? CalendarX : CalendarDays,
                  hint: m.date && (m.id === 'weekend' || m.id === 'next-week') ? formatDate(m.date, 'EEE d MMM') : undefined,
                  onSelect: () => reschedule(task, m.date, today),
                }))),
            ...(done ? [] : [{ label: 'Pick a date…', icon: CalendarClock, onSelect: () => void rescheduleToPickedDate(task, today) }, 'divider' as const]),
            { label: 'Duplicate', icon: Copy, onSelect: () => duplicateTask(task) },
            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => void deleteRecord('tasks', task.id) },
          ]}
        />
      </div>
      </div>
      <AnimatePresence initial={false}>
        {open && subs.total > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-8" data-testid="task-subtask-list">
            <div className="pt-1.5 pb-1">
              <Checklist items={task.checklist} onChange={(c) => setSubtasks(task, c)} today={today} placeholder="Add a subtask…" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
