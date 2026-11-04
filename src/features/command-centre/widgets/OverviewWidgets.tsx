import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { CalendarClock, CalendarPlus, CheckSquare, FileText, FolderKanban, Plus, Target, Zap } from 'lucide-react'
import { GOAL_HORIZONS, LIFE_AREAS, PROJECT_STATUSES } from '@/data/constants'
import type { WidgetSize } from '@/data/types'
import { buildAgenda } from '@/selectors/agenda'
import { nextMilestone, projectProgress } from '@/selectors/projects'
import { goalProgressOf } from '@/store/lifecycle'
import { actions, useCollection, useDatabase } from '@/store/store'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar } from '@/components/ui/display'
import { Segmented } from '@/components/ui/inputs'
import { AgendaList } from '@/components/shared/AgendaList'
import { editor } from '@/components/editor/editorStore'
import { useUI } from '@/components/command/uiStore'
import { useState } from 'react'
import { Widget, type WidgetProps } from './Widget'

export function UpcomingWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const db = useDatabase()
  const navigate = useNavigate()
  const items = useMemo(() => buildAgenda(db, today, addDaysISO(today, 7), today), [db, today])
  return (
    <Widget
      title="Upcoming · next 7 days"
      icon={CalendarClock}
      size={size}
      testId="widget-upcoming"
      actions={
        <>
          <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('events')}>
            Event
          </Button>
          <Button size="xs" variant="ghost" onClick={() => navigate('/schedule')}>
            Calendar
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="A clear week ahead" description="Events, deadlines, exams, interviews, birthdays and payments due in the next 7 days will show here." />
      ) : (
        <div className="-mx-2 max-h-96 overflow-y-auto">
          <AgendaList items={items} today={today} />
        </div>
      )}
    </Widget>
  )
}

