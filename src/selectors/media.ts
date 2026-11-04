import type { MediaItem } from '@/data/types'
import { average, countBy } from '@/lib/utils'

export function mediaStats(items: MediaItem[], year: string) {
  const completed = items.filter((i) => i.status === 'completed')
  const rated = items.filter((i) => typeof i.rating === 'number')
  return {
    total: items.length,
    inProgress: items.filter((i) => i.status === 'in_progress').length,
    queued: items.filter((i) => i.status === 'want').length,
    completed: completed.length,
    completedThisYear: completed.filter((i) => i.completedDate?.startsWith(year)).length,
    booksThisYear: completed.filter((i) => i.type === 'book' && i.completedDate?.startsWith(year)).length,
    averageRating: rated.length ? average(rated.map((i) => i.rating as number)) : null,
    byType: countBy(items, (i) => i.type),
    byStatus: countBy(items, (i) => i.status),
  }
}

export function mediaProgress(item: MediaItem): number | null {
  if (item.status === 'completed') return 100
  if (!item.total || item.progress === undefined) return null
  return Math.min(100, (item.progress / item.total) * 100)
}
