import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { actions, appStore } from '@/store/store'
import { addTemplates, existingTemplateIds, showGettingStarted, startSteps } from './model'

describe('getting started', () => {
  beforeEach(() => appStore.setState({ db: createEmptyDatabase(), ready: true, history: [] }))

  it('ticks steps off from real data and hides when done or dismissed', () => {
    const db = createEmptyDatabase()
    const steps = startSteps(db, false)
    expect(steps.every((s) => !s.done)).toBe(true)
    expect(showGettingStarted(steps, false)).toBe(true)
    expect(showGettingStarted(steps, true)).toBe(false)
    const all = steps.map((s) => ({ ...s, done: true }))
    expect(showGettingStarted(all, false)).toBe(false)
  })

  it('adds only the picked templates, as real records, and never twice', () => {
    const r = addTemplates(['read', 'weekly-review', 'nope'], '2026-11-04')
    expect(r).toEqual({ habits: 1, tasks: 1 })
    const db = actions.getDb()
    expect(db.habits.map((h) => h.name)).toEqual(['Read 20 minutes'])
    const review = db.tasks[0]
    // Weekly on Sunday: the first one is the coming Sunday, with its checklist ready.
    expect(review).toMatchObject({ title: 'Weekly review', dueDate: '2026-11-08', repeat: { freq: 'weekly', days: [0] } })
    expect(review.checklist).toHaveLength(4)
    expect([...existingTemplateIds(db)].sort()).toEqual(['read', 'weekly-review'])
    expect(startSteps(db, false).find((s) => s.id === 'habit')?.done).toBe(true)
  })
})