export function GoalsWidget({ size }: WidgetProps & { size: WidgetSize }) {
  const goals = useCollection('goals')
  const navigate = useNavigate()
  const active = goals
    .filter((g) => g.status === 'active')
    .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))
    .slice(0, 6)
  return (
    <Widget
      title="Goal progress"
      icon={Target}
      size={size}
      testId="widget-goals"
      actions={
        <Button size="xs" variant="ghost" onClick={() => navigate('/goals')}>
          All goals
        </Button>
      }
    >
      {active.length === 0 ? (
        <EmptyState compact icon={Target} title="No active goals" description="Set a goal and track it by %, milestones or a number." action={<Button size="sm" icon={Plus} onClick={() => editor.create('goals')}>Add goal</Button>} />
      ) : (
        <ul className="space-y-3">
          {active.map((g) => {
            const pct = goalProgressOf(g)
            return (
              <li key={g.id}>
                <button type="button" onClick={() => editor.edit('goals', g.id)} className="w-full text-left">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] text-ink">{g.title}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-ink-muted tabular">{Math.round(pct)}%</span>
                  </div>
                  <ProgressBar value={pct} size="sm" label={`${g.title} progress`} />
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-subtle">
                    <span>{GOAL_HORIZONS.label(g.horizon)}</span>
                    <span>·</span>
                    <span>{LIFE_AREAS.label(g.area)}</span>
                    {g.targetDate && (
                      <>
                        <span>·</span>
                        <span>{relativeDay(g.targetDate)}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}

export function ProjectsWidget({ size }: WidgetProps & { size: WidgetSize }) {
  const projects = useCollection('projects')
  const tasks = useCollection('tasks')
  const navigate = useNavigate()
  const active = projects.filter((p) => p.status === 'active' || p.status === 'planning').slice(0, 6)
  return (
    <Widget
      title="Active projects"
      icon={FolderKanban}
      size={size}
      testId="widget-projects"
      actions={
        <Button size="xs" variant="ghost" onClick={() => navigate('/projects')}>
          All projects
        </Button>
      }
    >
      {active.length === 0 ? (
        <EmptyState compact icon={FolderKanban} title="No active projects" action={<Button size="sm" icon={Plus} onClick={() => editor.create('projects')}>New project</Button>} />
      ) : (
        <ul className="space-y-2">
          {active.map((p) => {
            const prog = projectProgress(p, tasks)
            const next = nextMilestone(p)
            return (
              <li key={p.id}>
                <button type="button" onClick={() => navigate(`/projects/${p.id}`)} className="w-full rounded-lg border border-line bg-panel-2/30 p-3 text-left transition-colors hover:border-line-strong">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: toneColor(p.color) }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                    <Badge tone={PROJECT_STATUSES.tone(p.status)}>{PROJECT_STATUSES.label(p.status)}</Badge>
                  </div>
                  <ProgressBar value={prog.pct} size="xs" className="mt-2.5" showValue label={`${p.name} progress`} tone={p.color} />
                  <p className="mt-1.5 truncate text-[11.5px] text-ink-subtle">
                    {prog.total ? `${prog.done}/${prog.total} tasks & milestones` : 'No tasks or milestones yet'}
                    {next ? ` · Next: ${next.title}` : ''}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}

type QuickKind = 'task' | 'event' | 'goal' | 'note'

/** Create without leaving the dashboard: type a title, press Enter. */
export function QuickAddWidget({ today, size }: WidgetProps & { size: WidgetSize }) {
  const [kind, setKind] = useState<QuickKind>('task')
  const { showQuickAdd } = useUI()
  const placeholder = { task: 'Task title…', event: 'Event today, e.g. Gym 18:00', goal: 'Goal, e.g. Read 12 books', note: 'Quick note…' }[kind]
  return (
    <Widget title="Quick add" icon={Zap} size={size} testId="widget-quickadd">
      <Segmented
        value={kind}
        onChange={setKind}
        size="sm"
        fullWidth
        ariaLabel="Type to add"
        options={[
          { value: 'task', label: 'Task' },
          { value: 'event', label: 'Event' },
          { value: 'goal', label: 'Goal' },
          { value: 'note', label: 'Note' },
        ]}
      />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem('title') as HTMLInputElement
          const raw = input.value.trim()
          if (!raw) return
          if (kind === 'task') actions.create('tasks', { title: raw })
          if (kind === 'goal') actions.create('goals', { title: raw })
          if (kind === 'note') actions.create('notes', { title: raw.slice(0, 80), body: raw.length > 80 ? raw : '' })
          if (kind === 'event') {
            // A trailing time like "18:00" or "6pm" becomes the start time.
            const m = raw.match(/\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
            let start: string | undefined
            let title = raw
            if (m) {
              let h = Number(m[1])
              if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
              if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0
              if (h < 24) {
                start = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
                title = raw.slice(0, m.index).trim() || raw
              }
            }
            const end = start ? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0')}:${start.slice(3)}` : undefined
            actions.create('events', { title, date: today, allDay: !start, startTime: start, endTime: end })
          }
          input.value = ''
        }}
      >
        <input
          name="title"
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel-2/60 px-3 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle focus:border-accent/60"
        />
        <Button type="submit" variant="primary" size="md" icon={Plus} aria-label={`Add ${kind}`} />
      </form>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" icon={CheckSquare} onClick={() => showQuickAdd('tasks')}>Task…</Button>
        <Button size="sm" icon={CalendarPlus} onClick={() => showQuickAdd('events')}>Event…</Button>
        <Button size="sm" icon={Target} onClick={() => showQuickAdd('goals')}>Goal…</Button>
        <Button size="sm" icon={FileText} onClick={() => showQuickAdd('notes')}>Note…</Button>
      </div>
      <p className="mt-2.5 text-[11.5px] text-ink-subtle">
        Press <span className="font-mono text-ink-muted">N</span> anywhere for the full quick-add menu.
      </p>
    </Widget>
  )
}
