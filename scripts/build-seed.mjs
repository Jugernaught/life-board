#!/usr/bin/env node
/**
 * Build a LIFE OS backup file from a hand-written profile.
 *
 *   node scripts/build-seed.mjs [--in private/profile.json] [--out private/life-os-seed.json] [--today YYYY-MM-DD]
 *
 * The output is an ordinary LIFE OS backup, so it is loaded through the app's
 * normal Settings → Data & backups → Import flow, which validates every record
 * first. Nothing here runs inside the app, and the app never loads it on its
 * own: a new install still starts empty.
 *
 * This file holds no personal data. Your profile lives in `private/`, which is
 * git-ignored. See "Preloading your own data" in the README for the profile
 * format.
 *
 * Design notes:
 *  - Ids are stable (`seed-<collection>-<key>`), so importing a rebuilt seed
 *    with Merge updates the seeded records instead of duplicating them.
 *  - Money in the profile is in major units (pounds); the app stores minor
 *    units (pence).
 *  - The app's calendar has no repeat rule, so a weekly timetable is written
 *    out as one event per slot per week of term.
 *  - Recurring finance items have no end date in the app, so an end date or a
 *    remaining-payment count goes into the item's notes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Must match SCHEMA_VERSION in src/data/schema.ts (a unit test checks this). */
export const SEED_SCHEMA_VERSION = 1

/**
 * Allowed values, mirrored from src/data/constants.ts (this script can't
 * import the app's TypeScript). A unit test checks every list against the app
 * so they can never drift apart.
 */
export const ENUMS = {
  LIFE_AREAS: ['career', 'business', 'finance', 'health', 'learning', 'wellbeing', 'social', 'culture', 'personal'],
  PRIORITIES: ['low', 'medium', 'high', 'urgent'],
  EVENT_KINDS: ['event', 'block', 'deadline'],
  PROJECT_STATUSES: ['planning', 'active', 'on_hold', 'completed'],
  PROJECT_KINDS: ['business', 'personal', 'experiment', 'client', 'creative', 'other'],
  ACCENT_COLORS: ['cyan', 'violet', 'magenta', 'lime', 'amber', 'info'],
  CAREER_PATH_STATUSES: ['exploring', 'active', 'paused', 'archived'],
  QUALIFICATION_KINDS: ['degree', 'diploma', 'certificate', 'licence', 'award', 'other'],
  PROGRESS_STATUSES: ['planned', 'in_progress', 'completed', 'paused'],
  MODULE_STATUSES: ['upcoming', 'in_progress', 'completed'],
  ASSESSMENT_KINDS: ['assignment', 'exam', 'coursework', 'presentation', 'project', 'quiz'],
  ASSESSMENT_STATUSES: ['not_started', 'in_progress', 'submitted', 'graded'],
  TRANSACTION_KINDS: ['income', 'expense'],
  FREQUENCIES: ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'],
  TIMES_OF_DAY: ['morning', 'afternoon', 'evening', 'anytime'],
  GOAL_HORIZONS: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
  GOAL_TERMS: ['short', 'long'],
  GOAL_STATUSES: ['active', 'completed', 'paused', 'abandoned'],
  PROGRESS_MODES: ['manual', 'milestones', 'numeric'],
  HABIT_SCHEDULES: ['daily', 'days', 'weekly'],
}
const E = ENUMS
const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd MMM yyyy']
const FREQUENCIES = E.FREQUENCIES
const FREQUENCY_PER_MONTH = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }
const WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export class ProfileError extends Error {
  constructor(path, message) {
    super(`profile${path ? `.${path}` : ''}: ${message}`)
    this.name = 'ProfileError'
  }
}

// ------------------------------------------------------------------ dates --

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const toUTC = (iso) => new Date(`${iso}T00:00:00Z`)
const fromUTC = (d) => d.toISOString().slice(0, 10)

