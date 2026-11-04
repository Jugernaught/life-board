import { AnimatePresence } from 'framer-motion'
import { CheckCircle2, ListTodo, Star } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { WidgetSize } from '@/data/types'
import { tasksDueToday, todaysPriorities } from '@/selectors/tasks'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState, ProgressBar } from '@/components/ui/display'
import { TaskItem } from '@/components/shared/TaskItem'
import { InlineAdd, Widget, type WidgetProps } from './Widget'

export function PrioritiesWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const tasks = useCollection('tasks')
  const items = todaysPriorities(tasks, today)
  const done = items.filter((t) => t.status === 'done').length
  return (
    <Widget title="Today's priorities" icon={Star} size={size} testId="widget-priorities" actions={items.length > 0 && <span className="font-mono text-[11.5px] text-ink-subtle">{done}/{items.length}</span>}>
      {items.length > 0 && <ProgressBar value={(done / items.length) * 100} size="xs" className="mb-2" label="Priorities completed" />}
      {items.length === 0 ? (
        <EmptyState compact icon={Star} title="No priorities picked yet" description="Choose the few things that matter most today. Star any task, or add one below." />
      ) : (
        <div className="-mx-2">
          <AnimatePresence initial={false}>
            {items.map((t) => (
              <TaskItem key={t.id} task={t} today={today} />
            ))}
          </AnimatePresence>
        </div>
      )}
      <InlineAdd placeholder="Add a priority for today…" onAdd={(title) => actions.create('tasks', { title, focusDate: today, dueDate: today, priority: 'high' })} />
    </Widget>
  )
}

export function TodayWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const tasks = useCollection('tasks')
  const navigate = useNavigate()
  const { overdue, today: due } = tasksDueToday(tasks, today)
  const completedToday = tasks.filter((t) => t.status === 'done' && t.dueDate === today).length
  return (
    <Widget
      title="Due today"
      icon={ListTodo}
      size={size}
      testId="widget-today"
      actions={
        <Button size="xs" variant="ghost" onClick={() => navigate('/schedule?tab=tasks')}>
          All tasks
        </Button>
      }
    >
      {overdue.length === 0 && due.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircle2}
          title={completedToday ? 'All done for today' : 'Nothing due today'}
          description={completedToday ? `You completed ${completedToday} task${completedToday === 1 ? '' : 's'} due today.` : 'Tasks with today’s due date will appear here.'}
        />
      ) : (
        <div className="-mx-2 max-h-80 overflow-y-auto">
          {overdue.length > 0 && <p className="eyebrow px-2 pt-1 pb-1 text-[color-mix(in_oklab,var(--color-bad)_80%,var(--color-ink))]">Overdue · {overdue.length}</p>}
          <AnimatePresence initial={false}>
            {overdue.map((t) => (
              <TaskItem key={t.id} task={t} today={today} />
            ))}
          </AnimatePresence>
          {due.length > 0 && overdue.length > 0 && <p className="eyebrow px-2 pt-2 pb-1">Today · {due.length}</p>}
          <AnimatePresence initial={false}>
            {due.map((t) => (
              <TaskItem key={t.id} task={t} today={today} />
            ))}
          </AnimatePresence>
        </div>
      )}
      <InlineAdd placeholder="Add a task due today…" onAdd={(title) => actions.create('tasks', { title, dueDate: today })} />
    </Widget>
  )
}
