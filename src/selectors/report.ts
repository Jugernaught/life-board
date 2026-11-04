/**
 * Builds weekly / monthly reports as structured sections plus a Markdown
 * version. Every sentence is derived from stored records; sections with no
 * data say so instead of guessing.
 */
import type { Database } from '@/data/types'
import { type WeekStart, dateOfTimestamp, formatDate, isBetween } from '@/lib/dates'
import { formatMinutes, formatMoney } from '@/lib/format'
import { goalProgressOf } from '@/store/lifecycle'
import { type DateRange, periodSummary, previousRange } from './analytics'
import { categoryBreakdown } from './finance'
import { completionRate } from './habits'
import { minutesBySkill } from './learning'

export interface ReportSection {
  title: string
  lines: string[]
}

function change(cur: number, prev: number, unit = '', fmt: (n: number) => string = (n) => String(Math.round(n))): string {
  if (cur === prev) return prev === 0 ? '' : ` (same as previous period)`
  const diff = cur - prev
  return ` (${diff > 0 ? 'up' : 'down'} ${fmt(Math.abs(diff))}${unit} from ${fmt(prev)}${unit})`
}

export function buildReport(db: Database, range: DateRange, today: string, weekStartsOn: WeekStart, kind: 'week' | 'month' | 'custom') {
  const prev = previousRange(range)
  const s = periodSummary(db, range, today, weekStartsOn)
  const p = periodSummary(db, prev, today, weekStartsOn)
  const money = (n: number) => formatMoney(n, { currency: db.settings.currency, showPence: false })
  const sections: ReportSection[] = []

  // Tasks
  const tasks: string[] = []
  if (s.tasksCompleted || p.tasksCompleted || s.tasksCreated) {
    tasks.push(`Completed ${s.tasksCompleted} task${s.tasksCompleted === 1 ? '' : 's'}${change(s.tasksCompleted, p.tasksCompleted)}; added ${s.tasksCreated}.`)
    if (s.tasksDue) tasks.push(`${s.tasksDueDone} of ${s.tasksDue} tasks due in this period are done (${s.tasksOnTime} on or before their due date).`)
  }
  sections.push({ title: 'Tasks', lines: tasks })

  // Habits
  const habits: string[] = []
  if (s.habitRate !== null) habits.push(`Habit consistency was ${Math.round(s.habitRate * 100)}%${p.habitRate !== null ? change(s.habitRate * 100, p.habitRate * 100, ' pts') : ''} with ${s.habitCheckIns} check-ins.`)
  for (const h of db.habits.filter((x) => !x.archived)) {
    const r = completionRate(h, range.start, range.end, today, weekStartsOn)
    if (r.expected) habits.push(`${h.name}: ${r.done}/${r.expected} (${Math.round((r.rate ?? 0) * 100)}%).`)
  }
  sections.push({ title: 'Habits', lines: habits })

  // Goals
  const goals: string[] = []
  const completedGoals = db.goals.filter((g) => g.status === 'completed' && g.completedAt && isBetween(dateOfTimestamp(g.completedAt), range.start, range.end))
  if (completedGoals.length) goals.push(`Completed ${completedGoals.length} goal${completedGoals.length === 1 ? '' : 's'}: ${completedGoals.map((g) => g.title).join(', ')}.`)
  const progressed = db.goals
    .filter((g) => g.status === 'active')
    .map((g) => {
      const inRange = g.history.filter((h) => isBetween(dateOfTimestamp(h.at), range.start, range.end))
      const before = g.history.filter((h) => dateOfTimestamp(h.at) < range.start).pop()
      if (!inRange.length) return null
      const from = before?.progress ?? inRange[0].progress
      const to = inRange[inRange.length - 1].progress
      return to !== from ? { g, from, to } : null
    })
    .filter(Boolean) as { g: (typeof db.goals)[number]; from: number; to: number }[]
  for (const x of progressed) goals.push(`${x.g.title}: ${Math.round(x.from)}% → ${Math.round(x.to)}%.`)
  if (s.milestonesDone) goals.push(`${s.milestonesDone} project/goal milestone${s.milestonesDone === 1 ? '' : 's'} reached.`)
  if (s.goalsActive) goals.push(`${s.goalsActive} active goal${s.goalsActive === 1 ? '' : 's'}, averaging ${Math.round(s.goalsAvgProgress ?? 0)}% today.`)
  sections.push({ title: 'Goals', lines: goals })

  // Health
  const health: string[] = []
  if (s.workouts || p.workouts) health.push(`${s.workouts} workout${s.workouts === 1 ? '' : 's'} totalling ${formatMinutes(s.workoutMinutes)}${change(s.workouts, p.workouts)}.`)
  if (s.activeDays) health.push(`Active on ${s.activeDays} day${s.activeDays === 1 ? '' : 's'}.`)
  if (s.avgSleepMinutes !== null) health.push(`Average sleep ${formatMinutes(s.avgSleepMinutes)}${p.avgSleepMinutes !== null ? change(s.avgSleepMinutes, p.avgSleepMinutes, '', formatMinutes) : ''}.`)
  sections.push({ title: 'Fitness & wellbeing', lines: health })

  // Learning
  const learning: string[] = []
  if (s.learningMinutes || p.learningMinutes) {
    learning.push(`${formatMinutes(s.learningMinutes)} of learning across ${s.studySessions} session${s.studySessions === 1 ? '' : 's'}${change(s.learningMinutes, p.learningMinutes, '', formatMinutes)}.`)
    for (const k of minutesBySkill(db.studySessions, db.skills, range.start, range.end).slice(0, 5)) learning.push(`${k.name}: ${formatMinutes(k.minutes)}.`)
  }
  sections.push({ title: 'Learning', lines: learning })

  // Money
  const finance: string[] = []
  if (s.income || s.expenses || p.expenses) {
    finance.push(`Income ${money(s.income)}, spending ${money(s.expenses)}${change(s.expenses, p.expenses, '', money)}, net ${money(s.net)}.`)
    const top = categoryBreakdown(db.transactions, (t) => isBetween(t.date, range.start, range.end)).slice(0, 3)
    if (top.length) finance.push(`Top spending: ${top.map((c) => `${c.category} ${money(c.amount)}`).join(', ')}.`)
  }
  sections.push({ title: 'Money', lines: finance })

  // Journal & mood
  const journal: string[] = []
  if (s.journalEntries || s.checkIns) {
    journal.push(`${s.journalEntries} journal entr${s.journalEntries === 1 ? 'y' : 'ies'} and ${s.checkIns} check-in${s.checkIns === 1 ? '' : 's'}.`)
    if (s.avgMood !== null) journal.push(`Average mood ${s.avgMood.toFixed(1)}/5, energy ${(s.avgEnergy ?? 0).toFixed(1)}/5.`)
  }
  sections.push({ title: 'Journal', lines: journal })

  // Library
  const done = db.media.filter((m) => m.status === 'completed' && m.completedDate && isBetween(m.completedDate, range.start, range.end))
  sections.push({ title: 'Reading & media', lines: done.length ? [`Finished ${done.length}: ${done.map((m) => m.title).join(', ')}.`] : [] })

  // Career & projects
  const career: string[] = []
  if (s.careerMilestonesDone) career.push(`${s.careerMilestonesDone} career milestone${s.careerMilestonesDone === 1 ? '' : 's'} completed.`)
  if (s.applicationsSent) career.push(`${s.applicationsSent} job application${s.applicationsSent === 1 ? '' : 's'} sent.`)
  if (s.assessmentsGraded) career.push(`${s.assessmentsGraded} assessment${s.assessmentsGraded === 1 ? '' : 's'} graded.`)
  if (s.projectsCompleted) career.push(`${s.projectsCompleted} project${s.projectsCompleted === 1 ? '' : 's'} completed.`)
  const activeProjects = db.projects.filter((x) => x.status === 'active')
  if (activeProjects.length) career.push(`${activeProjects.length} active project${activeProjects.length === 1 ? '' : 's'}.`)
  sections.push({ title: 'Career & projects', lines: career })

  const review = kind === 'week' ? db.weeklyReviews.find((r) => r.weekStart === range.start) : undefined
  const title = kind === 'week' ? `Weekly report · ${formatDate(range.start, 'd MMM')} – ${formatDate(range.end, 'd MMM yyyy')}` : kind === 'month' ? `Monthly report · ${formatDate(range.start, 'MMMM yyyy')}` : `Report · ${formatDate(range.start, 'd MMM yyyy')} – ${formatDate(range.end, 'd MMM yyyy')}`

  const markdown = [
    `# ${title}`,
    '',
    ...sections.flatMap((sec) => [`## ${sec.title}`, ...(sec.lines.length ? sec.lines.map((l) => `- ${l}`) : ['- Nothing recorded.']), '']),
    ...(review ? ['## Reflection', review.wins ? `- Wins: ${review.wins}` : '', review.challenges ? `- Challenges: ${review.challenges}` : '', review.lessons ? `- Lessons: ${review.lessons}` : '', review.focus ? `- Next focus: ${review.focus}` : ''].filter(Boolean) : []),
  ].join('\n')

  return { title, sections, summary: s, previous: p, markdown, review, goalAverage: db.goals.filter((g) => g.status === 'active').map((g) => goalProgressOf(g)) }
}
