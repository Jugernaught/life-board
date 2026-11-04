/**
 * Enumerations used across the data model, with human labels and a colour
 * "tone" for badges. Keeping values and labels together means a status is
 * always displayed the same way everywhere.
 */

export type Tone = 'cyan' | 'violet' | 'magenta' | 'lime' | 'amber' | 'ok' | 'warn' | 'bad' | 'info' | 'muted'

export interface Option<T extends string = string> {
  value: T
  label: string
  tone?: Tone
  description?: string
}

function options<const T extends string>(list: readonly Option<T>[]) {
  const values = list.map((o) => o.value) as unknown as readonly [T, ...T[]]
  const byValue = Object.fromEntries(list.map((o) => [o.value, o])) as Record<T, Option<T>>
  return {
    list,
    values,
    label: (v: T | undefined) => (v ? (byValue[v]?.label ?? v) : ''),
    tone: (v: T | undefined): Tone => (v ? (byValue[v]?.tone ?? 'muted') : 'muted'),
    get: (v: T) => byValue[v],
  }
}

// ----------------------------------------------------------- life areas ---

export const LIFE_AREAS = options([
  { value: 'career', label: 'Career & Education', tone: 'cyan' },
  { value: 'business', label: 'Projects & Business', tone: 'violet' },
  { value: 'finance', label: 'Finance', tone: 'lime' },
  { value: 'health', label: 'Health & Fitness', tone: 'ok' },
  { value: 'learning', label: 'Learning & Skills', tone: 'info' },
  { value: 'wellbeing', label: 'Mind & Wellbeing', tone: 'magenta' },
  { value: 'social', label: 'Social & Relationships', tone: 'amber' },
  { value: 'culture', label: 'Reading & Media', tone: 'violet' },
  { value: 'personal', label: 'Personal', tone: 'muted' },
] as const)
export type LifeArea = (typeof LIFE_AREAS.values)[number]

// ---------------------------------------------------------------- tasks ---

export const PRIORITIES = options([
  { value: 'low', label: 'Low', tone: 'muted' },
  { value: 'medium', label: 'Medium', tone: 'info' },
  { value: 'high', label: 'High', tone: 'warn' },
  { value: 'urgent', label: 'Urgent', tone: 'bad' },
] as const)
export type Priority = (typeof PRIORITIES.values)[number]
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 }

export const TASK_STATUSES = options([
  { value: 'todo', label: 'To do', tone: 'muted' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'done', label: 'Done', tone: 'ok' },
] as const)
export type TaskStatus = (typeof TASK_STATUSES.values)[number]

export const EVENT_KINDS = options([
  { value: 'event', label: 'Event', tone: 'cyan', description: 'Something happening at a set time' },
  { value: 'block', label: 'Time block', tone: 'violet', description: 'Time reserved for focused work' },
  { value: 'deadline', label: 'Deadline', tone: 'bad', description: 'A due date or cut-off' },
] as const)
export type EventKind = (typeof EVENT_KINDS.values)[number]

// ------------------------------------------------------------- projects ---

