import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Plus } from 'lucide-react'
import { PRIORITIES, PROJECT_KINDS, PROJECT_STATUSES, type ProjectStatus } from '@/data/constants'
import { COLLECTIONS } from '@/data/registry'
import type { CollectionKey } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { nextMilestone, projectProgress } from '@/selectors/projects'
import { sortTasks } from '@/selectors/tasks'
import { diffDays, formatDate, relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { truncate } from '@/lib/utils'
import { actions, useCollection, useDatabase, useRecord } from '@/store/store'
import { ProgressRing } from '@/components/ui/display'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { checklistAdd, checklistRows } from '../../components/Checklist'
import { InlineAdd } from '../../components/InlineAdd'
import { ProgressLine } from '../../components/Stats'
import { TaskRow } from '../../components/TaskRow'
import { openRecord } from '../../editor/openRecord'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { Chips } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { MissingScreen } from '../habits/HabitsScreens'

type Filter = 'open' | ProjectStatus | 'all'

export function ProjectsScreen() {
  const projects = useCollection('projects')
  const tasks = useCollection('tasks')
  const today = useToday()
  const [filter, setFilter] = useState<Filter>('open')
  const shown = useMemo(
    () =>
      projects
        .filter((p) => (filter === 'all' ? true : filter === 'open' ? p.status !== 'completed' : p.status === filter))
        .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || (a.updatedAt < b.updatedAt ? 1 : -1)),
    [projects, filter],
  )
  return (
    <Screen
      title="Projects"
      large
      testId="screen-projects"
      trailing={
        <NavButton label="New project" onClick={() => editor.create('projects')} testId="projects-add">
          <Plus size={26} />
        </NavButton>
      }
      header={
        <Chips
          value={filter}
          onChange={setFilter}
          ariaLabel="Project status"
          options={[
            { value: 'open', label: 'Open', count: projects.filter((p) => p.status !== 'completed').length },
            ...PROJECT_STATUSES.list.map((s) => ({ value: s.value, label: s.label, count: projects.filter((p) => p.status === s.value).length })),
            { value: 'all', label: 'All' },
          ]}
        />
      }
    >
      <Section>
        {shown.length === 0 && <EmptyRow>{projects.length ? 'No projects here.' : 'No projects yet. Tap + to start one — add tasks and milestones and progress is tracked for you.'}</EmptyRow>}
        {shown.map((p) => {
          const prog = projectProgress(p, tasks)
          const next = nextMilestone(p)
          return (
            <button key={p.id} type="button" onClick={() => nav.push(`more/projects/${p.id}`)} className="ios-press block w-full px-4 py-3 text-left" data-testid="m-project-row">
              <span className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: toneColor(p.color) }} aria-hidden />
                <span className="ios-headline min-w-0 flex-1 truncate text-ink">{p.name}</span>
                <span className="ios-footnote shrink-0 font-medium" style={{ color: toneColor(PROJECT_STATUSES.tone(p.status)) }}>
                  {PROJECT_STATUSES.label(p.status)}
                </span>
              </span>
              <span className="ios-footnote mt-1 block truncate pl-[18px] text-ink-subtle">
                {prog.total ? `${prog.done} of ${prog.total} done` : 'No tasks yet'}
                {next ? ` · Next: ${next.title}` : ''}
                {p.deadline ? ` · ${relativeDay(p.deadline, today)}` : ''}
              </span>
              <span className="mt-2 block pl-[18px]">
                <ProgressLine value={prog.pct} tone={p.color} />
              </span>
            </button>
          )
        })}
      </Section>
    </Screen>
  )
}

