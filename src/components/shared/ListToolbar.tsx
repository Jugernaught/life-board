import type { ReactNode } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FilterX } from 'lucide-react'
import type { ListControls } from '@/hooks/useListControls'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/inputs'

/** Search box, filter dropdowns and sort control for a list. */
export function ListToolbar<T>({ controls, placeholder = 'Search…', children, className, total }: { controls: ListControls<T>; placeholder?: string; children?: ReactNode; className?: string; total?: number }) {
  const { defs } = controls
  return (
    <div className={cn('mb-4 flex flex-col gap-2 lg:flex-row lg:items-center', className)}>
      <SearchInput value={controls.query} onChange={controls.setQuery} placeholder={placeholder} className="lg:w-64" />
      <div className="flex flex-wrap items-center gap-2">
        {defs.filters?.map((f) => (
          <Select key={f.key} size="sm" value={controls.filters[f.key] ?? ''} onChange={(e) => controls.setFilter(f.key, e.target.value)} aria-label={`Filter by ${f.label}`} className="min-w-32">
            <option value="">All {f.label.toLowerCase()}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="flex items-center gap-1">
          <Select size="sm" value={controls.sort} onChange={(e) => controls.setSort(e.target.value)} aria-label="Sort by" className="min-w-36">
            {defs.sorts.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </Select>
          <IconButton icon={controls.dir === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow} label={controls.dir === 'asc' ? 'Ascending' : 'Descending'} onClick={controls.toggleDir} variant="secondary" />
        </div>
        {controls.activeFilters > 0 && (
          <Button size="sm" variant="ghost" icon={FilterX} onClick={controls.clear}>
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        {typeof total === 'number' && (
          <span className="font-mono text-[11.5px] text-ink-subtle tabular">
            {controls.results.length}
            {controls.results.length !== total ? ` of ${total}` : ''} shown
          </span>
        )}
        {children}
      </div>
    </div>
  )
}
