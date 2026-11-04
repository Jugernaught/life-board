import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { rescheduleOptions, subtaskProgress } from '@/lib/taskOps'
import { validateForm } from './EntityForm'
import { eventForm, taskForm } from './core'
import { applySmart, eventSmart, parseSmart, taskSmart } from './smart'
import type { FormContext } from './types'

const db = createEmptyDatabase()
// Wednesday 4 November 2026
const ctx: FormContext = { db, settings: db.settings, today: '2026-11-04' }
const none = new Set<never>()

describe('smart title', () => {
  it('fills a new task from one line, leaving a clean title', () => {
    const v = applySmart(taskSmart, { ...taskForm.defaults!(ctx), title: 'Pay rent every month 1 Dec !high #home' }, ctx, none, new Set())
    expect(v).toMatchObject({ title: 'Pay rent', dueDate: '2026-12-01', priority: 'high', tags: ['home'], repeat: { freq: 'monthly' } })
    const { errors, data } = validateForm(taskForm, v, ctx)
    expect(errors).toEqual({})
    expect(data.repeat).toMatchObject({ freq: 'monthly', interval: 1 })
  })

  it('lets fields the person set by hand win', () => {
    const v = applySmart(taskSmart, { title: 'Call mum tomorrow !high', priority: 'low', dueDate: '2026-11-20' }, ctx, none, new Set(['priority', 'dueDate']))
    expect(v).toMatchObject({ title: 'Call mum', priority: 'low', dueDate: '2026-11-20' })
  })

  it('keeps switched-off pieces in the title', () => {
    const v = applySmart(taskSmart, { title: 'Read Monday Morning tomorrow' }, ctx, new Set(['date']), new Set())
    expect(v.title).toBe('Read Monday Morning tomorrow')
    expect(v.dueDate).toBeUndefined()
  })

  it('treats a time on its own as today, and never empties the title', () => {
    expect(parseSmart('Call 3pm', ctx, taskSmart, none)).toMatchObject({ dueDate: '2026-11-04', dueTime: '15:00' })
    expect(applySmart(taskSmart, { title: 'tomorrow' }, ctx, none, new Set()).title).toBe('tomorrow')
  })

  it('moves an event and keeps its length', () => {
    const base = { ...eventForm.defaults!(ctx), startTime: '10:00', endTime: '10:30', title: 'Dentist Friday 3pm @health' }
    const v = applySmart(eventSmart, base, ctx, none, new Set())
    expect(v).toMatchObject({ title: 'Dentist', date: '2026-11-06', startTime: '15:00', endTime: '15:30', area: 'health' })
    // Events don't take tags or repeats from the title.
    expect(parseSmart('Gym every monday #fit', ctx, eventSmart, none).repeat).toBeUndefined()
  })
})

describe('task operations', () => {
  it('offers sensible reschedule targets', () => {
    expect(rescheduleOptions('2026-11-04', 1, '2026-11-01').map((o) => [o.id, o.date])).toEqual([
      ['today', '2026-11-04'],
      ['tomorrow', '2026-11-05'],
      ['weekend', '2026-11-07'],
      ['next-week', '2026-11-09'],
      ['none', undefined],
    ])
    // Friday: the weekend is tomorrow, so it isn't offered twice; the current date is skipped.
    expect(rescheduleOptions('2026-11-06', 1, '2026-11-06').map((o) => o.id)).toEqual(['tomorrow', 'next-week', 'none'])
    // Sunday-start weeks.
    expect(rescheduleOptions('2026-11-04', 0).find((o) => o.id === 'next-week')?.date).toBe('2026-11-08')
  })

  it('counts subtasks', () => {
    expect(subtaskProgress({ checklist: [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false }] })).toEqual({ done: 1, total: 2 })
    expect(subtaskProgress({ checklist: [] })).toEqual({ done: 0, total: 0 })
  })
})
