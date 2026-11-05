/**
 * The ATLAS data model, written as Zod schemas.
 *
 * Zod schemas are the single source of truth: TypeScript types are inferred
 * from them (see types.ts), forms validate input against them, and imported
 * backup files are checked against them before anything touches your data.
 *
 * Entities use `z.looseObject`, which keeps unknown fields instead of
 * stripping them. If a backup comes from a newer version of the app with
 * extra fields, importing it into an older version will not silently drop
 * that information.
 */
import { z } from 'zod'
import {
  ACCENT_COLORS,
  APPLICATION_STATUSES,
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  CAREER_CRITERIA,
  CAREER_MILESTONE_KINDS,
  CAREER_PATH_STATUSES,
  CIRCLES,
  COURSE_STATUSES,
  EVENT_KINDS,
  FINANCIAL_TARGET_METRICS,
  FREQUENCIES,
  GOAL_HORIZONS,
  GOAL_STATUSES,
  GOAL_TERMS,
  HABIT_SCHEDULES,
  INTENSITIES,
  LIFE_AREAS,
  MEDIA_STATUSES,
  MEDIA_TYPES,
  MODULE_STATUSES,
  OCCASION_KINDS,
  PRIORITIES,
  PROGRESS_MODES,
  PROGRESS_STATUSES,
  PROJECT_KINDS,
  PROJECT_STATUSES,
  QUALIFICATION_KINDS,
  QUESTION_CATEGORIES,
  RESOURCE_KINDS,
  RESOURCE_STATUSES,
  SKILL_STATUSES,
  TASK_STATUSES,
  TIMES_OF_DAY,
  TRANSACTION_KINDS,
  WORKOUT_TYPES,
} from './constants'

// ------------------------------------------------------------ primitives ---

export const idSchema = z.string().min(1)
export const isoDate = z.iso.date({ error: 'Enter a valid date' })
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use the format HH:MM' })
export const timestamp = z.string().min(1)
export const title = (label = 'Title') => z.string().trim().min(1, { error: `${label} is required` }).max(200, { error: `${label} must be 200 characters or fewer` })
export const longText = z.string().max(50_000, { error: 'Text is too long (50,000 characters max)' })
export const shortText = z.string().max(500, { error: 'Keep this under 500 characters' })
export const url = z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i, { error: 'Enter a full link starting with http:// or https://' })
/** Money in minor units (pence). */
export const money = z.number().int({ error: 'Amount must be a whole number of pence' }).max(1_000_000_000_00, { error: 'Amount is too large' })
export const positiveMoney = money.positive({ error: 'Amount must be greater than zero' })
export const rating = z.number().int().min(1).max(5)
export const percentage = z.number().min(0, { error: 'Must be 0 or more' }).max(100, { error: 'Must be 100 or less' })
export const tags = z.array(z.string().trim().min(1).max(40)).max(30).default([])

export const lifeArea = z.enum(LIFE_AREAS.values)
export const priority = z.enum(PRIORITIES.values)
export const accentColor = z.enum(ACCENT_COLORS.values)

/** A checklist row used for milestones, roadmaps and objectives. */
export const checkItem = z.looseObject({
  id: idSchema,
  title: title(),
  done: z.boolean().default(false),
  doneAt: timestamp.optional(),
  dueDate: isoDate.optional(),
})
export type CheckItem = z.infer<typeof checkItem>

const base = {
  id: idSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
}

/** Build the stored-entity schema and the editable-fields ("input") schema together. */
function entity<S extends z.ZodRawShape>(shape: S) {
  return { input: z.looseObject(shape), record: z.looseObject({ ...base, ...shape }) }
}

// ------------------------------------------------------------ core items ---

export const task = entity({
  title: title(),
  notes: longText.optional(),
  status: z.enum(TASK_STATUSES.values).default('todo'),
  priority: priority.default('medium'),
  area: lifeArea.default('personal'),
  dueDate: isoDate.optional(),
  dueTime: clockTime.optional(),
  projectId: idSchema.optional(),
  /** Date this task was picked as one of the day's priorities. */
  focusDate: isoDate.optional(),
  completedAt: timestamp.optional(),
  tags,
})

export const calendarEvent = entity({
  title: title(),
  description: longText.optional(),
  kind: z.enum(EVENT_KINDS.values).default('event'),
  area: lifeArea.default('personal'),
  priority: priority.optional(),
  date: isoDate,
  allDay: z.boolean().default(false),
  startTime: clockTime.optional(),
  endTime: clockTime.optional(),
  location: shortText.optional(),
})

