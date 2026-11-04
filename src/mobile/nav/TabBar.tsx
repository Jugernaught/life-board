import { CalendarDays, CircleEllipsis, NotebookPen, Repeat, Sun } from 'lucide-react'
import { useToday } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { useCollection } from '@/store/store'
import { screenScrollers, useNav } from './navigator'
import type { TabId } from './paths'

export const TABS: { id: TabId; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'journal', label: 'Journal', icon: NotebookPen },
  { id: 'more', label: 'More', icon: CircleEllipsis },
]

/**
 * Bottom tab bar. Tapping the current tab goes back to its first screen,
 * and tapping again scrolls to the top — the standard iOS behaviour.
 */
export function TabBar() {
  const { tab, stacks, switchTab, popToRoot } = useNav()
  const today = useToday()
  const tasks = useCollection('tasks')
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length

  const onTap = (id: TabId) => {
    if (id !== tab) return switchTab(id)
    if (stacks[id].length > 1) return popToRoot(id)
    const top = stacks[id][0]
    screenScrollers.get(top.key)?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Tabs"
      className="ios-bar ios-hairline-t absolute inset-x-0 bottom-0 z-40 flex"
      style={{ height: 'var(--tabbar-h)', paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      {TABS.map((t) => {
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
            className={cn('relative flex flex-1 flex-col items-center justify-start gap-[3px] pt-[7px] transition-colors', active ? 'text-accent' : 'text-[var(--color-ink-subtle)]')}
          >
            <span className="relative">
              <t.icon size={25} strokeWidth={active ? 2.3 : 1.8} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[12px] leading-none font-medium text-white tabular-nums" aria-hidden>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="text-[10px] leading-none font-medium tracking-[0.01em]">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
