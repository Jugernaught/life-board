/**
 * Loading, migrating and validating whole databases — used on startup and
 * when importing a backup file.
 */
import { normaliseSettings } from './defaults'
import { COLLECTION_KEYS, SCHEMA_VERSION, activityEntry, collectionSchemas, databaseSchema, deletionMarker } from './schema'
import type { Database, DeletionMarker } from './types'

/** Most recent activity entries kept (the log is a convenience, not a record). */
export const ACTIVITY_LIMIT = 3000

export const BACKUP_APP_ID = 'life-os'

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  kind: 'backup'
  exportedAt: string
  schemaVersion: number
  data: Database
}

export interface RejectedRecord {
  collection: string
  index: number
  id?: string
  problems: string[]
}

export type ValidationResult =
  | { ok: true; db: Database; rejected: RejectedRecord[] }
  | { ok: false; error: string; rejected: RejectedRecord[] }

type Migration = (db: Record<string, unknown>) => Record<string, unknown>

/**
 * Schema migrations, keyed by the version they upgrade *from*. When the data
 * model changes, add a function here; old backups keep importing cleanly.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1: (db) => ({ ...db, schemaVersion: 2, newCollection: [] }),
}

export function migrate(input: Record<string, unknown>): Record<string, unknown> {
  let db = { ...input }
  let version = typeof db.schemaVersion === 'number' ? db.schemaVersion : 1
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `This data was created by a newer version of LIFE OS (schema v${version}; this app understands v${SCHEMA_VERSION}). Update the app before loading it so nothing is lost.`,
    )
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`No migration from schema v${version}`)
    db = step(db)
    version = Number(db.schemaVersion)
  }
  db.schemaVersion = SCHEMA_VERSION
  return db
}

/** Accept either a LIFE OS backup file or a bare database object. */
export function unwrapBackup(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('The file does not contain a LIFE OS backup (expected a JSON object).')
  const obj = json as Record<string, unknown>
  if (obj.app === BACKUP_APP_ID && obj.data && typeof obj.data === 'object') return obj.data as Record<string, unknown>
  if ('settings' in obj || COLLECTION_KEYS.some((k) => k in obj)) return obj
  throw new Error('This JSON file does not look like a LIFE OS backup.')
}

function describeIssues(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.slice(0, 5).map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
}

/**
 * Validate a database. With `strict`, any invalid record fails the whole
 * thing. Without it, valid records are kept and invalid ones are returned in
 * `rejected` so the caller can show exactly what would be skipped — nothing
 * is ever dropped without telling you.
 */
export function validateDatabase(raw: unknown, { strict = true } = {}): ValidationResult {
  const rejected: RejectedRecord[] = []
  let migrated: Record<string, unknown>
  try {
    migrated = migrate(unwrapBackup(raw))
  } catch (e) {
    return { ok: false, error: (e as Error).message, rejected }
  }

  const candidate: Record<string, unknown> = { ...migrated }
  try {
    candidate.settings = normaliseSettings((migrated.settings ?? {}) as never)
  } catch (e) {
    return { ok: false, error: `Settings are invalid: ${(e as Error).message}`, rejected }
  }

  for (const key of COLLECTION_KEYS) {
    const list = migrated[key]
    if (list === undefined) {
      candidate[key] = []
      continue
    }
    if (!Array.isArray(list)) return { ok: false, error: `"${key}" should be a list of records.`, rejected }
    const valid: unknown[] = []
    const seen = new Set<string>()
    list.forEach((item, index) => {
      const parsed = collectionSchemas[key].record.safeParse(item)
      if (!parsed.success) {
        rejected.push({ collection: key, index, id: (item as { id?: string })?.id, problems: describeIssues(parsed.error.issues) })
        return
      }
      if (seen.has(parsed.data.id)) {
        rejected.push({ collection: key, index, id: parsed.data.id, problems: ['Duplicate id — another record in this list already uses it'] })
        return
      }
      seen.add(parsed.data.id)
      valid.push(parsed.data)
    })
    candidate[key] = valid
  }

  const activity = Array.isArray(migrated.activity) ? migrated.activity : []
  candidate.activity = activity.filter((a) => activityEntry.safeParse(a).success)
  const deletions = Array.isArray(migrated.deletions) ? migrated.deletions : []
  candidate.deletions = deletions.filter((d) => deletionMarker.safeParse(d).success)

  if (strict && rejected.length) {
    return { ok: false, error: `${rejected.length} record(s) failed validation.`, rejected }
  }

  const final = databaseSchema.safeParse(candidate)
  if (!final.success) return { ok: false, error: describeIssues(final.error.issues).join('; '), rejected }
  return { ok: true, db: final.data as unknown as Database, rejected }
}

