import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

export interface MenuItem {
  label: string
  icon?: IconType
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hint?: ReactNode
}

/** A small dropdown of actions ("…" menus on cards and rows). */
export function Menu({ items, label = 'More actions', trigger, align = 'end' }: { items: (MenuItem | 'divider')[]; label?: string; trigger?: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; id: string }) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null)
  const id = useId()
  const anchor = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const place = () => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        anchor.current?.querySelector('button')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const nodes = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])]
        const i = nodes.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'ArrowDown' ? nodes[(i + 1) % nodes.length] : nodes[(i - 1 + nodes.length) % nodes.length]
        next?.focus()
      }
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    const t = setTimeout(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(), 20)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const toggle = () => setOpen((o) => !o)

  return (
    <div ref={anchor} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        trigger({ onClick: toggle, 'aria-expanded': open, 'aria-haspopup': 'menu', id })
      ) : (
        <IconButton icon={MoreHorizontal} label={label} onClick={toggle} aria-expanded={open} aria-haspopup="menu" id={id} size="sm" />
      )}
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={menu}
              role="menu"
              aria-labelledby={id}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
              transition={{ duration: 0.14 }}
              className="float fixed z-[90] min-w-44 rounded-[calc(var(--radius-control)+4px)] p-1"
              style={align === 'end' ? { top: pos.top, right: Math.max(8, pos.right) } : { top: pos.top, left: Math.max(8, pos.left) }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item, i) =>
                item === 'divider' ? (
                  <div key={`d${i}`} className="my-1 h-px bg-line" />
                ) : (
                  <button
                    key={item.label}
                    role="menuitem"
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false)
                      item.onSelect()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-2 text-left text-[13px] transition-colors outline-none disabled:opacity-40',
                      item.danger ? 'text-bad hover:bg-bad/10 focus:bg-bad/10' : 'text-ink hover:bg-ink/[0.07] focus:bg-ink/[0.07]',
                    )}
                  >
                    {item.icon && <item.icon size={14} className={item.danger ? '' : 'text-ink-subtle'} />}
                    <span className="flex-1">{item.label}</span>
                    {item.hint}
                  </button>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