export const note = entity({
  title: title(),
  body: longText.default(''),
  area: lifeArea.default('personal'),
  pinned: z.boolean().default(false),
  projectId: idSchema.optional(),
  skillId: idSchema.optional(),
  tags,
})

// -------------------------------------------------------------- projects ---

export const resourceLink = z.looseObject({
  id: idSchema,
  title: title(),
  url: url.optional(),
  note: shortText.optional(),
})

export const project = entity({
  name: title('Name'),
  description: longText.optional(),
  status: z.enum(PROJECT_STATUSES.values).default('planning'),
  kind: z.enum(PROJECT_KINDS.values).default('personal'),
  priority: priority.default('medium'),
  area: lifeArea.default('business'),
  color: accentColor.default('cyan'),
  startDate: isoDate.optional(),
  deadline: isoDate.optional(),
  objectives: z.array(checkItem).default([]),
  milestones: z.array(checkItem).default([]),
  resources: z.array(resourceLink).default([]),
  completedAt: timestamp.optional(),
})

// ---------------------------------------------------------------- career ---

export const careerPath = entity({
  name: title('Name'),
  targetRole: shortText.optional(),
  description: longText.optional(),
  status: z.enum(CAREER_PATH_STATUSES.values).default('exploring'),
  color: accentColor.default('cyan'),
  targetDate: isoDate.optional(),
  roadmap: z.array(checkItem).default([]),
  scores: z.partialRecord(z.enum(CAREER_CRITERIA.values), rating).default({}),
  notes: longText.optional(),
})

export const qualification = entity({
  title: title(),
  institution: shortText.optional(),
  kind: z.enum(QUALIFICATION_KINDS.values).default('certificate'),
  status: z.enum(PROGRESS_STATUSES.values).default('planned'),
  startDate: isoDate.optional(),
  completionDate: isoDate.optional(),
  grade: shortText.optional(),
  credentialUrl: url.optional(),
  notes: longText.optional(),
})

export const academicCourse = entity({
  name: title('Course name'),
  institution: shortText.optional(),
  level: shortText.optional(),
  status: z.enum(PROGRESS_STATUSES.values).default('in_progress'),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  targetGrade: percentage.optional(),
  notes: longText.optional(),
})

export const studyModule = entity({
  name: title('Module name'),
  code: shortText.optional(),
  courseId: idSchema.optional(),
  credits: z.number().min(0).max(1000).optional(),
  term: shortText.optional(),
  status: z.enum(MODULE_STATUSES.values).default('in_progress'),
  targetGrade: percentage.optional(),
  notes: longText.optional(),
})

export const assessment = entity({
  title: title(),
  kind: z.enum(ASSESSMENT_KINDS.values).default('assignment'),
  moduleId: idSchema.optional(),
  dueDate: isoDate,
  dueTime: clockTime.optional(),
  /** Weight towards the module grade, in %. */
  weight: percentage.optional(),
  status: z.enum(ASSESSMENT_STATUSES.values).default('not_started'),
  /** Mark achieved, in %. */
  score: percentage.optional(),
  notes: longText.optional(),
})

export const statusChange = z.looseObject({
  status: z.enum(APPLICATION_STATUSES.values),
  at: timestamp,
})

export const jobApplication = entity({
  company: title('Company'),
  role: title('Role'),
  location: shortText.optional(),
  url: url.optional(),
  status: z.enum(APPLICATION_STATUSES.values).default('wishlist'),
  appliedDate: isoDate.optional(),
  nextStep: shortText.optional(),
  nextStepDate: isoDate.optional(),
  salary: shortText.optional(),
  careerPathId: idSchema.optional(),
  notes: longText.optional(),
  statusHistory: z.array(statusChange).default([]),
})

export const company = entity({
  name: title('Company name'),
  industry: shortText.optional(),
  website: url.optional(),
  location: shortText.optional(),
  interest: rating.optional(),
  research: longText.optional(),
  pros: longText.optional(),
  cons: longText.optional(),
})

export const interviewQuestion = entity({
  question: title('Question'),
  category: z.enum(QUESTION_CATEGORIES.values).default('behavioural'),
  answer: longText.optional(),
  confidence: rating.optional(),
  applicationId: idSchema.optional(),
  lastPractised: isoDate.optional(),
  practiceCount: z.number().int().min(0).default(0),
})

export const careerMilestone = entity({
  title: title(),
  kind: z.enum(CAREER_MILESTONE_KINDS.values).default('cv'),
  dueDate: isoDate.optional(),
  done: z.boolean().default(false),
  doneAt: timestamp.optional(),
  careerPathId: idSchema.optional(),
  notes: longText.optional(),
})

