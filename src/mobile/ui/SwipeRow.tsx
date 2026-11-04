import { type ComponentType, type ReactNode, useEffect, useId, useRef } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import type { Tone } from '@/data/constants'
import { toneColor } from '@/lib/tone'

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
export function SwipeRow({ actions, children, testId }: { actions: SwipeAction[]; children: ReactNode; testId?: string }) {
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
        }}
        onDragEnd={(_e, info) => {
          setOpen(info.offset.x < -width / 3 || info.velocity.x < -350 ? true : info.offset.x > 0 ? false : isOpen.current && info.offset.x < width / 3)
          setTimeout(() => {
            dragged.current = false
          }, 50)
        }}
        onClickCapture={(e) => {
          // A swipe isn't a tap; and tapping an open row just closes it.
          if (dragged.current || isOpen.current) {
            e.stopPropagation()
            e.preventDefault()
            if (isOpen.current && !dragged.current) setOpen(false)
          }
        }}
        className="relative z-[1] bg-[var(--ios-cell)]"
      >
        {children}
      </motion.div>
    </div>
  )
}
