import { useEffect, useMemo, useState } from 'react'
import { COLLECTIONS } from '@/data/registry'
import { EntityForm } from '@/forms/EntityForm'
import { FORMS } from '@/forms/registry'
import type { FormContext } from '@/forms/types'
import { useToday } from '@/hooks/useNow'
import { ValidationError, actions, useDatabase } from '@/store/store'
import { confirmAction } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { type EditorRequest, useEditorStore } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { NavButton } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Create/edit sheets for every record type, driven by the same editor store
 * and form definitions as the desktop app. Closing a sheet with unsaved
 * changes asks before discarding them.
 */
export function MobileEditorHost() {
  const { stack, close } = useEditorStore()
  return (
    <>
      {stack.map((r, i) => (
        <EditorSheet key={`${r.mode}-${r.key}-${'id' in r ? r.id : ''}-${i}`} request={r} index={i} onClosed={close} />
      ))}
    </>
  )
}

function EditorSheet({ request, index, onClosed }: { request: EditorRequest; index: number; onClosed: () => void }) {
  const db = useDatabase()
  const today = useToday()
  const [open, setOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const config = FORMS[request.key]
  const meta = COLLECTIONS[request.key]
  const ctx: FormContext = { db, settings: db.settings, today }
  const record = request.mode === 'edit' ? actions.get(request.key, request.id) : undefined
  const formId = `m-editor-${index}`
  const initial = useMemo(
    () => (request.mode === 'edit' ? { ...(record as object) } : { ...(config.defaults?.(ctx) ?? {}), ...(request.defaults ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request],
  )

  const dismiss = () => {
    setOpen(false)
    setTimeout(onClosed, 300)
  }
  const requestClose = async () => {
    if (!dirty) return dismiss()
    if (await confirmAction({ title: 'Discard changes?', message: 'Your changes will be lost.', confirmLabel: 'Discard Changes' })) dismiss()
  }

  // The record vanished (e.g. deleted in another tab): close quietly.
  const missing = request.mode === 'edit' && !record
  useEffect(() => {
    if (missing) onClosed()
  }, [missing, onClosed])
  if (missing) return null

  const save = (data: Record<string, unknown>) => {
    try {
      if (request.mode === 'create') {
        const created = actions.create(request.key, data as never)
        toast({ title: `${meta.singular} added`, description: meta.title(created as never) })
        request.onSaved?.(created)
      } else {
        const updated = actions.update(request.key, request.id, data as never)
        toast({ title: 'Saved' })
        if (updated) request.onSaved?.(updated)
      }
      dismiss()
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof ValidationError ? e.message : String(e), tone: 'error' })
    }
  }

  const title = request.title ?? (request.mode === 'create' ? config.createTitle ?? `New ${titleCase(meta.singular)}` : `Edit ${titleCase(meta.singular)}`)

  return (
    <Sheet
      open={open}
      onClose={requestClose}
      title={title}
      testId="editor-sheet"
      leading={<NavButton onClick={requestClose}>Cancel</NavButton>}
      trailing={
        <button type="submit" form={formId} className="ios-headline flex h-11 items-center px-3 text-accent active:opacity-50" data-testid="editor-save">
          {request.mode === 'create' ? 'Add' : 'Done'}
        </button>
      }
    >
      <div className="px-4 pt-3">
        <EntityForm config={config as never} initial={initial} ctx={ctx} formId={formId} onSubmit={save} autoFocus={request.mode === 'create'} onDirtyChange={setDirty} />
      </div>
      {request.mode === 'edit' && (
        <div className="mt-8 px-4">
          <button
            type="button"
            onClick={async () => {
              if (await deleteRecord(request.key, request.id)) dismiss()
            }}
            className="ios-body h-12 w-full rounded-[12px] bg-[var(--ios-fill)] text-bad active:opacity-60"
            data-testid="editor-delete"
          >
            Delete {titleCase(meta.singular)}
          </button>
        </div>
      )}
    </Sheet>
  )
}
