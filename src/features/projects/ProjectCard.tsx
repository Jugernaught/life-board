import { useNavigate } from 'react-router'
import { CalendarClock, CheckSquare, Milestone } from 'lucide-react'
import { PRIORITIES, PROJECT_KINDS, PROJECT_STATUSES } from '@/data/constants'
import type { Project, Task } from '@/data/types'
import { nextMilestone, projectProgress } from '@/selectors/projects'
import { relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { Badge, ProgressBar } from '@/components/ui/display'
import { RecordActions } from '@/components/shared/RecordActions'

export function ProjectCard({ project, tasks, today, draggable, compact }: { project: Project; tasks: Task[]; today: string; draggable?: boolean; compact?: boolean }) {
  const navigate = useNavigate()
  const prog = projectProgress(project, tasks)
  const next = nextMilestone(project)
  const openTasks = tasks.filter((t) => t.projectId === project.id && t.status !== 'done').length
  const overdue = project.deadline && project.deadline < today && project.status !== 'completed'
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/atlas-project', project.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn('panel group relative flex cursor-pointer flex-col overflow-hidden p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong', draggable && 'active:cursor-grabbing')}
      onClick={() => navigate(`/projects/${project.id}`)}
      data-testid="project-card"
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: toneColor(project.color), boxShadow: `0 0 12px ${toneColor(project.color)}` }} aria-hidden />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] font-semibold text-ink">{project.name}</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-subtle">{PROJECT_KINDS.label(project.kind)}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RecordActions collection="projects" id={project.id} duplicate />
        </div>
      </div>
      {!compact && project.description && <p className="mt-2 line-clamp-2 text-[13px] text-ink-muted">{project.description}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={PROJECT_STATUSES.tone(project.status)} dot>
          {PROJECT_STATUSES.label(project.status)}
        </Badge>
        {project.priority !== 'medium' && <Badge tone={PRIORITIES.tone(project.priority)}>{PRIORITIES.label(project.priority)}</Badge>}
      </div>
      <div className="mt-auto pt-4">
        <ProgressBar value={prog.pct} tone={project.color} size="sm" showValue label={`${project.name} progress`} />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <CheckSquare size={12} />
            {openTasks} open
          </span>
          {next && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Milestone size={12} />
              <span className="truncate">{next.title}</span>
            </span>
          )}
          {project.deadline && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-bad')}>
              <CalendarClock size={12} />
              {relativeDay(project.deadline, today)}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
