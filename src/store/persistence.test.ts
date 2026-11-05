import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { totalRecords } from '@/data/validate'
import { MemoryAdapter } from '@/storage/memory'
import { make } from '@/test/factories'
import { applyImport, createBackup, listBackups, pruneAutoBackups, resetAllData, restoreBackup } from './backups'
import { PENDING_KEY, flushSave, initPersistence, teardownPersistence } from './persistence'
import { appStore } from './store'

const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  localStorage.clear()
  appStore.setState({ ready: false, loadError: undefined, notice: undefined })
  appStore.getState().replaceDatabase(createEmptyDatabase())
})
afterEach(() => teardownPersistence())

/** Like IndexedDB: a save takes a while to commit (and closing the page can abort it). */
class SlowAdapter extends MemoryAdapter {
  // @ts-expect-error — pretend to be a persistent store so page-hide stashing applies.
  override readonly kind = 'indexeddb'
  release: (() => void) | undefined
  override async save(db: Parameters<MemoryAdapter['save']>[0]) {
    await new Promise<void>((r) => (this.release = r))
    return super.save(db)
  }
}

describe('persistence', () => {
  it('stashes a save that started but has not committed when the page closes', async () => {
    const adapter = new SlowAdapter()
    await initPersistence({ adapter })
    appStore.getState().create('tasks', { title: 'Typed just before closing' })
    flushSave() // the write starts…
    await tick()
    expect(adapter.release).toBeDefined()
    window.dispatchEvent(new Event('pagehide')) // …and the page closes before it commits.
    const stash = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { db: ReturnType<typeof createEmptyDatabase> } | null
    expect(stash?.db.tasks.map((t) => t.title)).toEqual(['Typed just before closing'])
    adapter.release?.()
  })

  it('starts empty on first run and saves changes', async () => {
    const adapter = new MemoryAdapter()
    await initPersistence({ adapter })
    expect(appStore.getState().ready).toBe(true)
    appStore.getState().create('tasks', { title: 'Persist me' })
    flushSave()
    await tick()
    const saved = (await adapter.load()) as ReturnType<typeof createEmptyDatabase>
    expect(saved.tasks.map((t) => t.title)).toEqual(['Persist me'])
    expect(appStore.getState().save.status).toBe('saved')
  })

  it('loads existing data', async () => {
    const db = createEmptyDatabase()
    db.goals = [make('goals', { title: 'Existing goal' })]
    await initPersistence({ adapter: new MemoryAdapter(db) })
    expect(appStore.getState().db.goals[0].title).toBe('Existing goal')
  })

  it('never overwrites data it cannot read', async () => {
    const raw = { schemaVersion: 999, settings: {} }
    const adapter = new MemoryAdapter(raw)
    await initPersistence({ adapter })
    expect(appStore.getState().loadError?.message).toMatch(/newer version/)
    appStore.getState().create('tasks', { title: 'should not be saved' })
    flushSave()
    await tick()
    expect(await adapter.load()).toEqual(raw)
  })

  it('sets aside unreadable records but keeps a full copy in a backup', async () => {
    const db = { ...createEmptyDatabase(), tasks: [make('tasks', { title: 'good' }), { id: 'bad' }] }
    const adapter = new MemoryAdapter(db)
    await initPersistence({ adapter })
    expect(appStore.getState().db.tasks).toHaveLength(1)
    expect(appStore.getState().notice).toMatch(/1 record/)
    const original = (await adapter.listBackups()).find((b) => b.label?.includes('unreadable'))
    expect(original).toBeDefined()
    expect((await adapter.getBackup(original!.id))?.data.tasks).toHaveLength(2)
  })

  it('recovers a change stashed while the page was closing, if newer', async () => {
    const stored = { ...createEmptyDatabase(), savedAt: '2026-01-01T00:00:00.000Z' }
    const pending = createEmptyDatabase()
    pending.tasks = [make('tasks', { title: 'typed just before closing' })]
    localStorage.setItem(PENDING_KEY, JSON.stringify({ at: '2026-01-01T00:00:01.000Z', db: pending }))
    const adapter = new MemoryAdapter(stored)
    await initPersistence({ adapter })
    expect(appStore.getState().db.tasks[0].title).toBe('typed just before closing')
    expect(localStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('ignores a stale stash older than what was saved', async () => {
    const stored = { ...createEmptyDatabase(), savedAt: '2026-01-02T00:00:00.000Z' }
    stored.tasks = [make('tasks', { title: 'newer in storage' })]
    localStorage.setItem(PENDING_KEY, JSON.stringify({ at: '2026-01-01T00:00:00.000Z', db: createEmptyDatabase() }))
    await initPersistence({ adapter: new MemoryAdapter(stored) })
    expect(appStore.getState().db.tasks[0].title).toBe('newer in storage')
  })
})

describe('backups, import and reset', () => {
  it('creates, restores and prunes backups', async () => {
    await initPersistence({ adapter: new MemoryAdapter() })
    appStore.getState().create('tasks', { title: 'v1' })
    const b = await createBackup('manual')
    appStore.getState().create('tasks', { title: 'v2' })
    expect(appStore.getState().db.tasks).toHaveLength(2)
    await restoreBackup(b.id)
    expect(appStore.getState().db.tasks.map((t) => t.title)).toEqual(['v1'])
    // a safety backup of the state before restoring was created
    expect((await listBackups()).some((x) => x.reason === 'pre-restore')).toBe(true)
    for (let i = 0; i < 4; i++) await createBackup('auto')
    expect(await pruneAutoBackups(2)).toBe(2)
    expect((await listBackups()).filter((x) => x.reason === 'auto')).toHaveLength(2)
  })

  it('merges or replaces imports, always backing up first', async () => {
    await initPersistence({ adapter: new MemoryAdapter() })
    appStore.getState().create('tasks', { title: 'mine' })
    const incoming = createEmptyDatabase()
    incoming.tasks = [make('tasks', { title: 'theirs' })]
    await applyImport(incoming, 'merge')
    expect(appStore.getState().db.tasks.map((t) => t.title).sort()).toEqual(['mine', 'theirs'])
    await applyImport(incoming, 'replace')
    expect(appStore.getState().db.tasks.map((t) => t.title)).toEqual(['theirs'])
    expect((await listBackups()).filter((b) => b.reason === 'pre-import')).toHaveLength(2)
  })

  it('erases records but keeps a backup and (optionally) settings', async () => {
    await initPersistence({ adapter: new MemoryAdapter() })
    appStore.getState().updateSettings({ displayName: 'Lin' })
    appStore.getState().create('notes', { title: 'n' })
    await resetAllData({ keepSettings: true })
    expect(totalRecords(appStore.getState().db)).toBe(0)
    expect(appStore.getState().db.settings.displayName).toBe('Lin')
    const backups = await listBackups()
    expect(backups.find((b) => b.reason === 'pre-reset')?.recordCount).toBe(1)
  })
})

describe('several tabs, imports and restores', () => {
  it('merges another tab’s save instead of overwriting it', async () => {
    const adapter = new MemoryAdapter()
    await initPersistence({ adapter })
    appStore.getState().create('tasks', { title: 'Saved here' })
    flushSave()
    await tick()
    // Another tab adds a task and saves the whole database (it never saw ours yet).
    const theirs = { ...createEmptyDatabase(), tasks: [make('tasks', { title: 'Saved in the other tab', rev: 1 })], savedAt: '2999-01-01T00:00:00.000Z' }
    await adapter.save(theirs as never)
    localStorage.setItem('life-os:save-stamp', JSON.stringify({ tab: 'other-tab', savedAt: '2999-01-01T00:00:00.000Z' }))
    // This tab makes its own change and saves: both tabs' work survives.
    appStore.getState().create('tasks', { title: 'Then this' })
    flushSave()
    await tick()
    await tick()
    const saved = (await adapter.load()) as ReturnType<typeof createEmptyDatabase>
    expect(saved.tasks.map((t) => t.title).sort()).toEqual(['Saved here', 'Saved in the other tab', 'Then this'])
    expect(appStore.getState().db.tasks).toHaveLength(3)
  })

  it('saves the cleaned data once after setting unreadable records aside', async () => {
    const adapter = new MemoryAdapter({ ...createEmptyDatabase(), tasks: [make('tasks', { title: 'good' }), { id: 'bad' }] })
    await initPersistence({ adapter })
    flushSave()
    await tick()
    expect(((await adapter.load()) as ReturnType<typeof createEmptyDatabase>).tasks).toHaveLength(1)
  })

  it('a replace-import keeps this device’s display preferences', async () => {
    await initPersistence({ adapter: new MemoryAdapter() })
    appStore.getState().updateSettings({ textScale: 110, sidebarCollapsed: true, displayName: 'Here' })
    const incoming = { ...createEmptyDatabase(), settings: { ...createEmptyDatabase().settings, textScale: 125 as const, sidebarCollapsed: false, displayName: 'There' } }
    await applyImport(incoming, 'replace')
    const s = appStore.getState().db.settings
    expect(s).toMatchObject({ textScale: 110, sidebarCollapsed: true, displayName: 'There', onboarded: true })
  })

  it('restoring a backup reports records it had to leave out', async () => {
    const adapter = new MemoryAdapter()
    await initPersistence({ adapter })
    await adapter.putBackup({ id: 'b1', createdAt: new Date().toISOString(), reason: 'manual', sizeBytes: 1, recordCount: 2, data: { ...createEmptyDatabase(), tasks: [make('tasks', { title: 'ok' }), { id: 'broken' }] } as never })
    expect(await restoreBackup('b1')).toEqual({ rejected: 1 })
    expect(appStore.getState().db.tasks.map((t) => t.title)).toEqual(['ok'])
  })
})