// --------------------------------------------------------------- finance ---

export const transaction = entity({
  kind: z.enum(TRANSACTION_KINDS.values).default('expense'),
  amount: positiveMoney,
  date: isoDate,
  category: title('Category'),
  description: shortText.optional(),
  notes: longText.optional(),
  recurringId: idSchema.optional(),
})

export const budget = entity({
  /** A spending category, or "*" for total monthly spending. */
  category: title('Category'),
  limit: positiveMoney,
  notes: shortText.optional(),
})

export const contribution = z.looseObject({
  id: idSchema,
  date: isoDate,
  /** Negative for withdrawals. */
  amount: money.refine((v) => v !== 0, { error: 'Amount cannot be zero' }),
  note: shortText.optional(),
})

export const savingsGoal = entity({
  name: title('Name'),
  target: positiveMoney,
  targetDate: isoDate.optional(),
  color: accentColor.default('lime'),
  contributions: z.array(contribution).default([]),
  notes: longText.optional(),
  archived: z.boolean().default(false),
})

export const recurringItem = entity({
  name: title('Name'),
  kind: z.enum(TRANSACTION_KINDS.values).default('expense'),
  amount: positiveMoney,
  category: title('Category'),
  frequency: z.enum(FREQUENCIES.values).default('monthly'),
  nextDate: isoDate,
  active: z.boolean().default(true),
  notes: shortText.optional(),
})

export const financialTarget = entity({
  name: title('Name'),
  metric: z.enum(FINANCIAL_TARGET_METRICS.values),
  amount: positiveMoney,
  category: shortText.optional(),
})

// --------------------------------------------------------------- fitness ---

export const exerciseEntry = z.looseObject({
  id: idSchema,
  name: title('Exercise'),
  sets: z.number().int().min(0).max(100).optional(),
  reps: z.number().int().min(0).max(1000).optional(),
  weightKg: z.number().min(0).max(1000).optional(),
  distanceKm: z.number().min(0).max(1000).optional(),
  durationMin: z.number().min(0).max(1440).optional(),
})

export const workout = entity({
  title: title(),
  type: z.enum(WORKOUT_TYPES.values).default('strength'),
  date: isoDate,
  durationMin: z.number().int({ error: 'Whole minutes only' }).min(1, { error: 'At least 1 minute' }).max(1440),
  intensity: z.enum(INTENSITIES.values).default('moderate'),
  exercises: z.array(exerciseEntry).default([]),
  notes: longText.optional(),
})

export const dailyActivity = entity({
  date: isoDate,
  steps: z.number().int().min(0).max(200_000).optional(),
  activeMinutes: z.number().int().min(0).max(1440).optional(),
  distanceKm: z.number().min(0).max(500).optional(),
  notes: shortText.optional(),
})

export const sleepLog = entity({
  /** The morning you woke up. */
  date: isoDate,
  bedTime: clockTime,
  wakeTime: clockTime,
  quality: rating.optional(),
  notes: shortText.optional(),
})

export const routineStep = z.looseObject({ id: idSchema, title: title('Step') })

export const routine = entity({
  name: title('Name'),
  timeOfDay: z.enum(TIMES_OF_DAY.values).default('morning'),
  days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  steps: z.array(routineStep).default([]),
  active: z.boolean().default(true),
  /** date → ids of completed steps. */
  log: z.record(z.string(), z.array(idSchema)).default({}),
})

// ----------------------------------------------------------------- goals ---

export const progressPoint = z.looseObject({ at: timestamp, progress: z.number() })

export const goal = entity({
  title: title(),
  description: longText.optional(),
  horizon: z.enum(GOAL_HORIZONS.values).default('monthly'),
  term: z.enum(GOAL_TERMS.values).default('short'),
  area: lifeArea.default('personal'),
  status: z.enum(GOAL_STATUSES.values).default('active'),
  targetDate: isoDate.optional(),
  progressMode: z.enum(PROGRESS_MODES.values).default('manual'),
  progress: percentage.default(0),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(30).optional(),
  milestones: z.array(checkItem).default([]),
  completedAt: timestamp.optional(),
  history: z.array(progressPoint).default([]),
})

export const habit = entity({
  name: title('Name'),
  description: shortText.optional(),
  area: lifeArea.default('personal'),
  schedule: z.enum(HABIT_SCHEDULES.values).default('daily'),
  days: z.array(z.number().int().min(0).max(6)).default([]),
  timesPerWeek: z.number().int().min(1).max(7).default(3),
  color: accentColor.default('cyan'),
  startDate: isoDate,
  /** Dates the habit was completed. */
  log: z.array(isoDate).default([]),
  archived: z.boolean().default(false),
})

