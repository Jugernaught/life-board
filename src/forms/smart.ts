/**
 * "Smart title" for new tasks and events: the title is read as natural
 * language ("Dentist tomorrow 3pm !high #health") and the recognised pieces
 * fill in the form when it is saved. Anything the person set explicitly in a
 * field wins over the text, and every recognised piece can be switched off.
 */
import { type ParsedQuick, type TokenKind, parseQuick } from '@/lib/parseQuick'
import { isTime, timeToMinutes } from '@/lib/dates'
import { plusMinutes } from './helpers'
import type { FormContext, Values } from './types'

export interface SmartTitle {
  /** The field that holds the text. */
  field: string
  /** Token kinds this record type can use. */
  kinds: ReadonlySet<TokenKind>
  /** Copy recognised values into the form, skipping fields in `touched`. */
  apply: (values: Values, parsed: ParsedQuick, touched: ReadonlySet<string>) => Values
}

export function parseSmart(text: string, ctx: FormContext, smart: SmartTitle, ignore: ReadonlySet<TokenKind>): ParsedQuick {
  const off = new Set<TokenKind>(ignore)
  for (const k of ['date', 'time', 'priority', 'tag', 'area', 'repeat'] as const) if (!smart.kinds.has(k)) off.add(k)
  const parsed = parseQuick(text, {
    today: ctx.today,
    weekStartsOn: ctx.settings.weekStartsOn,
    dayFirst: ctx.settings.dateFormat !== 'MM/dd/yyyy',
    ignore: off,
  })
  // A time with no date means today.
  if (parsed.dueTime && !parsed.dueDate) parsed.dueDate = ctx.today
  return parsed
}

/** Run the smart title over form values (used on submit). */
export function applySmart(smart: SmartTitle, values: Values, ctx: FormContext, ignore: ReadonlySet<TokenKind>, touched: ReadonlySet<string>): Values {
  const text = values[smart.field]
  if (typeof text !== 'string' || !text.trim()) return values
  const parsed = parseSmart(text, ctx, smart, ignore)
  if (!parsed.tokens.length) return values
  // Never empty the title: "tomorrow" on its own stays as the title.
  const withTitle = { ...values, [smart.field]: parsed.title || text.trim() }
  return smart.apply(withTitle, parsed, touched)
}

const set = (out: Values, touched: ReadonlySet<string>, name: string, v: unknown) => {
  if (v !== undefined && !touched.has(name)) out[name] = v
}

export const taskSmart: SmartTitle = {
  field: 'title',
  kinds: new Set(['date', 'time', 'priority', 'tag', 'area', 'repeat']),
  apply: (values, p, touched) => {
    const out = { ...values }
    set(out, touched, 'dueDate', p.dueDate)
    set(out, touched, 'dueTime', p.dueTime)
    set(out, touched, 'priority', p.priority)
    set(out, touched, 'area', p.area)
    set(out, touched, 'repeat', p.repeat)
    if (p.tags.length && !touched.has('tags')) out.tags = [...new Set([...((out.tags as string[]) ?? []), ...p.tags])]
    return out
  },
}

export const eventSmart: SmartTitle = {
  field: 'title',
  kinds: new Set(['date', 'time', 'priority', 'area']),
  apply: (values, p, touched) => {
    const out = { ...values }
    set(out, touched, 'date', p.dueDate)
    set(out, touched, 'priority', p.priority)
    set(out, touched, 'area', p.area)
    if (p.dueTime && !touched.has('startTime')) {
      // Keep the event's length when its start moves.
      const start = String(values.startTime ?? '')
      const end = String(values.endTime ?? '')
      const length = isTime(start) && isTime(end) ? Math.max(15, timeToMinutes(end) - timeToMinutes(start)) : 60
      out.startTime = p.dueTime
      out.allDay = false
      if (!touched.has('endTime')) out.endTime = plusMinutes(p.dueTime, length)
    }
    return out
  },
}