export function makeBackupFile(db: Database): BackupFile {
  return { app: BACKUP_APP_ID, kind: 'backup', exportedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, data: db }
}

export function countRecords(db: Partial<Database>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of COLLECTION_KEYS) out[key] = Array.isArray(db[key]) ? (db[key] as unknown[]).length : 0
  return out
}

export const totalRecords = (db: Partial<Database>) => Object.values(countRecords(db)).reduce((a, b) => a + b, 0)

type Versioned = { id: string; updatedAt: string; rev?: number }

const revOf = (r: { rev?: number }) => r.rev ?? 0

/** Which copy of the same record wins: the higher revision, then the later edit, then the current one. */
export function newerCopy<T extends Versioned>(current: T, incoming: T): T {
  if (revOf(incoming) !== revOf(current)) return revOf(incoming) > revOf(current) ? incoming : current
  return (incoming.updatedAt ?? '') > (current.updatedAt ?? '') ? incoming : current
}

/** Deletion markers kept this long (a merge older than this can't be told apart from a new record). */
export const DELETION_RETENTION_DAYS = 180
const MAX_DELETIONS = 5000

/** Combine two lists of deletion markers: one per record, the highest revision wins; old ones are pruned. */
export function mergeDeletions(a: readonly DeletionMarker[], b: readonly DeletionMarker[], now = Date.now()): DeletionMarker[] {
  const byKey = new Map<string, DeletionMarker>()
  for (const m of [...a, ...b]) {
    const k = `${m.key}:${m.id}`
    const seen = byKey.get(k)
    if (!seen || m.rev > seen.rev || (m.rev === seen.rev && m.at > seen.at)) byKey.set(k, m)
  }
  const cutoff = new Date(now - DELETION_RETENTION_DAYS * 86_400_000).toISOString()
  return [...byKey.values()]
    .filter((m) => m.at >= cutoff)
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, MAX_DELETIONS)
}

/**
 * Merge an incoming database into the current one. Records are matched by
 * id. When both sides have the record, the copy with the higher revision
 * wins (then the later edit), so clock differences between devices don't
 * decide. A record deleted on either side stays deleted, unless the other
 * side edited it after the deletion (a higher revision than the marker).
 */
export function mergeDatabases(current: Database, incoming: Database): { db: Database; added: number; updated: number; kept: number; removed: number } {
  const db = { ...current } as Database
  let added = 0
  let updated = 0
  let kept = 0
  let removed = 0
  const deletions = mergeDeletions(current.deletions ?? [], incoming.deletions ?? [])
  const deletedAt = new Map(deletions.map((m) => [`${m.key}:${m.id}`, m]))
  const superseded = new Set<string>()
  for (const key of COLLECTION_KEYS) {
    const byId = new Map<string, Versioned>()
    for (const r of current[key] as Versioned[]) byId.set(r.id, r)
    for (const r of incoming[key] as Versioned[]) {
      const existing = byId.get(r.id)
      if (!existing) {
        byId.set(r.id, r)
        added++
      } else if (newerCopy(existing, r) === r && r !== existing) {
        byId.set(r.id, r)
        updated++
      } else kept++
    }
    const rows: Versioned[] = []
    for (const r of byId.values()) {
      const marker = deletedAt.get(`${key}:${r.id}`)
      if (marker && revOf(r) <= marker.rev) {
        removed++
        continue
      }
      // Edited after it was deleted elsewhere: keep it, and forget the deletion.
      if (marker) superseded.add(`${key}:${r.id}`)
      rows.push(r)
    }
    ;(db as unknown as Record<string, unknown[]>)[key] = rows
  }
  db.deletions = deletions.filter((m) => !superseded.has(`${m.key}:${m.id}`))
  const activityIds = new Set(current.activity.map((a) => a.id))
  db.activity = [...current.activity, ...incoming.activity.filter((a) => !activityIds.has(a.id))].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, ACTIVITY_LIMIT)
  return { db, added, updated, kept, removed }
}
