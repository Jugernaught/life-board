import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import type { Database } from '@/data/types'
import { MISSED_GRACE_MS, upcomingReminders } from './reminders'

const base = createEmptyDatabase()
const settings = (patch: Partial<Database['settings']['reminders']> = {}) => ({ ...base.settings, reminders: { ...base.settings.reminders, enabled: true, ...patch } })
const now = new Date('2026-11-04T09:00:00').getTime()
const task = (p: Partial<Database['tasks'][number]>) => ({ id: p.id ?? 't1', title: 'Call', status: 'todo', priority: 'medium', area: 'personal', tags: [], checklist: [], createdAt: '', updatedAt: '', ...p }) as Database['tasks'][number]
const event = (p: Partial<Database['events'][number]>) => ({ id: p.id ?? 'e1', title: 'Gym', kind: 'event', area: 'health', date: '2026-11-04', allDay: false, createdAt: '', updatedAt: '', ...p }) as Database['events'][number]

describe('reminders', () => {
  it('does nothing until turned on', () => {
    const db = { tasks: [task({ dueDate: '2026-11-04', dueTime: '10:00' })], events: [] }
    expect(upcomingReminders(db, base.settings, now)).toEqual([])
  })

  it('reminds before timed tasks and events, using per-task leads', () => {
    const db = {
      tasks: [task({ id: 'a', dueDate: '2026-11-04', dueTime: '10:00' }), task({ id: 'b', dueDate: '2026-11-04', dueTime: '12:00', remindBefore: 60 }), task({ id: 'c', dueDate: '2026-11-04' }), task({ id: 'd', dueDate: '2026-11-04', dueTime: '11:00', status: 'done' })],
      events: [event({ startTime: '18:00', location: 'Leisure centre' }), event({ id: 'all', allDay: true })],
    }
    const list = upcomingReminders(db, settings({ lead: 10 }), now)
    expect(list.map((r) => [r.recordId, new Date(r.at).toTimeString().slice(0, 5)])).toEqual([
      ['a', '09:50'],
      ['b', '11:00'],
      ['e1', '17:50'],
    ])
    expect(list[2].body).toBe('Starts in 10 min · 18:00 · Leisure centre')
    expect(list[1].body).toBe('Task due in 1 h · 12:00')
  })

  it('respects the task and event switches, but keeps reminders set on a task', () => {
    const db = { tasks: [task({ id: 'a', dueDate: '2026-11-04', dueTime: '10:00' }), task({ id: 'b', dueDate: '2026-11-04', dueTime: '12:00', remindBefore: 0 })], events: [event({ startTime: '18:00' })] }
    expect(upcomingReminders(db, settings({ tasks: false, events: false }), now).map((r) => r.recordId)).toEqual(['b'])
  })

  it('still shows a recently missed reminder once, but not old ones', () => {
    const db = { tasks: [task({ id: 'late', dueDate: '2026-11-04', dueTime: '09:05' }), task({ id: 'old', dueDate: '2026-11-04', dueTime: '08:00' })], events: [] }
    const list = upcomingReminders(db, settings({ lead: 10 }), now)
    expect(list.map((r) => r.recordId)).toEqual(['late'])
    expect(now - list[0].at).toBeLessThan(MISSED_GRACE_MS)
    // Moving a task changes its key, so the reminder re-arms.
    const moved = upcomingReminders({ ...db, tasks: [task({ id: 'late', dueDate: '2026-11-04', dueTime: '09:30' })] }, settings({ lead: 10 }), now)
    expect(moved[0].key).not.toBe(list[0].key)
  })
})
