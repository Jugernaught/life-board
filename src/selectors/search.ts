/**
 * Global search. Builds a lightweight index over every searchable
 * collection and ranks matches: exact title > title starts with > all words
 * in title > all words anywhere.
 */
import { COLLECTIONS, hrefFor } from '@/data/registry'
import { COLLECTION_KEYS } from '@/data/schema'
import type { CollectionKey, Database } from '@/data/types'
import { normalise, truncate } from '@/lib/utils'

export interface SearchResult {
  key: CollectionKey
  id: string
  title: string
  snippet?: string
  href: string
  score: number
  updatedAt: string
}

export function searchDatabase(db: Database, query: string, limit = 40, only?: CollectionKey[]): SearchResult[] {
  const q = normalise(query)
  if (!q) return []
  const words = q.split(' ').filter(Boolean)
  const results: SearchResult[] = []
  for (const key of only ?? COLLECTION_KEYS) {
    const meta = COLLECTIONS[key]
    if (!meta.searchable) continue
    for (const record of db[key] as { id: string; updatedAt: string }[]) {
      const title = meta.title(record as never) ?? ''
      const body = meta.searchText?.(record as never) ?? ''
      const nTitle = normalise(title)
      const nBody = normalise(body)
      let score = 0
      if (nTitle === q) score = 100
      else if (nTitle.startsWith(q)) score = 80
      else if (nTitle.includes(q)) score = 65
      else if (words.every((w) => nTitle.includes(w))) score = 55
      else if (words.every((w) => nTitle.includes(w) || nBody.includes(w))) score = 30
      if (!score) continue
      let snippet: string | undefined
      if (body && score <= 55) {
        const idx = nBody.indexOf(words[0])
        if (idx >= 0) {
          const startIdx = Math.max(0, idx - 40)
          snippet = `${startIdx > 0 ? '…' : ''}${truncate(body.replace(/\s+/g, ' ').slice(startIdx), 110)}`
        }
      }
      results.push({ key, id: record.id, title, snippet, href: hrefFor(key, record.id), score, updatedAt: record.updatedAt })
    }
  }
  return results.sort((a, b) => b.score - a.score || (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, limit)
}
