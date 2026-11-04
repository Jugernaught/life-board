import { describe, expect, it, vi } from 'vitest'
import { addDaysISO, diffDays, eachDay, eachMonth, formatTime, isISODate, nextYearlyOccurrence, parseISODate, relativeDay, spanMinutes, toISODate, weekStartISO } from './dates'
import { delta, formatMinutes, formatMoney, moneyToInput, parseMoney } from './format'
import { cn, debounce, normalise, sortBy } from './utils'

describe('dates', () => {
  it('round-trips ISO dates in local time', () => {
    expect(toISODate(parseISODate('2026-03-29'))).toBe('2026-03-29') // DST change in the UK
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2026-02-28')).toBe(true)
  })
  it('does date arithmetic across months and years', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-01-01', '2026-03-01')).toBe(59)
    expect(eachDay('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
    expect(eachMonth('2026-11-15', '2027-02-01')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('computes week starts for Monday and Sunday weeks', () => {
    expect(weekStartISO('2026-11-04', 1)).toBe('2026-11-02') // Wednesday → Monday
    expect(weekStartISO('2026-11-04', 0)).toBe('2026-11-01') // → Sunday
  })
  it('describes relative days', () => {
    expect(relativeDay('2026-11-03', '2026-11-03')).toBe('Today')
    expect(relativeDay('2026-11-04', '2026-11-03')).toBe('Tomorrow')
    expect(relativeDay('2026-11-01', '2026-11-03')).toBe('2 days ago')
  })
  it('measures spans across midnight', () => {
    expect(spanMinutes('23:30', '07:00')).toBe(450)
    expect(spanMinutes('09:00', '17:30')).toBe(510)
  })
  it('finds the next yearly occurrence, handling 29 February', () => {
    expect(nextYearlyOccurrence('1995-12-25', '2026-11-03')).toBe('2026-12-25')
    expect(nextYearlyOccurrence('1995-01-10', '2026-11-03')).toBe('2027-01-10')
    expect(nextYearlyOccurrence('2000-02-29', '2026-11-03')).toBe('2027-02-28')
    expect(nextYearlyOccurrence('2000-02-29', '2027-11-03')).toBe('2028-02-29')
  })
  it('formats times in 12h and 24h', () => {
    expect(formatTime('13:05', '12h')).toBe('1:05pm')
    expect(formatTime('00:00', '12h')).toBe('12am')
    expect(formatTime('13:05', '24h')).toBe('13:05')
  })
})

describe('money', () => {
  it('parses typed amounts into pence without float error', () => {
    expect(parseMoney('12.34')).toBe(1234)
    expect(parseMoney('£1,250.5')).toBe(125050)
    expect(parseMoney('0.1')! + parseMoney('0.2')!).toBe(30)
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
  })
  it('formats GBP and handles zero-decimal currencies', () => {
    expect(formatMoney(123456)).toBe('£1,234.56')
    expect(formatMoney(5000, { showPence: false })).toBe('£50')
    expect(formatMoney(1500, { signed: true })).toBe('+£15.00')
    expect(parseMoney('500', 'JPY')).toBe(500)
    expect(moneyToInput(123456)).toBe('1234.56')
  })
  it('computes deltas', () => {
    expect(delta(15, 10)).toEqual({ diff: 5, pct: 50, direction: 'up' })
    expect(delta(5, 0).pct).toBeNull()
    expect(formatMinutes(95)).toBe('1h 35m')
    expect(formatMinutes(60)).toBe('1h')
  })
})

describe('utils', () => {
  it('sorts with empty values last in both directions', () => {
    const rows = [{ v: 2 }, { v: undefined }, { v: 1 }, { v: 3 }]
    expect(sortBy(rows, (r) => r.v).map((r) => r.v)).toEqual([1, 2, 3, undefined])
    expect(sortBy(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual([3, 2, 1, undefined])
  })
  it('joins class names and normalises text', () => {
    expect(cn('a', false, ['b', { c: true, d: false }])).toBe('a b c')
    expect(normalise('  Café   Crème ')).toBe('cafe creme')
  })
  it('debounces and flushes', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1)
    d(2)
    expect(fn).not.toHaveBeenCalled()
    d.flush()
    expect(fn).toHaveBeenCalledWith(2)
    d(3)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
