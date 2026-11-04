/**
 * The agenda pulls every dated commitment from across Atlas into one list:
 * calendar events, task due dates, assignment and exam deadlines, interview
 * dates, project deadlines and milestones, goal target dates, career
 * milestones, birthdays and occasions, and upcoming recurring payments.
 * The schedule, Command Centre and Social pages all read from it.
 */
import { ASSESSMENT_KINDS, type LifeArea, type Priority, type Tone } from '@/data/constants'
import { hrefFor } from '@/data/registry'
import type { CollectionKey, Database } from '@/data/types'
import { formatMoney } from '@/lib/format'
import { isBetween } from '@/lib/dates'
import { advanceDate } from './finance'
import { nextOccurrence } from './social'

export type AgendaKind = 'event' | 'block' | 'deadline' | 'task' | 'exam' | 'interview' | 'milestone' | 'occasion' | 'payment' | 'goal'

export interface AgendaItem {
  key: string
  sourceKey: CollectionKey
  sourceId: string
  title: string
  subtitle?: string
  date: string
  startTime?: string
  endTime?: string
  allDay: boolean
  kind: AgendaKind
  tone: Tone
  area?: LifeArea
  priority?: Priority
  done?: boolean
  /** Only calendar events can be dragged/resized; everything else is edited at its source. */
  editable: boolean
  href: string
}

export const AGENDA_KIND_LABEL: Record<AgendaKind, string> = {
  event: 'Event',
  block: 'Time block',
  deadline: 'Deadline',
  task: 'Task',
  exam: 'Exam',
  interview: 'Interview',
  milestone: 'Milestone',
  occasion: 'Occasion',
  payment: 'Payment',
  goal: 'Goal target',
}

type Db = Pick<
  Database,
  'events' | 'tasks' | 'assessments' | 'modules' | 'applications' | 'projects' | 'goals' | 'careerMilestones' | 'importantDates' | 'recurring' | 'settings'
>

export interface AgendaOptions {
  includeDone?: boolean
}

