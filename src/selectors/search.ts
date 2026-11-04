/**
 * Global search. Builds a lightweight index over every searchable
 * collection and ranks matches: exact title > title starts with > all words
 * in title > all words anywhere > letters in order ("grcrs" finds
 * "Groceries"), so small typos and abbreviations still find things.
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

/**
 * Letters of `needle` in order within `hay`. Scores 10–28 (always below a
 * real word match): tighter and earlier matches, and ones starting a word,
 * rank higher. 0 when the letters aren't all there in order.
 */
export function fuzzyScore(needle: string, hay: string): number {
  const n = needle.replace(/\s+/g, '')
  if (n.length < 3 || !hay) return 0
  let from = 0
  let first = -1
  let last = -1
  for (const ch of n) {
    const at = hay.indexOf(ch, from)
    if (at < 0) return 0
    if (first < 0) first = at
    last = at
    from = at + 1
  }
  const span = last - first + 1
  // Too spread out to be what was meant (e.g. three letters across a long note title).
  if (span > n.length * 3) return 0
  const tight = n.length / span
  const wordStart = first === 0 || hay[first - 1] === ' ' ? 3 : 0
  return Math.min(28, 10 + Math.round(15 * tight) + wordStart)
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
      let score: number
      if (nTitle === q) score = 100
      else if (nTitle.startsWith(q)) score = 80
      else if (nTitle.includes(q)) score = 65
      else if (words.every((w) => nTitle.includes(w))) score = 55
      else if (words.every((w) => nTitle.includes(w) || nBody.includes(w))) score = 30
      else score = fuzzyScore(q, nTitle)
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
