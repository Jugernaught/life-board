import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSheetDepth } from './sheetStore'

export interface SheetProps {
  open: boolean
  /** Called when the person asks to close (Cancel, drag down, tap outside). */
  onClose: () => void
  title?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  testId?: string
  /** "large" fills the screen below the status bar; "auto" fits its content. */
  size?: 'large' | 'auto'
  bodyClassName?: string
}

/**
 * iOS-style bottom sheet. Drag the top bar down (or tap outside) to dismiss.
 * It sits above the on-screen keyboard and scrolls focused fields into view.
 */
export function Sheet(props: SheetProps) {
  return createPortal(<AnimatePresence>{props.open && <SheetInner {...props} />}</AnimatePresence>, document.body)
}

function SheetInner({ onClose, title, leading, trailing, children, testId, size = 'large', bodyClassName }: SheetProps) {
  const controls = useDragControls()
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    useSheetDepth.getState().inc()
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    // Keep a focused field visible above the keyboard.
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (t.matches('input, textarea, select')) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
    const el = panel.current
    el?.addEventListener('focusin', onFocus)
    document.addEventListener('keydown', onKey)
    return () => {
      useSheetDepth.getState().dec()
      el?.removeEventListener('focusin', onFocus)
      document.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <motion.div className="absolute inset-0 bg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={() => closeRef.current()} aria-hidden />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        data-testid={testId}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) closeRef.current()
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
        className={cn('absolute inset-x-0 flex flex-col overflow-hidden rounded-t-[12px] bg-[var(--ios-cell)] shadow-[0_-8px_40px_rgb(0_0_0/0.25)]')}
        style={{
          bottom: 'var(--kb)',
          maxHeight: 'calc(100% - var(--safe-top) - 10px - var(--kb))',
          height: size === 'large' ? 'calc(100% - var(--safe-top) - 10px - var(--kb))' : undefined,
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
        }}
      >
        <div className="shrink-0 touch-none" onPointerDown={(e) => controls.start(e)}>
          <div className="mx-auto mt-[5px] h-[5px] w-9 rounded-full bg-[var(--color-line-strong)]" aria-hidden />
          {(title || leading || trailing) && (
            <div className="relative flex h-11 items-center px-1">
              <div className="z-10 flex flex-1 items-center">{leading}</div>
              {title && <h2 className="ios-headline pointer-events-none absolute inset-x-[25%] truncate text-center text-ink">{title}</h2>}
              <div className="z-10 flex flex-1 items-center justify-end">{trailing}</div>
            </div>
          )}
        </div>
        <div className={cn('ios-scroll min-h-0 flex-1', bodyClassName)} data-sheet-body>
          <div style={{ paddingBottom: 'max(16px, var(--safe-bottom))' }}>{children}</div>
        </div>
      </motion.div>
    </div>
  )
}
