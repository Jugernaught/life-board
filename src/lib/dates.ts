/**
 * Date helpers.
 *
 * Calendar dates (due dates, journal days, workouts …) are stored as local
 * `yyyy-MM-dd` strings, never as timestamps. That way a deadline on the 5th
 * stays on the 5th regardless of time zone or daylight-saving changes.
 * Moments in time (createdAt, completedAt …) are stored as ISO timestamps.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export type ISODate = string // yyyy-MM-dd
export type WeekStart = 0 | 1 // Sunday | Monday

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false
  const d = parseISODate(value)
  return isValid(d) && toISODate(d) === value
}

export const todayISO = (): ISODate => toISODate(new Date())

export const addDaysISO = (value: ISODate, days: number): ISODate => toISODate(addDays(parseISODate(value), days))

export const addMonthsISO = (value: ISODate, months: number): ISODate => toISODate(addMonths(parseISODate(value), months))

/** Calendar days from `a` to `b` (positive when `b` is later). */
export const diffDays = (a: ISODate, b: ISODate): number => differenceInCalendarDays(parseISODate(b), parseISODate(a))

export const weekStartISO = (value: ISODate, weekStartsOn: WeekStart): ISODate =>
  toISODate(startOfWeek(parseISODate(value), { weekStartsOn }))

export const monthStartISO = (value: ISODate): ISODate => toISODate(startOfMonth(parseISODate(value)))
export const monthEndISO = (value: ISODate): ISODate => toISODate(endOfMonth(parseISODate(value)))

/** `yyyy-MM` key for grouping by month. */
export const monthKey = (value: ISODate | string): string => value.slice(0, 7)

/** Inclusive list of dates between two ISO dates. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  const total = diffDays(start, end)
  if (total < 0) return out
  const first = parseISODate(start)
  for (let i = 0; i <= total; i++) out.push(toISODate(addDays(first, i)))
  return out
}

/** Inclusive list of `yyyy-MM` keys between two dates. */
export function eachMonth(start: ISODate, end: ISODate): string[] {
  const out: string[] = []
  let cursor = startOfMonth(parseISODate(start))
  const last = startOfMonth(parseISODate(end))
  while (cursor <= last) {
    out.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }
  return out
}

/** Weekday 0 (Sun) – 6 (Sat) of an ISO date. */
export const weekday = (value: ISODate): number => parseISODate(value).getDay()

export const isBetween = (value: ISODate, start: ISODate, end: ISODate) => value >= start && value <= end

/** Local calendar date of an ISO timestamp. */
export const dateOfTimestamp = (timestamp: string): ISODate => toISODate(new Date(timestamp))

export const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd MMM yyyy'] as const
export type DateFormat = (typeof DATE_FORMATS)[number]

export function formatDate(value: ISODate | undefined, pattern: DateFormat | string = 'd MMM yyyy'): string {
  if (!value) return ''
  const d = isISODate(value) ? parseISODate(value) : new Date(value)
  if (!isValid(d)) return value
  return format(d, pattern)
}

export function formatMonthKey(key: string, pattern = 'MMM yyyy'): string {
  const d = parse(`${key}-01`, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, pattern) : key
}

/** Human description of how far a date is from today: "Today", "Tomorrow", "In 3 days", "2 days ago". */
export function relativeDay(value: ISODate, today: ISODate = todayISO()): string {
  const delta = diffDays(today, value)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return `In ${delta} days`
  if (delta < -1 && delta > -7) return `${-delta} days ago`
  if (delta >= 7 && delta < 28) return `In ${Math.round(delta / 7)} wk`
  if (delta <= -7 && delta > -28) return `${Math.round(-delta / 7)} wk ago`
  return formatDate(value, 'd MMM yyyy')
}

// ---------------------------------------------------------------- times ---

export const isTime = (value: unknown): value is string => typeof value === 'string' && TIME_RE.test(value)

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export type TimeFormat = '24h' | '12h'

export function formatTime(value: string | undefined, mode: TimeFormat = '24h'): string {
  if (!value || !isTime(value)) return value ?? ''
  if (mode === '24h') return value
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

export const nowTime = (): string => format(new Date(), 'HH:mm')

/**
 * Minutes between two clock times; when `end` is earlier than `start` the
 * span is assumed to cross midnight (e.g. sleep from 23:30 to 07:00).
 */
export function spanMinutes(start: string, end: string): number {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  return e >= s ? e - s : 1440 - s + e
}

/** Next calendar occurrence of a yearly date (birthdays, anniversaries). */
export function nextYearlyOccurrence(value: ISODate, from: ISODate = todayISO()): ISODate {
  const [, m, d] = value.split('-').map(Number)
  const year = Number(from.slice(0, 4))
  const make = (y: number) => {
    // 29 Feb falls back to 28 Feb in non-leap years.
    const day = m === 2 && d === 29 && !isLeapYear(y) ? 28 : d
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const thisYear = make(year)
  return thisYear >= from ? thisYear : make(year + 1)
}

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
