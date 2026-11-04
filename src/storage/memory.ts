import type { Database } from '@/data/types'
import { type BackupMeta, type StorageAdapter, type StoredBackup, backupMeta } from './adapter'

/**
 * Keeps data in memory only. Used by tests, and as a last resort when the
 * browser blocks all storage — the app then warns that nothing will persist.
 */
export class MemoryAdapter implements StorageAdapter {
  readonly label = 'Memory only (not saved)'
  readonly kind = 'memory' as const
  readonly persistent = false
  private data: unknown | null
  private backups = new Map<string, StoredBackup>()

  constructor(initial: unknown | null = null) {
    this.data = initial
  }

  async load() {
    return this.data === null ? null : structuredClone(this.data)
  }
  async save(db: Database) {
    this.data = structuredClone(db)
  }
  async listBackups(): Promise<BackupMeta[]> {
    return [...this.backups.values()].map(backupMeta).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }
  async getBackup(id: string) {
    const b = this.backups.get(id)
    return b ? structuredClone(b) : null
  }
  async putBackup(backup: StoredBackup) {
    this.backups.set(backup.id, structuredClone(backup))
  }
  async deleteBackup(id: string) {
    this.backups.delete(id)
  }
}
