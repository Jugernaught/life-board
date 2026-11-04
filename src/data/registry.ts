/**
 * Metadata about each collection: how to name its records, where they live
 * in the app, how to search them and which other records point at them.
 * Search, the activity feed, deep links and safe deletion all read from here.
 */
import type { CollectionKey, Collections } from './types'

export type SectionId =
  | 'command'
  | 'career'
  | 'projects'
  | 'finance'
  | 'fitness'
  | 'goals'
  | 'learning'
  | 'journal'
  | 'schedule'
  | 'library'
  | 'social'
  | 'analytics'
  | 'settings'

export interface CollectionMeta<K extends CollectionKey> {
  singular: string
  plural: string
  section: SectionId
  /** Tab within the section where these records are listed. */
  tab?: string
  title: (record: Collections[K]) => string
  /** Extra text searched by global search (body, notes …). */
  searchText?: (record: Collections[K]) => string
  /** Include in global search. */
  searchable?: boolean
}

type Registry = { [K in CollectionKey]: CollectionMeta<K> }

export const COLLECTIONS: Registry = {
  tasks: { singular: 'Task', plural: 'Tasks', section: 'schedule', tab: 'tasks', title: (r) => r.title, searchText: (r) => [r.notes, ...(r.tags ?? [])].join(' '), searchable: true },
  events: { singular: 'Event', plural: 'Events', section: 'schedule', title: (r) => r.title, searchText: (r) => [r.description, r.location].join(' '), searchable: true },
  notes: { singular: 'Note', plural: 'Notes', section: 'command', title: (r) => r.title, searchText: (r) => [r.body, ...(r.tags ?? [])].join(' '), searchable: true },
  projects: { singular: 'Project', plural: 'Projects', section: 'projects', title: (r) => r.name, searchText: (r) => [r.description, ...r.objectives.map((o) => o.title), ...r.milestones.map((m) => m.title)].join(' '), searchable: true },
  careerPaths: { singular: 'Career path', plural: 'Career paths', section: 'career', tab: 'paths', title: (r) => r.name, searchText: (r) => [r.targetRole, r.description, r.notes].join(' '), searchable: true },
  qualifications: { singular: 'Qualification', plural: 'Qualifications', section: 'career', tab: 'education', title: (r) => r.title, searchText: (r) => [r.institution, r.notes].join(' '), searchable: true },
  academicCourses: { singular: 'Course', plural: 'Courses', section: 'career', tab: 'education', title: (r) => r.name, searchText: (r) => [r.institution, r.level, r.notes].join(' '), searchable: true },
  modules: { singular: 'Module', plural: 'Modules', section: 'career', tab: 'education', title: (r) => (r.code ? `${r.code} · ${r.name}` : r.name), searchText: (r) => r.notes ?? '', searchable: true },
  assessments: { singular: 'Assessment', plural: 'Assessments', section: 'career', tab: 'education', title: (r) => r.title, searchText: (r) => r.notes ?? '', searchable: true },
  applications: { singular: 'Application', plural: 'Applications', section: 'career', tab: 'applications', title: (r) => `${r.role} — ${r.company}`, searchText: (r) => [r.location, r.notes, r.nextStep].join(' '), searchable: true },
  companies: { singular: 'Company', plural: 'Companies', section: 'career', tab: 'companies', title: (r) => r.name, searchText: (r) => [r.industry, r.research, r.pros, r.cons].join(' '), searchable: true },
  interviewQuestions: { singular: 'Interview question', plural: 'Interview questions', section: 'career', tab: 'interviews', title: (r) => r.question, searchText: (r) => r.answer ?? '', searchable: true },
  careerMilestones: { singular: 'Career milestone', plural: 'Career milestones', section: 'career', tab: 'milestones', title: (r) => r.title, searchText: (r) => r.notes ?? '', searchable: true },
  transactions: { singular: 'Transaction', plural: 'Transactions', section: 'finance', tab: 'transactions', title: (r) => r.description || r.category, searchText: (r) => [r.category, r.notes].join(' '), searchable: true },
  budgets: { singular: 'Budget', plural: 'Budgets', section: 'finance', tab: 'budgets', title: (r) => (r.category === '*' ? 'Total spending' : r.category) },
  savingsGoals: { singular: 'Savings goal', plural: 'Savings goals', section: 'finance', tab: 'savings', title: (r) => r.name, searchText: (r) => r.notes ?? '', searchable: true },
  recurring: { singular: 'Recurring item', plural: 'Recurring items', section: 'finance', tab: 'recurring', title: (r) => r.name, searchable: true },
  financialTargets: { singular: 'Financial target', plural: 'Financial targets', section: 'finance', tab: 'targets', title: (r) => r.name },
  workouts: { singular: 'Workout', plural: 'Workouts', section: 'fitness', tab: 'workouts', title: (r) => r.title, searchText: (r) => [r.notes, ...r.exercises.map((e) => e.name)].join(' '), searchable: true },
  dailyActivity: { singular: 'Activity log', plural: 'Activity logs', section: 'fitness', tab: 'activity', title: (r) => `Activity · ${r.date}` },
  sleep: { singular: 'Sleep log', plural: 'Sleep logs', section: 'fitness', tab: 'sleep', title: (r) => `Sleep · ${r.date}` },
  routines: { singular: 'Routine', plural: 'Routines', section: 'fitness', tab: 'routines', title: (r) => r.name, searchText: (r) => r.steps.map((s) => s.title).join(' '), searchable: true },
  goals: { singular: 'Goal', plural: 'Goals', section: 'goals', tab: 'goals', title: (r) => r.title, searchText: (r) => [r.description, ...r.milestones.map((m) => m.title)].join(' '), searchable: true },
  habits: { singular: 'Habit', plural: 'Habits', section: 'goals', tab: 'habits', title: (r) => r.name, searchText: (r) => r.description ?? '', searchable: true },
  weeklyReviews: { singular: 'Weekly review', plural: 'Weekly reviews', section: 'goals', tab: 'review', title: (r) => `Week of ${r.weekStart}`, searchText: (r) => [r.wins, r.challenges, r.lessons, r.focus].join(' '), searchable: true },
  skills: { singular: 'Skill', plural: 'Skills', section: 'learning', tab: 'skills', title: (r) => r.name, searchText: (r) => [r.description, r.objectives, r.category, ...r.roadmap.map((s) => s.title)].join(' '), searchable: true },
  learningCourses: { singular: 'Course', plural: 'Courses', section: 'learning', tab: 'courses', title: (r) => r.title, searchText: (r) => [r.provider, r.notes].join(' '), searchable: true },
  studySessions: { singular: 'Study session', plural: 'Study sessions', section: 'learning', tab: 'sessions', title: (r) => r.topic || 'Study session', searchText: (r) => r.notes ?? '', searchable: true },
  resources: { singular: 'Resource', plural: 'Resources', section: 'learning', tab: 'resources', title: (r) => r.title, searchText: (r) => r.notes ?? '', searchable: true },
  journal: {
    singular: 'Journal entry',
    plural: 'Journal entries',
    section: 'journal',
    tab: 'history',
    title: (r) => r.title || `Journal · ${r.date}`,
    searchText: (r) => [r.body, r.lessons, r.challenges, r.achievements, ...Object.values(r.prompts ?? {}), ...(r.tags ?? [])].join(' '),
    searchable: true,
  },
  checkIns: { singular: 'Check-in', plural: 'Check-ins', section: 'journal', tab: 'checkins', title: (r) => `Check-in · ${r.date}`, searchText: (r) => r.note ?? '' },
  media: { singular: 'Library item', plural: 'Library items', section: 'library', title: (r) => r.title, searchText: (r) => [r.creator, r.category, r.notes, ...r.takeaways].join(' '), searchable: true },
  people: { singular: 'Person', plural: 'People', section: 'social', tab: 'people', title: (r) => r.name, searchText: (r) => r.notes ?? '', searchable: true },
  importantDates: { singular: 'Important date', plural: 'Important dates', section: 'social', tab: 'dates', title: (r) => r.title, searchText: (r) => r.notes ?? '', searchable: true },
}

