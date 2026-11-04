import { CIRCLES, ENERGY_SCALE, MEDIA_STATUSES, MEDIA_TYPES, MEDIA_PROGRESS_UNITS, MOOD_SCALE, OCCASION_KINDS, mediaStatusLabel, type MediaType } from '@/data/constants'
import { PromptsEditor } from './customFields'
import { notBefore, opts, refOptions } from './helpers'
import type { FormConfig } from './types'

export const journalForm: FormConfig<'journal'> = {
  key: 'journal',
  size: 'lg',
  fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'title', label: 'Title', type: 'text', placeholder: 'Optional' },
    { name: 'body', label: 'Entry', type: 'textarea', rows: 8, placeholder: 'Write freely…' },
    { name: 'prompts', label: 'Reflection prompts', type: 'custom', render: PromptsEditor, span: 2 },
    { name: 'achievements', label: 'Achievements', type: 'textarea', rows: 2 },
    { name: 'challenges', label: 'Challenges', type: 'textarea', rows: 2 },
    { name: 'lessons', label: 'Lessons learned', type: 'textarea', rows: 2 },
    { name: 'tags', label: 'Tags', type: 'tags', suggestions: (ctx) => [...new Set(ctx.db.journal.flatMap((j) => j.tags))] },
  ],
  defaults: (ctx) => ({ date: ctx.today, body: '', prompts: {}, tags: [] }),
  quickFields: ['date', 'title', 'body'],
}

export const checkInForm: FormConfig<'checkIns'> = {
  key: 'checkIns',
  fields: [
    { name: 'mood', label: 'Mood', type: 'scale', scale: MOOD_SCALE, required: true },
    { name: 'energy', label: 'Energy', type: 'scale', scale: ENERGY_SCALE, required: true },
    { name: 'note', label: 'Note', type: 'text', placeholder: 'Optional — what is behind it?', span: 2 },
    { name: 'date', label: 'Date', type: 'date', required: true },
  ],
  defaults: (ctx) => ({ date: ctx.today }),
  prepare: (v, ctx) => ({ ...v, at: v.at ?? (v.date === ctx.today ? new Date().toISOString() : `${String(v.date)}T12:00:00.000Z`) }),
}

const mediaStatusOptions = (type: unknown) => MEDIA_STATUSES.list.map((s) => ({ value: s.value, label: mediaStatusLabel(s.value, type as MediaType) }))

export const mediaForm: FormConfig<'media'> = {
  key: 'media',
  size: 'lg',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
    { name: 'creator', label: 'Author / creator', type: 'text' },
    { name: 'type', label: 'Type', type: 'select', options: opts(MEDIA_TYPES) },
    { name: 'status', label: 'Status', type: 'segmented', options: (_ctx, v) => mediaStatusOptions(v.type), span: 2 },
    { name: 'category', label: 'Category / genre', type: 'text', suggestions: (ctx) => [...new Set(ctx.db.media.map((m) => m.category).filter(Boolean) as string[])] },
    { name: 'rating', label: 'Rating', type: 'rating' },
    { name: 'startDate', label: 'Started', type: 'date' },
    { name: 'completedDate', label: 'Finished', type: 'date', visible: (v) => v.status === 'completed' || v.status === 'abandoned' },
    { name: 'progress', label: 'Progress', type: 'number', min: 0, visible: (v) => v.status === 'in_progress', hint: 'Optional' },
    { name: 'total', label: 'Total', type: 'number', min: 1, visible: (v) => v.status === 'in_progress' },
    { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…', span: 2 },
    { name: 'notes', label: 'Personal notes', type: 'textarea' },
    { name: 'takeaways', label: 'Key takeaways', type: 'list', placeholder: 'Add a takeaway' },
  ],
  defaults: () => ({ type: 'book', status: 'want', takeaways: [] }),
  prepare: (v, ctx) => {
    const out = { ...v }
    if (out.status === 'completed' && !out.completedDate) out.completedDate = ctx.today
    if (out.status === 'in_progress' && !out.startDate) out.startDate = ctx.today
    if (out.status === 'want') out.completedDate = undefined
    return out
  },
  validate: (v) => {
    if (typeof v.progress === 'number' && typeof v.total === 'number' && v.progress > v.total) return { progress: 'Cannot be more than the total' }
    return notBefore(v, 'startDate', 'completedDate', 'Finish date must be on or after the start date')
  },
  quickFields: ['title', 'creator', 'type', 'status'],
}
export const mediaUnit = (type: MediaType) => MEDIA_PROGRESS_UNITS[type]

const CADENCES = [
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Every month' },
  { value: '60', label: 'Every 2 months' },
  { value: '90', label: 'Every 3 months' },
  { value: '182', label: 'Every 6 months' },
  { value: '365', label: 'Every year' },
]

export const personForm: FormConfig<'people'> = {
  key: 'people',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, hint: 'A first name or nickname is enough' },
    { name: 'circle', label: 'Circle', type: 'select', options: opts(CIRCLES) },
    { name: 'cadenceDays', label: 'Reconnect', type: 'select', numeric: true, emptyOption: 'No reminder', options: CADENCES },
    { name: 'lastContact', label: 'Last in touch', type: 'date' },
    { name: 'notes', label: 'Note', type: 'text', span: 2, placeholder: 'Optional — e.g. ask about the new job', hint: 'Keep it light: avoid storing sensitive details about others.' },
  ],
  defaults: () => ({ circle: 'friend', contactLog: [] }),
}

export const importantDateForm: FormConfig<'importantDates'> = {
  key: 'importantDates',
  fields: [
    { name: 'title', label: 'Occasion', type: 'text', required: true, placeholder: "e.g. Mum's birthday", span: 2 },
    { name: 'kind', label: 'Type', type: 'select', options: opts(OCCASION_KINDS) },
    { name: 'date', label: 'Date', type: 'date', required: true, hint: 'For birthdays, any year works' },
    { name: 'recurring', label: 'Repeats every year', type: 'switch' },
    { name: 'personId', label: 'Person', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.people, (p) => p.name) },
    { name: 'notes', label: 'Notes', type: 'text', span: 2 },
  ],
  defaults: () => ({ kind: 'birthday', recurring: true }),
}
