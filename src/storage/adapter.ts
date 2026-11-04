/**
 * Storage adapters.
 *
 * The rest of the app never talks to IndexedDB or localStorage directly; it
 * talks to a `StorageAdapter`. To move your data to a server (for example
 * Supabase) later, write one new adapter that implements this interface —
 * no screen or component has to change. See docs/SUPABASE.md.
 */
import type { Database } from '@/data/types'

export type BackupReason = 'manual' | 'auto' | 'pre-import' | 'pre-restore' | 'pre-reset'

export interface BackupMeta {
  id: string
  createdAt: string
  reason: BackupReason
  label?: string
  sizeBytes: number
  recordCount: number
}

export interface StoredBackup extends BackupMeta {
  data: Database
}

export interface StorageAdapter {
  /** Human-readable name shown in Settings → Data. */
  readonly label: string
  readonly kind: 'indexeddb' | 'localstorage' | 'memory'
  /** True when data survives a page reload. */
  readonly persistent: boolean
  /** Returns the saved database, or null on first run. */
  load(): Promise<unknown | null>
  save(db: Database): Promise<void>
  listBackups(): Promise<BackupMeta[]>
  getBackup(id: string): Promise<StoredBackup | null>
  putBackup(backup: StoredBackup): Promise<void>
  deleteBackup(id: string): Promise<void>
}

export function backupMeta(b: StoredBackup): BackupMeta {
  const { data: _data, ...meta } = b
  return meta
}
