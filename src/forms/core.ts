import { EVENT_KINDS, PRIORITIES, TASK_STATUSES } from '@/data/constants'
import { isTime, timeToMinutes } from '@/lib/dates'
import { FocusToggle } from './customFields'
import { areaField, nextHour, opts, plusMinutes, refOptions } from './helpers'
import type { FormConfig } from './types'

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
    { name: 'focusDate', label: 'Focus', type: 'custom', render: FocusToggle, span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Details, links, context…' },
    { name: 'tags', label: 'Tags', type: 'tags', suggestions: (ctx) => [...new Set(ctx.db.tasks.flatMap((t) => t.tags))].slice(0, 50) },
  ],
  defaults: () => ({ status: 'todo', priority: 'medium', area: 'personal', tags: [] }),
  quickFields: ['title', 'dueDate', 'priority', 'area', 'focusDate'],
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
