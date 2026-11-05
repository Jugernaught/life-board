import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { uid } from '@/lib/utils'
import { cn } from '@/lib/utils'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
  duration: number
}

interface ToastState {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number }) => string
  dismiss: (id: string) => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = uid()
    const item: ToastItem = { tone: 'success', duration: t.action ? 7000 : 3500, ...t, id }
    set({ toasts: [...get().toasts.slice(-3), item] })
    timers.set(id, setTimeout(() => get().dismiss(id), item.duration))
    return id
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },
}))

/** Show a toast from anywhere (components or plain functions). */
export const toast = (t: Parameters<ToastState['push']>[0]) => useToasts.getState().push(t)

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const colors = { success: 'var(--color-ok)', error: 'var(--color-bad)', info: 'var(--color-accent)', warning: 'var(--color-warn)' }

export function Toaster({ placement = 'bottom' }: { placement?: 'bottom' | 'top' }) {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 p-4',
        placement === 'bottom' ? 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end' : 'top-0 pt-[calc(var(--safe-top,0px)+0.5rem)]',
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: placement === 'bottom' ? 16 : -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="float pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[calc(var(--radius-control)+6px)] px-4 py-3"
              style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${colors[t.tone]} 25%, transparent), 0 16px 40px -16px rgb(0 0 0 / 0.8)` }}
            >
              <Icon size={18} className="mt-0.5 shrink-0" style={{ color: colors[t.tone] }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-accent hover:bg-accent/10"
                  onClick={() => {
                    t.action?.onClick()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="shrink-0 rounded p-0.5 text-ink-subtle hover:text-ink">
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
