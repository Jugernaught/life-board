import type { Database } from '@/data/types'
import { type BackupMeta, type StorageAdapter, type StoredBackup, backupMeta } from './adapter'

const PREFIX = 'life-os'
const DB_KEY = `${PREFIX}:database`
const INDEX_KEY = `${PREFIX}:backups`
const backupKey = (id: string) => `${PREFIX}:backup:${id}`

/** Fallback when IndexedDB is unavailable. Limited to roughly 5 MB by browsers. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly label = 'localStorage (this browser)'
  readonly kind = 'localstorage' as const
  readonly persistent = true

  static isAvailable(): boolean {
    try {
      const k = `${PREFIX}:probe`
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
      return true
    } catch {
      return false
    }
  }

  private setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      throw new Error(`Browser storage is full or blocked (${(e as Error).name}). Export a backup and free some space.`, { cause: e })
    }
  }

  async load(): Promise<unknown | null> {
    const raw = localStorage.getItem(DB_KEY)
    return raw ? JSON.parse(raw) : null
  }

  async save(db: Database): Promise<void> {
    this.setItem(DB_KEY, JSON.stringify(db))
  }

  private index(): BackupMeta[] {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as BackupMeta[]
    } catch {
      return []
    }
  }

  async listBackups(): Promise<BackupMeta[]> {
    return this.index().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  async getBackup(id: string): Promise<StoredBackup | null> {
    const raw = localStorage.getItem(backupKey(id))
    return raw ? (JSON.parse(raw) as StoredBackup) : null
  }

  async putBackup(backup: StoredBackup): Promise<void> {
    this.setItem(backupKey(backup.id), JSON.stringify(backup))
    const index = this.index().filter((b) => b.id !== backup.id)
    index.push(backupMeta(backup))
    this.setItem(INDEX_KEY, JSON.stringify(index))
  }

  async deleteBackup(id: string): Promise<void> {
    localStorage.removeItem(backupKey(id))
    this.setItem(INDEX_KEY, JSON.stringify(this.index().filter((b) => b.id !== id)))
  }
}
