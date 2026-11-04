import { describe, expect, it } from 'vitest'
import { parseQuick } from './parseQuick'
import { describeRepeat, firstOnOrAfter, nextAfter, nextDueDate } from './recurrence'

// Wednesday 4 November 2026
const today = '2026-11-04'
const p = (s: string, extra: Partial<Parameters<typeof parseQuick>[1]> = {}) => parseQuick(s, { today, weekStartsOn: 1, dayFirst: true, ...extra })

describe('parseQuick', () => {
  it('reads relative dates, times, priority, tags and area', () => {
    const r = p('Dentist tomorrow 3pm !high #health @fitness')
    expect(r).toMatchObject({ title: 'Dentist', dueDate: '2026-11-05', dueTime: '15:00', priority: 'high', tags: ['health'], area: 'health' })
    expect(r.tokens.map((t) => t.kind).sort()).toEqual(['area', 'date', 'priority', 'tag', 'time'])
  })

  it('handles weekdays, "next" weekdays and weekends', () => {
    expect(p('Call mum friday').dueDate).toBe('2026-11-06')
    expect(p('Call mum on wed').dueDate).toBe('2026-11-04') // today
    expect(p('Call mum next friday').dueDate).toBe('2026-11-13')
    expect(p('Call mum next monday').dueDate).toBe('2026-11-09')
    expect(p('Hike this weekend').dueDate).toBe('2026-11-07')
    expect(p('Plan next week').dueDate).toBe('2026-11-09')
    expect(p('Pay rent next month').dueDate).toBe('2026-12-01')
  })

  it('handles explicit dates, rolling into next year when past', () => {
    expect(p('Exam 12 Nov').dueDate).toBe('2026-11-12')
    expect(p('Exam Nov 12th').dueDate).toBe('2026-11-12')
    expect(p('Birthday 3 March').dueDate).toBe('2027-03-03')
    expect(p('Form 5/12').dueDate).toBe('2026-12-05')
    expect(p('Form 5/12', { dayFirst: false }).dueDate).toBe('2027-05-12')
    expect(p('Trip 2027-01-20').dueDate).toBe('2027-01-20')
    expect(p('Report in 3 days').dueDate).toBe('2026-11-07')
    expect(p('Review in a week').dueDate).toBe('2026-11-11')
    expect(p('Bad date 31/02').dueDate).toBeUndefined()
  })

  it('reads 12h and 24h times without confusing dates', () => {
    expect(p('Standup 9:30am').dueTime).toBe('09:30')
    expect(p('Dinner at 7').dueTime).toBe('07:00')
    expect(p('Train 17:45').dueTime).toBe('17:45')
    expect(p('Lunch noon').dueTime).toBe('12:00')
    expect(p('Midnight snack 12am').dueTime).toBe('00:00')
    const r = p('Meeting 12.11')
    expect(r.dueTime).toBeUndefined()
    expect(r.dueDate).toBe('2026-11-12')
  })

  it('recognises repeat rules and starts them on the first occurrence', () => {
    expect(p('Water plants every day')).toMatchObject({ title: 'Water plants', repeat: { freq: 'daily', interval: 1 }, dueDate: today })
    expect(p('Gym every monday and thursday')).toMatchObject({ title: 'Gym', repeat: { freq: 'weekly', days: [1, 4] }, dueDate: '2026-11-05' })
    expect(p('Pay rent monthly on 1 Dec')).toMatchObject({ repeat: { freq: 'monthly' }, dueDate: '2026-12-01' })
    expect(p('Backup every 2 weeks').repeat).toEqual({ freq: 'weekly', interval: 2, days: [] })
    expect(p('Report every weekday').repeat?.freq).toBe('weekdays')
  })

  it('leaves ordinary words alone and respects switched-off tokens', () => {
    expect(p('Buy sun cream').title).toBe('Buy sun cream')
    expect(p('Buy sun cream').dueDate).toBeUndefined()
    expect(p('I may call').title).toBe('I may call')
    const r = p('Read Monday Morning book monday', { ignore: new Set(['date']) })
    expect(r.title).toBe('Read Monday Morning book monday')
    expect(p('Fix bug p1').priority).toBe('urgent')
    expect(p('Fix bug !!!').priority).toBe('urgent')
    expect(p('Email @nowhere').area).toBeUndefined()
  })
})

describe('recurrence', () => {
  it('advances by the rule', () => {
    expect(nextAfter({ freq: 'daily', interval: 1, days: [] }, '2026-11-04')).toBe('2026-11-05')
    expect(nextAfter({ freq: 'daily', interval: 3, days: [] }, '2026-11-04')).toBe('2026-11-07')
    expect(nextAfter({ freq: 'weekdays', interval: 1, days: [] }, '2026-11-06')).toBe('2026-11-09') // Fri → Mon
    expect(nextAfter({ freq: 'weekly', interval: 1, days: [] }, '2026-11-04')).toBe('2026-11-11')
    expect(nextAfter({ freq: 'weekly', interval: 1, days: [1, 4] }, '2026-11-05')).toBe('2026-11-09') // Thu → Mon
    expect(nextAfter({ freq: 'weekly', interval: 2, days: [1] }, '2026-11-02')).toBe('2026-11-16')
    expect(nextAfter({ freq: 'monthly', interval: 1, days: [] }, '2026-01-31')).toBe('2026-02-28')
    expect(nextAfter({ freq: 'yearly', interval: 1, days: [] }, '2028-02-29')).toBe('2029-02-28')
  })

  it('never schedules the next occurrence in the past', () => {
    const daily = { freq: 'daily' as const, interval: 1, days: [] }
    expect(nextDueDate(daily, '2026-10-20', today)).toBe('2026-11-05')
    expect(nextDueDate({ freq: 'weekly', interval: 1, days: [] }, '2026-11-02', today)).toBe('2026-11-09')
    expect(nextDueDate(daily, undefined, today)).toBe('2026-11-05')
  })

  it('finds the first occurrence and describes rules', () => {
    expect(firstOnOrAfter({ freq: 'weekdays', interval: 1, days: [] }, '2026-11-07')).toBe('2026-11-09')
    expect(firstOnOrAfter({ freq: 'weekly', interval: 1, days: [3] }, today)).toBe(today)
    expect(describeRepeat({ freq: 'weekly', interval: 1, days: [1] })).toBe('Every Monday')
    expect(describeRepeat({ freq: 'weekly', interval: 2, days: [4, 1] })).toBe('Every 2 weeks on Mon, Thu')
    expect(describeRepeat({ freq: 'monthly', interval: 3, days: [] })).toBe('Every 3 months')
  })
})
