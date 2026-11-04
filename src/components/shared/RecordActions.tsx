import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { CollectionKey } from '@/data/types'
import { actions } from '@/store/store'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'

/** Standard "…" menu: edit, optional extra actions, duplicate, delete. */
export function RecordActions({ collection, id, extra = [], duplicate }: { collection: CollectionKey; id: string; extra?: MenuItem[]; duplicate?: boolean }) {
  return (
    <Menu
      items={[
        { label: 'Edit', icon: Pencil, onSelect: () => editor.edit(collection, id) },
        ...extra,
        ...(duplicate
          ? [
              {
                label: 'Duplicate',
                icon: Copy,
                onSelect: () => {
                  const r = actions.get(collection, id) as Record<string, unknown> | undefined
                  if (!r) return
                  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = r
                  actions.create(collection, rest as never)
                },
              } satisfies MenuItem,
            ]
          : []),
        'divider',
        { label: 'Delete', icon: Trash2, danger: true, onSelect: () => void deleteRecord(collection, id) },
      ]}
    />
  )
}
