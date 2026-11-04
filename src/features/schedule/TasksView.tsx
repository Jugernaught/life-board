import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays, CheckSquare, Plus } from 'lucide-react'
import { LIFE_AREAS, PRIORITIES, PRIORITY_RANK } from '@/data/constants'
import type { Task } from '@/data/types'
import { useListControls } from '@/hooks/useListControls'
import { addDaysISO, formatDate, relativeDay } from '@/lib/dates'
import { groupBy } from '@/lib/utils'
import { isOverdue } from '@/selectors/tasks'
import { useCollection } from '@/store/store'
import { rescheduleMany } from '@/app/taskCommands'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { Segmented } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TaskItem } from '@/components/shared/TaskItem'
import { editor } from '@/components/editor/editorStore'

type Scope = 'today' | 'upcoming' | 'overdue' | 'someday' | 'all' | 'done'

/** The full task manager: scopes, search, filters, sorting, grouping by due date. */
export function TasksView({ today }: { today: string }) {
  const tasks = useCollection('tasks')
  const projects = useCollection('projects')
  const [scope, setScope] = useState<Scope>('today')
  const counts = useMemo(
    () => ({
      today: tasks.filter((t) => t.status !== 'done' && (t.dueDate === today || t.focusDate === today)).length,
      upcoming: tasks.filter((t) => t.status !== 'done' && !!t.dueDate && t.dueDate > today).length,
      overdue: tasks.filter((t) => isOverdue(t, today)).length,
      someday: tasks.filter((t) => t.status !== 'done' && !t.dueDate).length,
      all: tasks.filter((t) => t.status !== 'done').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks, today],
  )
  const scoped = useMemo(() => {
    switch (scope) {
      case 'today':
        return tasks.filter((t) => t.status !== 'done' && (t.dueDate === today || t.focusDate === today)).concat(tasks.filter((t) => t.status === 'done' && (t.dueDate === today || t.focusDate === today)))
      case 'upcoming':
        return tasks.filter((t) => t.status !== 'done' && !!t.dueDate && t.dueDate > today)
      case 'overdue':
        return tasks.filter((t) => isOverdue(t, today))
      case 'someday':
        return tasks.filter((t) => t.status !== 'done' && !t.dueDate)
      case 'all':
        return tasks.filter((t) => t.status !== 'done')
      case 'done':
        return tasks.filter((t) => t.status === 'done')
    }
  }, [tasks, scope, today])

  const controls = useListControls<Task>(scoped, {
    search: (t) => `${t.title} ${t.notes ?? ''} ${t.tags.join(' ')}`,
    filters: [
      { key: 'area', label: 'Areas', options: LIFE_AREAS.list, get: (t) => t.area },
      { key: 'priority', label: 'Priorities', options: PRIORITIES.list, get: (t) => t.priority },
      { key: 'project', label: 'Projects', options: projects.map((p) => ({ value: p.id, label: p.name })), get: (t) => t.projectId },
    ],
    sorts: [
      { value: 'due', label: 'Due date', get: (t) => `${t.dueDate ?? '9999'} ${t.dueTime ?? '99'}` },
      { value: 'priority', label: 'Priority', get: (t) => PRIORITY_RANK[t.priority], dir: 'desc' },
      { value: 'created', label: 'Created', get: (t) => t.createdAt, dir: 'desc' },
      { value: 'completed', label: 'Completed', get: (t) => t.completedAt, dir: 'desc' },
      { value: 'title', label: 'Title', get: (t) => t.title },
    ],
  })

  const grouped = controls.sort === 'due' && scope !== 'done'
  const groups = grouped ? groupBy(controls.results, (t) => t.dueDate ?? 'none') : { all: controls.results }
  const groupKeys = Object.keys(groups).sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : controls.dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <Segmented
            value={scope}
            onChange={setScope}
            ariaLabel="Task scope"
            options={(
              [
                ['today', 'Today'],
                ['upcoming', 'Upcoming'],
                ['overdue', 'Overdue'],
                ['someday', 'No date'],
                ['all', 'All open'],
                ['done', 'Completed'],
              ] as [Scope, string][]
            ).map(([value, label]) => ({
              value,
              label: (
                <>
                  {label}
                  <span className={value === 'overdue' && counts.overdue ? 'font-mono text-[10.5px] text-bad' : 'font-mono text-[10.5px] text-ink-subtle'}>{counts[value]}</span>
                </>
              ),
            }))}
          />
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('tasks', scope === 'today' ? { dueDate: today } : scope === 'upcoming' ? { dueDate: addDaysISO(today, 1) } : {})}>
          New task
        </Button>
      </div>
      <ListToolbar controls={controls} placeholder="Search tasks…" total={scoped.length} />
      {scope === 'overdue' && controls.results.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-bad/25 bg-bad/5 px-3 py-2 text-[13px] text-ink-muted">
          <span>Behind on {controls.results.length} tasks? Give them a fresh start.</span>
          <span className="flex gap-2">
            <Button size="xs" variant="secondary" onClick={() => rescheduleMany(controls.results, today, today)} data-testid="overdue-all-today">
              Move all to today
            </Button>
            <Button size="xs" variant="ghost" onClick={() => rescheduleMany(controls.results, addDaysISO(today, 1), today)}>
              Tomorrow
            </Button>
          </span>
        </div>
      )}
      {controls.results.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CheckSquare}
            title={scoped.length ? 'No tasks match your filters' : scope === 'today' ? 'Nothing due today' : scope === 'overdue' ? 'Nothing overdue' : 'No tasks here'}
            description={scoped.length ? 'Try clearing the search or filters.' : 'Add a task with the button above, or press N anywhere.'}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((k) => (
            <Panel
              key={k}
              title={grouped ? (k === 'none' ? 'No due date' : `${relativeDay(k, today)} · ${formatDate(k, 'EEE d MMM')}`) : undefined}
              actions={
                grouped && (
                  <span className="flex items-center gap-3">
                    {k !== 'none' && k < today && (
                      <Button size="xs" variant="ghost" icon={CalendarDays} onClick={() => rescheduleMany(groups[k], today, today)}>
                        Move to today
                      </Button>
                    )}
                    <span className="font-mono text-[11px] text-ink-subtle">{groups[k].length}</span>
                  </span>
                )
              }
              className={grouped && k !== 'none' && k < today ? 'border-bad/25' : undefined}
            >
              <div className="-mx-2">
                <AnimatePresence initial={false}>
                  {groups[k].map((t) => (
                    <TaskItem key={t.id} task={t} today={today} />
                  ))}
                </AnimatePresence>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
