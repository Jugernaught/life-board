/** Every collection's form, keyed by collection. */
import type { CollectionKey } from '@/data/types'
import * as career from './career'
import * as core from './core'
import * as finance from './finance'
import * as fitness from './fitness'
import * as goals from './goals'
import * as learning from './learning'
import * as personal from './personal'
import * as projects from './projects'
import type { FormConfig } from './types'

export const FORMS: { [K in CollectionKey]: FormConfig<K> } = {
  tasks: core.taskForm,
  events: core.eventForm,
  notes: core.noteForm,
  projects: projects.projectForm,
  careerPaths: career.careerPathForm,
  qualifications: career.qualificationForm,
  academicCourses: career.academicCourseForm,
  modules: career.moduleForm,
  assessments: career.assessmentForm,
  applications: career.applicationForm,
  companies: career.companyForm,
  interviewQuestions: career.interviewQuestionForm,
  careerMilestones: career.careerMilestoneForm,
  transactions: finance.transactionForm,
  budgets: finance.budgetForm,
  savingsGoals: finance.savingsGoalForm,
  recurring: finance.recurringForm,
  financialTargets: finance.financialTargetForm,
  workouts: fitness.workoutForm,
  dailyActivity: fitness.dailyActivityForm,
  sleep: fitness.sleepForm,
  routines: fitness.routineForm,
  goals: goals.goalForm,
  habits: goals.habitForm,
  weeklyReviews: goals.weeklyReviewForm,
  skills: learning.skillForm,
  learningCourses: learning.learningCourseForm,
  studySessions: learning.studySessionForm,
  resources: learning.resourceForm,
  journal: personal.journalForm,
  checkIns: personal.checkInForm,
  media: personal.mediaForm,
  people: personal.personForm,
  importantDates: personal.importantDateForm,
}
