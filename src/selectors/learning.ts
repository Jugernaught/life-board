import type { LearningCourse, Skill, StudySession } from '@/data/types'
import { type WeekStart, addDaysISO, isBetween, weekStartISO } from '@/lib/dates'
import { sum } from '@/lib/utils'

export function minutesInRange(sessions: StudySession[], start: string, end: string) {
  return sum(sessions.filter((s) => isBetween(s.date, start, end)).map((s) => s.durationMin))
}

export function minutesBySkill(sessions: StudySession[], skills: Skill[], start?: string, end?: string) {
  const filtered = start && end ? sessions.filter((s) => isBetween(s.date, start, end)) : sessions
  const totals = new Map<string, number>()
  for (const s of filtered) totals.set(s.skillId ?? '', (totals.get(s.skillId ?? '') ?? 0) + s.durationMin)
  return [...totals.entries()]
    .map(([skillId, minutes]) => ({ skillId, name: skills.find((k) => k.id === skillId)?.name ?? 'Unassigned', minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function weeklyStudySeries(sessions: StudySession[], today: string, weeks: number, weekStartsOn: WeekStart) {
  const thisWeek = weekStartISO(today, weekStartsOn)
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDaysISO(thisWeek, -7 * (weeks - 1 - i))
    return { week: start, minutes: minutesInRange(sessions, start, addDaysISO(start, 6)) }
  })
}

export function courseProgress(c: LearningCourse): number | null {
  if (c.status === 'completed') return 100
  if (!c.totalUnits) return null
  return Math.min(100, ((c.completedUnits ?? 0) / c.totalUnits) * 100)
}

/** Skill progress: roadmap completion when there is a roadmap, else level vs target. */
export function skillProgress(skill: Skill): { roadmap: number | null; level: number } {
  const steps = skill.roadmap
  return {
    roadmap: steps.length ? (steps.filter((s) => s.done).length / steps.length) * 100 : null,
    level: skill.targetLevel ? Math.min(100, (skill.level / skill.targetLevel) * 100) : 0,
  }
}

export interface LearningEvent {
  date: string
  kind: 'session' | 'step' | 'course' | 'level'
  title: string
  detail?: string
  skillId?: string
}

/** A unified learning history built from sessions, roadmap steps, courses and level changes. */
export function learningHistory(data: { skills: Skill[]; studySessions: StudySession[]; learningCourses: LearningCourse[] }): LearningEvent[] {
  const events: LearningEvent[] = []
  for (const s of data.studySessions) events.push({ date: s.date, kind: 'session', title: s.topic || 'Study session', detail: `${s.durationMin} min`, skillId: s.skillId })
  for (const k of data.skills) {
    for (const step of k.roadmap) if (step.done && step.doneAt) events.push({ date: step.doneAt.slice(0, 10), kind: 'step', title: step.title, detail: k.name, skillId: k.id })
    k.levelHistory.forEach((p, i) => {
      if (i === 0 && p.level === 0) return
      const prev = k.levelHistory[i - 1]
      if (prev && prev.level === p.level) return
      events.push({ date: p.date, kind: 'level', title: `${k.name}: level ${p.level}/5`, detail: prev ? `from ${prev.level}` : 'starting level', skillId: k.id })
    })
  }
  for (const c of data.learningCourses) if (c.status === 'completed' && c.completedDate) events.push({ date: c.completedDate, kind: 'course', title: `Completed ${c.title}`, detail: c.provider, skillId: c.skillId })
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
