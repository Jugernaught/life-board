import { COLLECTIONS, RELATIONS } from '@/data/registry'
import type { CollectionKey } from '@/data/types'
import { actions } from '@/store/store'
import { confirmAction } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'

/** Count records that point at this one (they'll be kept and unlinked). */
export function linkedCount(key: CollectionKey, id: string): number {
  const db = actions.getDb()
  return RELATIONS.filter((r) => r.to === key).reduce((n, r) => n + (db[r.from] as unknown as Record<string, unknown>[]).filter((row) => row[r.field] === id).length, 0)
}

/**
 * Ask, delete, and offer Undo. Linked records are never deleted with it —
 * they are unlinked, and Undo restores the links too.
 */
export async function deleteRecord(key: CollectionKey, id: string, opts: { skipConfirm?: boolean } = {}): Promise<boolean> {
  const meta = COLLECTIONS[key]
  const record = actions.get(key, id)
  if (!record) return false
  const title = meta.title(record as never)
  const linked = linkedCount(key, id)
  if (!opts.skipConfirm) {
    const ok = await confirmAction({
      title: `Delete ${meta.singular.toLowerCase()}?`,
      message: (
        <>
          <p>
            <span className="font-medium text-ink">“{title}”</span> will be removed.
          </p>
          {linked > 0 && (
            <p className="mt-2">
              {linked} linked record{linked === 1 ? '' : 's'} will be kept and simply unlinked.
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-ink-subtle">You can undo this straight after.</p>
        </>
      ),
      confirmLabel: 'Delete',
    })
    if (!ok) return false
  }
  const token = actions.remove(key, id)
  if (!token) return false
  toast({ title: `${meta.singular} deleted`, description: title, tone: 'info', action: { label: 'Undo', onClick: () => actions.undo(token) } })
  return true
}
