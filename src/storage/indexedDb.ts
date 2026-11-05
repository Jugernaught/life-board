import type { Database } from '@/data/types'
import { type BackupMeta, type StorageAdapter, type StoredBackup, backupMeta } from './adapter'
import { APP_KEY, LEGACY_APP_KEY } from './brand'

const DB_NAME = APP_KEY
/** Where the data lived before the LIFE OS → ATLAS rename. */
const LEGACY_DB_NAME = LEGACY_APP_KEY
const DB_VERSION = 1
const STATE_STORE = 'state'
const BACKUP_STORE = 'backups'
const STATE_KEY = 'database'

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function openDatabase(timeoutMs = 4000, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }
    const timer = setTimeout(() => reject(new Error('Timed out opening IndexedDB')), timeoutMs)
    const request = indexedDB.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE)
      if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => {
      clearTimeout(timer)
      const db = request.result
      // If another tab upgrades the schema, close so it isn't blocked.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => {
      clearTimeout(timer)
      reject(request.error ?? new Error('Could not open IndexedDB'))
    }
    request.onblocked = () => {
      clearTimeout(timer)
      reject(new Error('IndexedDB is blocked by another open tab. Close other ATLAS tabs and reload.'))
    }
  })
}

/**
 * Open a database only if it already exists. Opening a missing database
 * normally creates it; aborting the version-change transaction instead makes
 * the open fail and leaves nothing behind. Resolves null when there is none.
 */
function openExisting(name: string, timeoutMs = 4000): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    const request = indexedDB.open(name)
    request.onupgradeneeded = (event) => {
      if (event.oldVersion === 0) request.transaction?.abort()
    }
    request.onsuccess = () => {
      clearTimeout(timer)
      resolve(request.result)
    }
    request.onerror = (event) => {
      event.preventDefault()
      clearTimeout(timer)
      resolve(null)
    }
    request.onblocked = () => {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

function readAll(db: IDBDatabase): Promise<{ state: unknown; backups: StoredBackup[] }> {
  return new Promise((resolve, reject) => {
    const stores = [STATE_STORE, BACKUP_STORE].filter((s) => db.objectStoreNames.contains(s))
    if (stores.length === 0) {
      resolve({ state: undefined, backups: [] })
      return
    }
    const tx = db.transaction(stores, 'readonly')
    let state: unknown
    let backups: StoredBackup[] = []
    if (stores.includes(STATE_STORE)) tx.objectStore(STATE_STORE).get(STATE_KEY).onsuccess = (e) => (state = (e.target as IDBRequest).result)
    if (stores.includes(BACKUP_STORE)) tx.objectStore(BACKUP_STORE).getAll().onsuccess = (e) => (backups = (e.target as IDBRequest<StoredBackup[]>).result)
    tx.oncomplete = () => resolve({ state, backups })
    tx.onerror = () => reject(tx.error ?? new Error('Could not read the old database'))
  })
}

/**
 * One-time move of the pre-rename `life-os` database into `atlas`. Runs only
 * when `atlas` holds nothing yet, copies the saved state and every backup in
 * a single transaction, and deletes the old database only after that copy
 * has committed — so an interrupted move simply runs again next launch.
 * Returns true when data was moved.
 */
export async function migrateLegacyDatabase(target: IDBDatabase): Promise<boolean> {
  const empty = await new Promise<boolean>((resolve, reject) => {
    const tx = target.transaction([STATE_STORE, BACKUP_STORE], 'readonly')
    let stateCount = 0
    let backupCount = 0
    tx.objectStore(STATE_STORE).count().onsuccess = (e) => (stateCount = (e.target as IDBRequest<number>).result)
    tx.objectStore(BACKUP_STORE).count().onsuccess = (e) => (backupCount = (e.target as IDBRequest<number>).result)
    tx.oncomplete = () => resolve(stateCount === 0 && backupCount === 0)
    tx.onerror = () => reject(tx.error ?? new Error('Could not inspect the database'))
  })
  if (!empty) return false

  const legacy = await openExisting(LEGACY_DB_NAME)
  if (!legacy) return false
  let snapshot: { state: unknown; backups: StoredBackup[] }
  try {
    snapshot = await readAll(legacy)
  } finally {
    legacy.close()
  }
  const hasState = snapshot.state !== undefined && snapshot.state !== null
  if (hasState || snapshot.backups.length) {
    await new Promise<void>((resolve, reject) => {
      const tx = target.transaction([STATE_STORE, BACKUP_STORE], 'readwrite')
      if (hasState) tx.objectStore(STATE_STORE).put(snapshot.state, STATE_KEY)
      const backups = tx.objectStore(BACKUP_STORE)
      for (const b of snapshot.backups) backups.put(b)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not copy data from the old database'))
      tx.onabort = () => reject(tx.error ?? new Error('Copying data from the old database was aborted (storage may be full)'))
    })
  }
  // Copy committed: the old database is now redundant. Fire and forget — if
  // a stale tab still holds it open, deletion finishes once that tab closes.
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME)
  } catch {
    /* ignore */
  }
  return hasState || snapshot.backups.length > 0
}

/** Default adapter: IndexedDB holds far more than localStorage and never blocks the UI thread. */
export class IndexedDbAdapter implements StorageAdapter {
  readonly label = 'IndexedDB (this browser)'
  readonly kind = 'indexeddb' as const
  readonly persistent = true
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IndexedDbAdapter> {
    const db = await openDatabase()
    try {
      await migrateLegacyDatabase(db)
    } catch (e) {
      // The old database is untouched. Keep working from it this session —
      // never show an empty app over real data — and retry the move next launch.
      console.warn('Could not move data from the pre-rename database; using it in place', e)
      db.close()
      return new IndexedDbAdapter(await openDatabase(undefined, LEGACY_DB_NAME))
    }
    return new IndexedDbAdapter(db)
  }

  private tx(store: string, mode: IDBTransactionMode) {
    return this.db.transaction(store, mode).objectStore(store)
  }

  private write(store: string, fn: (s: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(store, 'readwrite')
      fn(transaction.objectStore(store))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Write failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Write aborted (storage may be full)'))
    })
  }

  async load(): Promise<unknown | null> {
    const value = await promisify(this.tx(STATE_STORE, 'readonly').get(STATE_KEY))
    return value ?? null
  }

  save(db: Database): Promise<void> {
    return this.write(STATE_STORE, (s) => s.put(db, STATE_KEY))
  }

  async listBackups(): Promise<BackupMeta[]> {
    const all = (await promisify(this.tx(BACKUP_STORE, 'readonly').getAll())) as StoredBackup[]
    return all.map(backupMeta).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  async getBackup(id: string): Promise<StoredBackup | null> {
    return ((await promisify(this.tx(BACKUP_STORE, 'readonly').get(id))) as StoredBackup | undefined) ?? null
  }

  putBackup(backup: StoredBackup): Promise<void> {
    return this.write(BACKUP_STORE, (s) => s.put(backup))
  }

  deleteBackup(id: string): Promise<void> {
    return this.write(BACKUP_STORE, (s) => s.delete(id))
  }
}
