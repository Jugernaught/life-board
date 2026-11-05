/**
 * Daylight-saving policy for reminder times (see localInstant in dates.ts).
 * Runs in a real DST zone regardless of the machine's own timezone.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { localInstant } from './dates'
import { nextDueDate } from './recurrence'

// Node's environment (the app's tsconfig has no Node types; tests run in Node).
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
const original = env.TZ
beforeAll(() => {
  env.TZ = 'Europe/London'
})
afterAll(() => {
  // Assigning undefined would set the string "undefined"; remove it instead.
  if (original === undefined) delete env.TZ
  else env.TZ = original
})

describe('daylight saving', () => {
  it('uses the first occurrence when clocks go back', () => {
    // 25 Oct 2026: 01:00–02:00 happens twice in London. 01:30 → the earlier one (still BST, UTC+1).
    expect(new Date(localInstant('2026-10-25', '01:30')).toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  it('moves a skipped time forward when clocks go forward', () => {
    // 29 Mar 2026: 01:00–02:00 doesn't exist. 01:30 → 02:30 BST.
    expect(new Date(localInstant('2026-03-29', '01:30')).toISOString()).toBe('2026-03-29T01:30:00.000Z')
  })

  it('never shifts or doubles a repeating date across a change', () => {
    const daily = { freq: 'daily' as const, interval: 1, days: [] }
    expect(nextDueDate(daily, '2026-10-24', '2026-10-24')).toBe('2026-10-25')
    expect(nextDueDate(daily, '2026-10-25', '2026-10-25')).toBe('2026-10-26')
    expect(nextDueDate({ freq: 'weekly', interval: 1, days: [0] }, '2026-10-25', '2026-10-25')).toBe('2026-11-01')
  })
})
