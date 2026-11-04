import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Open modals, topmost last — only the topmost one reacts to Escape and traps focus. */
const stack: string[] = []

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Close on Escape / backdrop click. */
  dismissible?: boolean
  className?: string
  /** Extra content to the right of the title. */
  headerExtra?: ReactNode
  bodyClassName?: string
  initialFocus?: 'first' | 'none'
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }

export function Modal(props: ModalProps) {
  return createPortal(<AnimatePresence>{props.open && <ModalInner {...props} />}</AnimatePresence>, document.body)
}

function ModalInner({ onClose, title, description, children, footer, size = 'md', dismissible = true, className, headerExtra, bodyClassName, initialFocus = 'first' }: ModalProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    stack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      if (initialFocus === 'none' || !panel.current) return
      const auto = panel.current.querySelector<HTMLElement>('[autofocus],[data-autofocus]')
      const first = auto ?? panel.current.querySelector<HTMLElement>(`[data-modal-body] ${FOCUSABLE}`) ?? panel.current
      first.focus({ preventScroll: true })
    }, 30)

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && panel.current) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null)
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      const i = stack.lastIndexOf(id)
      if (i >= 0) stack.splice(i, 1)
      if (!stack.length) document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [id, dismissible, initialFocus])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <motion.div
        className="absolute inset-0 bg-overlay backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={() => dismissible && onClose()}
        aria-hidden
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
        className={cn(
          'panel hud relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none border-line-strong bg-panel/95 outline-none sm:max-h-[86vh] sm:rounded-b-[var(--radius-panel)]',
          widths[size],
          className,
        )}
      >
        {(title || headerExtra) && (
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={`${id}-title`} className="font-display text-[17px] font-semibold tracking-wide text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <p id={`${id}-desc`} className="mt-0.5 text-[13px] text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            {headerExtra}
            {dismissible && <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1.5" />}
          </div>
        )}
        <div data-modal-body className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>
          {children}
        </div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-panel-2/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </motion.div>
    </div>
  )
}
