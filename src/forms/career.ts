import {
  APPLICATION_STATUSES,
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  CAREER_MILESTONE_KINDS,
  CAREER_PATH_STATUSES,
  MODULE_STATUSES,
  PROGRESS_STATUSES,
  QUALIFICATION_KINDS,
  QUESTION_CATEGORIES,
} from '@/data/constants'
import { ScoresEditor } from './customFields'
import { notBefore, opts, refOptions } from './helpers'
import type { FormConfig } from './types'

export const careerPathForm: FormConfig<'careerPaths'> = {
  key: 'careerPaths',
  size: 'lg',
  fields: [
    { name: 'name', label: 'Path name', type: 'text', required: true, placeholder: 'e.g. Software engineering, Product design' },
    { name: 'targetRole', label: 'Target role', type: 'text', placeholder: 'e.g. Senior engineer at a fintech' },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(CAREER_PATH_STATUSES), span: 2 },
    { name: 'targetDate', label: 'Target date', type: 'date' },
    { name: 'color', label: 'Colour', type: 'color' },
    { name: 'description', label: 'Why this path?', type: 'textarea' },
    { name: 'roadmap', label: 'Roadmap', type: 'checklist', placeholder: 'Add a roadmap step', hint: 'Long-term steps, in order. Drag to reorder.' },
    { name: 'scores', label: 'Comparison scores', type: 'custom', render: ScoresEditor, span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ status: 'exploring', color: 'cyan', roadmap: [], scores: {} }),
  quickFields: ['name', 'targetRole', 'status'],
}

export const qualificationForm: FormConfig<'qualifications'> = {
  key: 'qualifications',
  fields: [
    { name: 'title', label: 'Qualification', type: 'text', required: true, placeholder: 'e.g. AWS Solutions Architect', span: 2 },
    { name: 'institution', label: 'Awarding body / institution', type: 'text' },
    { name: 'kind', label: 'Type', type: 'select', options: opts(QUALIFICATION_KINDS) },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(PROGRESS_STATUSES), span: 2 },
    { name: 'startDate', label: 'Started', type: 'date' },
    { name: 'completionDate', label: 'Completed / expected', type: 'date' },
    { name: 'grade', label: 'Grade / result', type: 'text' },
    { name: 'credentialUrl', label: 'Credential link', type: 'url', placeholder: 'https://…' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ kind: 'certificate', status: 'planned' }),
  validate: (v) => notBefore(v, 'startDate', 'completionDate', 'Completion must be on or after the start date'),
}

export const academicCourseForm: FormConfig<'academicCourses'> = {
  key: 'academicCourses',
  fields: [
    { name: 'name', label: 'Course', type: 'text', required: true, placeholder: 'e.g. BSc Computer Science', span: 2 },
    { name: 'institution', label: 'Institution', type: 'text' },
    { name: 'level', label: 'Level', type: 'text', placeholder: 'e.g. Undergraduate, Year 2' },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(PROGRESS_STATUSES), span: 2 },
    { name: 'startDate', label: 'Start', type: 'date' },
    { name: 'endDate', label: 'End', type: 'date' },
    { name: 'targetGrade', label: 'Target average', type: 'number', unit: '%', min: 0, max: 100 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ status: 'in_progress' }),
  validate: (v) => notBefore(v, 'startDate', 'endDate', 'End must be on or after the start date'),
}

export const moduleForm: FormConfig<'modules'> = {
  key: 'modules',
  fields: [
    { name: 'name', label: 'Module / subject', type: 'text', required: true, span: 2 },
    { name: 'code', label: 'Code', type: 'text', placeholder: 'e.g. CS204' },
    { name: 'courseId', label: 'Course', type: 'select', emptyOption: 'No course', options: (ctx) => refOptions(ctx.db.academicCourses, (c) => c.name) },
    { name: 'term', label: 'Term / semester', type: 'text', placeholder: 'e.g. Autumn 2026' },
    { name: 'credits', label: 'Credits', type: 'number', min: 0 },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(MODULE_STATUSES), span: 2 },
    { name: 'targetGrade', label: 'Target grade', type: 'number', unit: '%', min: 0, max: 100 },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ status: 'in_progress' }),
}

