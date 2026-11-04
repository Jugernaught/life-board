import { useMemo, useState } from 'react'
import { type SortDirection, normalise, sortBy } from '@/lib/utils'

export interface FilterDef<T> {
  key: string
  label: string
  options: readonly { value: string; label: string }[]
  /** Value(s) of the item for this filter. */
  get: (item: T) => string | string[] | undefined
}

export interface SortDef<T> {
  value: string
  label: string
  get: (item: T) => string | number | boolean | undefined | null
  dir?: SortDirection
}

export interface ListOptions<T> {
  search: (item: T) => string
  filters?: FilterDef<T>[]
  sorts: SortDef<T>[]
  defaultSort?: string
  initialFilters?: Record<string, string>
}

export interface ListControls<T> {
  query: string
  setQuery: (q: string) => void
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  clear: () => void
  sort: string
  setSort: (value: string) => void
  dir: SortDirection
  toggleDir: () => void
  results: T[]
  activeFilters: number
  defs: ListOptions<T>
}

/** Search + filters + sorting for any list, all computed in memory. */
export function useListControls<T>(items: readonly T[], opts: ListOptions<T>): ListControls<T> {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>(opts.initialFilters ?? {})
  const [sort, setSortState] = useState<string>(opts.defaultSort ?? opts.sorts[0]?.value ?? '')
  const [dir, setDir] = useState<SortDirection>(opts.sorts.find((s) => s.value === (opts.defaultSort ?? opts.sorts[0]?.value))?.dir ?? 'asc')

  const setSort = (value: string) => {
    setSortState(value)
    setDir(opts.sorts.find((s) => s.value === value)?.dir ?? 'asc')
  }

  const results = useMemo(() => {
    const q = normalise(query)
    const words = q.split(' ').filter(Boolean)
    let out = items.filter((item) => {
      if (words.length) {
        const text = normalise(opts.search(item))
        if (!words.every((w) => text.includes(w))) return false
      }
      for (const f of opts.filters ?? []) {
        const want = filters[f.key]
        if (!want) continue
        const have = f.get(item)
        if (Array.isArray(have) ? !have.includes(want) : have !== want) return false
      }
      return true
    })
    const s = opts.sorts.find((x) => x.value === sort)
    if (s) out = sortBy(out, s.get, dir)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, filters, sort, dir])

  const activeFilters = Object.values(filters).filter(Boolean).length + (query ? 1 : 0)

  return {
    query,
    setQuery,
    filters,
    setFilter: (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value })),
    clear: () => {
      setQuery('')
      setFilters({})
    },
    sort,
    setSort,
    dir,
    toggleDir: () => setDir((d) => (d === 'asc' ? 'desc' : 'asc')),
    results,
    activeFilters,
    defs: opts,
  }
}
