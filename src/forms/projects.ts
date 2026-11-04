import { PRIORITIES, PROJECT_KINDS, PROJECT_STATUSES } from '@/data/constants'
import { ResourcesEditor } from './customFields'
import { areaField, notBefore, opts, withoutBlank } from './helpers'
import type { FormConfig } from './types'

export const projectForm: FormConfig<'projects'> = {
  key: 'projects',
  size: 'lg',
  fields: [
    { name: 'name', label: 'Project name', type: 'text', required: true, span: 2 },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'What is this project and why does it matter?' },
    { name: 'status', label: 'Status', type: 'segmented', options: opts(PROJECT_STATUSES), span: 2 },
    { name: 'kind', label: 'Type', type: 'select', options: opts(PROJECT_KINDS) },
    { name: 'priority', label: 'Priority', type: 'select', options: opts(PRIORITIES) },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'deadline', label: 'Deadline', type: 'date' },
    areaField(),
    { name: 'color', label: 'Colour', type: 'color' },
    { name: 'objectives', label: 'Objectives', type: 'checklist', placeholder: 'Add an objective', hint: 'What does success look like?' },
    { name: 'milestones', label: 'Milestones', type: 'checklist', placeholder: 'Add a milestone' },
    { name: 'resources', label: 'Resources & links', type: 'custom', render: ResourcesEditor, span: 2 },
  ],
  defaults: () => ({ status: 'planning', kind: 'personal', priority: 'medium', area: 'business', color: 'cyan', objectives: [], milestones: [], resources: [] }),
  prepare: (v) => ({ ...v, resources: withoutBlank(v.resources, 'title') }),
  validate: (v) => notBefore(v, 'startDate', 'deadline', 'Deadline must be on or after the start date'),
  quickFields: ['name', 'description', 'status', 'deadline'],
}