export const PROJECT_STATUSES = options([
  { value: 'planning', label: 'Planning', tone: 'violet' },
  { value: 'active', label: 'Active', tone: 'cyan' },
  { value: 'on_hold', label: 'On Hold', tone: 'warn' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
] as const)
export type ProjectStatus = (typeof PROJECT_STATUSES.values)[number]

export const PROJECT_KINDS = options([
  { value: 'business', label: 'Business venture' },
  { value: 'personal', label: 'Personal project' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'client', label: 'Client work' },
  { value: 'creative', label: 'Creative' },
  { value: 'other', label: 'Other' },
] as const)
export type ProjectKind = (typeof PROJECT_KINDS.values)[number]

export const ACCENT_COLORS = options([
  { value: 'cyan', label: 'Cyan', tone: 'cyan' },
  { value: 'violet', label: 'Violet', tone: 'violet' },
  { value: 'magenta', label: 'Magenta', tone: 'magenta' },
  { value: 'lime', label: 'Lime', tone: 'lime' },
  { value: 'amber', label: 'Amber', tone: 'amber' },
  { value: 'info', label: 'Blue', tone: 'info' },
] as const)
export type AccentColor = (typeof ACCENT_COLORS.values)[number]

// --------------------------------------------------------------- career ---

export const CAREER_PATH_STATUSES = options([
  { value: 'exploring', label: 'Exploring', tone: 'violet' },
  { value: 'active', label: 'Pursuing', tone: 'cyan' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
  { value: 'archived', label: 'Archived', tone: 'muted' },
] as const)
export type CareerPathStatus = (typeof CAREER_PATH_STATUSES.values)[number]

/** Criteria a person scores 1–5 when comparing career paths. */
export const CAREER_CRITERIA = options([
  { value: 'interest', label: 'Interest', description: 'How much the work excites you' },
  { value: 'fit', label: 'Skills fit', description: 'How well your current skills match' },
  { value: 'earnings', label: 'Earning potential', description: 'Long-term earning prospects' },
  { value: 'growth', label: 'Growth', description: 'Room to progress and learn' },
  { value: 'balance', label: 'Work–life balance', description: 'Hours, flexibility, stress' },
  { value: 'access', label: 'Ease of entry', description: 'How achievable the next step is' },
] as const)
export type CareerCriterion = (typeof CAREER_CRITERIA.values)[number]

export const QUALIFICATION_KINDS = options([
  { value: 'degree', label: 'Degree' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'licence', label: 'Licence' },
  { value: 'award', label: 'Award' },
  { value: 'other', label: 'Other' },
] as const)
export type QualificationKind = (typeof QUALIFICATION_KINDS.values)[number]

export const PROGRESS_STATUSES = options([
  { value: 'planned', label: 'Planned', tone: 'violet' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
] as const)
export type ProgressStatus = (typeof PROGRESS_STATUSES.values)[number]

export const MODULE_STATUSES = options([
  { value: 'upcoming', label: 'Upcoming', tone: 'violet' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
] as const)
export type ModuleStatus = (typeof MODULE_STATUSES.values)[number]

export const ASSESSMENT_KINDS = options([
  { value: 'assignment', label: 'Assignment', tone: 'cyan' },
  { value: 'exam', label: 'Exam', tone: 'magenta' },
  { value: 'coursework', label: 'Coursework', tone: 'violet' },
  { value: 'presentation', label: 'Presentation', tone: 'amber' },
  { value: 'project', label: 'Project', tone: 'info' },
  { value: 'quiz', label: 'Quiz / test', tone: 'lime' },
] as const)
export type AssessmentKind = (typeof ASSESSMENT_KINDS.values)[number]

export const ASSESSMENT_STATUSES = options([
  { value: 'not_started', label: 'Not started', tone: 'muted' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'submitted', label: 'Submitted', tone: 'violet' },
  { value: 'graded', label: 'Graded', tone: 'ok' },
] as const)
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES.values)[number]

export const APPLICATION_STATUSES = options([
  { value: 'wishlist', label: 'Wishlist', tone: 'muted' },
  { value: 'applied', label: 'Applied', tone: 'info' },
  { value: 'screening', label: 'Screening', tone: 'violet' },
  { value: 'interviewing', label: 'Interviewing', tone: 'cyan' },
  { value: 'offer', label: 'Offer', tone: 'lime' },
  { value: 'accepted', label: 'Accepted', tone: 'ok' },
  { value: 'rejected', label: 'Rejected', tone: 'bad' },
  { value: 'withdrawn', label: 'Withdrawn', tone: 'warn' },
] as const)
export type ApplicationStatus = (typeof APPLICATION_STATUSES.values)[number]
/** Statuses that mean the application is still live. */
export const OPEN_APPLICATION_STATUSES: ApplicationStatus[] = ['wishlist', 'applied', 'screening', 'interviewing', 'offer']

export const QUESTION_CATEGORIES = options([
  { value: 'behavioural', label: 'Behavioural', tone: 'violet' },
  { value: 'technical', label: 'Technical', tone: 'cyan' },
  { value: 'role', label: 'Role-specific', tone: 'info' },
  { value: 'company', label: 'Company', tone: 'amber' },
  { value: 'questions_to_ask', label: 'Questions to ask', tone: 'magenta' },
  { value: 'other', label: 'Other', tone: 'muted' },
] as const)
export type QuestionCategory = (typeof QUESTION_CATEGORIES.values)[number]

export const CAREER_MILESTONE_KINDS = options([
  { value: 'cv', label: 'CV', tone: 'cyan' },
  { value: 'portfolio', label: 'Portfolio', tone: 'violet' },
  { value: 'certification', label: 'Certification', tone: 'lime' },
  { value: 'networking', label: 'Networking', tone: 'amber' },
  { value: 'application', label: 'Applications', tone: 'info' },
  { value: 'other', label: 'Other', tone: 'muted' },
] as const)
export type CareerMilestoneKind = (typeof CAREER_MILESTONE_KINDS.values)[number]

// -------------------------------------------------------------- finance ---

export const TRANSACTION_KINDS = options([
  { value: 'income', label: 'Income', tone: 'ok' },
  { value: 'expense', label: 'Expense', tone: 'bad' },
] as const)
export type TransactionKind = (typeof TRANSACTION_KINDS.values)[number]

export const FREQUENCIES = options([
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const)
export type Frequency = (typeof FREQUENCIES.values)[number]
/** Average number of occurrences per month, for "monthly equivalent" totals. */
export const FREQUENCY_PER_MONTH: Record<Frequency, number> = {
  weekly: 52 / 12,
  fortnightly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
}

export const FINANCIAL_TARGET_METRICS = options([
  { value: 'monthly_savings', label: 'Save at least (per month)', description: 'Income minus spending each month' },
  { value: 'max_monthly_spending', label: 'Spend no more than (per month)', description: 'Total monthly spending' },
  { value: 'min_monthly_income', label: 'Earn at least (per month)', description: 'Total monthly income' },
  { value: 'max_category_spending', label: 'Category limit (per month)', description: 'Spending in one category' },
] as const)
export type FinancialTargetMetric = (typeof FINANCIAL_TARGET_METRICS.values)[number]

/** Generic starter categories — editable in Settings. These are labels, not personal data. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Housing',
  'Bills & Utilities',
  'Groceries',
  'Transport',
  'Eating Out',
  'Health',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Education',
  'Travel',
  'Gifts & Donations',
  'Personal Care',
  'Other',
]
export const DEFAULT_INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Student Finance', 'Investments', 'Gifts', 'Refunds', 'Other']

// -------------------------------------------------------------- fitness ---

export const WORKOUT_TYPES = options([
  { value: 'strength', label: 'Strength', tone: 'magenta' },
  { value: 'cardio', label: 'Cardio', tone: 'cyan' },
  { value: 'mobility', label: 'Mobility & Stretching', tone: 'violet' },
  { value: 'sport', label: 'Sport', tone: 'amber' },
  { value: 'walk', label: 'Walk / Hike', tone: 'lime' },
  { value: 'class', label: 'Class', tone: 'info' },
  { value: 'other', label: 'Other', tone: 'muted' },
] as const)
export type WorkoutType = (typeof WORKOUT_TYPES.values)[number]

export const INTENSITIES = options([
  { value: 'light', label: 'Light', tone: 'ok' },
  { value: 'moderate', label: 'Moderate', tone: 'amber' },
  { value: 'hard', label: 'Hard', tone: 'magenta' },
] as const)
export type Intensity = (typeof INTENSITIES.values)[number]

export const TIMES_OF_DAY = options([
  { value: 'morning', label: 'Morning', tone: 'amber' },
  { value: 'afternoon', label: 'Afternoon', tone: 'cyan' },
  { value: 'evening', label: 'Evening', tone: 'violet' },
  { value: 'anytime', label: 'Any time', tone: 'muted' },
] as const)
export type TimeOfDay = (typeof TIMES_OF_DAY.values)[number]

// ---------------------------------------------------------------- goals ---

export const GOAL_HORIZONS = options([
  { value: 'daily', label: 'Daily', tone: 'cyan' },
  { value: 'weekly', label: 'Weekly', tone: 'info' },
  { value: 'monthly', label: 'Monthly', tone: 'violet' },
  { value: 'quarterly', label: 'Quarterly', tone: 'magenta' },
  { value: 'yearly', label: 'Yearly', tone: 'amber' },
] as const)
export type GoalHorizon = (typeof GOAL_HORIZONS.values)[number]

export const GOAL_TERMS = options([
  { value: 'short', label: 'Short-term' },
  { value: 'long', label: 'Long-term' },
] as const)
export type GoalTerm = (typeof GOAL_TERMS.values)[number]

export const GOAL_STATUSES = options([
  { value: 'active', label: 'Active', tone: 'cyan' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
  { value: 'abandoned', label: 'Abandoned', tone: 'muted' },
] as const)
export type GoalStatus = (typeof GOAL_STATUSES.values)[number]

export const PROGRESS_MODES = options([
  { value: 'manual', label: 'Manual %', description: 'Set the percentage yourself' },
  { value: 'milestones', label: 'Milestones', description: 'Progress = milestones completed' },
  { value: 'numeric', label: 'Numeric target', description: 'Track a number towards a target' },
] as const)
export type ProgressMode = (typeof PROGRESS_MODES.values)[number]

export const HABIT_SCHEDULES = options([
  { value: 'daily', label: 'Every day' },
  { value: 'days', label: 'Specific days' },
  { value: 'weekly', label: 'Times per week' },
] as const)
export type HabitSchedule = (typeof HABIT_SCHEDULES.values)[number]

export const WEEKDAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
] as const

// ------------------------------------------------------------- learning ---

export const SKILL_STATUSES = options([
  { value: 'active', label: 'Developing', tone: 'cyan' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
  { value: 'achieved', label: 'Achieved', tone: 'ok' },
] as const)
export type SkillStatus = (typeof SKILL_STATUSES.values)[number]

export const PROFICIENCY_LEVELS = [
  { value: 0, label: 'Not started' },
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Novice' },
  { value: 3, label: 'Competent' },
  { value: 4, label: 'Proficient' },
  { value: 5, label: 'Expert' },
] as const
export const proficiencyLabel = (level: number) => PROFICIENCY_LEVELS.find((l) => l.value === level)?.label ?? `Level ${level}`

export const COURSE_STATUSES = options([
  { value: 'planned', label: 'Planned', tone: 'violet' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'dropped', label: 'Dropped', tone: 'muted' },
] as const)
export type CourseStatus = (typeof COURSE_STATUSES.values)[number]

export const RESOURCE_KINDS = options([
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'book', label: 'Book' },
  { value: 'course', label: 'Course' },
  { value: 'docs', label: 'Documentation' },
  { value: 'tool', label: 'Tool' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'other', label: 'Other' },
] as const)
export type ResourceKind = (typeof RESOURCE_KINDS.values)[number]

export const RESOURCE_STATUSES = options([
  { value: 'queued', label: 'To review', tone: 'violet' },
  { value: 'in_progress', label: 'In progress', tone: 'cyan' },
  { value: 'done', label: 'Done', tone: 'ok' },
] as const)
export type ResourceStatus = (typeof RESOURCE_STATUSES.values)[number]

// -------------------------------------------------------------- journal ---

export const MOOD_SCALE = [
  { value: 1, label: 'Very low', emoji: '😞' },
  { value: 2, label: 'Low', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const
export const ENERGY_SCALE = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Tired' },
  { value: 3, label: 'Steady' },
  { value: 4, label: 'Energised' },
  { value: 5, label: 'Charged' },
] as const

export const REFLECTION_PROMPTS = [
  { key: 'wentWell', label: 'What went well today?' },
  { key: 'improve', label: 'What could I improve?' },
  { key: 'learned', label: 'What did I learn?' },
  { key: 'tomorrow', label: 'What deserves my attention tomorrow?' },
  { key: 'grateful', label: 'What am I grateful for?' },
] as const
export type PromptKey = (typeof REFLECTION_PROMPTS)[number]['key']

// ---------------------------------------------------------------- media ---

export const MEDIA_TYPES = options([
  { value: 'book', label: 'Book', tone: 'cyan' },
  { value: 'article', label: 'Article', tone: 'info' },
  { value: 'podcast', label: 'Podcast', tone: 'magenta' },
  { value: 'film', label: 'Film', tone: 'violet' },
  { value: 'documentary', label: 'Documentary', tone: 'amber' },
  { value: 'educational', label: 'Educational', tone: 'lime' },
] as const)
export type MediaType = (typeof MEDIA_TYPES.values)[number]

export const MEDIA_STATUSES = options([
  { value: 'want', label: 'Want to Read', tone: 'violet' },
  { value: 'in_progress', label: 'In Progress', tone: 'cyan' },
  { value: 'completed', label: 'Completed', tone: 'ok' },
  { value: 'abandoned', label: 'Abandoned', tone: 'muted' },
] as const)
export type MediaStatus = (typeof MEDIA_STATUSES.values)[number]

/** "Want to Read" reads oddly for a film, so the verb follows the media type. */
export function mediaStatusLabel(status: MediaStatus, type?: MediaType): string {
  if (status !== 'want') return MEDIA_STATUSES.label(status)
  if (type === 'film' || type === 'documentary') return 'Want to Watch'
  if (type === 'podcast') return 'Want to Listen'
  if (type === 'educational') return 'Want to Study'
  return 'Want to Read'
}

export const MEDIA_PROGRESS_UNITS: Record<MediaType, string> = {
  book: 'pages',
  article: '%',
  podcast: 'episodes',
  film: 'min',
  documentary: 'episodes',
  educational: 'lessons',
}

// --------------------------------------------------------------- social ---

export const CIRCLES = options([
  { value: 'friend', label: 'Friend', tone: 'cyan' },
  { value: 'family', label: 'Family', tone: 'magenta' },
  { value: 'colleague', label: 'Colleague', tone: 'info' },
  { value: 'mentor', label: 'Mentor', tone: 'violet' },
  { value: 'community', label: 'Community', tone: 'amber' },
  { value: 'other', label: 'Other', tone: 'muted' },
] as const)
export type Circle = (typeof CIRCLES.values)[number]

export const OCCASION_KINDS = options([
  { value: 'birthday', label: 'Birthday', tone: 'magenta' },
  { value: 'anniversary', label: 'Anniversary', tone: 'violet' },
  { value: 'occasion', label: 'Occasion', tone: 'amber' },
  { value: 'other', label: 'Other', tone: 'muted' },
] as const)
export type OccasionKind = (typeof OCCASION_KINDS.values)[number]
