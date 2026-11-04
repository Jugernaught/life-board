import type { Project, Task } from '@/data/types'

/**
 * Project completion = finished tasks + finished milestones over the total.
 * With nothing to measure, progress is unknown (null) — except a project
 * you've marked Completed, which is 100%.
 */
export function projectProgress(project: Project, tasks: Task[]): { done: number; total: number; pct: number | null } {
  const own = tasks.filter((t) => t.projectId === project.id)
  const done = own.filter((t) => t.status === 'done').length + project.milestones.filter((m) => m.done).length
  const total = own.length + project.milestones.length
  if (project.status === 'completed') return { done, total, pct: 100 }
  return { done, total, pct: total ? (done / total) * 100 : null }
}

export function nextMilestone(project: Project) {
  return project.milestones.filter((m) => !m.done).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))[0]
}