export const weeklyReview = entity({
  weekStart: isoDate,
  wins: longText.optional(),
  challenges: longText.optional(),
  lessons: longText.optional(),
  focus: longText.optional(),
  rating: rating.optional(),
})

// -------------------------------------------------------------- learning ---

export const levelPoint = z.looseObject({ date: isoDate, level: z.number().int().min(0).max(5) })

export const skill = entity({
  name: title('Name'),
  description: longText.optional(),
  category: shortText.optional(),
  status: z.enum(SKILL_STATUSES.values).default('active'),
  level: z.number().int().min(0).max(5).default(0),
  targetLevel: z.number().int().min(1).max(5).default(3),
  levelHistory: z.array(levelPoint).default([]),
  objectives: longText.optional(),
  roadmap: z.array(checkItem).default([]),
  color: accentColor.default('cyan'),
})

export const learningCourse = entity({
  title: title(),
  provider: shortText.optional(),
  url: url.optional(),
  skillId: idSchema.optional(),
  status: z.enum(COURSE_STATUSES.values).default('planned'),
  totalUnits: z.number().int().min(1).max(10_000).optional(),
  completedUnits: z.number().int().min(0).max(10_000).optional(),
  startDate: isoDate.optional(),
  completedDate: isoDate.optional(),
  notes: longText.optional(),
})

export const studySession = entity({
  date: isoDate,
  durationMin: z.number().int({ error: 'Whole minutes only' }).min(1, { error: 'At least 1 minute' }).max(1440),
  skillId: idSchema.optional(),
  courseId: idSchema.optional(),
  topic: shortText.optional(),
  notes: longText.optional(),
})

export const learningResource = entity({
  title: title(),
  url: url.optional(),
  kind: z.enum(RESOURCE_KINDS.values).default('article'),
  skillId: idSchema.optional(),
  status: z.enum(RESOURCE_STATUSES.values).default('queued'),
  notes: longText.optional(),
})

// --------------------------------------------------------------- journal ---

export const journalEntry = entity({
  date: isoDate,
  title: z.string().max(200).optional(),
  body: longText.default(''),
  prompts: z
    .looseObject({
      wentWell: longText.optional(),
      improve: longText.optional(),
      learned: longText.optional(),
      tomorrow: longText.optional(),
      grateful: longText.optional(),
    })
    .default({}),
  lessons: longText.optional(),
  challenges: longText.optional(),
  achievements: longText.optional(),
  tags,
})

export const checkIn = entity({
  date: isoDate,
  at: timestamp,
  mood: rating,
  energy: rating,
  note: shortText.optional(),
})

// ----------------------------------------------------------------- media ---

export const mediaItem = entity({
  title: title(),
  creator: shortText.optional(),
  type: z.enum(MEDIA_TYPES.values).default('book'),
  category: shortText.optional(),
  status: z.enum(MEDIA_STATUSES.values).default('want'),
  startDate: isoDate.optional(),
  completedDate: isoDate.optional(),
  rating: rating.optional(),
  progress: z.number().min(0).max(100_000).optional(),
  total: z.number().min(1).max(100_000).optional(),
  url: url.optional(),
  notes: longText.optional(),
  takeaways: z.array(z.string().trim().min(1).max(1000)).default([]),
})

// ---------------------------------------------------------------- social ---

export const person = entity({
  name: title('Name'),
  circle: z.enum(CIRCLES.values).default('friend'),
  lastContact: isoDate.optional(),
  /** Reconnect every N days. */
  cadenceDays: z.number().int().min(1).max(3650).optional(),
  notes: shortText.optional(),
  contactLog: z.array(isoDate).default([]),
})

export const importantDate = entity({
  title: title(),
  date: isoDate,
  kind: z.enum(OCCASION_KINDS.values).default('occasion'),
  recurring: z.boolean().default(true),
  personId: idSchema.optional(),
  notes: shortText.optional(),
})

// --------------------------------------------------------------- activity --

export const activityEntry = z.looseObject({
  id: idSchema,
  at: timestamp,
  action: z.enum(['created', 'updated', 'deleted', 'completed', 'reopened', 'restored', 'logged']),
  collection: z.string(),
  entityId: idSchema,
  label: z.string(),
  projectId: idSchema.optional(),
  detail: z.string().optional(),
})

// -------------------------------------------------------------- settings ---