export function buildAgenda(db: Db, start: string, end: string, today: string, opts: AgendaOptions = {}): AgendaItem[] {
  const items: AgendaItem[] = []
  const inRange = (d?: string) => !!d && isBetween(d, start, end)

  for (const e of db.events) {
    if (!inRange(e.date)) continue
    items.push({
      key: `events:${e.id}`,
      sourceKey: 'events',
      sourceId: e.id,
      title: e.title,
      subtitle: e.location,
      date: e.date,
      startTime: e.allDay ? undefined : e.startTime,
      endTime: e.allDay ? undefined : e.endTime,
      allDay: e.allDay || !e.startTime,
      kind: e.kind,
      tone: e.kind === 'block' ? 'violet' : e.kind === 'deadline' ? 'bad' : e.area === 'social' ? 'amber' : 'cyan',
      area: e.area,
      priority: e.priority,
      editable: true,
      href: hrefFor('events', e.id),
    })
  }

  for (const t of db.tasks) {
    if (!inRange(t.dueDate)) continue
    const done = t.status === 'done'
    if (done && !opts.includeDone) continue
    items.push({
      key: `tasks:${t.id}`,
      sourceKey: 'tasks',
      sourceId: t.id,
      title: t.title,
      date: t.dueDate as string,
      startTime: t.dueTime,
      allDay: !t.dueTime,
      kind: 'task',
      tone: t.priority === 'urgent' ? 'bad' : t.priority === 'high' ? 'warn' : 'info',
      area: t.area,
      priority: t.priority,
      done,
      editable: false,
      href: hrefFor('tasks', t.id),
    })
  }

  for (const a of db.assessments) {
    if (!inRange(a.dueDate)) continue
    const done = a.status === 'submitted' || a.status === 'graded'
    if (done && !opts.includeDone) continue
    const mod = db.modules.find((m) => m.id === a.moduleId)
    items.push({
      key: `assessments:${a.id}`,
      sourceKey: 'assessments',
      sourceId: a.id,
      title: a.title,
      subtitle: [ASSESSMENT_KINDS.label(a.kind), mod?.code || mod?.name].filter(Boolean).join(' · '),
      date: a.dueDate,
      startTime: a.dueTime,
      allDay: !a.dueTime,
      kind: a.kind === 'exam' ? 'exam' : 'deadline',
      tone: a.kind === 'exam' ? 'magenta' : 'bad',
      area: 'career',
      done,
      editable: false,
      href: hrefFor('assessments', a.id),
    })
  }

  for (const app of db.applications) {
    if (!inRange(app.nextStepDate)) continue
    if (['rejected', 'withdrawn', 'accepted'].includes(app.status) && !opts.includeDone) continue
    items.push({
      key: `applications:${app.id}`,
      sourceKey: 'applications',
      sourceId: app.id,
      title: app.nextStep ? `${app.nextStep} — ${app.company}` : `${app.company}: next step`,
      subtitle: app.role,
      date: app.nextStepDate as string,
      allDay: true,
      kind: app.status === 'interviewing' ? 'interview' : 'deadline',
      tone: 'cyan',
      area: 'career',
      editable: false,
      href: hrefFor('applications', app.id),
    })
  }

  for (const p of db.projects) {
    if (p.status === 'completed' && !opts.includeDone) continue
    if (inRange(p.deadline)) {
      items.push({
        key: `projects:${p.id}:deadline`,
        sourceKey: 'projects',
        sourceId: p.id,
        title: `${p.name} deadline`,
        date: p.deadline as string,
        allDay: true,
        kind: 'deadline',
        tone: 'violet',
        area: p.area,
        priority: p.priority,
        editable: false,
        href: hrefFor('projects', p.id),
      })
    }
    for (const m of p.milestones) {
      if (!inRange(m.dueDate) || (m.done && !opts.includeDone)) continue
      items.push({
        key: `projects:${p.id}:${m.id}`,
        sourceKey: 'projects',
        sourceId: p.id,
        title: m.title,
        subtitle: p.name,
        date: m.dueDate as string,
        allDay: true,
        kind: 'milestone',
        tone: 'violet',
        area: p.area,
        done: m.done,
        editable: false,
        href: hrefFor('projects', p.id),
      })
    }
  }

  for (const g of db.goals) {
    if (!inRange(g.targetDate) || (g.status !== 'active' && !opts.includeDone)) continue
    items.push({
      key: `goals:${g.id}`,
      sourceKey: 'goals',
      sourceId: g.id,
      title: g.title,
      subtitle: 'Goal target date',
      date: g.targetDate as string,
      allDay: true,
      kind: 'goal',
      tone: 'lime',
      area: g.area,
      done: g.status === 'completed',
      editable: false,
      href: hrefFor('goals', g.id),
    })
  }

  for (const m of db.careerMilestones) {
    if (!inRange(m.dueDate) || (m.done && !opts.includeDone)) continue
    items.push({
      key: `careerMilestones:${m.id}`,
      sourceKey: 'careerMilestones',
      sourceId: m.id,
      title: m.title,
      subtitle: 'Career milestone',
      date: m.dueDate as string,
      allDay: true,
      kind: 'milestone',
      tone: 'cyan',
      area: 'career',
      done: m.done,
      editable: false,
      href: hrefFor('careerMilestones', m.id),
    })
  }

  for (const d of db.importantDates) {
    // Occurrences from the start of the range (handles yearly repeats).
    const next = nextOccurrence(d, start)
    if (!next || !inRange(next)) continue
    items.push({
      key: `importantDates:${d.id}:${next}`,
      sourceKey: 'importantDates',
      sourceId: d.id,
      title: d.title,
      subtitle: d.kind === 'birthday' ? 'Birthday' : d.kind === 'anniversary' ? 'Anniversary' : 'Occasion',
      date: next,
      allDay: true,
      kind: 'occasion',
      tone: 'magenta',
      area: 'social',
      editable: false,
      href: hrefFor('importantDates', d.id),
    })
  }

  for (const r of db.recurring) {
    if (!r.active) continue
    // Only project forward from the next due date; at most 60 occurrences.
    let date = r.nextDate
    for (let i = 0; i < 60 && date <= end; i++) {
      if (date >= start && date >= today) {
        items.push({
          key: `recurring:${r.id}:${date}`,
          sourceKey: 'recurring',
          sourceId: r.id,
          title: r.name,
          subtitle: `${r.kind === 'income' ? 'Income' : 'Payment'} · ${formatMoney(r.amount, { currency: db.settings.currency })}`,
          date,
          allDay: true,
          kind: 'payment',
          tone: r.kind === 'income' ? 'ok' : 'amber',
          area: 'finance',
          editable: false,
          href: hrefFor('recurring', r.id),
        })
      }
      date = advanceDate(date, r.frequency)
    }
  }

  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.startTime ?? '').localeCompare(b.startTime ?? '')
  })
}
