/**
 * Maps every screen path to its component and title. Screens load on demand
 * (and are precached by the service worker for offline use).
 */
import { type ComponentType, lazy } from 'react'
import type { Database } from '@/data/types'
import { formatDate } from '@/lib/dates'
import TodayScreen from '../screens/today/TodayScreen'
import { type RoutePattern, matchPath } from './paths'

type ScreenComponent = ComponentType<{ params: Record<string, string> }>

// lazy() loader for a named export.
function named<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): ScreenComponent {
  return lazy(() => load().then((m) => ({ default: m[name] as ScreenComponent })))
}

const career = () => import('../screens/career/CareerScreens')
const finance = () => import('../screens/finance/FinanceScreens')
const fitness = () => import('../screens/fitness/FitnessScreens')
const learning = () => import('../screens/learning/LearningScreens')
const social = () => import('../screens/social/SocialScreens')
const settings = () => import('../screens/settings/SettingsScreens')
const habits = () => import('../screens/habits/HabitsScreens')
const journal = () => import('../screens/journal/JournalScreens')
const projects = () => import('../screens/projects/ProjectsScreens')
const analytics = () => import('../screens/analytics/AnalyticsScreens')

export interface RouteDef {
  component: ScreenComponent
  title: string | ((params: Record<string, string>, db: Database) => string)
}

export const ROUTES: Record<RoutePattern, RouteDef> = {
  today: { component: TodayScreen as ScreenComponent, title: 'Today' },
  plan: { component: named(() => import('../screens/plan/PlanScreen'), 'PlanScreen'), title: 'Plan' },
  habits: { component: named(habits, 'HabitsScreen'), title: 'Habits' },
  'habits/habit/:id': { component: named(habits, 'HabitDetailScreen'), title: (p, db) => db.habits.find((h) => h.id === p.id)?.name ?? 'Habit' },
  'habits/goal/:id': { component: named(habits, 'GoalDetailScreen'), title: (p, db) => db.goals.find((g) => g.id === p.id)?.title ?? 'Goal' },
  'habits/review': { component: named(habits, 'WeeklyReviewScreen'), title: 'Weekly Review' },
  journal: { component: named(journal, 'JournalScreen'), title: 'Journal' },
  'journal/entry/:id': { component: named(journal, 'JournalEntryScreen'), title: (p, db) => { const e = db.journal.find((j) => j.id === p.id); return e ? e.title || formatDate(e.date, 'd MMM yyyy') : 'Entry' } },
  'journal/write/:date': { component: named(journal, 'JournalWriteScreen'), title: (p) => formatDate(p.date, 'd MMM yyyy') },
  'journal/history': { component: named(journal, 'JournalHistoryScreen'), title: 'All Entries' },
  'journal/checkins': { component: named(journal, 'CheckInsScreen'), title: 'Mood & Energy' },
  more: { component: named(() => import('../screens/more/MoreScreen'), 'MoreScreen'), title: 'More' },
  'more/projects': { component: named(projects, 'ProjectsScreen'), title: 'Projects' },
  'more/projects/:id': { component: named(projects, 'ProjectDetailScreen'), title: (p, db) => db.projects.find((x) => x.id === p.id)?.name ?? 'Project' },
  'more/career': { component: named(career, 'CareerScreen'), title: 'Career' },
  'more/career/paths': { component: named(career, 'CareerPathsScreen'), title: 'Career Paths' },
  'more/career/paths/:id': { component: named(career, 'CareerPathScreen'), title: (p, db) => db.careerPaths.find((x) => x.id === p.id)?.name ?? 'Career Path' },
  'more/career/education': { component: named(career, 'EducationScreen'), title: 'Education' },
  'more/career/education/course/:id': { component: named(career, 'AcademicCourseScreen'), title: (p, db) => db.academicCourses.find((x) => x.id === p.id)?.name ?? 'Course' },
  'more/career/education/module/:id': { component: named(career, 'ModuleScreen'), title: (p, db) => db.modules.find((x) => x.id === p.id)?.name ?? 'Module' },
  'more/career/applications': { component: named(career, 'ApplicationsScreen'), title: 'Applications' },
  'more/career/interviews': { component: named(career, 'InterviewScreen'), title: 'Interview Prep' },
  'more/career/companies': { component: named(career, 'CompaniesScreen'), title: 'Companies' },
  'more/career/milestones': { component: named(career, 'CareerMilestonesScreen'), title: 'CV & Portfolio' },
  'more/career/qualifications': { component: named(career, 'QualificationsScreen'), title: 'Qualifications' },
  'more/finance': { component: named(finance, 'FinanceScreen'), title: 'Finances' },
  'more/finance/transactions': { component: named(finance, 'TransactionsScreen'), title: 'Transactions' },
  'more/finance/budgets': { component: named(finance, 'BudgetsScreen'), title: 'Budgets' },
  'more/finance/savings': { component: named(finance, 'SavingsScreen'), title: 'Savings' },
  'more/finance/recurring': { component: named(finance, 'RecurringScreen'), title: 'Recurring' },
  'more/finance/targets': { component: named(finance, 'TargetsScreen'), title: 'Targets' },
  'more/fitness': { component: named(fitness, 'FitnessScreen'), title: 'Fitness' },
  'more/fitness/workouts': { component: named(fitness, 'WorkoutsScreen'), title: 'Workouts' },
  'more/fitness/records': { component: named(fitness, 'RecordsScreen'), title: 'Personal Records' },
  'more/fitness/activity': { component: named(fitness, 'ActivityScreen'), title: 'Activity' },
  'more/fitness/sleep': { component: named(fitness, 'SleepScreen'), title: 'Sleep' },
  'more/fitness/routines': { component: named(fitness, 'RoutinesScreen'), title: 'Routines' },
  'more/learning': { component: named(learning, 'LearningScreen'), title: 'Learning' },
  'more/learning/skill/:id': { component: named(learning, 'SkillScreen'), title: (p, db) => db.skills.find((s) => s.id === p.id)?.name ?? 'Skill' },
  'more/learning/sessions': { component: named(learning, 'SessionsScreen'), title: 'Study Sessions' },
  'more/learning/courses': { component: named(learning, 'CoursesScreen'), title: 'Courses' },
  'more/learning/resources': { component: named(learning, 'ResourcesScreen'), title: 'Resources' },
  'more/library': { component: named(() => import('../screens/library/LibraryScreen'), 'LibraryScreen'), title: 'Library' },
  'more/social': { component: named(social, 'SocialScreen'), title: 'Social' },
  'more/social/people': { component: named(social, 'PeopleScreen'), title: 'Reconnect' },
  'more/social/dates': { component: named(social, 'DatesScreen'), title: 'Important Dates' },
  'more/notes': { component: named(() => import('../screens/notes/NotesScreen'), 'NotesScreen'), title: 'Notes' },
  'more/analytics': { component: named(analytics, 'AnalyticsScreen'), title: 'Analytics' },
  'more/analytics/report': { component: named(analytics, 'ReportScreen'), title: 'Report' },
  'more/settings': { component: named(settings, 'SettingsScreen'), title: 'Settings' },
  'more/settings/data': { component: named(settings, 'DataScreen'), title: 'Data & Backups' },
  'more/settings/targets': { component: named(settings, 'TargetsScreen'), title: 'Targets' },
  'more/settings/categories': { component: named(settings, 'CategoriesScreen'), title: 'Categories' },
}

export function routeTitle(path: string, db: Database): string {
  const m = matchPath(path)
  if (!m) return 'Back'
  const t = ROUTES[m.pattern].title
  return typeof t === 'function' ? t(m.params, db) : t
}
