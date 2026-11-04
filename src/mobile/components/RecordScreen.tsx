import { type ReactNode, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CollectionKey, Collections } from '@/data/types'
import { normalise } from '@/lib/utils'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { type SwipeAction, SwipeRow } from '../ui/SwipeRow'
import { SearchField } from '../ui/controls'
import { Cell, type CellProps, EmptyRow, Section } from '../ui/List'
import { NavButton, Screen } from '../ui/Screen'

export interface RecordScreenProps<K extends CollectionKey> {
  title: string
  collection: K
  items: Collections[K][]
  /** Row content for a record. */
  row: (item: Collections[K]) => Omit<CellProps, 'onClick'>
  /** Text searched by the search field (omit to hide search). */
  search?: (item: Collections[K]) => string
  /** Group rows under section headers. */
  group?: (item: Collections[K]) => string
  groupOrder?: (a: string, b: string) => number
  /** Section header text for a group key (defaults to the key). */
  groupLabel?: (key: string) => string
  empty: string
  defaults?: Record<string, unknown>
  extraActions?: (item: Collections[K]) => SwipeAction[]
  onOpen?: (item: Collections[K]) => void
  /** Content above the list (summary cards, filters). */
  top?: ReactNode
  footer?: ReactNode
  testId?: string
}

/**
 * A standard record list: search, tap to edit in a sheet, swipe to delete,
 * + to add. Used by the simpler sections so they all behave the same way.
 */
export function RecordScreen<K extends CollectionKey>({ title, collection, items, row, search, group, groupOrder, groupLabel, empty, defaults, extraActions, onOpen, top, footer, testId }: RecordScreenProps<K>) {
  const [query, setQuery] = useState('')
  const q = normalise(query)
  const shown = useMemo(() => (q && search ? items.filter((i) => normalise(search(i)).includes(q)) : items), [items, q, search])
  const groups = useMemo(() => {
    if (!group) return [['', shown]] as [string, Collections[K][]][]
    const map = new Map<string, Collections[K][]>()
    for (const i of shown) {
      const k = group(i)
      map.set(k, [...(map.get(k) ?? []), i])
    }
    return [...map.entries()].sort(([a], [b]) => (groupOrder ? groupOrder(a, b) : 0))
  }, [shown, group, groupOrder])

  const renderRow = (item: Collections[K]) => {
    const id = (item as { id: string }).id
    return (
      <SwipeRow key={id} actions={[...(extraActions?.(item) ?? []), { label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord(collection, id) }]}>
        <Cell {...row(item)} chevron onClick={() => (onOpen ? onOpen(item) : editor.edit(collection, id))} testId={`m-row-${collection}`} />
      </SwipeRow>
    )
  }

  return (
    <Screen
      title={title}
      testId={testId}
      trailing={
        <NavButton label={`Add ${title}`} onClick={() => editor.create(collection, defaults as never)} testId="record-add">
          <Plus size={26} />
        </NavButton>
      }
      header={search && items.length > 6 ? <SearchField value={query} onChange={setQuery} placeholder={`Search ${title.toLowerCase()}`} /> : undefined}
    >
      {top}
      {shown.length === 0 ? (
        <Section footer={footer}>
          <EmptyRow>{items.length ? 'Nothing matches.' : empty}</EmptyRow>
        </Section>
      ) : (
        groups.map(([g, list], i) => (
          <Section key={g || 'all'} header={g ? (groupLabel ? groupLabel(g) : g) : undefined} footer={i === groups.length - 1 ? footer : undefined}>
            {list.map(renderRow)}
          </Section>
        ))
      )}
    </Screen>
  )
}
