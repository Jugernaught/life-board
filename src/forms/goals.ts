import { GOAL_HORIZONS, GOAL_STATUSES, GOAL_TERMS, HABIT_SCHEDULES, PROGRESS_MODES } from '@/data/constants'
import { ProgressSlider } from './customFields'
import { areaField, opts } from './helpers'
import type { FormConfig } from './types'

export const goalForm: FormConfig<'goals'> = {
  key: 'goals',
  size: 'lg',
  fields: [
    { name: 'title', label: 'Goal', type: 'text', required: true, placeholder: 'e.g. Run a half marathon', span: 2 },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'Why it matters, what done looks like' },
    { name: 'horizon', label: 'Timeframe', type: 'segmented', options: opts(GOAL_HORIZONS), span: 2 },
    { name: 'term', label: 'Term', type: 'segmented', options: opts(GOAL_TERMS) },
    areaField({ label: 'Life category' }),
    { name: 'targetDate', label: 'Target date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: opts(GOAL_STATUSES) },
    { name: 'progressMode', label: 'Track progress by', type: 'segmented', options: opts(PROGRESS_MODES), span: 2 },
    { name: 'progress', label: 'Progress', type: 'custom', render: ProgressSlider, span: 2, visible: (v) => v.progressMode === 'manual' },
    { name: 'startValue', label: 'Starting value', type: 'number', visible: (v) => v.progressMode === 'numeric', placeholder: '0' },
    { name: 'targetValue', label: 'Target value', type: 'number', visible: (v) => v.progressMode === 'numeric', required: true },
    { name: 'currentValue', label: 'Current value', type: 'number', visible: (v) => v.progressMode === 'numeric' },
    { name: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. km, books, £', visible: (v) => v.progressMode === 'numeric' },
    { name: 'milestones', label: 'Milestones', type: 'checklist', placeholder: 'Add a milestone' },
  ],
  defaults: () => ({ horizon: 'monthly', term: 'short', area: 'personal', status: 'active', progressMode: 'manual', progress: 0, milestones: [], history: [] }),
  validate: (v) => {
    if (v.progressMode === 'numeric' && (v.targetValue === undefined || Number.isNaN(v.targetValue))) return { targetValue: 'Set a target value' }
    if (v.progressMode === 'numeric' && v.targetValue === (v.startValue ?? 0)) return { targetValue: 'Target must differ from the starting value' }
    if (v.progressMode === 'milestones' && !(v.milestones as unknown[])?.length) return { milestones: 'Add at least one milestone to track progress this way' }
    return undefined
  },
  quickFields: ['title', 'horizon', 'area', 'targetDate'],
}

export const habitForm: FormConfig<'habits'> = {
  key: 'habits',
  fields: [
    { name: 'name', label: 'Habit', type: 'text', required: true, placeholder: 'e.g. Read 20 minutes', span: 2 },
    { name: 'description', label: 'Description', type: 'text', span: 2 },
    { name: 'schedule', label: 'Schedule', type: 'segmented', options: opts(HABIT_SCHEDULES), span: 2 },
    { name: 'days', label: 'On these days', type: 'weekdays', visible: (v) => v.schedule === 'days' },
    { name: 'timesPerWeek', label: 'Times per week', type: 'number', min: 1, max: 7, visible: (v) => v.schedule === 'weekly' },
    areaField({ label: 'Life category' }),
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    { name: 'color', label: 'Colour', type: 'color', span: 2 },
    { name: 'archived', label: 'Archived', type: 'switch', hint: 'Stops tracking but keeps history' },
  ],
  defaults: (ctx) => ({ schedule: 'daily', days: [1, 2, 3, 4, 5], timesPerWeek: 3, area: 'personal', color: 'cyan', startDate: ctx.today, log: [], archived: false }),
  validate: (v) => (v.schedule === 'days' && !(v.days as number[])?.length ? { days: 'Choose at least one day' } : undefined),
}

export const weeklyReviewForm: FormConfig<'weeklyReviews'> = {
  key: 'weeklyReviews',
  size: 'lg',
  fields: [
    { name: 'weekStart', label: 'Week starting', type: 'date', required: true },
    { name: 'rating', label: 'How was the week?', type: 'rating' },
    { name: 'wins', label: 'Wins', type: 'textarea', rows: 3 },
    { name: 'challenges', label: 'Challenges', type: 'textarea', rows: 3 },
    { name: 'lessons', label: 'Lessons', type: 'textarea', rows: 3 },
    { name: 'focus', label: 'Focus for next week', type: 'textarea', rows: 3 },
  ],
}
