import { AnimatePresence, motion } from 'framer-motion'
import { NavLink } from 'react-router'
import { ChevronsLeft, ChevronsRight, Plus, Search, X } from 'lucide-react'
import { NAV_ITEMS, type NavItem } from '@/app/navigation'
import { initials, cn } from '@/lib/utils'
import { actions, useSettings } from '@/store/store'
import { Kbd } from '@/components/ui/display'
import { useUI } from '@/components/command/uiStore'
import { SaveStatus } from './SaveStatus'

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Cyberpunk: the original chamfered HUD mark. */}
      <div className="cyber-only relative flex size-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0" aria-hidden>
          <defs>
            <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="100%" stopColor="var(--color-accent-2)" />
            </linearGradient>
          </defs>
          <path d="M8 2h20l6 6v20l-6 6H8l-6-6V8z" fill="none" stroke="url(#logo-g)" strokeWidth="1.5" />
          <path d="M11.5 27 18 9.5 24.5 27M13.7 21.2h8.6" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinejoin="miter" />
          <circle cx="25.5" cy="10.5" r="2.2" fill="var(--color-accent-3)" />
        </svg>
        <div className="absolute inset-1 rounded-md bg-accent/10 blur-md" />
      </div>
      {/* Other themes: an app-icon squircle. */}
      <div
        className="not-cyber relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--color-accent)_60%,transparent),inset_0_1px_0_rgb(255_255_255/0.35)]"
        style={{ background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-2))' }}
        aria-hidden
      >
        <svg viewBox="0 0 36 36" className="size-6">
          <path d="M11.5 26.5 18 10l6.5 16.5M14.2 20.8h7.6" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="26" cy="11" r="2.6" fill="#fff" opacity="0.9" />
        </svg>
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <p className="cyber-only font-display text-[17px] font-bold tracking-[0.12em] text-ink">
            ATLAS<span className="text-accent">//</span>
          </p>
          <p className="cyber-only mt-1 font-mono text-[9.5px] tracking-[0.2em] text-ink-subtle">PERSONAL SYSTEM</p>
          <p className="not-cyber title text-[15.5px] font-semibold text-ink">ATLAS</p>
          <p className="not-cyber mt-0.5 text-[11.5px] text-ink-subtle">Personal system</p>
        </div>
      )}
    </div>
  )
}

function NavRow({ item, index, collapsed, onNavigate }: { item: NavItem; index: number; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-[13.5px] transition-colors duration-150',
          isActive ? 'bg-[var(--nav-active-bg)] font-medium text-[var(--nav-active-ink)]' : 'text-ink-muted hover:bg-ink/[0.05] hover:text-ink',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-accent shadow-[var(--glow-sm)]"
              style={{ opacity: 'var(--nav-indicator)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={cn('shrink-0', isActive ? 'text-accent' : 'text-ink-subtle group-hover:text-ink-muted')} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span aria-hidden className={cn('cyber-only font-mono text-[10px] tabular', isActive ? 'text-accent' : 'text-ink-subtle/60')}>{String(index + 1).padStart(2, '0')}</span>
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const settings = useSettings()
  const { setPalette, showQuickAdd } = useUI()
  const groups: { id: NavItem['group']; label: string }[] = [
    { id: 'core', label: 'Overview' },
    { id: 'life', label: 'Life modules' },
    { id: 'system', label: 'System' },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Logo collapsed={collapsed} />
      </div>
      <div className={cn('flex shrink-0 gap-1.5 pb-3', collapsed ? 'flex-col items-center px-2' : 'px-3')}>
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            setPalette(true)
          }}
          className={cn(
            'flex h-9 items-center gap-2 rounded-[var(--radius-btn)] border border-line bg-ink/[0.04] text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink',
            collapsed ? 'w-9 justify-center' : 'flex-1 px-2.5',
          )}
          aria-label="Search and commands"
          title="Search and commands (Ctrl K)"
        >
          <Search size={15} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            showQuickAdd()
          }}
          className="chamfer-sm flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-btn-primary)] bg-accent-fill text-on-accent shadow-[var(--glow-md)] transition hover:brightness-110"
          aria-label="Quick add"
          title="Quick add (N)"
        >
          <Plus size={17} strokeWidth={2.5} />
        </button>
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g.id} className="mt-2 first:mt-0">
            {!collapsed ? <p className="eyebrow px-2.5 pt-2 pb-1.5">{g.label}</p> : <div className="mx-3 my-2 h-px bg-line" />}
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((n) => n.group === g.id).map((item) => (
                <NavRow key={item.id} item={item} index={NAV_ITEMS.indexOf(item)} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn('shrink-0 border-t border-line p-2', collapsed && 'flex flex-col items-center gap-1')}>
        {!collapsed && (
          <NavLink to="/settings" onClick={onNavigate} className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2 hover:bg-ink/[0.05]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-btn)*0.5)] border border-accent/30 bg-accent/10 font-display text-[12px] font-semibold text-accent">
              {initials(settings.displayName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink">{settings.displayName || 'Set your name'}</span>
              <span className="block truncate text-[11px] text-ink-subtle">Private · local-first</span>
            </span>
          </NavLink>
        )}
        <SaveStatus compact={collapsed} />
      </div>
    </div>
  )
}

export function Sidebar() {
  const settings = useSettings()
  const { mobileNavOpen, setMobileNav } = useUI()
  const collapsed = settings.sidebarCollapsed
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 264 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        aria-label="Sidebar"
        className="no-print relative z-30 hidden h-dvh shrink-0 lg:sticky lg:top-0 lg:block"
        style={{ padding: 'var(--shell-gap) 0 var(--shell-gap) var(--shell-gap)' }}
      >
        {/* A floating glass pane in Liquid Glass; a full-height source list elsewhere. */}
        <div className="chrome h-full overflow-hidden" style={{ borderRadius: 'var(--sidebar-radius)', borderWidth: 'var(--sidebar-border)' }} data-testid="sidebar-pane">
          <SidebarContent collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => actions.updateSettings({ sidebarCollapsed: !collapsed })}
          className="float absolute top-[26px] -right-3 flex size-6 items-center justify-center rounded-full! text-ink-subtle transition-colors hover:text-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar ( [ )`}
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-overlay backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="float absolute inset-y-2 left-2 w-[84vw] max-w-[300px] overflow-hidden"
              aria-label="Navigation"
            >
              <button type="button" onClick={() => setMobileNav(false)} className="absolute top-4 right-3 z-10 rounded-md p-1.5 text-ink-subtle hover:text-ink" aria-label="Close navigation">
                <X size={18} />
              </button>
              <SidebarContent collapsed={false} onNavigate={() => setMobileNav(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
