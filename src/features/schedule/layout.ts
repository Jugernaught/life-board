/**
 * Lays out timed items in a day column. Overlapping items share the width
 * side by side (like most calendar apps); a cluster of overlaps uses as many
 * columns as its busiest moment needs.
 */
import { timeToMinutes } from '@/lib/dates'

export interface Timed {
  key: string
  start: number // minutes from midnight
  end: number
}

export interface Placed<T> {
  item: T
  start: number
  end: number
  column: number
  columns: number
}

export const MIN_DURATION = 15

export function toTimed<T extends { key: string; startTime?: string; endTime?: string }>(item: T, defaultDuration = 30) {
  const start = timeToMinutes(item.startTime as string)
  let end = item.endTime ? timeToMinutes(item.endTime) : start + defaultDuration
  if (end <= start) end = Math.min(1440, start + defaultDuration)
  return { start, end: Math.max(end, start + MIN_DURATION) }
}

export function layoutDay<T extends { key: string }>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const placed: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.column + 1))
    for (const p of cluster) p.columns = cols
    placed.push(...cluster)
    cluster = []
  }
  for (const it of sorted) {
    if (it.start >= clusterEnd && cluster.length) flush()
    const used = new Set(cluster.filter((p) => p.end > it.start).map((p) => p.column))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ item: it.item, start: it.start, end: it.end, column: col, columns: 1 })
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()
  return placed
}

export const snap = (minutes: number, step = 15) => Math.round(minutes / step) * step