export function addDays(iso, days) {
  const d = toUTC(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUTC(d)
}

const daysInMonth = (year, monthIndex) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

/** Add months, clamping the day to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso, months, preferredDay) {
  const d = toUTC(iso)
  const day = preferredDay ?? d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  target.setUTCDate(Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth())))
  return fromUTC(target)
}

function advance(iso, frequency, dayOfMonth) {
  switch (frequency) {
    case 'weekly':
      return addDays(iso, 7)
    case 'fortnightly':
      return addDays(iso, 14)
    case 'monthly':
      return addMonths(iso, 1, dayOfMonth)
    case 'quarterly':
      return addMonths(iso, 3, dayOfMonth)
    case 'yearly':
      return addMonths(iso, 12, dayOfMonth)
  }
  throw new Error(`Unknown frequency ${frequency}`)
}

/** The first date on or after `today` that falls on `dayOfMonth` (clamped for short months). */
export function nextDayOfMonth(today, dayOfMonth) {
  const d = toUTC(today)
  const thisMonth = Math.min(dayOfMonth, daysInMonth(d.getUTCFullYear(), d.getUTCMonth()))
  if (d.getUTCDate() <= thisMonth) {
    d.setUTCDate(thisMonth)
    return fromUTC(d)
  }
  return addMonths(fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), 1, dayOfMonth)
}

