/**
 * Loading, migrating and validating whole databases — used on startup and
 * when importing a backup file.
 */
import { normaliseSettings } from './defaults'
import { COLLECTION_KEYS, SCHEMA_VERSION, activityEntry, collectionSchemas, databaseSchema } from './schema'
import type { Database } from './types'

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

/**
 * Merge an incoming database into the current one. Records are matched by
 * id; when both sides have the same record, the most recently updated copy
 * wins. Records that exist only on one side are always kept.
 */
export function mergeDatabases(current: Database, incoming: Database): { db: Database; added: number; updated: number; kept: number } {
  const db = { ...current } as Database
  let added = 0
  let updated = 0
  let kept = 0
  for (const key of COLLECTION_KEYS) {
    const byId = new Map<string, { id: string; updatedAt: string }>()
    for (const r of current[key] as { id: string; updatedAt: string }[]) byId.set(r.id, r)
    for (const r of incoming[key] as { id: string; updatedAt: string }[]) {
      const existing = byId.get(r.id)
      if (!existing) {
        byId.set(r.id, r)
        added++
      } else if ((r.updatedAt ?? '') > (existing.updatedAt ?? '')) {
        byId.set(r.id, r)
        updated++
      } else kept++
    }
    ;(db as unknown as Record<string, unknown[]>)[key] = [...byId.values()]
  }
  const activityIds = new Set(current.activity.map((a) => a.id))
  db.activity = [...current.activity, ...incoming.activity.filter((a) => !activityIds.has(a.id))].sort((a, b) => (a.at < b.at ? 1 : -1))
  return { db, added, updated, kept }
}
