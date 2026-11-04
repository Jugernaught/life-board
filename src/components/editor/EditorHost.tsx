import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Trash2 } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import { COLLECTION_KEYS } from '@/data/schema'
import type { CollectionKey } from '@/data/types'
import { EntityForm } from '@/forms/EntityForm'
import { FORMS } from '@/forms/registry'
import type { FormContext } from '@/forms/types'
import { useToday } from '@/hooks/useNow'
import { ValidationError, actions, useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import { type EditorRequest, useEditorStore } from './editorStore'
import { deleteRecord } from './useDeleteRecord'

/** Renders the global create/edit dialog and handles `?open=collection:id` deep links. */
export function EditorHost() {
  const { stack, close, open } = useEditorStore()
  const [params, setParams] = useSearchParams()
  const request = stack[stack.length - 1]

  useEffect(() => {
    const target = params.get('open')
    if (!target) return
    const [key, id] = target.split(':') as [CollectionKey, string]
    if (COLLECTION_KEYS.includes(key) && id && actions.get(key, id)) open({ mode: 'edit', key, id })
    else if (COLLECTION_KEYS.includes(key) && id) toast({ title: 'That record no longer exists', tone: 'warning' })
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('open')
        return next
      },
      { replace: true },
    )
  }, [params, setParams, open])

  return (
    <>
      {stack.map((r, i) => (
        <EditorDialog key={`${r.mode}-${r.key}-${'id' in r ? r.id : ''}-${i}`} request={r} active={r === request} onClose={close} />
      ))}
    </>
  )
}

function EditorDialog({ request, onClose, active }: { request: EditorRequest; onClose: () => void; active: boolean }) {
  const db = useDatabase()
  const today = useToday()
  const config = FORMS[request.key]
  const meta = COLLECTIONS[request.key]
  const ctx: FormContext = { db, settings: db.settings, today }
  const record = request.mode === 'edit' ? actions.get(request.key, request.id) : undefined
  const formId = `editor-${request.key}-${request.mode}`

  // Snapshot initial values once so typing isn't overwritten by store updates.
  const initial = useMemo(
    () => (request.mode === 'edit' ? { ...(record as object) } : { ...(config.defaults?.(ctx) ?? {}), ...(request.defaults ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request],
  )

  if (request.mode === 'edit' && !record) return null

  const save = (data: Record<string, unknown>) => {
    try {
      if (request.mode === 'create') {
        const created = actions.create(request.key, data as never)
        toast({ title: `${meta.singular} added`, description: meta.title(created as never) })
        request.onSaved?.(created)
      } else {
        const updated = actions.update(request.key, request.id, data as never)
        toast({ title: 'Changes saved' })
        if (updated) request.onSaved?.(updated)
      }
      onClose()
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof ValidationError ? e.message : String(e), tone: 'error' })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size={config.size ?? 'md'}
      title={request.title ?? (request.mode === 'create' ? config.createTitle ?? `New ${meta.singular.toLowerCase()}` : `Edit ${meta.singular.toLowerCase()}`)}
      dismissible={active}
      footer={
        <>
          {request.mode === 'edit' && (
            <Button
              variant="ghost"
              icon={Trash2}
              className="mr-auto text-bad hover:text-bad"
              onClick={async () => {
                if (await deleteRecord(request.key, request.id)) onClose()
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            {request.mode === 'create' ? `Add ${meta.singular.toLowerCase()}` : 'Save changes'}
          </Button>
        </>
      }
    >
      <EntityForm config={config as never} initial={initial} ctx={ctx} formId={formId} onSubmit={save} smart={request.mode === 'create'} />
    </Modal>
  )
}
