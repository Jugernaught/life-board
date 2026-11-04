import { INTENSITIES, TIMES_OF_DAY, WORKOUT_TYPES } from '@/data/constants'
import { ExercisesEditor, StepsEditor } from './customFields'
import { opts, withoutBlank } from './helpers'
import type { FormConfig } from './types'

export const workoutForm: FormConfig<'workouts'> = {
  key: 'workouts',
  size: 'lg',
  fields: [
    { name: 'title', label: 'Workout', type: 'text', required: true, placeholder: 'e.g. Upper body, 5k run', suggestions: (ctx) => [...new Set(ctx.db.workouts.map((w) => w.title))].slice(0, 30) },
    { name: 'type', label: 'Type', type: 'select', options: opts(WORKOUT_TYPES) },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'durationMin', label: 'Duration', type: 'number', unit: 'min', required: true, min: 1 },
    { name: 'intensity', label: 'Intensity', type: 'segmented', options: opts(INTENSITIES), span: 2 },
    { name: 'exercises', label: 'Exercises', type: 'custom', render: ExercisesEditor, span: 2, hint: 'Optional — logged exercises build your personal records' },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, placeholder: 'How did it feel?' },
  ],
  defaults: (ctx) => ({ type: 'strength', date: ctx.today, intensity: 'moderate', exercises: [] }),
  prepare: (v) => ({ ...v, exercises: withoutBlank(v.exercises, 'name') }),
  quickFields: ['title', 'type', 'date', 'durationMin', 'intensity'],
}

export const dailyActivityForm: FormConfig<'dailyActivity'> = {
  key: 'dailyActivity',
  fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'steps', label: 'Steps', type: 'number', min: 0, placeholder: 'e.g. 8500' },
    { name: 'activeMinutes', label: 'Active minutes', type: 'number', unit: 'min', min: 0 },
    { name: 'distanceKm', label: 'Distance', type: 'number', unit: 'km', min: 0, step: 0.1 },
    { name: 'notes', label: 'Notes', type: 'text', span: 2 },
  ],
  defaults: (ctx) => ({ date: ctx.today }),
  validate: (v, ctx) => {
    if (ctx.db.dailyActivity.some((a) => a.date === v.date && a.id !== v.id)) return { date: 'There is already an activity log for this date — edit that one instead' }
    if (v.steps === undefined && v.activeMinutes === undefined && v.distanceKm === undefined) return { steps: 'Enter at least one of steps, active minutes or distance' }
    return undefined
  },
}

export const sleepForm: FormConfig<'sleep'> = {
  key: 'sleep',
  fields: [
    { name: 'date', label: 'Morning of', type: 'date', required: true, hint: 'The date you woke up', span: 2 },
    { name: 'bedTime', label: 'Went to bed', type: 'time', required: true },
    { name: 'wakeTime', label: 'Woke up', type: 'time', required: true },
    { name: 'quality', label: 'Sleep quality', type: 'rating' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  defaults: (ctx) => ({ date: ctx.today, bedTime: '23:00', wakeTime: '07:00' }),
  validate: (v, ctx) => (ctx.db.sleep.some((s) => s.date === v.date && s.id !== v.id) ? { date: 'Sleep is already logged for this morning' } : undefined),
}

export const routineForm: FormConfig<'routines'> = {
  key: 'routines',
  fields: [
    { name: 'name', label: 'Routine', type: 'text', required: true, placeholder: 'e.g. Morning reset', span: 2 },
    { name: 'timeOfDay', label: 'Time of day', type: 'segmented', options: opts(TIMES_OF_DAY), span: 2 },
    { name: 'days', label: 'Days', type: 'weekdays' },
    { name: 'steps', label: 'Steps', type: 'custom', render: StepsEditor, span: 2 },
    { name: 'active', label: 'Active', type: 'switch' },
  ],
  defaults: () => ({ timeOfDay: 'morning', days: [0, 1, 2, 3, 4, 5, 6], steps: [], active: true, log: {} }),
  prepare: (v) => ({ ...v, steps: withoutBlank(v.steps, 'title') }),
  validate: (v) => {
    if (!(v.days as number[])?.length) return { days: 'Choose at least one day' }
    if (!(v.steps as unknown[])?.length) return { steps: 'Add at least one step' }
    return undefined
  },
}
