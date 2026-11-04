import type { Database } from '@/data/types'
import { type BackupMeta, type StorageAdapter, type StoredBackup, backupMeta } from './adapter'

const DB_NAME = 'life-os'
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

function openDatabase(timeoutMs = 4000): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'))
      return
    }
    const timer = setTimeout(() => reject(new Error('Timed out opening IndexedDB')), timeoutMs)
    const request = indexedDB.open(DB_NAME, DB_VERSION)
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
      reject(new Error('IndexedDB is blocked by another open tab. Close other Atlas tabs and reload.'))
    }
  })
}

/** Default adapter: IndexedDB holds far more than localStorage and never blocks the UI thread. */
export class IndexedDbAdapter implements StorageAdapter {
  readonly label = 'IndexedDB (this browser)'
  readonly kind = 'indexeddb' as const
  readonly persistent = true
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IndexedDbAdapter> {
    return new IndexedDbAdapter(await openDatabase())
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
