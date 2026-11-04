import type { ReactNode } from 'react'
import type { CollectionKey, Database, InputOf, Settings } from '@/data/types'

export interface FormContext {
  db: Database
  settings: Settings
  today: string
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'money'
  | 'date'
  | 'time'
  | 'select'
  | 'segmented'
  | 'rating'
  | 'scale'
  | 'tags'
  | 'checklist'
  | 'list'
  | 'weekdays'
  | 'color'
  | 'switch'
  | 'level'
  | 'custom'

export interface FieldOption {
  value: string
  label: string
}

export type Values = Record<string, unknown>

export interface CustomFieldProps {
  value: unknown
  onChange: (v: unknown) => void
  values: Values
  setValue: (name: string, v: unknown) => void
  error?: string
  ctx: FormContext
  id: string
}

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  hint?: ReactNode
  required?: boolean
  options?: readonly FieldOption[] | ((ctx: FormContext, values: Values) => readonly FieldOption[])
  /** Label for an empty choice in selects (makes the field optional). */
  emptyOption?: string
  scale?: readonly { value: number; label: string; emoji?: string }[]
  min?: number
  max?: number
  step?: number
  rows?: number
  unit?: string
  /** 2 = full width on desktop. Text areas and lists default to 2. */
  span?: 1 | 2
  visible?: (values: Values) => boolean
  suggestions?: (ctx: FormContext, values: Values) => string[]
  autoFocus?: boolean
  /** For selects whose options are numbers (stored as numbers, shown as strings). */
  numeric?: boolean
  render?: (props: CustomFieldProps) => ReactNode
}

export interface FormConfig<K extends CollectionKey = CollectionKey> {
  key: K
  fields: FieldDef[]
  /** Values for a brand-new record. */
  defaults?: (ctx: FormContext) => Partial<InputOf<K>> & Values
  /** Cross-field checks; return { fieldName: message }. */
  validate?: (values: Values, ctx: FormContext) => Partial<Record<string, string>> | undefined
  /** Adjust values just before saving (e.g. clear times for all-day events). */
  prepare?: (values: Values, ctx: FormContext) => Values
  /** Field names shown in Quick Add. */
  quickFields?: string[]
  size?: 'md' | 'lg'
  /** Override modal titles. */
  createTitle?: string
}
