import { LIFE_AREAS, type Option } from '@/data/constants'
import { addDaysISO, minutesToTime, timeToMinutes } from '@/lib/dates'
import type { FieldDef, FieldOption, FormContext, Values } from './types'

export const opts = (o: { list: readonly Option[] }): FieldOption[] => o.list.map((x) => ({ value: x.value, label: x.label }))

export const areaField = (def?: Partial<FieldDef>): FieldDef => ({ name: 'area', label: 'Life area', type: 'select', options: opts(LIFE_AREAS), ...def })

export function refOptions<T extends { id: string }>(items: T[], label: (t: T) => string): FieldOption[] {
  return items.map((i) => ({ value: i.id, label: label(i) })).sort((a, b) => a.label.localeCompare(b.label))
}

/** Next full hour from now, for new events. */
export function nextHour(): string {
  const now = new Date()
  return minutesToTime(Math.min(23 * 60, (now.getHours() + 1) * 60))
}

export const plusMinutes = (time: string, minutes: number) => minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(time) + minutes))

export const notBefore = (values: Values, a: string, b: string, message: string) =>
  values[a] && values[b] && String(values[b]) < String(values[a]) ? { [b]: message } : undefined

export const inDays = (ctx: FormContext, n: number) => addDaysISO(ctx.today, n)

/** Drop list rows the person left blank so they don't fail validation. */
export function withoutBlank<T extends Record<string, unknown>>(rows: unknown, key: string): T[] {
  return ((rows as T[]) ?? []).filter((r) => String(r[key] ?? '').trim() !== '').map((r) => ({ ...r, [key]: String(r[key]).trim() }))
}