export const assessmentForm: FormConfig<'assessments'> = {
  key: 'assessments',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Essay 1, Final exam', span: 2 },
    { name: 'kind', label: 'Type', type: 'select', options: opts(ASSESSMENT_KINDS) },
    { name: 'moduleId', label: 'Module', type: 'select', emptyOption: 'No module', options: (ctx) => refOptions(ctx.db.modules, (m) => (m.code ? `${m.code} · ${m.name}` : m.name)) },
    { name: 'dueDate', label: 'Due / exam date', type: 'date', required: true },
    { name: 'dueTime', label: 'Time', type: 'time' },
    { name: 'weight', label: 'Weight', type: 'number', unit: '%', min: 0, max: 100, hint: 'Share of the module grade' },
    { name: 'status', label: 'Status', type: 'select', options: opts(ASSESSMENT_STATUSES) },
    { name: 'score', label: 'Mark achieved', type: 'number', unit: '%', min: 0, max: 100, visible: (v) => v.status === 'graded', hint: 'Used for grade tracking' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: (ctx) => ({ kind: 'assignment', status: 'not_started', dueDate: ctx.today }),
  prepare: (v) => (v.status === 'graded' ? v : { ...v, score: undefined }),
  validate: (v) => (v.status === 'graded' && (v.score === undefined || v.score === null) ? { score: 'Enter the mark to record this as graded' } : undefined),
  quickFields: ['title', 'kind', 'moduleId', 'dueDate'],
}

export const applicationForm: FormConfig<'applications'> = {
  key: 'applications',
  size: 'lg',
  fields: [
    { name: 'company', label: 'Company', type: 'text', required: true, suggestions: (ctx) => ctx.db.companies.map((c) => c.name) },
    { name: 'role', label: 'Role', type: 'text', required: true },
    { name: 'status', label: 'Status', type: 'select', options: opts(APPLICATION_STATUSES) },
    { name: 'appliedDate', label: 'Applied on', type: 'date' },
    { name: 'nextStep', label: 'Next step', type: 'text', placeholder: 'e.g. Technical interview' },
    { name: 'nextStepDate', label: 'Next step date', type: 'date' },
    { name: 'location', label: 'Location', type: 'text', placeholder: 'e.g. London / Remote' },
    { name: 'salary', label: 'Salary / rate', type: 'text', placeholder: 'e.g. £45–55k' },
    { name: 'url', label: 'Job listing', type: 'url', placeholder: 'https://…' },
    { name: 'careerPathId', label: 'Career path', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.careerPaths, (p) => p.name) },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ status: 'wishlist', statusHistory: [] }),
  quickFields: ['company', 'role', 'status', 'appliedDate'],
}

export const companyForm: FormConfig<'companies'> = {
  key: 'companies',
  size: 'lg',
  fields: [
    { name: 'name', label: 'Company', type: 'text', required: true },
    { name: 'industry', label: 'Industry', type: 'text' },
    { name: 'website', label: 'Website', type: 'url', placeholder: 'https://…' },
    { name: 'location', label: 'Location', type: 'text' },
    { name: 'interest', label: 'Your interest', type: 'rating' },
    { name: 'research', label: 'Research notes', type: 'textarea', rows: 5, placeholder: 'Products, mission, recent news, team, culture…' },
    { name: 'pros', label: 'Pros', type: 'textarea', rows: 2, span: 1 },
    { name: 'cons', label: 'Cons', type: 'textarea', rows: 2, span: 1 },
  ],
}

export const interviewQuestionForm: FormConfig<'interviewQuestions'> = {
  key: 'interviewQuestions',
  fields: [
    { name: 'question', label: 'Question', type: 'text', required: true, placeholder: 'e.g. Tell me about a time you led a project', span: 2 },
    { name: 'category', label: 'Category', type: 'select', options: opts(QUESTION_CATEGORIES) },
    { name: 'applicationId', label: 'For application', type: 'select', emptyOption: 'General', options: (ctx) => refOptions(ctx.db.applications, (a) => `${a.company} — ${a.role}`) },
    { name: 'answer', label: 'Your answer / notes', type: 'textarea', rows: 6, placeholder: 'Situation, Task, Action, Result…' },
    { name: 'confidence', label: 'Confidence', type: 'rating' },
  ],
  defaults: () => ({ category: 'behavioural', practiceCount: 0 }),
}

export const careerMilestoneForm: FormConfig<'careerMilestones'> = {
  key: 'careerMilestones',
  fields: [
    { name: 'title', label: 'Milestone', type: 'text', required: true, placeholder: 'e.g. Update CV with new project', span: 2 },
    { name: 'kind', label: 'Type', type: 'select', options: opts(CAREER_MILESTONE_KINDS) },
    { name: 'dueDate', label: 'Target date', type: 'date' },
    { name: 'careerPathId', label: 'Career path', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.careerPaths, (p) => p.name) },
    { name: 'done', label: 'Completed', type: 'switch' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  defaults: () => ({ kind: 'cv', done: false }),
}
