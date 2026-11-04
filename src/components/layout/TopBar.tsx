import { useLocation, useNavigate } from 'react-router'
import { format } from 'date-fns'
import { Check, Menu as MenuIcon, Moon, Palette, Plus, Search, Settings2, Sun } from 'lucide-react'
import { NAV_ITEMS } from '@/app/navigation'
import { THEMES, resolveAppearance, supportsLight } from '@/app/themes'
import { useSystemDark } from '@/app/ThemeController'
import { useNow } from '@/hooks/useNow'
import { formatTime } from '@/lib/dates'
import { actions, useSettings } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/display'
import { Menu } from '@/components/ui/Menu'
import { useUI } from '@/components/command/uiStore'
import { Logo } from './Sidebar'

export function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const settings = useSettings()
  const now = useNow()
  const { setPalette, showQuickAdd, setMobileNav } = useUI()
  const current = [...NAV_ITEMS].sort((a, b) => b.path.length - a.path.length).find((n) => (n.path === '/' ? pathname === '/' : pathname.startsWith(n.path)))
  const isLight = resolveAppearance(settings, settings.theme, useSystemDark()).mode === 'light'
  const canToggleMode = supportsLight(settings.uiStyle)
  const CurrentIcon = current?.icon
  return (
    // In Liquid Glass the toolbar floats above the content; elsewhere it spans the window.
    <header className="no-print sticky top-0 z-20" style={{ padding: 'var(--shell-gap) var(--shell-gap) 0' }}>
      <div className="chrome flex h-14 items-center gap-2 px-4 sm:px-5" style={{ borderRadius: 'var(--toolbar-radius)', borderWidth: 'var(--toolbar-border)' }} data-testid="toolbar">
        <IconButton icon={MenuIcon} label="Open navigation" onClick={() => setMobileNav(true)} className="-ml-1.5 lg:hidden" />
        <div className="lg:hidden">
          <Logo collapsed />
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
          <span className="cyber-only font-mono text-[11px] tracking-widest text-ink-subtle">LIFE//OS</span>
          <span className="cyber-only text-ink-subtle/50">/</span>
          <span className="cyber-only truncate text-ink-muted">{current?.label}</span>
          {CurrentIcon && <CurrentIcon size={16} className="not-cyber shrink-0 text-accent" aria-hidden />}
          <span className="not-cyber truncate text-[14px] font-semibold text-ink">{current?.label}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="hidden h-8 w-64 items-center gap-2 rounded-[var(--radius-btn)] border border-line bg-ink/[0.04] px-3 text-[13px] text-ink-subtle transition-colors hover:border-line-strong hover:text-ink-muted md:flex"
          aria-label="Search and commands"
        >
          <Search size={14} />
          <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </button>
        <IconButton icon={Search} label="Search" onClick={() => setPalette(true)} className="md:hidden" />
        <div className="hidden items-baseline gap-1.5 px-2 font-mono text-[12px] text-ink-muted tabular sm:flex" aria-label="Current time">
          <span className="text-ink">{formatTime(format(now, 'HH:mm'), settings.timeFormat)}</span>
          <span className="text-ink-subtle">{format(now, 'EEE d MMM')}</span>
        </div>
        <Menu
          label="Appearance"
          trigger={(p) => <IconButton icon={Palette} label="Appearance" {...p} data-testid="appearance-menu" />}
          items={[
            ...THEMES.map((t) => ({
              label: t.name,
              hint: settings.uiStyle === t.id ? <Check size={14} className="text-accent" aria-label="(current)" /> : undefined,
              onSelect: () => actions.updateSettings({ uiStyle: t.id }),
            })),
            'divider' as const,
            { label: 'Appearance settings…', icon: Settings2, onSelect: () => navigate('/settings?tab=appearance') },
          ]}
        />
        {canToggleMode && (
          <IconButton
            icon={isLight ? Moon : Sun}
            label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={() => actions.updateSettings({ theme: isLight ? 'dark' : 'light' })}
          />
        )}
        <Button variant="primary" size="sm" icon={Plus} onClick={() => showQuickAdd()} className="max-sm:hidden" title="Quick add (N)">
          New
        </Button>
        <IconButton icon={Plus} label="Quick add" variant="subtle" onClick={() => showQuickAdd()} className="sm:hidden" />
      </div>
    </header>
  )
}