/** "2027-01-01" → "1 Jan 2027" (used only in generated notes). */
export function humanDate(iso) {
  const d = toUTC(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function localISODate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${s}`
}

// ------------------------------------------------------------- validation --

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function str(obj, field, path, { required = false, max = 200 } = {}) {
  const v = obj?.[field]
  if (v === undefined || v === null || v === '') {
    if (required) throw new ProfileError(`${path}.${field}`, 'is required')
    return undefined
  }
  if (typeof v !== 'string') throw new ProfileError(`${path}.${field}`, 'must be text')
  const t = v.trim()
  if (!t && required) throw new ProfileError(`${path}.${field}`, 'is required')
  if (t.length > max) throw new ProfileError(`${path}.${field}`, `must be ${max} characters or fewer`)
  return t || undefined
}

function date(obj, field, path, { required = false } = {}) {
  const v = obj?.[field]
  if (v === undefined || v === null) {
    if (required) throw new ProfileError(`${path}.${field}`, 'is required')
    return undefined
  }
  if (!isIsoDate(v)) throw new ProfileError(`${path}.${field}`, `must be a real date written YYYY-MM-DD (got ${JSON.stringify(v)})`)
  return v
}

function clock(obj, field, path) {
  const v = obj?.[field]
  if (typeof v !== 'string' || !CLOCK.test(v)) throw new ProfileError(`${path}.${field}`, `must be a 24-hour time HH:MM (got ${JSON.stringify(v)})`)
  return v
}

/** Major units (e.g. 121.62) → minor units (12162). Rejects zero, negatives and fractions of a penny. */
export function toMinor(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ProfileError(path, 'must be a number')
  if (value <= 0) throw new ProfileError(path, 'must be greater than zero (leave the record out if you do not know the amount yet)')
  const minor = Math.round(value * 100)
  if (Math.abs(minor - value * 100) > 1e-6) throw new ProfileError(path, `has more than two decimal places (${value})`)
  return minor
}

function list(obj, field, path) {
  const v = obj?.[field]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ProfileError(`${path}.${field}`, 'must be a list')
  return v.map((item, i) => {
    if (!isObject(item)) throw new ProfileError(`${path}.${field}[${i}]`, 'must be an object')
    return item
  })
}

function oneOf(obj, field, path, allowed, fallback) {
  const v = obj?.[field]
  if (v === undefined || v === null) return fallback
  if (!allowed.includes(v)) throw new ProfileError(`${path}.${field}`, `must be one of ${allowed.join(', ')} (got ${JSON.stringify(v)})`)
  return v
}

function pct(obj, field, path) {
  const v = obj?.[field]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'number' || v < 0 || v > 100) throw new ProfileError(`${path}.${field}`, 'must be a number from 0 to 100')
  return v
}

/** ["mon", "Wednesday"] or "every day" → [1, 3] / [0..6]. */
function weekdays(obj, field, path) {
  const v = obj?.[field]
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string' && /^(every ?day|daily|all)$/i.test(v.trim())) return [0, 1, 2, 3, 4, 5, 6]
  if (!Array.isArray(v) || !v.length) throw new ProfileError(`${path}.${field}`, 'must be a list of day names such as ["mon", "thu"], or "every day"')
  const days = v.map((d, i) => {
    const n = WEEKDAYS[String(d).toLowerCase().slice(0, 3)]
    if (n === undefined) throw new ProfileError(`${path}.${field}[${i}]`, `is not a day name (got ${JSON.stringify(d)})`)
    return n
  })
  return [...new Set(days)].sort((a, b) => a - b)
}

/** Checklist rows (milestones, objectives, roadmaps): strings or { title, dueDate?, done? }, with stable ids. */
function checkItems(obj, field, path, parentId) {
  const v = obj?.[field]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw new ProfileError(`${path}.${field}`, 'must be a list')
  return v.map((item, i) => {
    const p = `${path}.${field}[${i}]`
    const row = typeof item === 'string' ? { title: item } : item
    if (!isObject(row)) throw new ProfileError(p, 'must be text or an object with a title')
    const out = { id: `${parentId}-${field}-${i + 1}`, title: str(row, 'title', p, { required: true }), done: row.done === true }
    const due = date(row, 'dueDate', p)
    if (due) out.dueDate = due
    return out
  })
}

// ----------------------------------------------------------------- builder --

function money(minor, currency) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100)
}

const joinNotes = (...parts) => parts.filter(Boolean).join('\n') || undefined

/**
 * Turn a profile object into a LIFE OS backup file.
 *
 * @param {object} profile  Parsed profile JSON (see README → "Preloading your own data").
 * @param {{ now?: Date, today?: string }} [options]  `now` sets record timestamps; `today` (YYYY-MM-DD) anchors "next payment" dates. Both default to the current time.
 * @returns {{ backup: object, summary: { counts: Record<string, number>, warnings: string[] } }}
 */
export function buildSeed(profile, options = {}) {
  if (!isObject(profile)) throw new ProfileError('', 'must be a JSON object')
  const now = options.now ?? new Date()
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('options.now must be a valid Date')
  const today = options.today ?? localISODate(now)
  if (!isIsoDate(today)) throw new Error('options.today must be YYYY-MM-DD')
  const stamp = now.toISOString()
  const warnings = []

  const data = { schemaVersion: SEED_SCHEMA_VERSION, settings: {}, activity: [] }
  const ids = new Map()
  const push = (collection, key, path, fields) => {
    if (typeof key !== 'string' || !KEY.test(key)) throw new ProfileError(`${path}.key`, 'is required: lower-case letters, digits and dashes (e.g. "rent")')
    const id = `seed-${collection}-${key}`
    if (ids.has(id)) throw new ProfileError(`${path}.key`, `"${key}" is already used by ${ids.get(id)}`)
    ids.set(id, path)
    const record = { id, createdAt: stamp, updatedAt: stamp }
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) record[k] = v
    ;(data[collection] ??= []).push(record)
    return id
  }

  // --- settings ---
  const s = profile.settings ?? {}
  if (!isObject(s)) throw new ProfileError('settings', 'must be an object')
  const settings = { onboarded: true }
  const displayName = str(s, 'displayName', 'settings', { max: 60 })
  if (displayName) settings.displayName = displayName
  if (s.currency !== undefined) {
    if (typeof s.currency !== 'string' || !/^[A-Z]{3}$/.test(s.currency)) throw new ProfileError('settings.currency', 'must be a 3-letter ISO code such as GBP')
    settings.currency = s.currency
  }
  const dateFormat = oneOf(s, 'dateFormat', 'settings', DATE_FORMATS)
  if (dateFormat) settings.dateFormat = dateFormat
  const weekStartsOn = oneOf(s, 'weekStartsOn', 'settings', [0, 1])
  if (weekStartsOn !== undefined) settings.weekStartsOn = weekStartsOn
  data.settings = settings
  const currency = settings.currency ?? 'GBP'

  // --- education ---
  const edu = profile.education ?? {}
  if (!isObject(edu)) throw new ProfileError('education', 'must be an object')
  let courseId
  if (edu.course !== undefined) {
    const c = edu.course
    if (!isObject(c)) throw new ProfileError('education.course', 'must be an object')
    courseId = push('academicCourses', c.key ?? 'course', 'education.course', {
      name: str(c, 'name', 'education.course', { required: true }),
      institution: str(c, 'institution', 'education.course', { max: 500 }),
      level: str(c, 'level', 'education.course', { max: 500 }),
      status: oneOf(c, 'status', 'education.course', E.PROGRESS_STATUSES, 'in_progress'),
      startDate: date(c, 'startDate', 'education.course'),
      endDate: date(c, 'endDate', 'education.course'),
      notes: str(c, 'notes', 'education.course', { max: 50_000 }),
    })
  }

  list(edu, 'qualifications', 'education').forEach((q, i) => {
    const p = `education.qualifications[${i}]`
    push('qualifications', q.key, p, {
      title: str(q, 'title', p, { required: true }),
      institution: str(q, 'institution', p, { max: 500 }),
      kind: oneOf(q, 'kind', p, E.QUALIFICATION_KINDS, 'certificate'),
      status: oneOf(q, 'status', p, E.PROGRESS_STATUSES, 'planned'),
      startDate: date(q, 'startDate', p),
      completionDate: date(q, 'completionDate', p),
      grade: str(q, 'grade', p, { max: 500 }),
      notes: str(q, 'notes', p, { max: 50_000 }),
    })
  })

  const moduleIds = new Map()
  const moduleNames = new Map()
  list(edu, 'modules', 'education').forEach((m, i) => {
    const p = `education.modules[${i}]`
    const name = str(m, 'name', p, { required: true })
    const id = push('modules', m.key, p, {
      name,
      code: str(m, 'code', p, { max: 500 }),
      courseId,
      term: str(m, 'term', p, { max: 500 }),
      status: oneOf(m, 'status', p, E.MODULE_STATUSES, 'in_progress'),
      notes: str(m, 'notes', p, { max: 50_000 }),
    })
    moduleIds.set(m.key, id)
    moduleNames.set(m.key, name)
  })
  const moduleRef = (key, path) => {
    if (key === undefined) return undefined
    if (!moduleIds.has(key)) throw new ProfileError(path, `refers to unknown module "${key}"`)
    return moduleIds.get(key)
  }

  list(edu, 'assessments', 'education').forEach((a, i) => {
    const p = `education.assessments[${i}]`
    let dueDate = date(a, 'dueDate', p)
    let notes = str(a, 'notes', p, { max: 50_000 })
    if (!dueDate) {
      // The app requires a due date; use the build date and say so.
      dueDate = today
      notes = joinNotes(notes, `Due date is a placeholder (${humanDate(today)}, the day this seed was built) because the app requires one. Change it when known.`)
      warnings.push(`${p} (${a.title}) has no dueDate; used ${today} as a placeholder.`)
    }
    push('assessments', a.key, p, {
      title: str(a, 'title', p, { required: true }),
      kind: oneOf(a, 'kind', p, E.ASSESSMENT_KINDS, 'assignment'),
      moduleId: moduleRef(a.moduleKey, `${p}.moduleKey`),
      dueDate,
      dueTime: a.dueTime === undefined ? undefined : clock(a, 'dueTime', p),
      weight: pct(a, 'weight', p),
      status: oneOf(a, 'status', p, E.ASSESSMENT_STATUSES, 'not_started'),
      score: pct(a, 'score', p),
      notes,
    })
  })

  // Term breaks become all-day events; the weekly timetable becomes one event per slot per week.
  const term = edu.term
  const timetable = list(edu, 'timetable', 'education')
  if (timetable.length && !isObject(term)) throw new ProfileError('education.term', 'is required when a timetable is given (teachingStart and teachingEnd)')
  if (isObject(term)) {
    const start = date(term, 'teachingStart', 'education.term', { required: true })
    const end = date(term, 'teachingEnd', 'education.term', { required: true })
    if (end < start) throw new ProfileError('education.term.teachingEnd', 'is before teachingStart')
    const excluded = new Set()
    list(term, 'breaks', 'education.term').forEach((b, i) => {
      const p = `education.term.breaks[${i}]`
      const bStart = date(b, 'start', p, { required: true })
      const bEnd = date(b, 'end', p) ?? bStart
      if (bEnd < bStart) throw new ProfileError(`${p}.end`, 'is before start')
      if (b.excludeFromTimetable === true) for (let d = bStart; d <= bEnd; d = addDays(d, 1)) excluded.add(d)
      push('events', b.key, p, {
        title: str(b, 'title', p, { required: true }),
        description: joinNotes(str(b, 'notes', p, { max: 50_000 }), bEnd !== bStart ? `${humanDate(bStart)} – ${humanDate(bEnd)}` : undefined),
        kind: 'event',
        area: 'career',
        date: bStart,
        allDay: true,
      })
    })

    timetable.forEach((slot, i) => {
      const p = `education.timetable[${i}]`
      if (typeof slot.key !== 'string' || !KEY.test(slot.key)) throw new ProfileError(`${p}.key`, 'is required: lower-case letters, digits and dashes')
      const weekday = WEEKDAYS[String(slot.weekday ?? '').toLowerCase().slice(0, 3)]
      if (weekday === undefined) throw new ProfileError(`${p}.weekday`, 'must be a day name such as "mon"')
      const startTime = clock(slot, 'start', p)
      const endTime = clock(slot, 'end', p)
      if (endTime <= startTime) throw new ProfileError(`${p}.end`, 'must be after start')
      const moduleName = slot.moduleKey !== undefined ? (moduleRef(slot.moduleKey, `${p}.moduleKey`), moduleNames.get(slot.moduleKey)) : undefined
      const baseTitle = str(slot, 'title', p) ?? moduleName
      if (!baseTitle) throw new ProfileError(p, 'needs a title or a moduleKey')
      const cancelled = slot.cancelled === true
      const title = cancelled ? `${baseTitle} (cancelled)` : baseTitle
      const description = joinNotes('Weekly timetable (term time).', cancelled ? 'Cancelled for now.' : undefined, str(slot, 'notes', p, { max: 10_000 }))
      let made = 0
      for (let d = start; d <= end; d = addDays(d, 1)) {
        if (toUTC(d).getUTCDay() !== weekday || excluded.has(d)) continue
        push('events', `${slot.key}-${d}`, p, {
          title,
          description,
          kind: 'event',
          area: 'career',
          date: d,
          allDay: false,
          startTime,
          endTime,
          location: str(slot, 'location', p, { max: 500 }),
        })
        made++
      }
      if (!made) warnings.push(`${p} (${title}) produced no events between ${start} and ${end}.`)
    })
  }

  // --- finance ---
  const fin = profile.finance ?? {}
  if (!isObject(fin)) throw new ProfileError('finance', 'must be an object')
  const recurring = list(fin, 'recurring', 'finance').map((r, i) => {
    const p = `finance.recurring[${i}]`
    const frequency = oneOf(r, 'frequency', p, FREQUENCIES, 'monthly')
    const kind = oneOf(r, 'kind', p, E.TRANSACTION_KINDS, 'expense')
    const amount = toMinor(r.amount, `${p}.amount`)
    let dayOfMonth
    if (r.dayOfMonth !== undefined) {
      if (!Number.isInteger(r.dayOfMonth) || r.dayOfMonth < 1 || r.dayOfMonth > 31) throw new ProfileError(`${p}.dayOfMonth`, 'must be a whole number from 1 to 31')
      if (!['monthly', 'quarterly', 'yearly'].includes(frequency)) throw new ProfileError(`${p}.dayOfMonth`, `only applies to monthly, quarterly or yearly items (this one is ${frequency})`)
      dayOfMonth = r.dayOfMonth
    }
    const explicitNext = date(r, 'nextDate', p)
    if (explicitNext && dayOfMonth) throw new ProfileError(p, 'give either nextDate or dayOfMonth, not both')
    const nextDate = explicitNext ?? (dayOfMonth ? nextDayOfMonth(today, dayOfMonth) : today)
    if (!explicitNext && !dayOfMonth) warnings.push(`${p} (${r.name}) has no nextDate or dayOfMonth; first date set to ${today}.`)

    const endDate = date(r, 'endDate', p)
    let remaining = r.remainingPayments
    if (remaining !== undefined && (!Number.isInteger(remaining) || remaining < 1)) throw new ProfileError(`${p}.remainingPayments`, 'must be a whole number of 1 or more')
    if (remaining !== undefined && endDate) throw new ProfileError(p, 'give either endDate or remainingPayments, not both')

    // The app has no end date for recurring items, so work out the last payment and record it in the notes.
    let lastDate
    if (endDate) {
      if (endDate < nextDate) throw new ProfileError(`${p}.endDate`, `is before the first payment (${nextDate})`)
      remaining = 0
      for (let d = nextDate; d <= endDate; d = advance(d, frequency, dayOfMonth)) {
        remaining++
        lastDate = d
      }
    } else if (remaining !== undefined) {
      lastDate = nextDate
      for (let n = 1; n < remaining; n++) lastDate = advance(lastDate, frequency, dayOfMonth)
    }
    const endNote =
      lastDate &&
      `Ends: ${remaining} payment${remaining === 1 ? '' : 's'} remaining${endDate ? ` up to ${humanDate(endDate)}` : ''} (last on ${humanDate(lastDate)}). Switch this item off after that — the app has no end date for recurring items.`

    const name = str(r, 'name', p, { required: true })
    const notes = joinNotes(str(r, 'notes', p, { max: 500 }), endNote)
    if (notes && notes.length > 500) throw new ProfileError(`${p}.notes`, `with the generated end note is ${notes.length} characters; recurring notes are limited to 500`)
    const record = {
      name,
      kind,
      amount,
      category: str(r, 'category', p, { required: true }),
      frequency,
      nextDate,
      active: r.active !== false,
      notes,
    }
    push('recurring', r.key, p, record)
    return { ...record, dayOfMonth, lastDate }
  })

  const mb = fin.monthlyBudget
  if (mb !== undefined) {
    if (!isObject(mb)) throw new ProfileError('finance.monthlyBudget', 'must be an object')
    let limit
    let notes
    if (mb.fromRecurring === true) {
      const out = recurring.filter((r) => r.active && r.kind === 'expense')
      const monthly = (r) => Math.round(r.amount * FREQUENCY_PER_MONTH[r.frequency])
      limit = out.reduce((a, r) => a + monthly(r), 0)
      if (!limit) throw new ProfileError('finance.monthlyBudget', 'fromRecurring needs at least one active recurring expense')
      if (mb.expectedTotal !== undefined) {
        const expected = toMinor(mb.expectedTotal, 'finance.monthlyBudget.expectedTotal')
        if (expected !== limit) throw new ProfileError('finance.monthlyBudget.expectedTotal', `is ${money(expected, currency)} but the active recurring expenses add up to ${money(limit, currency)}`)
      }
      const byDay = new Map()
      for (const r of out) if (r.frequency === 'monthly' && r.dayOfMonth) byDay.set(r.dayOfMonth, (byDay.get(r.dayOfMonth) ?? 0) + r.amount)
      const split = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, v]) => `${money(v, currency)} on the ${ordinal(d)}`)
      const ending = out.filter((r) => r.lastDate).sort((a, b) => (a.lastDate < b.lastDate ? -1 : 1))
      let running = limit
      const drops = ending.map((r) => {
        running -= monthly(r)
        return `Drops to ${money(running, currency)}/month after ${r.name} ends (last payment ${humanDate(r.lastDate)}).`
      })
      notes = joinNotes(`Committed monthly outgoings from recurring items: ${money(limit, currency)}.`, split.length ? `${split.join(', ')}.` : undefined, ...drops)
    } else {
      limit = toMinor(mb.limit, 'finance.monthlyBudget.limit')
    }
    notes = joinNotes(notes, str(mb, 'notes', 'finance.monthlyBudget', { max: 500 }))
    if (notes && notes.length > 500) notes = `${notes.slice(0, 497)}...`
    push('budgets', 'total', 'finance.monthlyBudget', { category: '*', limit, notes })
  }

  list(fin, 'savingsGoals', 'finance').forEach((g, i) => {
    const p = `finance.savingsGoals[${i}]`
    push('savingsGoals', g.key, p, {
      name: str(g, 'name', p, { required: true }),
      target: toMinor(g.target, `${p}.target`),
      targetDate: date(g, 'targetDate', p),
      color: 'lime',
      contributions: [],
      notes: str(g, 'notes', p, { max: 50_000 }),
      archived: false,
    })
  })

  // --- calendar events ---
  list(profile, 'events', '').forEach((ev, i) => {
    const p = `events[${i}]`
    const allDay = ev.allDay === true || ev.start === undefined
    const startTime = allDay ? undefined : clock(ev, 'start', p)
    const endTime = allDay || ev.end === undefined ? undefined : clock(ev, 'end', p)
    if (startTime && endTime && endTime <= startTime) throw new ProfileError(`${p}.end`, 'must be after start')
    push('events', ev.key, p, {
      title: str(ev, 'title', p, { required: true }),
      description: str(ev, 'description', p, { max: 50_000 }),
      kind: oneOf(ev, 'kind', p, E.EVENT_KINDS, 'event'),
      area: oneOf(ev, 'area', p, E.LIFE_AREAS, 'personal'),
      priority: oneOf(ev, 'priority', p, E.PRIORITIES),
      date: date(ev, 'date', p, { required: true }),
      allDay,
      startTime,
      endTime,
      location: str(ev, 'location', p, { max: 500 }),
    })
  })

  // --- projects (before notes, which can link to them) ---
  const projectIds = new Map()
  list(profile, 'projects', '').forEach((pr, i) => {
    const p = `projects[${i}]`
    const id = `seed-projects-${pr.key}`
    const startDate = date(pr, 'startDate', p)
    const deadline = date(pr, 'deadline', p)
    if (startDate && deadline && deadline < startDate) throw new ProfileError(`${p}.deadline`, 'is before startDate')
    push('projects', pr.key, p, {
      name: str(pr, 'name', p, { required: true }),
      description: str(pr, 'description', p, { max: 50_000 }),
      status: oneOf(pr, 'status', p, E.PROJECT_STATUSES, 'planning'),
      kind: oneOf(pr, 'kind', p, E.PROJECT_KINDS, 'personal'),
      priority: oneOf(pr, 'priority', p, E.PRIORITIES, 'medium'),
      area: oneOf(pr, 'area', p, E.LIFE_AREAS, 'business'),
      color: oneOf(pr, 'color', p, E.ACCENT_COLORS, 'cyan'),
      startDate,
      deadline,
      objectives: checkItems(pr, 'objectives', p, id),
      milestones: checkItems(pr, 'milestones', p, id),
      resources: list(pr, 'resources', p).map((r, j) => {
        const rp = `${p}.resources[${j}]`
        const link = str(r, 'url', rp, { max: 2000 })
        if (link && !/^https?:\/\/\S+$/i.test(link)) throw new ProfileError(`${rp}.url`, 'must start with http:// or https://')
        return { id: `${id}-resources-${j + 1}`, title: str(r, 'title', rp, { required: true }), ...(link ? { url: link } : {}), ...(r.note ? { note: str(r, 'note', rp, { max: 500 }) } : {}) }
      }),
    })
    projectIds.set(pr.key, id)
  })

  list(profile, 'notes', '').forEach((n, i) => {
    const p = `notes[${i}]`
    if (n.projectKey !== undefined && !projectIds.has(n.projectKey)) throw new ProfileError(`${p}.projectKey`, `refers to unknown project "${n.projectKey}"`)
    push('notes', n.key, p, {
      title: str(n, 'title', p, { required: true }),
      body: str(n, 'body', p, { max: 50_000 }) ?? '',
      area: oneOf(n, 'area', p, E.LIFE_AREAS, 'personal'),
      pinned: n.pinned === true,
      projectId: n.projectKey === undefined ? undefined : projectIds.get(n.projectKey),
      tags: Array.isArray(n.tags) ? n.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    })
  })

  // --- routines (checklists on chosen days) ---
  list(profile, 'routines', '').forEach((r, i) => {
    const p = `routines[${i}]`
    const id = `seed-routines-${r.key}`
    const rawSteps = r.steps
    if (!Array.isArray(rawSteps) || !rawSteps.length) throw new ProfileError(`${p}.steps`, 'needs at least one step')
    push('routines', r.key, p, {
      name: str(r, 'name', p, { required: true }),
      timeOfDay: oneOf(r, 'timeOfDay', p, E.TIMES_OF_DAY, 'morning'),
      days: weekdays(r, 'days', p) ?? [0, 1, 2, 3, 4, 5, 6],
      steps: rawSteps.map((st, j) => {
        const title = typeof st === 'string' ? st.trim() : st?.title
        if (!title || typeof title !== 'string' || title.length > 200) throw new ProfileError(`${p}.steps[${j}]`, 'must be text of 1–200 characters')
        return { id: `${id}-step-${j + 1}`, title }
      }),
      active: r.active !== false,
      log: {},
    })
  })

  // --- goals, habits, career ---
  list(profile, 'goals', '').forEach((g, i) => {
    const p = `goals[${i}]`
    const id = `seed-goals-${g.key}`
    const milestones = checkItems(g, 'milestones', p, id)
    push('goals', g.key, p, {
      title: str(g, 'title', p, { required: true }),
      description: str(g, 'description', p, { max: 50_000 }),
      horizon: oneOf(g, 'horizon', p, E.GOAL_HORIZONS, 'monthly'),
      term: oneOf(g, 'term', p, E.GOAL_TERMS, 'short'),
      area: oneOf(g, 'area', p, E.LIFE_AREAS, 'personal'),
      status: oneOf(g, 'status', p, E.GOAL_STATUSES, 'active'),
      targetDate: date(g, 'targetDate', p),
      progressMode: oneOf(g, 'progressMode', p, E.PROGRESS_MODES, milestones.length ? 'milestones' : 'manual'),
      progress: pct(g, 'progress', p) ?? 0,
      milestones,
      history: [],
    })
  })

  list(profile, 'habits', '').forEach((h, i) => {
    const p = `habits[${i}]`
    const days = weekdays(h, 'days', p)
    const schedule = oneOf(h, 'schedule', p, E.HABIT_SCHEDULES, days ? 'days' : 'daily')
    if (schedule === 'days' && !days) throw new ProfileError(`${p}.days`, 'is required when schedule is "days"')
    const timesPerWeek = h.timesPerWeek ?? 3
    if (!Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7) throw new ProfileError(`${p}.timesPerWeek`, 'must be a whole number from 1 to 7')
    push('habits', h.key, p, {
      name: str(h, 'name', p, { required: true }),
      description: str(h, 'description', p, { max: 500 }),
      area: oneOf(h, 'area', p, E.LIFE_AREAS, 'personal'),
      schedule,
      days: days ?? [],
      timesPerWeek,
      color: oneOf(h, 'color', p, E.ACCENT_COLORS, 'cyan'),
      startDate: date(h, 'startDate', p) ?? today,
      log: [],
      archived: false,
    })
  })

  list(profile, 'careerPaths', '').forEach((c, i) => {
    const p = `careerPaths[${i}]`
    const id = `seed-careerPaths-${c.key}`
    push('careerPaths', c.key, p, {
      name: str(c, 'name', p, { required: true }),
      targetRole: str(c, 'targetRole', p, { max: 500 }),
      description: str(c, 'description', p, { max: 50_000 }),
      status: oneOf(c, 'status', p, E.CAREER_PATH_STATUSES, 'exploring'),
      color: oneOf(c, 'color', p, E.ACCENT_COLORS, 'cyan'),
      targetDate: date(c, 'targetDate', p),
      roadmap: checkItems(c, 'roadmap', p, id),
      scores: {},
      notes: str(c, 'notes', p, { max: 50_000 }),
    })
  })

  const known = new Set(['settings', 'education', 'finance', 'events', 'projects', 'notes', 'routines', 'goals', 'habits', 'careerPaths'])
  for (const k of Object.keys(profile)) if (!known.has(k)) warnings.push(`Ignored unknown top-level key "${k}".`)

  const counts = {}
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v) && k !== 'activity') counts[k] = v.length
  return {
    backup: { app: 'life-os', kind: 'backup', exportedAt: stamp, schemaVersion: SEED_SCHEMA_VERSION, data },
    summary: { counts, warnings },
  }
}

// --------------------------------------------------------------------- CLI --

function parseArgs(argv) {
  const out = { in: 'private/profile.json', out: 'private/life-os-seed.json' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const [flag, inline] = a.split('=', 2)
    const value = () => inline ?? argv[++i]
    if (flag === '--in') out.in = value()
    else if (flag === '--out') out.out = value()
    else if (flag === '--today') out.today = value()
    else if (flag === '--help' || flag === '-h') out.help = true
    else throw new Error(`Unknown argument: ${a}`)
  }
  return out
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log('Usage: node scripts/build-seed.mjs [--in private/profile.json] [--out private/life-os-seed.json] [--today YYYY-MM-DD]')
    return 0
  }
  const inPath = resolve(args.in)
  const outPath = resolve(args.out)
  let profile
  try {
    profile = JSON.parse(readFileSync(inPath, 'utf8'))
  } catch (e) {
    console.error(`Could not read ${args.in}: ${e.message}`)
    return 1
  }
  try {
    const { backup, summary } = buildSeed(profile, { today: args.today })
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, `${JSON.stringify(backup, null, 2)}\n`)
    const total = Object.values(summary.counts).reduce((a, b) => a + b, 0)
    console.log(`Wrote ${args.out}: ${total} records`)
    for (const [k, n] of Object.entries(summary.counts)) console.log(`  ${k.padEnd(16)} ${n}`)
    for (const w of summary.warnings) console.warn(`  note: ${w}`)
    console.log('Next: npm run seed:validate, then Settings → Data & backups → Import.')
    return 0
  } catch (e) {
    console.error(e instanceof ProfileError ? `Invalid profile — ${e.message}` : e)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main()
}

export const SCRIPT_PATH = fileURLToPath(import.meta.url)
