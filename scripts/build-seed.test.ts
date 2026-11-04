/**
 * Tests for scripts/build-seed.mjs. Uses made-up placeholder data only:
 * nothing here describes a real person.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEmptyDatabase } from '@/data/defaults'
import { COLLECTION_KEYS, SCHEMA_VERSION, databaseSchema } from '@/data/schema'
import type { Database } from '@/data/types'
import { mergeDatabases, validateDatabase } from '@/data/validate'
import { ProfileError, SEED_SCHEMA_VERSION, addMonths, buildSeed, humanDate, main, nextDayOfMonth, toMinor } from './build-seed.mjs'

const NOW = new Date('2030-03-15T12:00:00Z')
const TODAY = '2030-03-15' // a Friday

function fakeProfile() {
  return {
    settings: { displayName: 'Alex Example', currency: 'EUR', dateFormat: 'yyyy-MM-dd', weekStartsOn: 1 },
    education: {
      course: { key: 'degree', name: 'BA Example Studies', institution: 'Sample University', level: 'Year 1' },
      qualifications: [{ key: 'school-cert', title: 'Example Certificate', institution: 'Placeholder School', kind: 'other', status: 'completed', grade: 'B' }],
      modules: [
        { key: 'mod-a', name: 'Module Alpha' },
        { key: 'mod-b', name: 'Module Beta', notes: 'Paused' },
      ],
      assessments: [
        { key: 'exam-a', title: 'Alpha exam', kind: 'exam', moduleKey: 'mod-a', dueDate: '2030-04-01' },
        { key: 'undated', title: 'Undated piece', status: 'submitted' },
      ],
      term: {
        teachingStart: '2030-03-18',
        teachingEnd: '2030-04-12',
        breaks: [{ key: 'spring-break', title: 'Break week', start: '2030-04-01', end: '2030-04-05', excludeFromTimetable: true }],
      },
      timetable: [
        { key: 'mon-a', weekday: 'mon', moduleKey: 'mod-a', start: '09:00', end: '10:00' },
        { key: 'wed-b', weekday: 'Wednesday', moduleKey: 'mod-b', start: '14:00', end: '16:00', cancelled: true },
      ],
    },
    finance: {
      recurring: [
        { key: 'flat', name: 'Flat share', amount: 400, category: 'Housing', dayOfMonth: 1 },
        { key: 'phone', name: 'Phone plan', amount: 12.34, category: 'Bills & Utilities', dayOfMonth: 20 },
        { key: 'gadget', name: 'Gadget instalments', amount: 10, category: 'Other', dayOfMonth: 1, remainingPayments: 3 },
        { key: 'stipend', name: 'Weekly stipend', kind: 'income', amount: 25, category: 'Other', frequency: 'weekly', endDate: '2030-04-05' },
        { key: 'grant', name: 'Grant', kind: 'income', amount: 1000, category: 'Student Finance', frequency: 'yearly', nextDate: '2030-09-01' },
      ],
      monthlyBudget: { fromRecurring: true, expectedTotal: 422.34 },
      savingsGoals: [{ key: 'pot', name: 'Rainy-day pot', target: 250 }],
    },
    goals: [{ key: 'goal-a', title: 'Try a new hobby', area: 'wellbeing' }],
    habits: [{ key: 'walk', name: 'Daily walk', area: 'health' }],
    careerPaths: [{ key: 'path-a', name: 'Example path' }],
  }
}

const build = (profile: unknown = fakeProfile()) => buildSeed(profile, { now: NOW, today: TODAY })
type Rec = Record<string, unknown> & { id: string }
const records = (key: string, profile?: unknown) => (build(profile).backup.data[key] ?? []) as Rec[]

describe('buildSeed', () => {
  it('produces a backup the app imports with zero invalid records', () => {
    const { backup } = build()
    expect(backup).toMatchObject({ app: 'life-os', kind: 'backup', schemaVersion: SCHEMA_VERSION })
    const result = validateDatabase(backup, { strict: true })
    expect(result.rejected).toEqual([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(databaseSchema.safeParse(result.db).success).toBe(true)
    // Every record survives validation.
    for (const [key, list] of Object.entries(backup.data)) {
      if (Array.isArray(list) && key !== 'activity') expect((result.db as unknown as Record<string, unknown[]>)[key]).toHaveLength(list.length)
    }
  })

  it('also validates each raw collection directly against databaseSchema', () => {
    expect(databaseSchema.safeParse(build().backup.data).success).toBe(true)
  })

  it('tracks the app schema version and only uses known collection keys', () => {
    expect(SEED_SCHEMA_VERSION).toBe(SCHEMA_VERSION)
    const allowed = new Set<string>(['schemaVersion', 'settings', 'activity', ...COLLECTION_KEYS])
    for (const key of Object.keys(build().backup.data)) expect(allowed).toContain(key)
  })

  it('carries settings for a Replace import and marks setup as done', () => {
    const result = validateDatabase(build().backup)
    expect(result.ok && result.db.settings).toMatchObject({ displayName: 'Alex Example', currency: 'EUR', dateFormat: 'yyyy-MM-dd', weekStartsOn: 1, onboarded: true })
  })

  it('uses stable, prefixed ids so re-importing updates instead of duplicating', () => {
    const a = build().backup.data
    const b = buildSeed(fakeProfile(), { now: new Date('2031-01-01T00:00:00Z'), today: TODAY }).backup.data
    const ids = (d: Record<string, unknown>) => Object.values(d).flatMap((v) => (Array.isArray(v) ? (v as Rec[]).map((r) => r.id) : []))
    expect(ids(a)).toEqual(ids(b))
    expect(ids(a).every((id) => id.startsWith('seed-'))).toBe(true)
    expect(new Set(ids(a)).size).toBe(ids(a).length)

    const seeded = validateDatabase(build().backup) as { ok: true; db: Database }
    const first = mergeDatabases(createEmptyDatabase(), seeded.db)
    expect(first.added).toBe(ids(a).length)
    const newer = validateDatabase(buildSeed(fakeProfile(), { now: new Date('2031-01-01T00:00:00Z'), today: TODAY }).backup) as { db: Database }
    const second = mergeDatabases(first.db, newer.db)
    expect(second).toMatchObject({ added: 0, updated: ids(a).length })
    // Merge keeps the current settings — which is why the README explains Replace vs Merge.
    expect(second.db.settings.displayName).toBe('')
  })

  it('converts money to minor units and links records', () => {
    const rec = records('recurring')
    expect(rec.find((r) => r.id === 'seed-recurring-phone')).toMatchObject({ amount: 1234, kind: 'expense', frequency: 'monthly', active: true })
    const course = records('academicCourses')[0]
    expect(records('modules').every((m) => m.courseId === course.id)).toBe(true)
    expect(records('assessments')[0]).toMatchObject({ moduleId: 'seed-modules-mod-a', kind: 'exam', dueDate: '2030-04-01' })
    expect(records('savingsGoals')[0]).toMatchObject({ target: 25000, contributions: [] })
  })

  it('works out next payment dates from the day of the month', () => {
    const rec = records('recurring')
    expect(rec.find((r) => r.id === 'seed-recurring-flat')!.nextDate).toBe('2030-04-01') // the 1st has passed
    expect(rec.find((r) => r.id === 'seed-recurring-phone')!.nextDate).toBe('2030-03-20') // still to come this month
    expect(rec.find((r) => r.id === 'seed-recurring-grant')!.nextDate).toBe('2030-09-01') // explicit date kept
    expect(rec.find((r) => r.id === 'seed-recurring-stipend')!.nextDate).toBe(TODAY) // no date given → build date
  })

  it('records end dates in notes, since recurring items have no end field', () => {
    const rec = records('recurring')
    expect(rec.find((r) => r.id === 'seed-recurring-gadget')!.notes).toContain('3 payments remaining (last on 1 Jun 2030)')
    // 15, 22, 29 Mar and 5 Apr.
    expect(rec.find((r) => r.id === 'seed-recurring-stipend')!.notes).toContain('4 payments remaining up to 5 Apr 2030 (last on 5 Apr 2030)')
  })

  it('totals committed monthly spending into a "*" budget with a breakdown', () => {
    const [budget] = records('budgets')
    expect(budget).toMatchObject({ id: 'seed-budgets-total', category: '*', limit: 42234 })
    expect(budget.notes).toContain('€410.00 on the 1st, €12.34 on the 20th.')
    expect(budget.notes).toContain('Drops to €412.34/month after Gadget instalments ends')
  })

  it('writes the weekly timetable out as dated events, skipping excluded breaks', () => {
    const events = records('events')
    const mon = events.filter((e) => e.id.startsWith('seed-events-mon-a-'))
    // Mondays 18 Mar – 12 Apr, minus the break week (1 Apr).
    expect(mon.map((e) => e.date)).toEqual(['2030-03-18', '2030-03-25', '2030-04-08'])
    expect(mon[0]).toMatchObject({ title: 'Module Alpha', startTime: '09:00', endTime: '10:00', allDay: false, area: 'career' })
    const wed = events.filter((e) => e.id.startsWith('seed-events-wed-b-'))
    expect(wed).toHaveLength(3)
    expect(wed[0].title).toBe('Module Beta (cancelled)')
    expect(events.find((e) => e.id === 'seed-events-spring-break')).toMatchObject({ allDay: true, date: '2030-04-01' })
  })

  it('uses the build date for an undated assessment and says so', () => {
    const { backup, summary } = build()
    const undated = (backup.data.assessments as Rec[]).find((a) => a.id === 'seed-assessments-undated')!
    expect(undated).toMatchObject({ dueDate: TODAY, status: 'submitted' })
    expect(undated.notes).toContain('placeholder')
    expect(summary.warnings.some((w) => w.includes('Undated piece'))).toBe(true)
  })

  it('leaves out collections that were not given', () => {
    const { backup } = build({ settings: { displayName: 'Sam Placeholder' } })
    expect(Object.keys(backup.data).sort()).toEqual(['activity', 'schemaVersion', 'settings'])
    expect(validateDatabase(backup).ok).toBe(true)
  })

  describe('rejects bad input with a clear path', () => {
    const cases: [string, (p: ReturnType<typeof fakeProfile>) => void, RegExp][] = [
      ['zero amount', (p) => (p.finance.recurring[0].amount = 0), /recurring\[0\]\.amount: must be greater than zero/],
      ['fractional pence', (p) => (p.finance.recurring[0].amount = 1.234), /more than two decimal places/],
      ['impossible date', (p) => (p.finance.recurring[4].nextDate = '2030-02-30'), /nextDate: must be a real date/],
      ['duplicate key', (p) => (p.finance.recurring[1].key = 'flat'), /"flat" is already used/],
      ['unknown module', (p) => (p.education.timetable[0].moduleKey = 'nope'), /unknown module "nope"/],
      ['bad time', (p) => (p.education.timetable[0].start = '9am'), /start: must be a 24-hour time/],
      ['end before start', (p) => (p.education.timetable[0].end = '08:00'), /end: must be after start/],
      ['bad weekday', (p) => (p.education.timetable[0].weekday = 'someday'), /weekday: must be a day name/],
      ['budget mismatch', (p) => (p.finance.monthlyBudget.expectedTotal = 999), /expectedTotal: is €999\.00 but the active recurring expenses add up to €422\.34/],
      ['bad currency', (p) => (p.settings.currency = 'euro'), /settings\.currency/],
      ['bad enum', (p) => ((p.goals[0] as Record<string, unknown>).area = 'space'), /goals\[0\]\.area: must be one of/],
      ['missing key', (p) => delete (p.habits[0] as Record<string, unknown>).key, /habits\[0\]\.key: is required/],
    ]
    it.each(cases)('%s', (_name, mutate, message) => {
      const p = fakeProfile()
      mutate(p)
      expect(() => build(p)).toThrow(ProfileError)
      expect(() => build(p)).toThrow(message)
    })
  })
})

describe('date and money helpers', () => {
  it('clamps month arithmetic to short months', () => {
    expect(addMonths('2030-01-31', 1)).toBe('2030-02-28')
    expect(addMonths('2030-02-28', 1, 31)).toBe('2030-03-31')
    expect(nextDayOfMonth('2030-02-10', 31)).toBe('2030-02-28')
    expect(nextDayOfMonth('2030-12-05', 1)).toBe('2031-01-01')
    expect(nextDayOfMonth('2030-06-01', 1)).toBe('2030-06-01')
  })
  it('formats and converts', () => {
    expect(humanDate('2030-01-04')).toBe('4 Jan 2030')
    expect(toMinor(121.62, 'x')).toBe(12162)
    expect(toMinor(46.7, 'x')).toBe(4670)
    expect(() => toMinor('5', 'x')).toThrow(/must be a number/)
  })
})

describe('CLI', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'life-os-seed-'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads a profile and writes a valid backup file', () => {
    const input = join(dir, 'profile.json')
    const output = join(dir, 'out', 'seed.json')
    writeFileSync(input, JSON.stringify(fakeProfile()))
    expect(main(['--in', input, `--out=${output}`, '--today', TODAY])).toBe(0)
    const result = validateDatabase(JSON.parse(readFileSync(output, 'utf8')), { strict: true })
    expect(result.ok).toBe(true)
  })

  it('exits non-zero on an invalid profile or a missing file', () => {
    const input = join(dir, 'profile.json')
    writeFileSync(input, JSON.stringify({ finance: { recurring: [{ key: 'x', name: 'X', amount: -1, category: 'Other' }] } }))
    expect(main(['--in', input, '--out', join(dir, 'o.json')])).toBe(1)
    expect(main(['--in', join(dir, 'missing.json')])).toBe(1)
    expect(() => main(['--bogus'])).toThrow(/Unknown argument/)
  })
})
