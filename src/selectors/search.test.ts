import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import type { Database } from '@/data/types'
import { fuzzyScore, searchDatabase } from './search'

const task = (id: string, title: string) => ({ id, title, status: 'todo', priority: 'medium', area: 'personal', tags: [], checklist: [], createdAt: '', updatedAt: '2026-11-01T00:00:00Z' }) as Database['tasks'][number]

describe('search', () => {
  it('scores letters-in-order matches below real word matches', () => {
    expect(fuzzyScore('grcrs', 'buy groceries')).toBeGreaterThan(0)
    expect(fuzzyScore('grcrs', 'buy groceries')).toBeLessThan(30)
    expect(fuzzyScore('xyz', 'buy groceries')).toBe(0)
    expect(fuzzyScore('ab', 'abc')).toBe(0) // too short to guess
    expect(fuzzyScore('gro', 'groceries')).toBeGreaterThan(fuzzyScore('gro', 'go to the rodeo'))
    // Letters scattered across a long title don't count.
    expect(fuzzyScore('bat', 'b' + 'x'.repeat(30) + 'a' + 'x'.repeat(30) + 't')).toBe(0)
  })

  it('finds typos and abbreviations, with exact matches first', () => {
    const db = { ...createEmptyDatabase(), tasks: [task('a', 'Buy groceries'), task('b', 'Groceries list'), task('c', 'Call the dentist')] }
    expect(searchDatabase(db, 'groceries').map((r) => r.id)).toEqual(['b', 'a'])
    expect(searchDatabase(db, 'grocries').map((r) => r.id)).toEqual(['b', 'a'])
    expect(searchDatabase(db, 'dentst').map((r) => r.id)).toEqual(['c'])
  })
})
