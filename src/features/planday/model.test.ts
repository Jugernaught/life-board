import { describe, expect, it } from 'vitest'
import type { Task } from '@/data/types'
import { overdueTasks, planSteps, priorityCandidates, priorityChanges } from './model'

const today = '2026-11-04'
const t = (id: string, p: Partial<Task> = {}) => ({ id, title: id, status: 'todo', priority: 'medium', area: 'personal', tags: [], checklist: [], createdAt: '', updatedAt: '', ...p }) as Task

describe('plan my day', () => {
  const tasks = [
    t('starred', { focusDate: today, priority: 'low' }),
    t('due', { dueDate: today }),
    t('late', { dueDate: '2026-11-01', priority: 'urgent' }),
    t('soonHigh', { dueDate: '2026-11-06', priority: 'high' }),
    t('laterHigh', { dueDate: '2026-11-20', priority: 'high' }),
    t('undatedHigh', { priority: 'high' }),
    t('undatedLow'),
    t('done', { dueDate: today, status: 'done' }),
  ]

  it('offers starred, due and important tasks, starred first then by importance', () => {
    expect(priorityCandidates(tasks, today).map((x) => x.id)).toEqual(['starred', 'late', 'soonHigh', 'undatedHigh', 'due'])
  })

  it('lists overdue tasks and skips the catch-up step when there are none', () => {
    expect(overdueTasks(tasks, today).map((x) => x.id)).toEqual(['late'])
    expect(planSteps(true)[0]).toBe('overdue')
    expect(planSteps(false)).toEqual(['priorities', 'day', 'intention'])
  })

  it('computes exactly the focus changes needed', () => {
    expect(priorityChanges(tasks, new Set(['due', 'late']), today)).toEqual([
      { id: 'starred', focusDate: undefined },
      { id: 'due', focusDate: today },
      { id: 'late', focusDate: today },
    ])
    expect(priorityChanges(tasks, new Set(['starred']), today)).toEqual([])
  })
})
