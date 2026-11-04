import { COURSE_STATUSES, RESOURCE_KINDS, RESOURCE_STATUSES, SKILL_STATUSES } from '@/data/constants'
import { opts, refOptions } from './helpers'
import type { FormConfig } from './types'

export const skillForm: FormConfig<'skills'> = {
  key: 'skills',
  size: 'lg',
  fields: [
    { name: 'name', label: 'Skill', type: 'text', required: true, placeholder: 'e.g. TypeScript, Public speaking, Spanish' },
    { name: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Technical, Language', suggestions: (ctx) => [...new Set(ctx.db.skills.map((s) => s.category).filter(Boolean) as string[])] },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(SKILL_STATUSES), span: 2 },
    { name: 'level', label: 'Current proficiency', type: 'level', min: 0 },
    { name: 'targetLevel', label: 'Target proficiency', type: 'level', min: 1 },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
    { name: 'objectives', label: 'Objectives', type: 'textarea', rows: 3, placeholder: 'What will you be able to do?' },
    { name: 'roadmap', label: 'Learning roadmap', type: 'checklist', placeholder: 'Add a roadmap step' },
    { name: 'color', label: 'Colour', type: 'color', span: 2 },
  ],
  defaults: () => ({ status: 'active', level: 0, targetLevel: 3, roadmap: [], levelHistory: [], color: 'cyan' }),
  quickFields: ['name', 'category', 'level', 'targetLevel'],
}

export const learningCourseForm: FormConfig<'learningCourses'> = {
  key: 'learningCourses',
  fields: [
    { name: 'title', label: 'Course', type: 'text', required: true, span: 2 },
    { name: 'provider', label: 'Provider', type: 'text', placeholder: 'e.g. Coursera, YouTube, a book' },
    { name: 'skillId', label: 'Skill', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.skills, (s) => s.name) },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(COURSE_STATUSES), span: 2 },
    { name: 'totalUnits', label: 'Total lessons / modules', type: 'number', min: 1 },
    { name: 'completedUnits', label: 'Completed', type: 'number', min: 0 },
    { name: 'startDate', label: 'Started', type: 'date' },
    { name: 'completedDate', label: 'Finished', type: 'date', visible: (v) => v.status === 'completed' },
    { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ status: 'planned' }),
  prepare: (v, ctx) => ({ ...v, completedDate: v.status === 'completed' ? (v.completedDate ?? ctx.today) : undefined }),
  validate: (v) =>
    typeof v.completedUnits === 'number' && typeof v.totalUnits === 'number' && v.completedUnits > v.totalUnits ? { completedUnits: 'Cannot exceed the total' } : undefined,
}

export const studySessionForm: FormConfig<'studySessions'> = {
  key: 'studySessions',
  fields: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'durationMin', label: 'Duration', type: 'number', unit: 'min', required: true, min: 1 },
    { name: 'skillId', label: 'Skill', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.skills, (s) => s.name) },
    {
      name: 'courseId',
      label: 'Course',
      type: 'select',
      emptyOption: 'None',
      options: (ctx, v) => refOptions(ctx.db.learningCourses.filter((c) => !v.skillId || !c.skillId || c.skillId === v.skillId), (c) => c.title),
    },
    { name: 'topic', label: 'Topic', type: 'text', placeholder: 'What did you work on?', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: (ctx) => ({ date: ctx.today }),
  quickFields: ['date', 'durationMin', 'skillId', 'topic'],
}

export const resourceForm: FormConfig<'resources'> = {
  key: 'resources',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
    { name: 'url', label: 'Link', type: 'url', placeholder: 'https://…', span: 2 },
    { name: 'kind', label: 'Type', type: 'select', options: opts(RESOURCE_KINDS) },
    { name: 'skillId', label: 'Skill', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.skills, (s) => s.name) },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(RESOURCE_STATUSES), span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ kind: 'article', status: 'queued' }),
}
