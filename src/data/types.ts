/** TypeScript types inferred from the Zod schemas in schema.ts. */
import type { z } from 'zod'
import type * as S from './schema'

export type Task = z.infer<typeof S.task.record>
export type CalendarEvent = z.infer<typeof S.calendarEvent.record>
export type Note = z.infer<typeof S.note.record>
export type Project = z.infer<typeof S.project.record>
export type ResourceLink = z.infer<typeof S.resourceLink>
export type CareerPath = z.infer<typeof S.careerPath.record>
export type Qualification = z.infer<typeof S.qualification.record>
export type AcademicCourse = z.infer<typeof S.academicCourse.record>
export type StudyModule = z.infer<typeof S.studyModule.record>
export type Assessment = z.infer<typeof S.assessment.record>
export type JobApplication = z.infer<typeof S.jobApplication.record>
export type Company = z.infer<typeof S.company.record>
export type InterviewQuestion = z.infer<typeof S.interviewQuestion.record>
export type CareerMilestone = z.infer<typeof S.careerMilestone.record>
export type Transaction = z.infer<typeof S.transaction.record>
export type Budget = z.infer<typeof S.budget.record>
export type SavingsGoal = z.infer<typeof S.savingsGoal.record>
export type Contribution = z.infer<typeof S.contribution>
export type RecurringItem = z.infer<typeof S.recurringItem.record>
export type FinancialTarget = z.infer<typeof S.financialTarget.record>
export type Workout = z.infer<typeof S.workout.record>
export type ExerciseEntry = z.infer<typeof S.exerciseEntry>
export type DailyActivity = z.infer<typeof S.dailyActivity.record>
export type SleepLog = z.infer<typeof S.sleepLog.record>
export type Routine = z.infer<typeof S.routine.record>
export type Goal = z.infer<typeof S.goal.record>
export type Habit = z.infer<typeof S.habit.record>
export type WeeklyReview = z.infer<typeof S.weeklyReview.record>
export type Skill = z.infer<typeof S.skill.record>
export type LearningCourse = z.infer<typeof S.learningCourse.record>
export type StudySession = z.infer<typeof S.studySession.record>
export type LearningResource = z.infer<typeof S.learningResource.record>
export type JournalEntry = z.infer<typeof S.journalEntry.record>
export type CheckIn = z.infer<typeof S.checkIn.record>
export type MediaItem = z.infer<typeof S.mediaItem.record>
export type Person = z.infer<typeof S.person.record>
export type ImportantDate = z.infer<typeof S.importantDate.record>
export type ActivityEntry = z.infer<typeof S.activityEntry>
export type ActivityAction = ActivityEntry['action']
export type Settings = z.infer<typeof S.settings>
export type WidgetPref = z.infer<typeof S.widgetPref>
export type { CheckItem, CollectionKey, WidgetId, WidgetSize } from './schema'

/** Maps each collection key to the type of record it stores. */
export interface Collections {
  tasks: Task
  events: CalendarEvent
  notes: Note
  projects: Project
  careerPaths: CareerPath
  qualifications: Qualification
  academicCourses: AcademicCourse
  modules: StudyModule
  assessments: Assessment
  applications: JobApplication
  companies: Company
  interviewQuestions: InterviewQuestion
  careerMilestones: CareerMilestone
  transactions: Transaction
  budgets: Budget
  savingsGoals: SavingsGoal
  recurring: RecurringItem
  financialTargets: FinancialTarget
  workouts: Workout
  dailyActivity: DailyActivity
  sleep: SleepLog
  routines: Routine
  goals: Goal
  habits: Habit
  weeklyReviews: WeeklyReview
  skills: Skill
  learningCourses: LearningCourse
  studySessions: StudySession
  resources: LearningResource
  journal: JournalEntry
  checkIns: CheckIn
  media: MediaItem
  people: Person
  importantDates: ImportantDate
}

export type EntityOf<K extends keyof Collections> = Collections[K]
/** The editable part of a record — everything except id and timestamps. */
export type InputOf<K extends keyof Collections> = Omit<Collections[K], 'id' | 'createdAt' | 'updatedAt'>

export type Database = {
  schemaVersion: number
  settings: Settings
  activity: ActivityEntry[]
} & { [K in keyof Collections]: Collections[K][] }

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}
