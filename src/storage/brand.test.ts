import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { makeBackupFile, unwrapBackup } from '@/data/validate'
import { APP_KEY, LEGACY_APP_KEY, migrateLegacyLocalStorage, storageKey } from './brand'
import { IndexedDbAdapter } from './indexedDb'
import { LocalStorageAdapter } from './localStorage'
import type { StoredBackup } from './adapter'

/** Write data the way the pre-rename (LIFE OS) build did: a `life-os` database. */
function seedLegacyDatabase(state: unknown, backups: StoredBackup[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_APP_KEY, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('state')
      req.result.createObjectStore('backups', { keyPath: 'id' })
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(['state', 'backups'], 'readwrite')
      if (state !== undefined) tx.objectStore('state').put(state, 'database')
      for (const b of backups) tx.objectStore('backups').put(b)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((d) => d.name ?? '')
}

/** deleteDatabase is fire-and-forget in the adapter; let it settle. */
const settle = () => new Promise((r) => setTimeout(r, 20))

function backup(id: string, createdAt: string): StoredBackup {
  return { id, createdAt, reason: 'manual', sizeBytes: 10, recordCount: 0, data: createEmptyDatabase() }
}

describe('storage identity', () => {
  it('names everything after ATLAS', () => {
    expect(APP_KEY).toBe('atlas')
    expect(storageKey('appearance')).toBe('atlas:appearance')
  })
})

describe('migrateLegacyLocalStorage', () => {
  beforeEach(() => localStorage.clear())

  it('moves every life-os:* key to atlas:* and removes the old ones', () => {
    localStorage.setItem('life-os:appearance', '{"style":"glass"}')
    localStorage.setItem('life-os:backup:b1', '{"id":"b1"}')
    localStorage.setItem('unrelated', 'keep me')

    expect(migrateLegacyLocalStorage()).toBe(2)
    expect(localStorage.getItem('atlas:appearance')).toBe('{"style":"glass"}')
    expect(localStorage.getItem('atlas:backup:b1')).toBe('{"id":"b1"}')
    expect(localStorage.getItem('life-os:appearance')).toBeNull()
    expect(localStorage.getItem('life-os:backup:b1')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep me')
  })

  it('is idempotent', () => {
    localStorage.setItem('life-os:study-timer', '{"running":false}')
    expect(migrateLegacyLocalStorage()).toBe(1)
    expect(migrateLegacyLocalStorage()).toBe(0)
    expect(localStorage.getItem('atlas:study-timer')).toBe('{"running":false}')
  })

  it('never overwrites a value already saved under the new name', () => {
    localStorage.setItem('atlas:appearance', 'new')
    localStorage.setItem('life-os:appearance', 'old')
    expect(migrateLegacyLocalStorage()).toBe(0)
    expect(localStorage.getItem('atlas:appearance')).toBe('new')
    expect(localStorage.getItem('life-os:appearance')).toBeNull()
  })

  it('puts the old value back and stops if the new write fails (quota)', () => {
    const data = new Map<string, string>([
      ['life-os:database', 'BIG'],
      ['life-os:pending-save', 'later'],
    ])
    let failWrites = true
    const store: Storage = {
      get length() {
        return data.size
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        if (failWrites && k.startsWith('atlas:')) throw new DOMException('full', 'QuotaExceededError')
        data.set(k, v)
      },
      removeItem: (k) => void data.delete(k),
      clear: () => data.clear(),
    }
    expect(migrateLegacyLocalStorage(store)).toBe(0)
    expect(data.get('life-os:database')).toBe('BIG')
    expect(data.get('life-os:pending-save')).toBe('later')
    expect(data.has('atlas:database')).toBe(false)

    failWrites = false
    expect(migrateLegacyLocalStorage(store)).toBe(2)
    expect(data.get('atlas:database')).toBe('BIG')
  })

  it('does nothing when storage is unavailable or blocked', () => {
    expect(migrateLegacyLocalStorage(undefined)).toBe(0)
    const blocked = {
      get length(): number {
        throw new DOMException('blocked', 'SecurityError')
      },
    } as unknown as Storage
    expect(migrateLegacyLocalStorage(blocked)).toBe(0)
  })

  it('lets the localStorage adapter find a pre-rename database', async () => {
    const db = createEmptyDatabase()
    db.settings.displayName = 'Ada'
    localStorage.setItem('life-os:database', JSON.stringify(db))
    migrateLegacyLocalStorage()
    const loaded = (await new LocalStorageAdapter().load()) as typeof db
    expect(loaded.settings.displayName).toBe('Ada')
  })
})

describe('IndexedDB migration from life-os to atlas', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  it('moves the saved state and every backup, then deletes the old database', async () => {
    const db = createEmptyDatabase()
    db.settings.displayName = 'Grace'
    await seedLegacyDatabase(db, [backup('b1', '2026-01-01T00:00:00.000Z'), backup('b2', '2026-02-01T00:00:00.000Z')])

    const adapter = await IndexedDbAdapter.open()
    expect(((await adapter.load()) as typeof db).settings.displayName).toBe('Grace')
    expect((await adapter.listBackups()).map((b) => b.id)).toEqual(['b2', 'b1'])
    expect((await adapter.getBackup('b1'))?.data).toBeTruthy()

    await settle()
    expect(await databaseNames()).toEqual(['atlas'])
  })

  it('moves backups even when there is no saved state', async () => {
    await seedLegacyDatabase(undefined, [backup('b1', '2026-01-01T00:00:00.000Z')])
    const adapter = await IndexedDbAdapter.open()
    expect(await adapter.load()).toBeNull()
    expect((await adapter.listBackups()).map((b) => b.id)).toEqual(['b1'])
  })

  it('carries unreadable data across untouched so the recovery screen still sees it', async () => {
    await seedLegacyDatabase('this is not a database')
    const adapter = await IndexedDbAdapter.open()
    expect(await adapter.load()).toBe('this is not a database')
  })

  it('does not create a life-os database on a fresh install', async () => {
    const adapter = await IndexedDbAdapter.open()
    expect(await adapter.load()).toBeNull()
    expect(await databaseNames()).toEqual(['atlas'])
  })

  it('never overwrites data already saved under atlas', async () => {
    const fresh = await IndexedDbAdapter.open()
    const current = createEmptyDatabase()
    current.settings.displayName = 'Current'
    await fresh.save(current)

    const old = createEmptyDatabase()
    old.settings.displayName = 'Old'
    await seedLegacyDatabase(old)

    const reopened = await IndexedDbAdapter.open()
    expect(((await reopened.load()) as typeof current).settings.displayName).toBe('Current')
    // The old database is left alone rather than silently discarded.
    expect((await databaseNames()).sort()).toEqual(['atlas', 'life-os'])
  })

  it('is a one-time move: reopening does not duplicate or resurrect anything', async () => {
    const db = createEmptyDatabase()
    await seedLegacyDatabase(db, [backup('b1', '2026-01-01T00:00:00.000Z')])
    const first = await IndexedDbAdapter.open()
    await first.deleteBackup('b1')
    await settle()

    const second = await IndexedDbAdapter.open()
    expect(await second.listBackups()).toEqual([])
    expect(await databaseNames()).toEqual(['atlas'])
  })
})

describe('backup files', () => {
  it('are stamped as ATLAS backups', () => {
    expect(makeBackupFile(createEmptyDatabase()).app).toBe('atlas')
  })

  it('still import when exported before the rename', () => {
    const db = createEmptyDatabase()
    const legacyFile = { ...makeBackupFile(db), app: 'life-os' }
    expect(unwrapBackup(legacyFile)).toEqual(db)
  })

  it('reject other apps’ files', () => {
    expect(() => unwrapBackup({ app: 'something-else', kind: 'backup', data: {} })).toThrow(/does not look like/)
  })
})
