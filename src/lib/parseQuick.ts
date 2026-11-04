/**
 * Natural-language quick add: "Dentist tomorrow 3pm !high #health every month".
 *
 * Recognises dates, times, priority, #tags, @areas and repeat rules, and
 * returns the remaining words as the title. Every recognised piece is a token
 * the person can switch off (it then stays in the title). Pure; no dependency.
 */
import type { LifeArea, Priority } from '@/data/constants'
import type { RepeatRule } from '@/data/schema'
import { type ISODate, type WeekStart, addDaysISO, addMonthsISO, monthStartISO, parseISODate, toISODate, weekStartISO, weekday } from './dates'
import { firstOnOrAfter } from './recurrence'

export type TokenKind = 'date' | 'time' | 'priority' | 'tag' | 'area' | 'repeat'

export interface QuickToken {
  kind: TokenKind
  /** The text it came from. */
  raw: string
}

export interface ParsedQuick {
  title: string
  dueDate?: ISODate
  dueTime?: string
  priority?: Priority
  tags: string[]
  area?: LifeArea
  repeat?: RepeatRule
  tokens: QuickToken[]
}

export interface ParseOptions {
  today: ISODate
  weekStartsOn?: WeekStart
  /** Read 05/11 as 5 November (true) or May 11 (false). */
  dayFirst?: boolean
  /** Token kinds to leave in the title. */
  ignore?: ReadonlySet<TokenKind>
}

const DAYS: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 }
const MONTHS: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 }
const AREAS: Record<string, LifeArea> = {
  career: 'career', work: 'career', study: 'career', uni: 'career', education: 'career',
  business: 'business', project: 'business', projects: 'business',
  finance: 'finance', money: 'finance',
  health: 'health', fitness: 'health', gym: 'health',
  learning: 'learning', learn: 'learning', skills: 'learning',
  wellbeing: 'wellbeing', mind: 'wellbeing',
  social: 'social', friends: 'social', family: 'social',
  culture: 'culture', reading: 'culture', media: 'culture',
  personal: 'personal', home: 'personal',
}
const PRIORITY_WORDS: Record<string, Priority> = { urgent: 'urgent', high: 'high', medium: 'medium', med: 'medium', normal: 'medium', low: 'low' }

const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)'
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const valid = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
/** Month/day without a year: this year, or next year if already past. */
const upcoming = (m: number, d: number, today: ISODate): ISODate | undefined => {
  const y = Number(today.slice(0, 4))
  if (!valid(y, m, d)) return valid(y + 1, m, d) ? iso(y + 1, m, d) : undefined
  const date = iso(y, m, d)
  return date < today ? (valid(y + 1, m, d) ? iso(y + 1, m, d) : undefined) : date
}
/** Next occurrence of a weekday, today included. */
const onOrAfter = (dow: number, today: ISODate) => addDaysISO(today, (dow - weekday(today) + 7) % 7)

interface Rule {
  kind: TokenKind
  re: RegExp
  apply: (m: RegExpMatchArray, out: ParsedQuick, o: Required<Omit<ParseOptions, 'ignore'>>) => boolean
}

