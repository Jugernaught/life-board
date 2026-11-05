/**
 * Connects the in-memory store to persistent storage.
 *
 *  1. On startup: load → migrate → validate. If the stored data cannot be
 *     read, the app shows a recovery screen and *never* overwrites it.
 *  2. Every change is saved automatically (debounced by 250 ms) and flushed
 *     immediately when the tab is hidden or closed. Because the browser may
 *     abandon an IndexedDB write while a page unloads, any unsaved change is
 *     also written synchronously to a small "write-ahead" slot in
 *     localStorage at that moment, and recovered on the next start if it is
 *     newer than what IndexedDB holds.
 *  3. Other open tabs are told about each save (BroadcastChannel) and reload,
 *     so two tabs never silently overwrite each other's changes.
 *  4. A daily automatic backup is kept (Settings → Data → Backups).
 */
import { createEmptyDatabase } from '@/data/defaults'
import type { Database } from '@/data/types'
import { mergeDatabases, totalRecords, validateDatabase } from '@/data/validate'
import { type StorageAdapter, createStorage, requestPersistentStorage } from '@/storage'
import { debounce, uid } from '@/lib/utils'
import { appStore } from './store'
import { createBackup, pruneAutoBackups } from './backups'

const SAVE_DELAY_MS = 250
export const PENDING_KEY = 'life-os:pending-save'
const AUTO_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000
const TAB_ID = uid()

let adapter: StorageAdapter | null = null
let unsubscribe: (() => void) | null = null
let channel: BroadcastChannel | null = null
/** Set while applying data that came from storage, so it isn't saved straight back. */
let applyingExternal = false
let pageListenersAttached = false

export function getAdapter(): StorageAdapter {
  if (!adapter) throw new Error('Storage is not initialised yet')
  return adapter
}

/** Timestamp written into every saved copy, used to pick the newest copy on start-up. */
type Persisted = Database & { savedAt?: string }

/** Saves started but not yet committed. Closing the page can abort them, so they're stashed too. */
let inFlight = 0

// ------------------------------------------------- several tabs at once ---
// Each tab holds the whole database in memory and saves it whole. Two rules
// stop one tab silently overwriting another's changes:
//  1. Writes are serialised across tabs with a Web Lock (where supported).
//  2. Inside the lock, a tab checks the "last save" stamp. If another tab
//     saved since this tab last loaded or saved, it merges that copy in first
//     (mergeDatabases: higher revision wins; deletions are respected).

const STAMP_KEY = 'life-os:save-stamp'
const LOCK_NAME = 'life-os-db'
/** `savedAt` of the copy this tab last loaded or wrote. */
let lastSyncedAt = ''
/** Another tab announced a save we haven't merged yet (used when localStorage is unavailable). */
let otherTabSaved = false

function readStamp(): { tab: string; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(STAMP_KEY)
    return raw ? (JSON.parse(raw) as { tab: string; savedAt: string }) : null
  } catch {
    return null
  }
}

function writeStamp(savedAt: string) {
  try {
    localStorage.setItem(STAMP_KEY, JSON.stringify({ tab: TAB_ID, savedAt }))
  } catch {
    // Falls back to the BroadcastChannel flag.
  }
}

function savedElsewhere(): boolean {
  const stamp = readStamp()
  if (stamp) return stamp.tab !== TAB_ID && stamp.savedAt > lastSyncedAt
  return otherTabSaved
}

function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : undefined
  return locks ? (locks.request(LOCK_NAME, fn) as Promise<T>) : fn()
}

async function writeNow(_scheduled: Database) {
  if (!adapter) return
  const store = adapter
  appStore.setState((s) => ({ save: { ...s.save, status: 'saving' } }))
  inFlight++
  try {
    await withDbLock(async () => {
      // Always save the latest state (the scheduled copy may be a moment old).
      let db = appStore.getState().db
      if (savedElsewhere()) {
        const raw = await store.load()
        const stored = raw ? validateDatabase(raw, { strict: false }) : null
        if (stored?.ok) {
          delete (stored.db as Persisted).savedAt
          db = mergeDatabases(db, stored.db).db
          applyingExternal = true
          appStore.setState({ db })
          applyingExternal = false
        }
        otherTabSaved = false
      }
      const savedAt = new Date().toISOString()
      await store.save({ ...db, savedAt } as Persisted)
      lastSyncedAt = savedAt
      writeStamp(savedAt)
      clearPending(savedAt)
    })
    appStore.setState({ save: { status: 'saved', lastSavedAt: lastSyncedAt } })
    channel?.postMessage({ type: 'saved', from: TAB_ID })
  } catch (e) {
    appStore.setState((s) => ({ save: { ...s.save, status: 'error', error: (e as Error).message } }))
  } finally {
    inFlight--
  }
}

const scheduleSave = debounce((db: Database) => void writeNow(db), SAVE_DELAY_MS)

function readPending(): { at: string; db: unknown } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as { at: string; db: unknown }) : null
  } catch {
    return null
  }
}

function clearPending(upTo?: string) {
  try {
    const p = readPending()
    if (p && (!upTo || p.at <= upTo)) localStorage.removeItem(PENDING_KEY)
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}

/** Synchronously stash an unsaved (or not yet committed) change so it survives the page closing. */
function stashPending() {
  if ((!scheduleSave.pending() && inFlight === 0) || adapter?.kind === 'memory') return
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ at: new Date().toISOString(), db: appStore.getState().db }))
  } catch {
    // Too large or blocked: the asynchronous save below is still attempted.
  }
}