export function ProjectDetailScreen({ params }: { params: Record<string, string> }) {
  const project = useRecord('projects', params.id)
  const tasks = useCollection('tasks')
  const db = useDatabase()
  const today = useToday()
  const [showDone, setShowDone] = useState(false)
  if (!project) return <MissingScreen title="Project" />
  const own = sortTasks(tasks.filter((t) => t.projectId === project.id))
  const visible = showDone ? own : own.filter((t) => t.status !== 'done')
  const doneCount = own.length - own.filter((t) => t.status !== 'done').length
  const prog = projectProgress(project, tasks)
  const notes = db.notes.filter((n) => n.projectId === project.id)
  const history = db.activity.filter((a) => a.projectId === project.id).slice(0, 15)
  const update = (patch: Parameters<typeof actions.update<'projects'>>[2]) => actions.update('projects', project.id, patch)
  const daysLeft = project.deadline ? diffDays(today, project.deadline) : null

  return (
    <Screen title={project.name} trailing={<NavButton onClick={() => editor.edit('projects', project.id)}>Edit</NavButton>} testId="screen-project">
      <div className="flex items-center gap-4 px-4 pt-2 pb-5">
        <ProgressRing value={prog.pct} size={72} stroke={7} tone={project.color} label="Project progress">
          <span className="text-[16px] font-bold text-ink tabular-nums">{prog.pct === null ? '—' : `${Math.round(prog.pct)}%`}</span>
        </ProgressRing>
        <div className="min-w-0">
          <h2 className="ios-title2 text-ink">{project.name}</h2>
          <p className="ios-subhead text-ink-subtle">
            {PROJECT_KINDS.label(project.kind)} · {PRIORITIES.label(project.priority)} priority
          </p>
          {project.deadline && (
            <p className="ios-subhead" style={{ color: daysLeft !== null && daysLeft < 0 && project.status !== 'completed' ? 'var(--color-bad)' : 'var(--color-ink-subtle)' }}>
              Due {formatDate(project.deadline, 'd MMM yyyy')}
              {daysLeft !== null && Math.abs(daysLeft) < 28 ? ` · ${relativeDay(project.deadline, today)}` : ''}
            </p>
          )}
        </div>
      </div>
      {project.description && <p className="ios-subhead mx-4 mb-6 whitespace-pre-line text-ink-muted" data-selectable>{project.description}</p>}

      <Section>
        <Cell
          title="Status"
          detail={<span style={{ color: toneColor(PROJECT_STATUSES.tone(project.status)) }}>{PROJECT_STATUSES.label(project.status)}</span>}
          chevron
          testId="project-status"
          onClick={() =>
            actionSheet({
              title: 'Project status',
              options: PROJECT_STATUSES.list.filter((s) => s.value !== project.status).map((s) => ({ label: s.label, onSelect: () => update({ status: s.value }) })),
            })
          }
        />
      </Section>

      <Section header="Tasks" headerAction={doneCount > 0 ? <button type="button" className="ios-subhead text-accent" onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide Completed' : `Show Completed (${doneCount})`}</button> : undefined}>
        {visible.map((t) => (
          <TaskRow key={t.id} task={t} today={today} showProject={false} />
        ))}
        <InlineAdd placeholder="Add a task" testId="project-add-task" onAdd={(title) => actions.create('tasks', { title, projectId: project.id, area: project.area })} />
      </Section>

      <Section header="Milestones">
        {checklistRows(project.milestones, (milestones) => update({ milestones }), today, toneColor(project.color))}
        {checklistAdd(project.milestones, (milestones) => update({ milestones }), 'Add a milestone')}
      </Section>

      <Section header="Objectives">
        {checklistRows(project.objectives, (objectives) => update({ objectives }), today, toneColor(project.color))}
        {checklistAdd(project.objectives, (objectives) => update({ objectives }), 'Add an objective')}
      </Section>

      {project.resources.length > 0 && (
        <Section header="Resources">
          {project.resources.map((r) =>
            r.url ? (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer noopener" className="ios-press ios-body flex min-h-11 items-center gap-3 px-4 text-accent">
                <ExternalLink size={18} />
                <span className="truncate">{r.title}</span>
              </a>
            ) : (
              <Cell key={r.id} title={r.title} subtitle={r.note} />
            ),
          )}
        </Section>
      )}

      <Section header="Notes">
        {notes.map((n) => (
          <Cell key={n.id} title={n.title} subtitle={n.body ? truncate(n.body, 90) : undefined} chevron onClick={() => editor.edit('notes', n.id)} />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('notes', { projectId: project.id, area: project.area })}>
          Add Note
        </ActionCell>
      </Section>

      {history.length > 0 && (
        <Section header="History">
          {history.map((a) => {
            const key = a.collection as CollectionKey
            return <Cell key={a.id} title={truncate(a.label, 44)} subtitle={`${a.action[0].toUpperCase()}${a.action.slice(1)} ${COLLECTIONS[key]?.singular.toLowerCase() ?? ''}`} detail={<span className="ios-footnote">{format(new Date(a.at), 'd MMM')}</span>} onClick={a.action !== 'deleted' && key !== 'projects' ? () => openRecord(key, a.entityId) : undefined} />
          })}
        </Section>
      )}

      <Section>
        <ActionCell destructive onClick={async () => { if (await deleteRecord('projects', project.id)) nav.pop() }}>
          Delete Project
        </ActionCell>
      </Section>
    </Screen>
  )
}
