import { type ComponentType, type ReactNode, useEffect, useId, useRef } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import type { Tone } from '@/data/constants'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>

export interface SwipeAction {
  label: string
  icon?: IconType
  tone: Tone
  onAction: () => void
}

const ACTION_W = 78
// Only one row is open at a time, like Mail and Reminders.
const openListeners = new Set<(id: string) => void>()
const announceOpen = (id: string) => openListeners.forEach((l) => l(id))

/**
 * A list row that reveals actions when swiped left. The actions are also
 * real, focusable buttons, so keyboard and VoiceOver users can reach them.
 */
const LONG_PRESS_MS = 480
const MOVE_TOLERANCE = 8

/**
 * Press-and-hold, like a context menu on iOS. Movement past a few pixels (a
 * scroll or a swipe) cancels it, and the tap that ends a long press is
 * swallowed so the row doesn't also open.
 */
function useLongPress(onLongPress?: () => void) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const cancel = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    start.current = null
  }
  useEffect(() => cancel, [])
  if (!onLongPress) return { fired, handlers: {}, cancel }
  return {
    fired,
    cancel,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(() => {
          fired.current = true
          start.current = null
          navigator.vibrate?.(8)
          onLongPress()
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        if (!fired.current) {
          cancel()
          fired.current = true
          onLongPress()
        }
      },
    },
  }
}

export function SwipeRow({ actions, children, testId, onLongPress }: { actions: SwipeAction[]; children: ReactNode; testId?: string; onLongPress?: () => void }) {
  const press = useLongPress(onLongPress)
  const id = useId()
  const x = useMotionValue(0)
  const width = actions.length * ACTION_W
  // Invisible until the row moves, so the coloured actions never show through rounded corners.
  const actionsOpacity = useTransform(x, [-6, 0], [1, 0])
  const dragged = useRef(false)
  const isOpen = useRef(false)

  const setOpen = (open: boolean) => {
    isOpen.current = open
    if (open) announceOpen(id)
    animate(x, open ? -width : 0, { type: 'spring', stiffness: 500, damping: 42 })
  }

  useEffect(() => {
    const l = (other: string) => {
      if (other !== id && isOpen.current) setOpen(false)
    }
    openListeners.add(l)
    return () => {
      openListeners.delete(l)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className="relative overflow-hidden" data-testid={testId}>
      <motion.div className="absolute inset-y-0 right-0 flex" style={{ width, opacity: actionsOpacity }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onFocus={() => setOpen(true)}
            onClick={() => {
              setOpen(false)
              a.onAction()
            }}
            className="ios-footnote flex flex-col items-center justify-center gap-1 font-medium text-white"
            style={{ width: ACTION_W, background: toneColor(a.tone) }}
          >
            {a.icon && <a.icon size={20} strokeWidth={2} />}
            {a.label}
          </button>
        ))}
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        onDragStart={() => {
          dragged.current = true
          press.cancel()
        }}
        {...press.handlers}
        onDragEnd={(_e, info) => {
          setOpen(info.offset.x < -width / 3 || info.velocity.x < -350 ? true : info.offset.x > 0 ? false : isOpen.current && info.offset.x < width / 3)
          setTimeout(() => {
            dragged.current = false
          }, 50)
        }}
        onClickCapture={(e) => {
          if (press.fired.current) {
            press.fired.current = false
            e.stopPropagation()
            e.preventDefault()
            return
          }
          // A swipe isn't a tap; and tapping an open row just closes it.
          if (dragged.current || isOpen.current) {
            e.stopPropagation()
            e.preventDefault()
            if (isOpen.current && !dragged.current) setOpen(false)
          }
        }}
        className={cn('relative z-[1] bg-[var(--ios-cell)]', onLongPress && 'select-none [-webkit-touch-callout:none]')}
      >
        {children}
      </motion.div>
    </div>
  )
}
