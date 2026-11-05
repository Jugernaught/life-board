import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, CalendarClock, ExternalLink, FolderX, History, Link2, ListChecks, Milestone, Pencil, Target, Trash2 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PRIORITIES, PROJECT_KINDS, PROJECT_STATUSES, type ProjectStatus } from '@/data/constants'
import { useToday } from '@/hooks/useNow'
import { projectProgress } from '@/selectors/projects'
import { sortTasks } from '@/selectors/tasks'
import { dateOfTimestamp, diffDays, eachDay, formatDate, relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { actions, useCollection, useDatabase, useRecord } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressRing } from '@/components/ui/display'
import { Checkbox, Segmented } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { Checklist } from '@/components/shared/Checklist'
import { NotesPanel } from '@/components/shared/NotesPanel'
import { TaskItem } from '@/components/shared/TaskItem'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { ActivityFeed } from '@/features/command-centre/widgets/LifeWidgets'
import { InlineAdd } from '@/features/command-centre/widgets/Widget'

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const project = useRecord('projects', projectId)
  const tasks = useCollection('tasks')
  const db = useDatabase()
  const today = useToday()
  const navigate = useNavigate()
  const [showDone, setShowDone] = useState(false)

  const own = useMemo(() => sortTasks(tasks.filter((t) => t.projectId === projectId)), [tasks, projectId])
  const history = useMemo(() => db.activity.filter((a) => a.projectId === projectId), [db.activity, projectId])

  const burnup = useMemo(() => {
    if (!project) return []
    const events = [
      ...own.filter((t) => t.completedAt).map((t) => dateOfTimestamp(t.completedAt as string)),
      ...project.milestones.filter((m) => m.done && m.doneAt).map((m) => dateOfTimestamp(m.doneAt as string)),
    ].sort()
    if (!events.length) return []
    const start = dateOfTimestamp(project.createdAt) < events[0] ? dateOfTimestamp(project.createdAt) : events[0]
    const days = eachDay(start, today)
    const step = Math.max(1, Math.ceil(days.length / 60))
    let i = 0
    let count = 0
    return days
      .map((d) => {
        while (i < events.length && events[i] <= d) {
          count++
          i++
        }
        return { date: d, done: count }
      })
      .filter((_, idx, arr) => idx % step === 0 || idx === arr.length - 1)
  }, [own, project, today])

  if (!project) {
    return (
      <Panel padded={false}>
        <EmptyState icon={FolderX} title="Project not found" description="It may have been deleted." action={<Button onClick={() => navigate('/projects')}>Back to projects</Button>} />
      </Panel>
    )
  }

  const prog = projectProgress(project, tasks)
  const visibleTasks = showDone ? own : own.filter((t) => t.status !== 'done')
  const daysLeft = project.deadline ? diffDays(today, project.deadline) : null
  const update = (patch: Parameters<typeof actions.update<'projects'>>[2]) => actions.update('projects', project.id, patch)

  return (
    <div>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-subtle hover:text-ink">
        <ArrowLeft size={14} /> All projects
      </Link>
      <header className="panel hud relative mb-5 overflow-hidden p-5">
        <span className="absolute inset-y-0 left-0 w-1" style={{ background: toneColor(project.color), boxShadow: `0 0 16px ${toneColor(project.color)}` }} aria-hidden />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {PROJECT_KINDS.label(project.kind)} · created {formatDate(project.createdAt.slice(0, 10), 'd MMM yyyy')}
            </p>
            <h1 className="mt-1.5 font-display text-[26px] leading-tight font-semibold text-ink">{project.name}</h1>
            {project.description && <p className="mt-2 max-w-3xl text-[14px] whitespace-pre-line text-ink-muted">{project.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={PRIORITIES.tone(project.priority)}>{PRIORITIES.label(project.priority)} priority</Badge>
              {project.startDate && <Badge>Started {formatDate(project.startDate, 'd MMM yyyy')}</Badge>}
              {project.deadline && (
                <Badge tone={daysLeft !== null && daysLeft < 0 && project.status !== 'completed' ? 'bad' : 'muted'}>
                  <CalendarClock size={11} className="mr-1 inline" />
                  Deadline {formatDate(project.deadline, 'd MMM yyyy')}
                  {daysLeft !== null && Math.abs(daysLeft) < 28 ? ` · ${relativeDay(project.deadline, today)}` : daysLeft !== null && daysLeft > 0 ? ` · ${daysLeft} days left` : ''}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={prog.pct} size={76} stroke={6} tone={project.color} label="Project progress">
              <div className="text-center">
                <p className="font-mono text-[15px] text-ink tabular">{prog.pct === null ? '—' : `${Math.round(prog.pct)}%`}</p>
                <p className="text-[9.5px] text-ink-subtle">
                  {prog.done}/{prog.total}
                </p>
              </div>
            </ProgressRing>
            <div className="flex flex-col gap-2">
              <Button size="sm" icon={Pencil} onClick={() => editor.edit('projects', project.id)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="text-bad hover:text-bad"
                onClick={async () => {
                  if (await deleteRecord('projects', project.id)) navigate('/projects')
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Segmented value={project.status} onChange={(status: ProjectStatus) => update({ status })} options={PROJECT_STATUSES.list} ariaLabel="Project status" />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Panel
            title="Tasks"
            icon={ListChecks}
            actions={
              <Checkbox size="sm" checked={showDone} onChange={setShowDone} label={<span className="text-[12px] text-ink-muted">Show completed ({own.filter((t) => t.status === 'done').length})</span>} />
            }
          >
            {visibleTasks.length === 0 ? (
              <p className="py-2 text-[13px] text-ink-subtle">{own.length ? 'All tasks done.' : 'No tasks yet — break the project into steps below.'}</p>
            ) : (
              <div className="-mx-2">
                <AnimatePresence initial={false}>
                  {visibleTasks.map((t) => (
                    <TaskItem key={t.id} task={t} today={today} showProject={false} />
                  ))}
                </AnimatePresence>
              </div>
            )}
            <InlineAdd placeholder="Add a task to this project…" onAdd={(title) => actions.create('tasks', { title, projectId: project.id, area: project.area })} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Objectives" icon={Target}>
              <Checklist items={project.objectives} onChange={(objectives) => update({ objectives })} placeholder="Add an objective…" today={today} showProgress emptyText="What does success look like?" />
            </Panel>
            <Panel title="Milestones" icon={Milestone}>
              <Checklist items={project.milestones} onChange={(milestones) => update({ milestones })} placeholder="Add a milestone…" today={today} showProgress emptyText="Key checkpoints along the way." />
              <p className="mt-2 text-[11.5px] text-ink-subtle">Set milestone due dates in Edit — they appear on your calendar.</p>
            </Panel>
          </div>
          <ChartCard
            title="Completion over time"
            description="Cumulative tasks and milestones completed"
            rows={burnup}
            columns={[
              { label: 'Date', value: (r) => formatDate(r.date, 'd MMM yyyy') },
              { label: 'Completed', value: (r) => r.done, align: 'right' },
            ]}
            empty={burnup.length === 0}
            emptyHint="Complete a task or milestone to start the chart."
            height={200}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnup} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="burn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series(0)} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={series(0)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'd MMM')} {...axisProps} minTickGap={24} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatLabel={(l) => formatDate(String(l), 'd MMM yyyy')} />} />
                <Area type="monotone" dataKey="done" name="Completed" stroke={series(0)} strokeWidth={2} fill="url(#burn)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="space-y-4">
          <Panel title="Resources" icon={Link2} actions={<Button size="xs" variant="ghost" onClick={() => editor.edit('projects', project.id)}>Manage</Button>}>
            {project.resources.length === 0 ? (
              <p className="text-[12.5px] text-ink-subtle">Links to docs, designs, repos or references. Add them via Manage.</p>
            ) : (
              <ul className="space-y-1">
                {project.resources.map((r) => (
                  <li key={r.id}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-panel-3/50">
                        <ExternalLink size={13} className="shrink-0 text-accent" />
                        <span className="truncate">{r.title}</span>
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-ink">
                        <Link2 size={13} className="shrink-0 text-ink-subtle" />
                        {r.title}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <NotesPanel title="Notes" filter={(n) => n.projectId === project.id} defaults={{ projectId: project.id, area: project.area }} emptyText="No project notes yet." />
          <Panel title="Project history" icon={History}>
            {history.length === 0 ? (
              <p className="text-[12.5px] text-ink-subtle">Changes to this project and its tasks will be logged here.</p>
            ) : (
              <div className="-mx-2 max-h-96 overflow-y-auto">
                <ActivityFeed entries={history} limit={50} />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
