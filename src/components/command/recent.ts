/** The last few records opened from the command palette (this device only). */
import type { CollectionKey } from '@/data/types'

const KEY = 'life-os:recent'
export const RECENT_LIMIT = 8

export interface RecentRef {
  key: CollectionKey
  id: string
}

export function readRecent(): RecentRef[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((r): r is RecentRef => !!r && typeof r.key === 'string' && typeof r.id === 'string').slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function pushRecent(ref: RecentRef) {
  const next = [ref, ...readRecent().filter((r) => !(r.key === ref.key && r.id === ref.id))].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Recent items are a convenience; ignore storage errors.
  }
}
