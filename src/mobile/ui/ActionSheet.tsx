import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { create } from 'zustand'
import { useConfirmStore } from '@/components/ui/confirm'
import { cn } from '@/lib/utils'

export interface ActionOption {
  label: string
  destructive?: boolean
  onSelect: () => void
}

export interface ActionSheetRequest {
  title?: string
  message?: string
  options: ActionOption[]
  /** Label of the bottom button (default "Cancel"; "Done" suits information-only sheets). */
  cancelLabel?: string
}

interface ActionSheetState {
  request?: ActionSheetRequest
  open: (r: ActionSheetRequest) => void
  close: () => void
}

const useActionSheetStore = create<ActionSheetState>((set) => ({
  request: undefined,
  open: (request) => set({ request }),
  close: () => set({ request: undefined }),
}))

/** Show an iOS action sheet with a list of choices (and Cancel). */
export const actionSheet = (r: ActionSheetRequest) => useActionSheetStore.getState().open(r)

function SheetFrame({ onCancel, children, testId, cancelLabel = 'Cancel' }: { onCancel: () => void; children: React.ReactNode; testId?: string; cancelLabel?: string }) {
  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <motion.div className="absolute inset-0 bg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} aria-hidden />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        data-testid={testId}
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        exit={{ y: '110%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="absolute inset-x-2 flex flex-col gap-2"
        style={{ bottom: 'calc(var(--safe-bottom) + 8px)', maxHeight: 'calc(100% - var(--safe-top) - var(--safe-bottom) - 24px)' }}
      >
        {children}
        <button type="button" onClick={onCancel} className="ios-headline h-14 shrink-0 rounded-[14px] bg-[var(--ios-cell)] text-accent active:bg-[var(--ios-cell-pressed)]" data-testid="action-sheet-cancel">
          {cancelLabel}
        </button>
      </motion.div>
    </div>
  )
}

/** Renders the shared confirm dialog (used by every delete/reset) as an iOS action sheet. */
export function ActionSheetHost() {
  const confirm = useConfirmStore()
  const sheet = useActionSheetStore()
  const [typed, setTyped] = useState('')
  const req = confirm.request
  const blocked = !!req?.requireText && typed.trim().toLowerCase() !== req.requireText.toLowerCase()
  const finish = (ok: boolean) => {
    setTyped('')
    confirm.close(ok)
  }
  return createPortal(
    <>
      <AnimatePresence>
        {req && (
          <SheetFrame onCancel={() => finish(false)} testId="action-sheet">
            <div className="min-h-0 overflow-y-auto overscroll-contain rounded-[14px] bg-[var(--ios-cell)]">
              <div className="px-4 py-3.5 text-center">
                <p className="ios-footnote font-semibold text-ink-subtle">{req.title}</p>
                {req.message && <div className="ios-footnote mt-1 text-ink-subtle">{req.message}</div>}
                {req.requireText && (
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={`Type ${req.requireText} to confirm`}
                    aria-label={`Type ${req.requireText} to confirm`}
                    autoCapitalize="characters"
                    className="mt-3 w-full rounded-[10px] bg-[var(--ios-fill)] px-3 text-center text-ink outline-none"
                  />
                )}
              </div>
              <button
                type="button"
                disabled={blocked}
                onClick={() => finish(true)}
                data-testid="confirm-button"
                className={cn('ios-body h-14 w-full border-t-[0.5px] border-[var(--color-line-strong)] active:bg-[var(--ios-cell-pressed)] disabled:opacity-40', (req.tone ?? 'danger') === 'danger' ? 'text-bad' : 'text-accent')}
              >
                {req.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </SheetFrame>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sheet.request && !req && (
          <SheetFrame onCancel={sheet.close} testId="choice-sheet" cancelLabel={sheet.request.cancelLabel}>
            <div className="min-h-0 overflow-y-auto overscroll-contain rounded-[14px] bg-[var(--ios-cell)]">
              {(sheet.request.title || sheet.request.message) && (
                <div className="px-4 py-3 text-center">
                  {sheet.request.title && <p className="ios-footnote font-semibold text-ink-subtle">{sheet.request.title}</p>}
                  {sheet.request.message && <p className="ios-footnote mt-0.5 text-ink-subtle">{sheet.request.message}</p>}
                </div>
              )}
              {sheet.request.options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => {
                    sheet.close()
                    o.onSelect()
                  }}
                  className={cn('ios-body h-14 w-full active:bg-[var(--ios-cell-pressed)]', (i > 0 || sheet.request?.title || sheet.request?.message) && 'border-t-[0.5px] border-[var(--color-line-strong)]', o.destructive ? 'text-bad' : 'text-accent')}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </SheetFrame>
        )}
      </AnimatePresence>
    </>,
    document.body,
  )
}
