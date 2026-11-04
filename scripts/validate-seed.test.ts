/**
 * Validates your own generated seed (private/life-os-seed.json, git-ignored)
 * with the same checks the app's import screen uses. Skipped when the file
 * does not exist, so it never fails for anyone who has not made one.
 *
 *   npm run seed:validate
 *
 * Set LIFE_OS_SEED=path/to/file.json to check a different file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COLLECTION_KEYS, SCHEMA_VERSION, databaseSchema } from '@/data/schema'
import { totalRecords, validateDatabase } from '@/data/validate'

const SEED = resolve(process.env.LIFE_OS_SEED ?? 'private/life-os-seed.json')

describe.skipIf(!existsSync(SEED))(`private seed (${SEED})`, () => {
  const raw = existsSync(SEED) ? JSON.parse(readFileSync(SEED, 'utf8')) : null

  it('is a LIFE OS backup for the current schema version', () => {
    expect(raw).toMatchObject({ app: 'life-os', kind: 'backup', schemaVersion: SCHEMA_VERSION })
  })

  it('passes the import validator in strict mode with no rejected records', () => {
    const result = validateDatabase(raw, { strict: true })
    if (result.rejected.length) console.error(result.rejected)
    expect(result.rejected).toEqual([])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const expected = Object.entries(raw.data).filter(([k, v]) => k !== 'activity' && Array.isArray(v)).reduce((n, [, v]) => n + (v as unknown[]).length, 0)
      expect(totalRecords(result.db)).toBe(expected)
    }
  })

  it('parses with databaseSchema and uses only known collections', () => {
    expect(databaseSchema.safeParse(raw.data).success).toBe(true)
    const allowed = new Set<string>(['schemaVersion', 'settings', 'activity', ...COLLECTION_KEYS])
    for (const key of Object.keys(raw.data)) expect(allowed).toContain(key)
  })
})