export function metaOf<K extends CollectionKey>(key: K): CollectionMeta<K> {
  return COLLECTIONS[key] as CollectionMeta<K>
}

/**
 * Foreign keys. When a record is deleted, records that point at it are
 * *unlinked* (the field is cleared) rather than deleted, and the link is
 * restored if you undo the deletion.
 */
export const RELATIONS: { from: CollectionKey; field: string; to: CollectionKey }[] = [
  { from: 'tasks', field: 'projectId', to: 'projects' },
  { from: 'notes', field: 'projectId', to: 'projects' },
  { from: 'notes', field: 'skillId', to: 'skills' },
  { from: 'modules', field: 'courseId', to: 'academicCourses' },
  { from: 'assessments', field: 'moduleId', to: 'modules' },
  { from: 'applications', field: 'careerPathId', to: 'careerPaths' },
  { from: 'careerMilestones', field: 'careerPathId', to: 'careerPaths' },
  { from: 'interviewQuestions', field: 'applicationId', to: 'applications' },
  { from: 'transactions', field: 'recurringId', to: 'recurring' },
  { from: 'learningCourses', field: 'skillId', to: 'skills' },
  { from: 'studySessions', field: 'skillId', to: 'skills' },
  { from: 'studySessions', field: 'courseId', to: 'learningCourses' },
  { from: 'resources', field: 'skillId', to: 'skills' },
  { from: 'importantDates', field: 'personId', to: 'people' },
]

export const SECTION_ROUTES: Record<SectionId, string> = {
  command: '/',
  career: '/career',
  projects: '/projects',
  finance: '/finance',
  fitness: '/fitness',
  goals: '/goals',
  learning: '/learning',
  journal: '/journal',
  schedule: '/schedule',
  library: '/library',
  social: '/social',
  analytics: '/analytics',
  settings: '/settings',
}

/** Deep link to a record: its section/tab, plus an `open` parameter the editor host picks up. */
export function hrefFor(key: CollectionKey, id: string): string {
  if (key === 'projects') return `/projects/${id}`
  const meta = COLLECTIONS[key]
  const params = new URLSearchParams()
  if (meta.tab) params.set('tab', meta.tab)
  params.set('open', `${key}:${id}`)
  return `${SECTION_ROUTES[meta.section]}?${params.toString()}`
}