const time24 = (h: number, min: number) => (h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${pad(h)}:${pad(min)}` : undefined)

const RULES: Rule[] = [
  // ---------------------------------------------------------- repeat first
  {
    kind: 'repeat',
    re: /\bevery\s+(\d{1,3})\s+(day|week|month|year)s?\b/i,
    apply: (m, out) => {
      const unit = m[2].toLowerCase()
      out.repeat = { freq: unit === 'day' ? 'daily' : unit === 'week' ? 'weekly' : unit === 'month' ? 'monthly' : 'yearly', interval: Number(m[1]), days: [] }
      return true
    },
  },
  {
    kind: 'repeat',
    re: new RegExp(`\\bevery\\s+${DAY_RE}s?(?:\\s*(?:,|and|&)\\s*${DAY_RE}s?)*\\b`, 'i'),
    apply: (m, out) => {
      const days = [...m[0].matchAll(new RegExp(DAY_RE, 'gi'))].map((x) => DAYS[x[1].toLowerCase()]).filter((d) => d !== undefined)
      out.repeat = { freq: 'weekly', interval: 1, days: [...new Set(days)] }
      return true
    },
  },
  {
    kind: 'repeat',
    re: /\b(every\s+(?:day|weekday|week|month|year)|daily|weekdays|weekly|monthly|yearly|annually)\b/i,
    apply: (m, out) => {
      const w = m[1].toLowerCase().replace(/^every\s+/, '')
      const freq = w.startsWith('weekday') ? 'weekdays' : w === 'day' || w === 'daily' ? 'daily' : w === 'week' || w === 'weekly' ? 'weekly' : w === 'month' || w === 'monthly' ? 'monthly' : 'yearly'
      out.repeat = { freq, interval: 1, days: [] }
      return true
    },
  },
  // ------------------------------------------------------------------ time
  {
    kind: 'time',
    re: /\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i,
    apply: (m, out) => {
      let h = Number(m[1])
      if (h < 1 || h > 12) return false
      const pm = m[3].toLowerCase() === 'pm'
      if (h === 12) h = pm ? 12 : 0
      else if (pm) h += 12
      const t = time24(h, Number(m[2] ?? 0))
      if (!t) return false
      out.dueTime = t
      return true
    },
  },
  {
    kind: 'time',
    re: /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/,
    apply: (m, out) => {
      const t = time24(Number(m[1]), Number(m[2]))
      if (!t) return false
      out.dueTime = t
      return true
    },
  },
  {
    kind: 'time',
    re: /\b(noon|midday|midnight)\b/i,
    apply: (m, out) => {
      out.dueTime = m[1].toLowerCase() === 'midnight' ? '00:00' : '12:00'
      return true
    },
  },
  {
    kind: 'time',
    re: /\bat\s+([01]?\d|2[0-3])\b(?![:/.-]\d)/i,
    apply: (m, out) => {
      out.dueTime = time24(Number(m[1]), 0)
      return !!out.dueTime
    },
  },
  // ------------------------------------------------------------------ date
  {
    kind: 'date',
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    apply: (m, out) => {
      if (!valid(+m[1], +m[2], +m[3])) return false
      out.dueDate = iso(+m[1], +m[2], +m[3])
      return true
    },
  },
  {
    kind: 'date',
    re: /\b(?:on\s+)?(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/,
    apply: (m, out, o) => {
      const [a, b] = [Number(m[1]), Number(m[2])]
      const [d, mo] = o.dayFirst ? [a, b] : [b, a]
      if (m[3]) {
        const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
        if (!valid(y, mo, d)) return false
        out.dueDate = iso(y, mo, d)
        return true
      }
      const date = upcoming(mo, d, o.today)
      if (!date) return false
      out.dueDate = date
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:\\s+(\\d{4}))?`, 'i'),
    apply: (m, out, o) => {
      const d = Number(m[1])
      const mo = MONTHS[m[2].toLowerCase()]
      const date = m[3] ? (valid(+m[3], mo, d) ? iso(+m[3], mo, d) : undefined) : upcoming(mo, d, o.today)
      if (!date) return false
      out.dueDate = date
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`\\b(?:on\\s+)?${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i'),
    apply: (m, out, o) => {
      const mo = MONTHS[m[1].toLowerCase()]
      const d = Number(m[2])
      const date = m[3] ? (valid(+m[3], mo, d) ? iso(+m[3], mo, d) : undefined) : upcoming(mo, d, o.today)
      if (!date) return false
      out.dueDate = date
      return true
    },
  },
  {
    kind: 'date',
    re: /\bin\s+(\d{1,3}|a|an|one|two|three)\s+(day|week|month)s?\b/i,
    apply: (m, out, o) => {
      const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 }
      const n = words[m[1].toLowerCase()] ?? Number(m[1])
      const unit = m[2].toLowerCase()
      out.dueDate = unit === 'day' ? addDaysISO(o.today, n) : unit === 'week' ? addDaysISO(o.today, 7 * n) : addMonthsISO(o.today, n)
      return true
    },
  },
  {
    kind: 'date',
    re: /\b(today|tonight|tod|tomorrow|tmrw?|day after tomorrow)\b/i,
    apply: (m, out, o) => {
      const w = m[1].toLowerCase()
      out.dueDate = w === 'day after tomorrow' ? addDaysISO(o.today, 2) : w.startsWith('to') && w !== 'tomorrow' ? o.today : addDaysISO(o.today, 1)
      if (w === 'tonight' && !out.dueTime) out.dueTime = '19:00'
      return true
    },
  },
  {
    kind: 'date',
    re: /\b(next\s+week|this\s+weekend|next\s+weekend|weekend|next\s+month|end\s+of\s+(?:the\s+)?(?:week|month))\b/i,
    apply: (m, out, o) => {
      const w = m[1].toLowerCase().replace(/\s+/g, ' ')
      const nextWeek = addDaysISO(weekStartISO(o.today, o.weekStartsOn), 7)
      if (w === 'next week') out.dueDate = nextWeek
      else if (w === 'next month') out.dueDate = monthStartISO(addMonthsISO(o.today, 1))
      else if (w.startsWith('end of')) out.dueDate = w.endsWith('month') ? toISODate(new Date(parseISODate(o.today).getFullYear(), parseISODate(o.today).getMonth() + 1, 0)) : onOrAfter(5, o.today)
      else {
        const sat = onOrAfter(6, o.today)
        out.dueDate = w === 'next weekend' ? addDaysISO(sat, 7) : sat
      }
      return true
    },
  },
  {
    kind: 'date',
    re: new RegExp(`\\b(?:(next|this|on)\\s+)?${DAY_RE}\\b`, 'i'),
    apply: (m, out, o) => {
      // "sun" and "sat" are ordinary words ("sun cream") unless clearly a day.
      if (!m[1] && ['sun', 'sat'].includes(m[2].toLowerCase())) return false
      const dow = DAYS[m[2].toLowerCase()]
      let date = onOrAfter(dow, o.today)
      if (m[1]?.toLowerCase() === 'next') {
        if (date === o.today) date = addDaysISO(date, 7)
        // "next Friday" on a Monday means the Friday of next week.
        if (weekStartISO(date, o.weekStartsOn) === weekStartISO(o.today, o.weekStartsOn)) date = addDaysISO(date, 7)
      }
      out.dueDate = date
      return true
    },
  },
  // -------------------------------------------------- priority, tag, area
  {
    kind: 'priority',
    re: /(?:^|\s)(!{1,3}|!(urgent|high|medium|med|normal|low)|p([1-4]))(?=\s|$)/i,
    apply: (m, out) => {
      if (m[2]) out.priority = PRIORITY_WORDS[m[2].toLowerCase()]
      else if (m[3]) out.priority = (['urgent', 'high', 'medium', 'low'] as const)[Number(m[3]) - 1]
      else out.priority = m[1].length >= 3 ? 'urgent' : 'high'
      return true
    },
  },
  {
    kind: 'area',
    re: /(?:^|\s)@([a-z]+)(?=\s|$)/i,
    apply: (m, out) => {
      const a = AREAS[m[1].toLowerCase()]
      if (!a) return false
      out.area = a
      return true
    },
  },
]

const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]{1,40})(?=\s|$)/gu

export function parseQuick(input: string, opts: ParseOptions): ParsedQuick {
  const o = { today: opts.today, weekStartsOn: opts.weekStartsOn ?? 1, dayFirst: opts.dayFirst ?? true }
  const ignore = opts.ignore ?? new Set<TokenKind>()
  const out: ParsedQuick = { title: '', tags: [], tokens: [] }
  let text = ` ${input} `
  const take = (raw: string, kind: TokenKind) => {
    out.tokens.push({ kind, raw: raw.trim() })
    text = text.replace(raw, ' ')
  }
  for (const rule of RULES) {
    if (ignore.has(rule.kind)) continue
    // Only one token of each kind (the first match wins).
    if (out.tokens.some((t) => t.kind === rule.kind)) continue
    const m = text.match(rule.re)
    if (m && rule.apply(m, out, o)) take(m[0], rule.kind)
  }
  if (!ignore.has('tag')) {
    for (const m of [...text.matchAll(TAG_RE)]) {
      out.tags.push(m[1])
      take(m[0], 'tag')
    }
  }
  // A repeat with no date starts at its first occurrence.
  if (out.repeat && !out.dueDate) out.dueDate = firstOnOrAfter(out.repeat, o.today)
  out.title = text.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^[\s,;:-]+|[\s,;:-]+$/g, '').trim()
  return out
}
