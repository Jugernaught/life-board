/**
 * Starter templates: ready-made habits and repeating tasks people can add in
 * one go. Nothing is added until the person picks it — and nothing here is
 * personal data (no amounts, names or dates beyond "starts today").
 */
import type { LifeArea } from './constants'
import type { RepeatRule } from './schema'

export interface HabitTemplate {
  id: string
  name: string
  description: string
  area: LifeArea
  schedule: 'daily' | 'days' | 'weekly'
  days?: number[]
  timesPerWeek?: number
  color: 'cyan' | 'violet' | 'magenta' | 'lime' | 'amber'
}

export interface RoutineTemplate {
  id: string
  title: string
  area: LifeArea
  repeat: RepeatRule
  /** Optional subtasks so the routine is a checklist each time. */
  checklist?: string[]
}

export interface TemplatePack<T> {
  id: string
  title: string
  description: string
  items: T[]
}

export const HABIT_PACKS: TemplatePack<HabitTemplate>[] = [
  {
    id: 'foundations',
    title: 'Healthy foundations',
    description: 'Small daily basics that compound.',
    items: [
      { id: 'water', name: 'Drink water', description: 'A glass with every meal', area: 'health', schedule: 'daily', color: 'cyan' },
      { id: 'walk', name: 'Walk 30 minutes', description: 'Outside if you can', area: 'health', schedule: 'daily', color: 'lime' },
      { id: 'sleep', name: 'In bed by 11pm', description: 'Screens away 30 minutes before', area: 'health', schedule: 'daily', color: 'violet' },
      { id: 'strength', name: 'Strength training', description: 'Any session counts', area: 'health', schedule: 'weekly', timesPerWeek: 3, color: 'magenta' },
    ],
  },
  {
    id: 'mind',
    title: 'Mind & growth',
    description: 'Habits for focus, learning and calm.',
    items: [
      { id: 'read', name: 'Read 20 minutes', description: 'Book, not feed', area: 'learning', schedule: 'daily', color: 'amber' },
      { id: 'meditate', name: 'Meditate 10 minutes', description: 'Breathing counts', area: 'wellbeing', schedule: 'daily', color: 'violet' },
      { id: 'journal', name: 'Write in the journal', description: 'Three lines is enough', area: 'wellbeing', schedule: 'daily', color: 'cyan' },
      { id: 'learn', name: 'Practise a skill', description: 'Deliberate practice, 25 minutes', area: 'learning', schedule: 'days', days: [1, 3, 5], color: 'lime' },
    ],
  },
]

export const ROUTINE_PACKS: TemplatePack<RoutineTemplate>[] = [
  {
    id: 'reviews',
    title: 'Reviews & planning',
    description: 'Repeating tasks that keep life on track.',
    items: [
      { id: 'weekly-review', title: 'Weekly review', area: 'personal', repeat: { freq: 'weekly', interval: 1, days: [0] }, checklist: ['Clear inboxes', 'Review calendar for next week', 'Pick next week’s priorities', 'Check habits and goals'] },
      { id: 'monthly-money', title: 'Monthly money check', area: 'finance', repeat: { freq: 'monthly', interval: 1, days: [] }, checklist: ['Review spending vs budget', 'Check subscriptions', 'Move savings'] },
      { id: 'plan-week', title: 'Plan the week ahead', area: 'personal', repeat: { freq: 'weekly', interval: 1, days: [1] } },
    ],
  },
  {
    id: 'home',
    title: 'Home & admin',
    description: 'Chores that come back by themselves.',
    items: [
      { id: 'clean', title: 'Clean the house', area: 'personal', repeat: { freq: 'weekly', interval: 1, days: [6] }, checklist: ['Kitchen', 'Bathroom', 'Hoover', 'Bins out'] },
      { id: 'laundry', title: 'Laundry', area: 'personal', repeat: { freq: 'weekly', interval: 1, days: [3] } },
      { id: 'plants', title: 'Water the plants', area: 'personal', repeat: { freq: 'weekly', interval: 1, days: [2, 5] } },
      { id: 'backup', title: 'Back up LIFE OS', area: 'personal', repeat: { freq: 'monthly', interval: 1, days: [] } },
    ],
  },
]
