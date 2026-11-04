/** Small, dependency-free helpers shared across the app. */

type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[] | Record<string, unknown>

/** Join class names, skipping falsy values. Accepts strings, arrays and `{ class: condition }` maps. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  const walk = (v: ClassValue) => {
    if (!v) return
    if (v === true) return
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') out.push(String(v))
    else if (Array.isArray(v)) v.forEach(walk)
    else for (const [k, on] of Object.entries(v)) if (on) out.push(k)
  }
  values.forEach(walk)
  return out.join(' ')
}

/** Collision-resistant id. Uses the platform UUID generator where available. */
export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback for non-secure contexts (e.g. LAN IP over http).
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0)

export const average = (values: readonly number[]) => (values.length ? sum(values) / values.length : 0)

/** Percentage 0–100 of `part` over `whole`; 0 when `whole` is 0. */
export const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

export function groupBy<T, K extends string | number>(items: readonly T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    ;(out[k] ||= []).push(item)
  }
  return out
}

export function countBy<T, K extends string | number>(items: readonly T[], key: (item: T) => K): Record<K, number> {
  const out = {} as Record<K, number>
  for (const item of items) {
    const k = key(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export type SortDirection = 'asc' | 'desc'

/**
 * Stable sort by a derived value. `undefined`/empty values always sort last,
 * whatever the direction, so incomplete records never crowd the top of a list.
 */
export function sortBy<T>(items: readonly T[], value: (item: T) => string | number | boolean | undefined | null, direction: SortDirection = 'asc'): T[] {
  const dir = direction === 'asc' ? 1 : -1
  return items
    .map((item, index) => ({ item, index, v: value(item) }))
    .sort((a, b) => {
      const av = a.v
      const bv = b.v
      const aEmpty = av === undefined || av === null || av === ''
      const bEmpty = bv === undefined || bv === null || bv === ''
      if (aEmpty && bEmpty) return a.index - b.index
      if (aEmpty) return 1
      if (bEmpty) return -1
      if (typeof av === 'string' && typeof bv === 'string') {
        const c = av.localeCompare(bv, undefined, { sensitivity: 'base', numeric: true })
        return c === 0 ? a.index - b.index : c * dir
      }
      const an = Number(av)
      const bn = Number(bv)
      return an === bn ? a.index - b.index : (an < bn ? -1 : 1) * dir
    })
    .map((x) => x.item)
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: A | undefined
  const debounced = (...args: A) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...(lastArgs as A))
    }, wait)
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
      fn(...(lastArgs as A))
    }
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  debounced.pending = () => timer !== undefined
  return debounced
}

/** Normalise text for search: lower case, accents stripped, whitespace collapsed. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '··'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Remove keys whose value is `undefined` or an empty string (keeps 0 and false). */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== '') out[k] = v
  return out as T
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
