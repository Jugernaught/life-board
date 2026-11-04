import { EVENT_KINDS, PRIORITIES, TASK_STATUSES } from '@/data/constants'
import { isTime, timeToMinutes } from '@/lib/dates'
import { FocusToggle, RepeatPicker } from './customFields'
import { areaField, nextHour, opts, plusMinutes, refOptions } from './helpers'
import { eventSmart, taskSmart } from './smart'
import type { FormConfig } from './types'

/** Minutes before a task's due time. */
export const REMINDER_LEADS = [
  { value: '0', label: 'At the due time' },
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
] as const

export const taskForm: FormConfig<'tasks'> = {
  key: 'tasks',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'What needs doing?', span: 2 },
    { name: 'dueDate', label: 'Due date', type: 'date' },
    { name: 'dueTime', label: 'Due time', type: 'time', hint: 'Optional' },
    { name: 'priority', label: 'Priority', type: 'segmented', options: opts(PRIORITIES), span: 2 },
    { name: 'status', label: 'Status', type: 'select', options: opts(TASK_STATUSES) },
    areaField(),
    { name: 'projectId', label: 'Project', type: 'select', emptyOption: 'No project', options: (ctx) => refOptions(ctx.db.projects, (p) => p.name) },
    {
      name: 'remindBefore',
      label: 'Reminder',
      type: 'select',
      numeric: true,
      emptyOption: 'No reminder',
      options: REMINDER_LEADS,
      visible: (v) => Boolean(v.dueDate && v.dueTime),
      hint: 'Notifies you while LIFE OS is open. Turn reminders on in Settings → Notifications.',
    },
    { name: 'repeat', label: 'Repeat', type: 'custom', render: RepeatPicker, span: 2 },
    { name: 'focusDate', label: 'Focus', type: 'custom', render: FocusToggle, span: 2 },
    { name: 'checklist', label: 'Subtasks', type: 'checklist', placeholder: 'Add a subtask and press Enter', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Details, links, context…' },
    { name: 'tags', label: 'Tags', type: 'tags', suggestions: (ctx) => [...new Set(ctx.db.tasks.flatMap((t) => t.tags))].slice(0, 50) },
  ],
  defaults: () => ({ status: 'todo', priority: 'medium', area: 'personal', tags: [], checklist: [] }),
  prepare: (v) => (v.dueTime ? v : { ...v, remindBefore: undefined }),
  smart: taskSmart,
  quickFields: ['title', 'dueDate', 'dueTime', 'priority', 'area', 'focusDate'],
}

export const eventForm: FormConfig<'events'> = {
  key: 'events',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Dentist, Deep work, Team call', span: 2 },
    { name: 'kind', label: 'Type', type: 'segmented', options: opts(EVENT_KINDS), span: 2 },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'allDay', label: 'All day', type: 'switch' },
    { name: 'startTime', label: 'Start', type: 'time', visible: (v) => !v.allDay },
    { name: 'endTime', label: 'End', type: 'time', visible: (v) => !v.allDay },
    areaField(),
    { name: 'priority', label: 'Priority', type: 'select', emptyOption: 'None', options: opts(PRIORITIES) },
    { name: 'location', label: 'Location', type: 'text', placeholder: 'Optional', span: 2 },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  defaults: (ctx) => {
    const start = nextHour()
    return { kind: 'event', date: ctx.today, allDay: false, startTime: start, endTime: plusMinutes(start, 60), area: 'personal' }
  },
  prepare: (v) => (v.allDay ? { ...v, startTime: undefined, endTime: undefined } : v),
  validate: (v) => {
    if (v.allDay) return undefined
    if (!v.startTime) return { startTime: 'Add a start time or mark the event as all day' }
    if (v.endTime && isTime(v.endTime) && isTime(v.startTime) && timeToMinutes(String(v.endTime)) <= timeToMinutes(String(v.startTime))) return { endTime: 'End time must be after the start time' }
    return undefined
  },
  smart: eventSmart,
  quickFields: ['title', 'kind', 'date', 'allDay', 'startTime', 'endTime'],
}

export const noteForm: FormConfig<'notes'> = {
  key: 'notes',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
    { name: 'body', label: 'Note', type: 'textarea', rows: 6, placeholder: 'Write anything…' },
    areaField(),
    { name: 'pinned', label: 'Pin to Command Centre', type: 'switch' },
    { name: 'projectId', label: 'Project', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.projects, (p) => p.name) },
    { name: 'skillId', label: 'Skill', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.skills, (s) => s.name) },
    { name: 'tags', label: 'Tags', type: 'tags', suggestions: (ctx) => [...new Set(ctx.db.notes.flatMap((n) => n.tags))].slice(0, 50) },
  ],
  defaults: () => ({ body: '', area: 'personal', pinned: false, tags: [] }),
  quickFields: ['title', 'body', 'area'],
}
