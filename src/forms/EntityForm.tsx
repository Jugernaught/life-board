/**
 * Renders a form from a FormConfig and validates it against the record's
 * Zod schema. Every create/edit dialog in Atlas goes through this, so
 * validation and error messages are consistent everywhere.
 */
import { type FormEvent, useId, useMemo, useRef, useState } from 'react'
import { collectionSchemas } from '@/data/schema'
import { currencySymbol, moneyToInput, parseMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Field, Input, NumberInput, Segmented, Select, Switch, Textarea } from '@/components/ui/inputs'
import { ChecklistEditor, ColorSwatches, LevelPicker, ListEditor, RatingInput, ScaleInput, TagInput, WeekdayPicker } from '@/components/ui/pickers'
import { PROFICIENCY_LEVELS } from '@/data/constants'
import type { CheckItem } from '@/data/types'
import type { FieldDef, FormConfig, FormContext, Values } from './types'

const STRINGISH = new Set(['text', 'textarea', 'url', 'date', 'time', 'select', 'segmented'])
const WIDE = new Set(['textarea', 'checklist', 'list', 'tags', 'scale', 'custom', 'weekdays'])

/** Turn form state into a candidate record: blank strings become "not set". */
export function cleanValues(fields: FieldDef[], values: Values): Values {
  const out: Values = { ...values }
  for (const f of fields) {
    const v = out[f.name]
    if (STRINGISH.has(f.type) && typeof v === 'string') {
      const trimmed = f.type === 'textarea' ? v : v.trim()
      out[f.name] = trimmed.trim() === '' ? undefined : trimmed
      if (f.numeric && out[f.name] !== undefined) out[f.name] = Number(out[f.name])
    }
  }
  return out
}

export function validateForm<K extends FormConfig['key']>(config: FormConfig<K>, values: Values, ctx: FormContext): { errors: Record<string, string>; data: Values } {
  let data = cleanValues(config.fields, values)
  if (config.prepare) data = config.prepare(data, ctx)
  const errors: Record<string, string> = {}
  const labels = Object.fromEntries(config.fields.map((f) => [f.name, f.label]))
  const parsed = collectionSchemas[config.key].input.safeParse(data)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? '')
      if (!name || errors[name]) continue
      let message = issue.message
      if (/received undefined/i.test(message)) message = `${labels[name] ?? 'This field'} is required`
      else if (/received NaN/i.test(message)) message = 'Enter a valid number'
      else if (/expected number/i.test(message)) message = 'Enter a number'
      errors[name] = message
    }
  }
  for (const [k, v] of Object.entries(config.validate?.(data, ctx) ?? {})) if (v && !errors[k]) errors[k] = v
  return { errors, data }
}

export interface EntityFormProps {
  config: FormConfig
  initial: Values
  ctx: FormContext
  formId: string
  onSubmit: (data: Values) => void
  /** Only render these fields (Quick Add). */
  only?: string[]
  className?: string
}

export function EntityForm({ config, initial, ctx, formId, onSubmit, only, className }: EntityFormProps) {
  const [values, setValues] = useState<Values>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const root = useRef<HTMLFormElement>(null)
  const baseId = useId()

  const fields = useMemo(() => config.fields.filter((f) => !only || only.includes(f.name)), [config.fields, only])
  const visible = fields.filter((f) => !f.visible || f.visible(values))

  const setValue = (name: string, v: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [name]: v }
      if (submitted) setErrors(validateForm(config, next, ctx).errors)
      return next
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSubmitted(true)
    const { errors: errs, data } = validateForm(config, values, ctx)
    // Ignore errors for fields that aren't on screen (they keep their stored value).
    const shown = new Set(visible.map((f) => f.name))
    const relevant = Object.fromEntries(Object.entries(errs).filter(([k]) => shown.has(k) || !config.fields.some((f) => f.name === k)))
    setErrors(relevant)
    if (Object.keys(relevant).length) {
      const first = Object.keys(relevant)[0]
      const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(`${baseId}-${first}`) : `${baseId}-${first}`.replace(/[^\w-]/g, '\\$&')
      const el = root.current?.querySelector<HTMLElement>(`[name="${first}"], #${safeId}`)
      el?.focus()
      return
    }
    onSubmit(data)
  }

  return (
    <form ref={root} id={formId} onSubmit={submit} noValidate className={cn('grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2', className)}>
      {visible.map((f, i) => (
        <FieldRenderer
          key={f.name}
          field={f}
          id={`${baseId}-${f.name}`}
          value={values[f.name]}
          values={values}
          error={errors[f.name]}
          ctx={ctx}
          autoFocus={f.autoFocus ?? i === 0}
          onChange={(v) => setValue(f.name, v)}
          setValue={setValue}
        />
      ))}
      {errors._form && <p className="text-sm text-bad sm:col-span-2">{errors._form}</p>}
      {/* Enter key submits even when the submit button lives in the modal footer. */}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  )
}

