import { CalendarDays, CalendarRange, CheckSquare, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { addDaysISO } from '@/lib/dates'
import { useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { AgendaList } from '@/components/shared/AgendaList'
import { editor } from '@/components/editor/editorStore'
import { CalendarView } from './CalendarView'
import { TasksView } from './TasksView'

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'agenda', label: 'Agenda', icon: CalendarRange },
] as const

export default function SchedulePage() {
  const today = useToday()
  const db = useDatabase()
  const [tab, setTab] = useTabParam(TABS, 'calendar')
  const agenda = useMemo(() => buildAgenda(db, today, addDaysISO(today, 60), today), [db, today])
  const openTasks = db.tasks.filter((t) => t.status !== 'done').length
  return (
    <div>
      <PageHeader
        section="schedule"
        description="Plan your days with time blocks, events and tasks. Deadlines, exams, interviews and occasions from every section appear here automatically."
        actions={
          <>
            {/* On the Tasks tab, its own "New task" button prefills the date for the chosen scope. */}
            {tab !== 'tasks' && (
              <Button icon={Plus} onClick={() => editor.create('tasks')}>
                Task
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={() => editor.create('events', { kind: 'block' })}>
              Time block
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'tasks' ? openTasks : undefined }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'calendar' && <CalendarView today={today} />}
      {tab === 'tasks' && <TasksView today={today} />}
      {tab === 'agenda' && (
        <Panel title="Agenda" eyebrow="Next 60 days">
          {agenda.length === 0 ? (
            <EmptyState icon={CalendarRange} title="Your agenda is clear" description="Anything with a date — events, task due dates, assignments, exams, interviews, project milestones, goal targets, birthdays, recurring payments — will be listed here." />
          ) : (
            <div className="-mx-2">
              <AgendaList items={agenda} today={today} />
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
