import { describe, expect, it } from 'vitest'
import { make } from '@/test/factories'
import { createEmptyDatabase, normaliseSettings } from './defaults'
import { SCHEMA_VERSION, WIDGET_IDS } from './schema'
import { BACKUP_APP_ID, makeBackupFile, mergeDatabases, unwrapBackup, validateDatabase } from './validate'

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

  it('rejects things that are not Atlas backups', () => {
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

describe('backward compatibility after the rename to Atlas', () => {
  it('still writes and accepts the original "life-os" backup id', () => {
    const file = makeBackupFile(createEmptyDatabase())
    expect(file.app).toBe('life-os')
    expect(BACKUP_APP_ID).toBe('life-os')
    // A backup exported before the rename imports unchanged.
    const legacy = { app: 'life-os', kind: 'backup', exportedAt: '2026-01-01T00:00:00Z', schemaVersion: 1, data: createEmptyDatabase() }
    expect(validateDatabase(legacy, { strict: true }).ok).toBe(true)
  })
})
