import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { IndexedDbAdapter } from './indexedDb'
import { LocalStorageAdapter } from './localStorage'
import { MemoryAdapter } from './memory'
import type { StorageAdapter } from './adapter'

async function exercise(adapter: StorageAdapter) {
  expect(await adapter.load()).toBeNull()
  const db = createEmptyDatabase()
  db.settings.displayName = 'Grace'
  await adapter.save(db)
  expect(((await adapter.load()) as typeof db).settings.displayName).toBe('Grace')
  const backup = { id: 'b1', createdAt: '2026-01-01T00:00:00.000Z', reason: 'manual' as const, sizeBytes: 10, recordCount: 0, data: db }
  await adapter.putBackup(backup)
  await adapter.putBackup({ ...backup, id: 'b2', createdAt: '2026-02-01T00:00:00.000Z' })
  const list = await adapter.listBackups()
  expect(list.map((b) => b.id)).toEqual(['b2', 'b1'])
  expect('data' in list[0]).toBe(false)
  expect((await adapter.getBackup('b1'))?.data.settings.displayName).toBe('Grace')
  await adapter.deleteBackup('b1')
  expect((await adapter.listBackups()).map((b) => b.id)).toEqual(['b2'])
}

describe('storage adapters', () => {
  it('IndexedDB adapter saves, loads and manages backups', async () => {
    await exercise(await IndexedDbAdapter.open())
  })
  it('localStorage adapter does the same', async () => {
    localStorage.clear()
    expect(LocalStorageAdapter.isAvailable()).toBe(true)
    await exercise(new LocalStorageAdapter())
  })
  it('memory adapter does the same and returns copies', async () => {
    const m = new MemoryAdapter()
    await exercise(m)
    const loaded = (await m.load()) as ReturnType<typeof createEmptyDatabase>
    loaded.settings.displayName = 'mutated'
    expect(((await m.load()) as typeof loaded).settings.displayName).toBe('Grace')
  })
})
