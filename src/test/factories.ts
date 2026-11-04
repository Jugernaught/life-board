/** Test helpers for building records with sensible defaults. */
import { collectionSchemas } from '@/data/schema'
import type { CollectionKey, Collections } from '@/data/types'
import { uid } from '@/lib/utils'

export function make<K extends CollectionKey>(key: K, fields: Record<string, unknown>): Collections[K] {
  const now = (fields.createdAt as string) ?? '2026-01-01T09:00:00.000Z'
  return collectionSchemas[key].record.parse({ id: uid(), createdAt: now, updatedAt: now, ...fields }) as unknown as Collections[K]
}
