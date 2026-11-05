import { CalendarDays, CircleEllipsis, NotebookPen, PenLine, Plus, Repeat, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToday } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { useCollection, useSettings } from '@/store/store'
import { editor } from '@/components/editor/editorStore'
import { useUI } from '@/components/command/uiStore'
import { nav, screenScrollers, useNav } from './navigator'
import type { TabId } from './paths'
import { hasFloatingAction, useTabContext } from './tabContext'

export const TABS: { id: TabId; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'journal', label: 'Journal', icon: NotebookPen },
  { id: 'more', label: 'More', icon: CircleEllipsis },
]

/** The floating accessory button does the most likely next thing for the tab you're on. */
function useAccessory(tab: TabId) {
  const today = useToday()
  const { showQuickAdd } = useUI()
  const ctx = useTabContext()
  switch (tab) {
    case 'plan':
      return ctx.planMode === 'calendar'
        ? { label: 'New event', icon: Plus, run: () => editor.create('events', { date: ctx.planDate ?? today }) }
        : { label: 'New task', icon: Plus, run: () => showQuickAdd('tasks', { dueDate: today }) }
    case 'habits':
      return ctx.habitsSegment === 'goals' ? { label: 'New goal', icon: Plus, run: () => editor.create('goals') } : { label: 'New habit', icon: Plus, run: () => editor.create('habits') }
    case 'journal':
      return { label: 'Write today’s entry', icon: PenLine, run: () => nav.push(`journal/write/${today}`) }
    // More: Quick add, which never changes your place in the stack. Search is the More screen's own field.
    default:
      return { label: 'Quick add', icon: Plus, run: () => showQuickAdd() }
  }
}

/**
 * Bottom tab bar. Tapping the current tab goes back to its first screen,
 * and tapping again scrolls to the top — the standard iOS behaviour.
 *
 * Liquid Glass, Cyberpunk and Minimal Dark use a floating capsule (iOS 26
 * style) with a contextual action button beside it; Apple Clean keeps the
 * classic full-width bar.
 */
export function TabBar() {
  const { tab, stacks, switchTab, popToRoot } = useNav()
  const style = useSettings().uiStyle
  const today = useToday()
  const tasks = useCollection('tasks')
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length
  const accessory = useAccessory(tab)
  const floating = hasFloatingAction(style)

  const onTap = (id: TabId) => {
    if (id !== tab) return switchTab(id)
    if (stacks[id].length > 1) return popToRoot(id)
    const top = stacks[id][0]
    screenScrollers.get(top.key)?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const items = TABS.map((t) => {
    const active = t.id === tab
    const badge = t.id === 'plan' && overdue > 0 ? overdue : 0
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onTap(t.id)}
        aria-current={active ? 'page' : undefined}
        aria-label={badge ? `${t.label}, ${badge} overdue` : t.label}
        data-testid={`tab-${t.id}`}
        className={cn(
          'relative z-0 flex flex-1 flex-col items-center gap-[3px] transition-[color,transform] duration-150 active:scale-[0.94]',
          floating ? 'justify-center' : 'justify-start pt-[7px]',
          active ? 'text-accent' : floating ? 'text-ink-muted' : 'text-[var(--color-ink-subtle)]',
        )}
      >
        {floating && active && (
          <motion.span
            layoutId="tab-lens"
            className="absolute inset-y-[5px] inset-x-[3px] -z-10 rounded-full"
            style={{ background: 'var(--ios-tab-active-bg)', boxShadow: 'var(--ios-tab-glow)' }}
            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          />
        )}
        <span className="relative">
          <t.icon size={floating ? 23 : 25} strokeWidth={active ? 2.3 : 1.8} />
          {badge > 0 && (
            <span className="absolute -top-1 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[12px] leading-none font-medium text-white tabular-nums" aria-hidden>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        {/* Like iOS, tab labels keep their size whatever the Text Size setting (inline style isn't scaled). */}
        <span className="leading-none font-medium tracking-[0.01em]" style={{ fontSize: 10 }}>
          {t.label}
        </span>
      </button>
    )
  })

  if (!floating) {
    return (
      <nav
        aria-label="Tabs"
        className="ios-bar ios-hairline-t absolute inset-x-0 bottom-0 z-40 flex"
        style={{ height: 'var(--tabbar-h)', paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        {items}
      </nav>
    )
  }

  return (
    <nav
      aria-label="Tabs"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-end gap-2.5"
      style={{ height: 'var(--tabbar-h)', paddingBottom: 'var(--tabbar-float-bottom)', paddingLeft: 'calc(var(--safe-left) + 14px)', paddingRight: 'calc(var(--safe-right) + 14px)' }}
      data-floating
    >
      <div className="ios-glass pointer-events-auto flex h-[62px] min-w-0 flex-1 rounded-full px-1" data-testid="tab-capsule">
        {items}
      </div>
      <motion.button
        key={tab}
        type="button"
        onClick={accessory.run}
        aria-label={accessory.label}
        title={accessory.label}
        data-testid="tab-accessory"
        initial={{ scale: 0.85, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
        className="ios-glass pointer-events-auto flex size-[62px] shrink-0 items-center justify-center rounded-full text-accent active:scale-[0.92]"
      >
        <accessory.icon size={26} strokeWidth={2.2} />
      </motion.button>
    </nav>
  )
}
