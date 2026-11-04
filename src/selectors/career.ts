import { OPEN_APPLICATION_STATUSES } from '@/data/constants'
import type { Assessment, CareerMilestone, CareerPath, JobApplication, StudyModule } from '@/data/types'
import { sum } from '@/lib/utils'

/**
 * Module grade from graded assessments. When weights are given they are
 * used (and normalised over what's graded so far); otherwise a plain mean.
 */
export function moduleGrade(moduleId: string, assessments: Assessment[]) {
  const graded = assessments.filter((a) => a.moduleId === moduleId && a.status === 'graded' && typeof a.score === 'number')
  if (!graded.length) return { grade: null as number | null, gradedWeight: 0, graded: 0, total: assessments.filter((a) => a.moduleId === moduleId).length }
  const weighted = graded.every((a) => typeof a.weight === 'number' && a.weight > 0)
  const grade = weighted
    ? sum(graded.map((a) => (a.score as number) * (a.weight as number))) / sum(graded.map((a) => a.weight as number))
    : sum(graded.map((a) => a.score as number)) / graded.length
  return {
    grade,
    gradedWeight: weighted ? sum(graded.map((a) => a.weight as number)) : 0,
    graded: graded.length,
    total: assessments.filter((a) => a.moduleId === moduleId).length,
  }
}

/** Course average weighted by module credits (or equally when credits are missing). */
export function courseGrade(courseId: string, modules: StudyModule[], assessments: Assessment[]) {
  const rows = modules
    .filter((m) => m.courseId === courseId)
    .map((m) => ({ module: m, ...moduleGrade(m.id, assessments) }))
    .filter((r) => r.grade !== null)
  if (!rows.length) return null
  const useCredits = rows.every((r) => (r.module.credits ?? 0) > 0)
  const weights = rows.map((r) => (useCredits ? (r.module.credits as number) : 1))
  return sum(rows.map((r, i) => (r.grade as number) * weights[i])) / sum(weights)
}

export function applicationFunnel(applications: JobApplication[]) {
  const reached = (statuses: string[]) => applications.filter((a) => a.statusHistory.some((h) => statuses.includes(h.status)) || statuses.includes(a.status)).length
  return {
    total: applications.length,
    open: applications.filter((a) => OPEN_APPLICATION_STATUSES.includes(a.status)).length,
    applied: reached(['applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected']),
    interviewing: reached(['interviewing', 'offer', 'accepted']),
    offers: reached(['offer', 'accepted']),
    accepted: applications.filter((a) => a.status === 'accepted').length,
  }
}

export function careerPathProgress(path: CareerPath, milestones: CareerMilestone[]) {
  const linked = milestones.filter((m) => m.careerPathId === path.id)
  const done = path.roadmap.filter((s) => s.done).length + linked.filter((m) => m.done).length
  const total = path.roadmap.length + linked.length
  return { done, total, pct: total ? (done / total) * 100 : null }
}

export function averageScore(path: CareerPath): number | null {
  const values = Object.values(path.scores ?? {}).filter((v): v is number => typeof v === 'number')
  return values.length ? sum(values) / values.length : null
}
