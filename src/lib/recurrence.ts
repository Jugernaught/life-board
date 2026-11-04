/**
 * Repeating tasks. A rule describes how often; completing a repeating task
 * creates the next occurrence (see store/lifecycle). Pure functions.
 */
import type { RepeatRule } from '@/data/schema'
import { WEEKDAYS } from '@/data/constants'
import { type ISODate, addDaysISO, addMonthsISO, diffDays, parseISODate, toISODate, weekStartISO, weekday } from './dates'

const addYearsISO = (d: ISODate, n: number) => addMonthsISO(d, 12 * n)

/** The first occurrence strictly after `from`. */
export function nextAfter(rule: RepeatRule, from: ISODate): ISODate {
  const n = Math.max(1, rule.interval || 1)
  switch (rule.freq) {
    case 'daily':
      return addDaysISO(from, n)
    case 'weekdays': {
      let d = addDaysISO(from, 1)
      while ([0, 6].includes(weekday(d))) d = addDaysISO(d, 1)
      return d
    }
    case 'weekly': {
      const days = rule.days?.length ? rule.days : []
      if (!days.length) return addDaysISO(from, 7 * n)
      const anchor = weekStartISO(from, 1)
      for (let i = 1; i <= 7 * n + 7; i++) {
        const d = addDaysISO(from, i)
        const weeks = Math.round(diffDays(anchor, weekStartISO(d, 1)) / 7)
        if (days.includes(weekday(d)) && weeks % n === 0) return d
      }
      return addDaysISO(from, 7 * n)
    }
    case 'monthly':
      return addMonthsISO(from, n)
    case 'yearly':
      return addYearsISO(from, n)
  }
}

/**
 * When a repeating task is completed: the next due date, counted from its due
 * date (so "every Monday" stays on Mondays) but never in the past — a daily
 * task finished after a week away comes back tomorrow, not seven times.
 */
export function nextDueDate(rule: RepeatRule, due: ISODate | undefined, today: ISODate): ISODate {
  let next = nextAfter(rule, due ?? today)
  let guard = 0
  while (next <= today && guard++ < 2000) next = nextAfter(rule, next)
  return next
}

/** First occurrence on or after `from` (for a new repeating task without a date). */
export function firstOnOrAfter(rule: RepeatRule, from: ISODate): ISODate {
  if (rule.freq === 'weekdays') return [0, 6].includes(weekday(from)) ? nextAfter(rule, from) : from
  if (rule.freq === 'weekly' && rule.days?.length) return rule.days.includes(weekday(from)) ? from : nextAfter({ ...rule, interval: 1 }, from)
  return from
}

const dayName = (d: number) => WEEKDAYS.find((w) => w.value === d)?.label ?? ''

/** Plain-English description: "Every 2 weeks on Mon, Thu". */
export function describeRepeat(rule: RepeatRule): string {
  const n = rule.interval || 1
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`)
  switch (rule.freq) {
    case 'daily':
      return n === 1 ? 'Every day' : every('day')
    case 'weekdays':
      return 'Every weekday'
    case 'weekly': {
      const days = [...(rule.days ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      const base = every('week')
      if (!days.length) return base
      if (n === 1 && days.length === 1) return `Every ${dayName(days[0])}`
      return `${base} on ${days.map((d) => dayName(d).slice(0, 3)).join(', ')}`
    }
    case 'monthly':
      return every('month')
    case 'yearly':
      return every('year')
  }
}

/** For callers holding a Date. */
export const nextFromDate = (rule: RepeatRule, from: Date) => parseISODate(nextAfter(rule, toISODate(from)))
