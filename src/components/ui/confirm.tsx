import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { create } from 'zustand'
import { Button } from './Button'
import { Input } from './inputs'
import { Modal } from './Modal'

export interface ConfirmOptions {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  /** Require typing this word to enable the confirm button (for irreversible actions). */
  requireText?: string
}

interface ConfirmState {
  request?: ConfirmOptions & { resolve: (ok: boolean) => void }
  open: (o: ConfirmOptions) => Promise<boolean>
  close: (ok: boolean) => void
}

/** Exported so the iPhone version can render confirmations as an action sheet. */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: undefined,
  open: (o) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false)
      set({ request: { ...o, resolve } })
    }),
  close: (ok) => {
    get().request?.resolve(ok)
    set({ request: undefined })
  },
}))

/** Ask for confirmation. Resolves true only if the person explicitly confirms. */
export const confirmAction = (o: ConfirmOptions) => useConfirmStore.getState().open(o)

export function ConfirmHost() {
  const { request, close } = useConfirmStore()
  const [typed, setTyped] = useState('')
  const danger = (request?.tone ?? 'danger') === 'danger'
  const blocked = !!request?.requireText && typed.trim().toLowerCase() !== request.requireText.toLowerCase()
  const finish = (ok: boolean) => {
    setTyped('')
    close(ok)
  }
  return (
    <Modal
      open={!!request}
      onClose={() => finish(false)}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {danger && <AlertTriangle size={17} className="text-bad" />}
          {request?.title}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => finish(false)}>
            {request?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => finish(true)} data-testid="confirm-button">
            {request?.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
          </Button>
        </>
      }
    >
      {request?.message && <div className="text-sm leading-relaxed text-ink-muted">{request.message}</div>}
      {request?.requireText && (
        <div className="mt-4">
          <label className="mb-1.5 block text-[12px] text-ink-muted">
            Type <span className="font-mono font-semibold text-ink">{request.requireText}</span> to confirm
          </label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus aria-label={`Type ${request.requireText} to confirm`} />
        </div>
      )}
    </Modal>
  )
}