export const WIDGET_IDS = [
  'priorities',
  'today',
  'upcoming',
  'habits',
  'weekly',
  'goals',
  'projects',
  'quickadd',
  'activity',
  'notes',
  'finance',
  'checkin',
  'reading',
  'social',
] as const
export type WidgetId = (typeof WIDGET_IDS)[number]
export const WIDGET_SIZES = ['s', 'm', 'l', 'xl'] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]

export const widgetPref = z.looseObject({
  id: z.enum(WIDGET_IDS),
  visible: z.boolean(),
  size: z.enum(WIDGET_SIZES),
})

export const settings = z.looseObject({
  displayName: z.string().max(60).default(''),
  onboarded: z.boolean().default(false),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  /** Appearance of the iPhone version (follows iOS by default). */
  mobileTheme: z.enum(['system', 'light', 'dark']).default('system'),
  /** Visual style of the whole interface (desktop and iPhone). */
  uiStyle: z.enum(['glass', 'clean', 'cyber', 'minimal']).default('glass'),
  accent: z.enum(['blue', 'cyan', 'violet', 'magenta', 'lime']).default('blue'),
  /** Ambient wallpaper and animated decoration. */
  effects: z.boolean().default(true),
  /** Like iOS "Reduce Transparency": solid surfaces, no blur. */
  reduceTransparency: z.boolean().default(false),
  motion: z.enum(['system', 'full', 'reduced']).default('system'),
  currency: z.string().length(3).default('GBP'),
  dateFormat: z.enum(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd MMM yyyy']).default('d MMM yyyy'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  workStart: clockTime.default('09:00'),
  workEnd: clockTime.default('17:30'),
  workDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  defaultCalendarView: z.enum(['day', 'week', 'month']).default('week'),
  dashboard: z.array(widgetPref).default([]),
  sidebarCollapsed: z.boolean().default(false),
  expenseCategories: z.array(z.string().min(1).max(60)).default([]),
  incomeCategories: z.array(z.string().min(1).max(60)).default([]),
  journalBlur: z.boolean().default(false),
  journalPrompts: z.boolean().default(true),
  autoBackup: z.boolean().default(true),
  backupsToKeep: z.number().int().min(1).max(60).default(7),
  /** Personal targets used by Analytics. All optional — nothing is assumed. */
  targets: z
    .looseObject({
      weeklyWorkouts: z.number().int().min(1).max(21).optional(),
      weeklyLearningMinutes: z.number().int().min(1).max(10_000).optional(),
      sleepHours: z.number().min(1).max(14).optional(),
      dailySteps: z.number().int().min(1).max(100_000).optional(),
      yearlyReading: z.number().int().min(1).max(1000).optional(),
      weeklyJournalEntries: z.number().int().min(1).max(7).optional(),
    })
    .default({}),
})

// -------------------------------------------------------------- database ---

/** Every record collection, keyed by its storage name. */
export const collectionSchemas = {
  tasks: task,
  events: calendarEvent,
  notes: note,
  projects: project,
  careerPaths: careerPath,
  qualifications: qualification,
  academicCourses: academicCourse,
  modules: studyModule,
  assessments: assessment,
  applications: jobApplication,
  companies: company,
  interviewQuestions: interviewQuestion,
  careerMilestones: careerMilestone,
  transactions: transaction,
  budgets: budget,
  savingsGoals: savingsGoal,
  recurring: recurringItem,
  financialTargets: financialTarget,
  workouts: workout,
  dailyActivity: dailyActivity,
  sleep: sleepLog,
  routines: routine,
  goals: goal,
  habits: habit,
  weeklyReviews: weeklyReview,
  skills: skill,
  learningCourses: learningCourse,
  studySessions: studySession,
  resources: learningResource,
  journal: journalEntry,
  checkIns: checkIn,
  media: mediaItem,
  people: person,
  importantDates: importantDate,
} as const

export type CollectionKey = keyof typeof collectionSchemas
export const COLLECTION_KEYS = Object.keys(collectionSchemas) as CollectionKey[]

export const SCHEMA_VERSION = 1

const collectionsShape = Object.fromEntries(
  COLLECTION_KEYS.map((key) => [key, z.array(collectionSchemas[key].record).default([])]),
) as { [K in CollectionKey]: z.ZodDefault<z.ZodArray<(typeof collectionSchemas)[K]['record']>> }

export const databaseSchema = z.looseObject({
  schemaVersion: z.number().int().min(1),
  settings,
  activity: z.array(activityEntry).default([]),
  ...collectionsShape,
})
