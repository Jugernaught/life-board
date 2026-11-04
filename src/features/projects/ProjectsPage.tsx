import { useMemo, useState } from 'react'
import { Columns3, FolderKanban, LayoutGrid, Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PRIORITY_RANK, PROJECT_KINDS, PROJECT_STATUSES, type ProjectStatus } from '@/data/constants'
import type { Project } from '@/data/types'
import { useListControls } from '@/hooks/useListControls'
import { useToday } from '@/hooks/useNow'
import { projectProgress } from '@/selectors/projects'
import { truncate } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState, Stat } from '@/components/ui/display'
import { Segmented } from '@/components/ui/inputs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { editor } from '@/components/editor/editorStore'
import { ProjectCard } from './ProjectCard'

export default function ProjectsPage() {
  const projects = useCollection('projects')
  const tasks = useCollection('tasks')
  const today = useToday()
  const [view, setView] = useState<'grid' | 'board'>('grid')
  const [dropTarget, setDropTarget] = useState<ProjectStatus | null>(null)

  const controls = useListControls<Project>(projects, {
    search: (p) => `${p.name} ${p.description ?? ''} ${p.objectives.map((o) => o.title).join(' ')}`,
    filters: [
      { key: 'status', label: 'Statuses', options: PROJECT_STATUSES.list, get: (p) => p.status },
      { key: 'kind', label: 'Types', options: PROJECT_KINDS.list, get: (p) => p.kind },
    ],
    sorts: [
      { value: 'updated', label: 'Last updated', get: (p) => p.updatedAt, dir: 'desc' },
      { value: 'deadline', label: 'Deadline', get: (p) => p.deadline },
      { value: 'progress', label: 'Progress', get: (p) => projectProgress(p, tasks).pct ?? -1, dir: 'desc' },
      { value: 'priority', label: 'Priority', get: (p) => PRIORITY_RANK[p.priority], dir: 'desc' },
      { value: 'name', label: 'Name', get: (p) => p.name },
    ],
  })

  const counts = useMemo(() => Object.fromEntries(PROJECT_STATUSES.list.map((s) => [s.value, projects.filter((p) => p.status === s.value).length])) as Record<ProjectStatus, number>, [projects])
  const chartRows = useMemo(
    () =>
      projects
        .filter((p) => p.status !== 'completed')
        .map((p) => ({ name: truncate(p.name, 22), full: p.name, ...projectProgress(p, tasks) }))
        .filter((r) => r.pct !== null)
        .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
        .slice(0, 10),
    [projects, tasks],
  )

  return (
    <div>
      <PageHeader
        section="projects"
        description="Ventures, personal projects and experiments — with objectives, tasks, milestones, resources and a full history."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => editor.create('projects')}>
            New project
          </Button>
        }
      />
      {projects.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project for a business idea, side project or experiment. Add tasks and milestones and LIFE OS will track progress for you."
            action={
              <Button variant="primary" icon={Plus} onClick={() => editor.create('projects')}>
                Create your first project
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {PROJECT_STATUSES.list.map((s) => (
              <Stat key={s.value} label={s.label} value={counts[s.value]} tone={s.tone} sub={`${projects.length ? Math.round((counts[s.value] / projects.length) * 100) : 0}% of projects`} />
            ))}
          </div>
          <ChartCard
            title="Progress by project"
            description="Completed tasks and milestones as a share of each project's total."
            rows={chartRows}
            columns={[
              { label: 'Project', value: (r) => r.full },
              { label: 'Done', value: (r) => `${r.done}/${r.total}`, align: 'right' },
              { label: 'Progress', value: (r) => `${Math.round(r.pct ?? 0)}%`, align: 'right' },
            ]}
            empty={chartRows.length === 0}
            emptyHint="Add tasks or milestones to a project to see its progress."
            height={Math.max(140, chartRows.length * 34)}
            className="mb-5"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} />
                <YAxis type="category" dataKey="name" width={150} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${Math.round(v)}%`} formatLabel={(_l, row) => String(row?.full ?? '')} />} />
                <Bar dataKey="pct" name="Progress" fill={series(0)} radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ListToolbar controls={controls} placeholder="Search projects…" total={projects.length}>
            <Segmented
              value={view}
              onChange={setView}
              size="sm"
              ariaLabel="Layout"
              options={[
                { value: 'grid', label: <LayoutGrid size={14} aria-label="Grid" />, title: 'Grid' },
                { value: 'board', label: <Columns3 size={14} aria-label="Board" />, title: 'Board by status' },
              ]}
            />
          </ListToolbar>
          {controls.results.length === 0 ? (
            <div className="panel">
              <EmptyState icon={FolderKanban} title="No projects match" description="Try a different search or filter." />
            </div>
          ) : view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {controls.results.map((p) => (
                <ProjectCard key={p.id} project={p} tasks={tasks} today={today} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PROJECT_STATUSES.list.map((s) => {
                const list = controls.results.filter((p) => p.status === s.value)
                return (
                  <div
                    key={s.value}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDropTarget(s.value)
                    }}
                    onDragLeave={() => setDropTarget((d) => (d === s.value ? null : d))}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDropTarget(null)
                      const id = e.dataTransfer.getData('text/life-os-project')
                      if (id) actions.update('projects', id, { status: s.value })
                    }}
                    className={`rounded-[var(--radius-panel)] border border-dashed p-2 transition-colors ${dropTarget === s.value ? 'border-accent/60 bg-accent/5' : 'border-line'}`}
                    aria-label={`${s.label} column`}
                  >
                    <p className="eyebrow mb-2 flex items-center justify-between px-1">
                      <span>{s.label}</span>
                      <span>{list.length}</span>
                    </p>
                    <div className="space-y-3">
                      {list.map((p) => (
                        <ProjectCard key={p.id} project={p} tasks={tasks} today={today} draggable compact />
                      ))}
                      {list.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-ink-subtle">Drag a project here</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