function onPageHide() {
  stashPending()
  flushSave()
}

/** Save any pending change immediately (used before backups, imports and page hide). */
export function flushSave(): void {
  scheduleSave.flush()
}

export function hasPendingSave(): boolean {
  return scheduleSave.pending()
}

async function reloadFromStorage() {
  if (!adapter) return
  const raw = await adapter.load()
  if (!raw) return
  const result = validateDatabase(raw, { strict: false })
  if (!result.ok) return
  lastSyncedAt = (raw as Persisted).savedAt ?? lastSyncedAt
  delete (result.db as Persisted).savedAt
  applyingExternal = true
  appStore.getState().replaceDatabase(result.db)
  applyingExternal = false
}

export interface InitOptions {
  /** Inject an adapter (tests). Defaults to the best available browser storage. */
  adapter?: StorageAdapter
}

export async function initPersistence(options: InitOptions = {}): Promise<void> {
  let warning: string | undefined
  if (options.adapter) adapter = options.adapter
  else {
    const created = await createStorage()
    adapter = created.adapter
    warning = created.warning
  }
  appStore.setState({ storage: { label: adapter.label, kind: adapter.kind, persistent: adapter.persistent, warning } })

  let raw: unknown
  try {
    raw = await adapter.load()
  } catch (e) {
    appStore.setState({ ready: true, loadError: { message: `Could not read stored data: ${(e as Error).message}` } })
    return
  }

  lastSyncedAt = (raw as Persisted | null)?.savedAt ?? ''

  // Recover a change that was stashed while a previous page closed, if it is
  // newer than the copy IndexedDB managed to store.
  const pending = readPending()
  if (pending) {
    const storedAt = (raw as Persisted | null)?.savedAt ?? ''
    if (pending.at > storedAt && validateDatabase(pending.db, { strict: false }).ok) {
      raw = pending.db
      try {
        await adapter.save({ ...(pending.db as Database), savedAt: pending.at } as Persisted)
        lastSyncedAt = pending.at
      } catch {
        // Will be saved on the next change.
      }
    }
    clearPending()
  }

  let notice: string | undefined
  let quarantined = false
  if (raw === null) {
    applyingExternal = true
    appStore.getState().replaceDatabase(createEmptyDatabase())
    applyingExternal = false
  } else {
    const result = validateDatabase(raw, { strict: false })
    if (!result.ok) {
      // Leave stored data untouched; the recovery screen lets you export it.
      appStore.setState({ ready: true, loadError: { message: result.error, raw } })
      return
    }
    if (result.rejected.length) {
      // Keep an exact copy of what was on disk before we drop unreadable rows.
      await adapter.putBackup({
        id: uid(),
        createdAt: new Date().toISOString(),
        reason: 'pre-restore',
        label: `Original data before ${result.rejected.length} unreadable record(s) were set aside`,
        sizeBytes: JSON.stringify(raw).length,
        recordCount: totalRecords(raw as Database),
        data: raw as Database,
      })
      notice = `${result.rejected.length} record(s) could not be read and were set aside. An exact copy of the original data is in Settings → Data → Backups.`
      quarantined = true
    }
    delete (result.db as Persisted).savedAt
    applyingExternal = true
    appStore.getState().replaceDatabase(result.db)
    applyingExternal = false
  }

  appStore.setState({ ready: true, notice, save: { status: 'saved', lastSavedAt: new Date().toISOString() } })

  unsubscribe?.()
  unsubscribe = appStore.subscribe((state, prev) => {
    if (state.db === prev.db || applyingExternal || state.loadError) return
    scheduleSave(state.db)
  })
  // Unreadable records were set aside (a copy is in Backups): store the cleaned
  // data now, or every launch would set them aside — and back up — again.
  if (quarantined) scheduleSave(appStore.getState().db)

  if (typeof window !== 'undefined') {
    if (!pageListenersAttached) {
      pageListenersAttached = true
      window.addEventListener('pagehide', onPageHide)
      window.addEventListener('beforeunload', onPageHide)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') onPageHide()
      })
    }
    if ('BroadcastChannel' in window) {
      channel?.close()
      channel = new BroadcastChannel('life-os')
      channel.onmessage = (event) => {
        const msg = event.data as { type?: string; from?: string }
        if (msg?.type !== 'saved' || msg.from === TAB_ID) return
        // With a change of its own on the way, this tab merges the other tab's copy when it saves.
        if (scheduleSave.pending() || inFlight > 0) otherTabSaved = true
        else void reloadFromStorage()
      }
    }
  }

  void maybeAutoBackup()
  if (totalRecords(appStore.getState().db) > 0) void requestPersistentStorage()
}

async function maybeAutoBackup() {
  const { db } = appStore.getState()
  if (!adapter || !db.settings.autoBackup || totalRecords(db) === 0) return
  try {
    const backups = await adapter.listBackups()
    const latestAuto = backups.find((b) => b.reason === 'auto')
    if (!latestAuto || Date.now() - Date.parse(latestAuto.createdAt) > AUTO_BACKUP_INTERVAL_MS) {
      await createBackup('auto')
      await pruneAutoBackups(db.settings.backupsToKeep)
    }
  } catch {
    // A failed automatic backup must never block the app; Settings shows backup status.
  }
}

/** Test helper: stop listening and forget the adapter. */
export function teardownPersistence() {
  scheduleSave.cancel()
  unsubscribe?.()
  unsubscribe = null
  channel?.close()
  channel = null
  adapter = null
  lastSyncedAt = ''
  otherTabSaved = false
}
