/**
 * Backups, export and import.
 *
 * Every operation that replaces your data (import, restore, reset) first
 * stores a safety backup of what was there, so it can always be undone from
 * Settings → Data → Backups.
 */
import { createEmptyDatabase } from '@/data/defaults'
import type { Database } from '@/data/types'
import { type ValidationResult, makeBackupFile, mergeDatabases, totalRecords, validateDatabase } from '@/data/validate'
import type { BackupMeta, BackupReason, StoredBackup } from '@/storage'
import { todayISO } from '@/lib/dates'
import { uid } from '@/lib/utils'
import { appStore } from './store'
import { flushSave, getAdapter } from './persistence'

export async function createBackup(reason: BackupReason, label?: string, data?: Database): Promise<BackupMeta> {
  flushSave()
  const db = structuredClone(data ?? appStore.getState().db)
  const json = JSON.stringify(db)
  const backup: StoredBackup = {
    id: uid(),
    createdAt: new Date().toISOString(),
    reason,
    label,
    sizeBytes: new Blob([json]).size,
    recordCount: totalRecords(db),
    data: db,
  }
  await getAdapter().putBackup(backup)
  const { data: _omit, ...meta } = backup
  return meta
}

export const listBackups = () => getAdapter().listBackups()
export const getBackup = (id: string) => getAdapter().getBackup(id)
export const deleteBackup = (id: string) => getAdapter().deleteBackup(id)

/** Keep only the newest `keep` automatic backups. Manual and safety backups are never pruned. */
export async function pruneAutoBackups(keep: number): Promise<number> {
  const autos = (await listBackups()).filter((b) => b.reason === 'auto')
  const stale = autos.slice(keep)
  for (const b of stale) await deleteBackup(b.id)
  return stale.length
}

export async function restoreBackup(id: string): Promise<void> {
  const backup = await getBackup(id)
  if (!backup) throw new Error('Backup not found')
  const result = validateDatabase(backup.data, { strict: false })
  if (!result.ok) throw new Error(`This backup cannot be restored: ${result.error}`)
  await createBackup('pre-restore', `Before restoring backup from ${new Date(backup.createdAt).toLocaleString()}`)
  appStore.getState().replaceDatabase(result.db)
  flushSave()
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportDatabase(db: Database = appStore.getState().db) {
  downloadJson(`life-os-backup-${todayISO()}.json`, makeBackupFile(db))
}

export async function downloadBackup(id: string) {
  const backup = await getBackup(id)
  if (!backup) throw new Error('Backup not found')
  downloadJson(`life-os-${backup.reason}-${backup.createdAt.slice(0, 10)}.json`, makeBackupFile(backup.data))
}

/** Read and validate a backup file without changing anything. */
export async function inspectImportFile(file: File): Promise<ValidationResult & { fileName: string }> {
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: 'File is larger than 50 MB.', rejected: [], fileName: file.name }
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'This file is not valid JSON.', rejected: [], fileName: file.name }
  }
  return { ...validateDatabase(json, { strict: false }), fileName: file.name }
}

export type ImportMode = 'replace' | 'merge'

export async function applyImport(incoming: Database, mode: ImportMode): Promise<{ added?: number; updated?: number }> {
  await createBackup('pre-import', mode === 'replace' ? 'Before replacing data with an import' : 'Before merging an import')
  if (mode === 'replace') {
    appStore.getState().replaceDatabase({ ...incoming, settings: { ...incoming.settings, onboarded: true } })
    flushSave()
    return {}
  }
  const current = appStore.getState().db
  const merged = mergeDatabases(current, incoming)
  appStore.getState().replaceDatabase({ ...merged.db, settings: current.settings })
  flushSave()
  return { added: merged.added, updated: merged.updated }
}

/** Erase all records (and optionally settings) after taking a safety backup. */
export async function resetAllData({ keepSettings }: { keepSettings: boolean }) {
  await createBackup('pre-reset', 'Before erasing all data')
  const fresh = createEmptyDatabase()
  const current = appStore.getState().db.settings
  appStore.getState().replaceDatabase(keepSettings ? { ...fresh, settings: current } : fresh)
  flushSave()
}
