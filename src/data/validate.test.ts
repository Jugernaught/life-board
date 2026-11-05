import { describe, expect, it } from 'vitest'
import { make } from '@/test/factories'
import { createEmptyDatabase, normaliseSettings } from './defaults'
import { SCHEMA_VERSION, WIDGET_IDS } from './schema'
import { ACTIVITY_LIMIT, makeBackupFile, mergeDatabases, mergeDeletions, unwrapBackup, validateDatabase } from './validate'

describe('validateDatabase', () => {
  it('accepts an empty database and a wrapped backup file', () => {
    const db = createEmptyDatabase()
    expect(validateDatabase(db).ok).toBe(true)
    expect(validateDatabase(makeBackupFile(db)).ok).toBe(true)
  })

  it('fills missing collections and settings from defaults (older/partial files)', () => {
    const r = validateDatabase({ schemaVersion: 1, settings: { displayName: 'Ada' }, tasks: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.db.settings.displayName).toBe('Ada')
    expect(r.db.settings.currency).toBe('GBP')
    expect(r.db.habits).toEqual([])
  })

  it('lists invalid records instead of silently dropping them', () => {
    const good = make('tasks', { title: 'ok' })
    const raw = { ...createEmptyDatabase(), tasks: [good, { id: 'x', title: '', createdAt: 'a', updatedAt: 'a' }] }
    const strict = validateDatabase(raw)
    expect(strict.ok).toBe(false)
    expect(strict.rejected).toHaveLength(1)
    const lenient = validateDatabase(raw, { strict: false })
    expect(lenient.ok).toBe(true)
    if (lenient.ok) expect(lenient.db.tasks).toHaveLength(1)
    expect(lenient.rejected[0]).toMatchObject({ collection: 'tasks', index: 1, id: 'x' })
  })

  it('rejects duplicate ids', () => {
    const t = make('tasks', { title: 'dup' })
    const r = validateDatabase({ ...createEmptyDatabase(), tasks: [t, t] }, { strict: false })
    expect(r.rejected[0].problems[0]).toMatch(/Duplicate/)
  })

  it('refuses data from a newer schema version so nothing is lost', () => {
    const r = validateDatabase({ ...createEmptyDatabase(), schemaVersion: SCHEMA_VERSION + 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/newer version/)
  })

  it('keeps unknown fields (forward compatibility)', () => {
    const t = { ...make('tasks', { title: 'x' }), futureField: 42 }
    const r = validateDatabase({ ...createEmptyDatabase(), tasks: [t] })
    expect(r.ok && (r.db.tasks[0] as Record<string, unknown>).futureField).toBe(42)
  })

  it('rejects things that are not LIFE OS backups', () => {
    expect(() => unwrapBackup([])).toThrow()
    expect(() => unwrapBackup({ hello: 'world' })).toThrow(/does not look like/)
    expect(validateDatabase('nope').ok).toBe(false)
  })
})

describe('mergeDatabases', () => {
  it('adds new records and keeps the most recently edited copy', () => {
    const a = createEmptyDatabase()
    const shared = make('tasks', { title: 'old', updatedAt: '2026-01-01T00:00:00.000Z' })
    a.tasks = [shared, make('tasks', { title: 'only-mine' })]
    const b = createEmptyDatabase()
    b.tasks = [{ ...shared, title: 'newer', updatedAt: '2026-02-01T00:00:00.000Z' }, make('tasks', { title: 'only-theirs' })]
    const r = mergeDatabases(a, b)
    expect(r.added).toBe(1)
    expect(r.updated).toBe(1)
    expect(r.db.tasks.map((t) => t.title).sort()).toEqual(['newer', 'only-mine', 'only-theirs'])
  })
})

describe('normaliseSettings', () => {
  it('keeps the dashboard order, drops unknown widgets and appends new ones', () => {
    const s = normaliseSettings({ dashboard: [{ id: 'notes', visible: false, size: 'xl' }, { id: 'bogus' as never, visible: true, size: 's' }] })
    expect(s.dashboard[0]).toEqual({ id: 'notes', visible: false, size: 'xl' })
    expect(s.dashboard.map((w) => w.id).sort()).toEqual([...WIDGET_IDS].sort())
  })
})

describe('normaliseSettings robustness', () => {
  it('replaces individual invalid values with defaults instead of failing', () => {
    const s = normaliseSettings({ currency: 'TOO-LONG', theme: 'neon' as never, displayName: 'Kai' })
    expect(s.currency).toBe('GBP')
    expect(s.theme).toBe('dark')
    expect(s.displayName).toBe('Kai')
  })
})

describe('merging by revision, with deletions', () => {
  const at = (h: number) => `2026-11-05T${String(h).padStart(2, '0')}:00:00.000Z`

  it('prefers the higher revision even when that device’s clock is behind', () => {
    const id = 'task-1'
    const a = { ...createEmptyDatabase(), tasks: [make('tasks', { id, title: 'Edited twice here', rev: 3, updatedAt: at(9) })] }
    // The other copy claims a later time (clock running fast) but saw fewer edits.
    const b = { ...createEmptyDatabase(), tasks: [make('tasks', { id, title: 'Edited once there', rev: 2, updatedAt: at(18) })] }
    expect(mergeDatabases(a, b).db.tasks[0].title).toBe('Edited twice here')
    expect(mergeDatabases(b, a).db.tasks[0].title).toBe('Edited twice here')
    // Equal revisions (or old data without them) fall back to the later edit.
    const c = { ...createEmptyDatabase(), tasks: [make('tasks', { id, title: 'Later', updatedAt: at(12) })] }
    const d = { ...createEmptyDatabase(), tasks: [make('tasks', { id, title: 'Earlier', updatedAt: at(10) })] }
    expect(mergeDatabases(d, c).db.tasks[0].title).toBe('Later')
  })

  it('keeps deleted records deleted, unless they were edited after the deletion', () => {
    const gone = make('tasks', { id: 'gone', title: 'Deleted here', rev: 2 })
    const editedLater = make('tasks', { id: 'kept', title: 'Edited there after deletion', rev: 4 })
    const here = { ...createEmptyDatabase(), deletions: [{ key: 'tasks', id: 'gone', rev: 2, at: new Date().toISOString() }, { key: 'tasks', id: 'kept', rev: 3, at: new Date().toISOString() }] }
    const there = { ...createEmptyDatabase(), tasks: [gone, editedLater] }
    const r = mergeDatabases(here, there)
    expect(r.db.tasks.map((t) => t.id)).toEqual(['kept'])
    expect(r.removed).toBe(1)
    // The deletion that lost is forgotten; the one that won is kept (and travels with the data).
    expect(r.db.deletions.map((m) => m.id)).toEqual(['gone'])
    expect(mergeDatabases(there, here).db.tasks.map((t) => t.id)).toEqual(['kept'])
  })

  it('combines deletion lists, forgets very old ones, and caps the merged activity log', () => {
    const old = { key: 'notes', id: 'n', rev: 1, at: '2020-01-01T00:00:00.000Z' }
    const recent = { key: 'notes', id: 'm', rev: 1, at: new Date().toISOString() }
    expect(mergeDeletions([old], [recent]).map((m) => m.id)).toEqual(['m'])
    const many = Array.from({ length: ACTIVITY_LIMIT + 50 }, (_, i) => ({ id: `a${i}`, at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), action: 'created', collection: 'tasks', entityId: 'x', label: 'x' }))
    const a = { ...createEmptyDatabase(), activity: many.slice(0, 2000) } as never
    const b = { ...createEmptyDatabase(), activity: many.slice(2000) } as never
    expect(mergeDatabases(a, b).db.activity).toHaveLength(ACTIVITY_LIMIT)
  })
})