function FieldRenderer({
  field: f,
  id,
  value,
  values,
  error,
  ctx,
  autoFocus,
  onChange,
  setValue,
}: {
  field: FieldDef
  id: string
  value: unknown
  values: Values
  error?: string
  ctx: FormContext
  autoFocus?: boolean
  onChange: (v: unknown) => void
  setValue: (name: string, v: unknown) => void
}) {
  const span = f.span ?? (WIDE.has(f.type) ? 2 : 1)
  const options = typeof f.options === 'function' ? f.options(ctx, values) : (f.options ?? [])
  const describedBy = error ? `${id}-error` : undefined
  const common = { id, name: f.name, 'aria-describedby': describedBy, invalid: !!error }
  const currency = ctx.settings.currency
  const suggestions = f.suggestions?.(ctx, values) ?? []
  const listId = suggestions.length ? `${id}-list` : undefined

  let control: React.ReactNode
  switch (f.type) {
    case 'text':
    case 'url':
      control = (
        <>
          <Input
            {...common}
            type={f.type === 'url' ? 'url' : 'text'}
            inputMode={f.type === 'url' ? 'url' : undefined}
            value={(value as string) ?? ''}
            placeholder={f.placeholder}
            autoFocus={autoFocus}
            list={listId}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
          />
          {listId && (
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )
      break
    case 'textarea':
      control = <Textarea {...common} value={(value as string) ?? ''} rows={f.rows ?? 3} placeholder={f.placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
      break
    case 'number':
      control = (
        <NumberInput
          {...common}
          value={value as number | undefined}
          onChange={onChange}
          placeholder={f.placeholder}
          min={f.min}
          max={f.max}
          step={f.step}
          autoFocus={autoFocus}
          trailing={f.unit ? <span className="pr-1 text-[12px]">{f.unit}</span> : undefined}
        />
      )
      break
    case 'money':
      control = (
        <NumberInput
          {...common}
          value={value as number | undefined}
          onChange={onChange}
          parse={(t) => parseMoney(t, currency)}
          format={(v) => moneyToInput(v, currency)}
          placeholder={f.placeholder ?? '0.00'}
          autoFocus={autoFocus}
          leading={<span className="text-[13px]">{currencySymbol(currency)}</span>}
        />
      )
      break
    case 'date':
      control = <Input {...common} type="date" value={(value as string) ?? ''} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
      break
    case 'time':
      control = <Input {...common} type="time" value={(value as string) ?? ''} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
      break
    case 'select':
      control = (
        <Select {...common} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}>
          {(f.emptyOption !== undefined || value === undefined || value === '') && <option value="">{f.emptyOption ?? 'Select…'}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )
      break
    case 'segmented':
      control = <Segmented value={(value as string) ?? ''} onChange={onChange} options={options} ariaLabel={f.label} fullWidth />
      break
    case 'rating':
      control = <RatingInput value={value as number | undefined} onChange={onChange} label={f.label} />
      break
    case 'scale':
      control = <ScaleInput value={value as number | undefined} onChange={onChange} options={f.scale ?? []} label={f.label} />
      break
    case 'tags':
      control = <TagInput value={(value as string[]) ?? []} onChange={onChange} placeholder={f.placeholder} suggestions={suggestions} />
      break
    case 'checklist':
      control = <ChecklistEditor value={(value as CheckItem[]) ?? []} onChange={onChange} placeholder={f.placeholder} />
      break
    case 'list':
      control = <ListEditor value={(value as string[]) ?? []} onChange={onChange} placeholder={f.placeholder} />
      break
    case 'weekdays':
      control = <WeekdayPicker value={(value as number[]) ?? []} onChange={onChange} weekStartsOn={ctx.settings.weekStartsOn} />
      break
    case 'color':
      control = <ColorSwatches value={value as string} onChange={onChange} />
      break
    case 'switch':
      return (
        <div className={cn('flex items-center', span === 2 && 'sm:col-span-2')}>
          <div className="w-full rounded-lg border border-line bg-panel-2/40 px-3 py-2.5">
            <Switch id={id} checked={!!value} onChange={onChange} label={f.label} description={f.hint} />
          </div>
        </div>
      )
    case 'level':
      control = <LevelPicker value={(value as number) ?? f.min ?? 0} onChange={onChange} min={f.min} labels={PROFICIENCY_LEVELS} />
      break
    case 'custom':
      control = f.render?.({ value, onChange, values, setValue, error, ctx, id })
      break
  }

  return (
    <Field label={f.label} htmlFor={id} hint={f.hint} error={error} required={f.required} className={cn(span === 2 && 'sm:col-span-2')}>
      {control}
    </Field>
  )
}
