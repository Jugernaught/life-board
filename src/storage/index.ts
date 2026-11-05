import type { StorageAdapter } from './adapter'
import { migrateLegacyLocalStorage } from './brand'
import { IndexedDbAdapter } from './indexedDb'
import { LocalStorageAdapter } from './localStorage'
import { MemoryAdapter } from './memory'

export type { BackupMeta, BackupReason, StorageAdapter, StoredBackup } from './adapter'
export { IndexedDbAdapter, LocalStorageAdapter, MemoryAdapter }
export { APP_KEY, LEGACY_APP_KEY, migrateLegacyLocalStorage, storageKey } from './brand'

/**
 * Pick the most capable storage available: IndexedDB, then localStorage,
 * then memory (with a visible warning that data will not persist).
 */
export async function createStorage(): Promise<{ adapter: StorageAdapter; warning?: string }> {
  // Carry over pre-rename (LIFE OS) keys before anything reads them. Also run
  // from each entry point; repeating it is a no-op.
  migrateLegacyLocalStorage()
  try {
    return { adapter: await IndexedDbAdapter.open() }
  } catch (e) {
    if (LocalStorageAdapter.isAvailable()) {
      return { adapter: new LocalStorageAdapter(), warning: `IndexedDB unavailable (${(e as Error).message}); using localStorage instead.` }
    }
    return {
      adapter: new MemoryAdapter(),
      warning: 'This browser is blocking storage (private mode or site data disabled). Changes will be lost when you close the tab — export a backup to keep them.',
    }
  }
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  try {
    if (!navigator.storage?.persist) return undefined
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return undefined
  }
}

export async function storageEstimate(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  try {
    const [estimate, persisted] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()])
    return { usage: estimate?.usage, quota: estimate?.quota, persisted }
  } catch {
    return {}
  }
}
