import { useLocation } from 'react-router'
import { format } from 'date-fns'
import { Menu as MenuIcon, Moon, Plus, Search, Sun } from 'lucide-react'
import { NAV_ITEMS } from '@/app/navigation'
import { useNow } from '@/hooks/useNow'
import { formatTime } from '@/lib/dates'
import { actions, useSettings } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/display'
import { useUI } from '@/components/command/uiStore'
import { Logo } from './Sidebar'

export function TopBar() {
  const { pathname } = useLocation()
  const settings = useSettings()
  const now = useNow()
  const { setPalette, showQuickAdd, setMobileNav } = useUI()
  const current = [...NAV_ITEMS].sort((a, b) => b.path.length - a.path.length).find((n) => (n.path === '/' ? pathname === '/' : pathname.startsWith(n.path)))
  const isLight = settings.theme === 'light'
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/70 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
        <IconButton icon={MenuIcon} label="Open navigation" onClick={() => setMobileNav(true)} className="-ml-1.5 lg:hidden" />
        <div className="lg:hidden">
          <Logo collapsed />
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
          <span className="font-mono text-[11px] tracking-widest text-ink-subtle">ATLAS</span>
          <span className="text-ink-subtle/50">/</span>
          <span className="truncate text-ink-muted">{current?.label}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="hidden h-8 w-64 items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-2.5 text-[13px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-muted md:flex"
          aria-label="Search and commands"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </button>
        <IconButton icon={Search} label="Search" onClick={() => setPalette(true)} className="md:hidden" />
        <div className="hidden items-baseline gap-1.5 px-2 font-mono text-[12px] text-ink-muted tabular sm:flex" aria-label="Current time">
          <span className="text-ink">{formatTime(format(now, 'HH:mm'), settings.timeFormat)}</span>
          <span className="text-ink-subtle">{format(now, 'EEE d MMM')}</span>
        </div>
        <IconButton
          icon={isLight ? Moon : Sun}
          label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
          onClick={() => actions.updateSettings({ theme: isLight ? 'dark' : 'light' })}
        />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => showQuickAdd()} className="max-sm:hidden" title="Quick add (N)">
          New
        </Button>
        <IconButton icon={Plus} label="Quick add" variant="subtle" onClick={() => showQuickAdd()} className="sm:hidden" />
      </div>
    </header>
  )
}
