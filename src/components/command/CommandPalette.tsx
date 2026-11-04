import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  CheckSquare,
  CornerDownLeft,
  Download,
  Dumbbell,
  FileText,
  FolderPlus,
  GraduationCap,
  Keyboard,
  Moon,
  PanelLeft,
  PencilLine,
  PoundSterling,
  Repeat,
  Search,
  Smile,
  Target,
} from 'lucide-react'
import { NAV_ITEMS } from '@/app/navigation'
import { COLLECTIONS } from '@/data/registry'
import type { CollectionKey } from '@/data/types'
import { searchDatabase } from '@/selectors/search'
import { exportDatabase } from '@/store/backups'
import { actions, useDatabase } from '@/store/store'
import { cn, normalise } from '@/lib/utils'
import { Kbd } from '@/components/ui/display'
import { editor } from '@/components/editor/editorStore'
import { type QuickAddType, useUI } from './uiStore'

type IconType = ComponentType<{ size?: number; className?: string }>

interface Command {
  id: string
  label: string
  group: string
  icon: IconType
  hint?: string
  keywords?: string
  run: () => void
}

const SEARCH_ICONS: Partial<Record<CollectionKey, IconType>> = {
  tasks: CheckSquare,
  events: CalendarPlus,
  notes: FileText,
  projects: FolderPlus,
  goals: Target,
  habits: Repeat,
  journal: PencilLine,
  media: BookOpen,
  workouts: Dumbbell,
  transactions: PoundSterling,
  skills: GraduationCap,
}

export function CommandPalette() {
  const { paletteOpen, setPalette } = useUI()
  return createPortal(<AnimatePresence>{paletteOpen && <Palette onClose={() => setPalette(false)} />}</AnimatePresence>, document.body)
}

function Palette({ onClose }: { onClose: () => void }) {
  const db = useDatabase()
  const navigate = useNavigate()
  const { showQuickAdd, setHelp } = useUI()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const commands: Command[] = useMemo(() => {
    const create = (type: QuickAddType, label: string, icon: IconType, keywords = ''): Command => ({
      id: `new-${type}`,
      label,
      group: 'Create',
      icon,
      keywords: `new add create ${keywords}`,
      run: () => showQuickAdd(type),
    })
    return [
      create('tasks', 'New task', CheckSquare, 'todo'),
      create('events', 'New event', CalendarPlus, 'calendar meeting time block'),
      create('goals', 'New goal', Target, 'objective'),
      create('notes', 'New note', FileText, 'memo idea'),
      create('transactions', 'Log a transaction', PoundSterling, 'expense income money spend'),
      create('journal', 'New journal entry', PencilLine, 'write diary reflect'),
      create('checkIns', 'Mood & energy check-in', Smile, 'feel mood energy'),
      create('workouts', 'Log a workout', Dumbbell, 'exercise gym run'),
      create('studySessions', 'Log study time', GraduationCap, 'learn session'),
      create('media', 'Add to library', BookOpen, 'book film podcast article'),
      create('habits', 'New habit', Repeat, 'routine streak'),
      { id: 'new-project', label: 'New project', group: 'Create', icon: FolderPlus, keywords: 'business venture', run: () => editor.create('projects') },
      ...NAV_ITEMS.map((n) => ({ id: `go-${n.id}`, label: n.label, group: 'Go to', icon: n.icon, hint: `G ${n.key.toUpperCase()}`, keywords: n.description, run: () => navigate(n.path) })),
      { id: 'theme', label: 'Toggle light / dark theme', group: 'Actions', icon: Moon, keywords: 'appearance mode', run: () => actions.updateSettings({ theme: db.settings.theme === 'light' ? 'dark' : 'light' }) },
      { id: 'sidebar', label: 'Toggle sidebar', group: 'Actions', icon: PanelLeft, hint: '[', run: () => actions.updateSettings({ sidebarCollapsed: !db.settings.sidebarCollapsed }) },
      { id: 'export', label: 'Export backup (JSON)', group: 'Actions', icon: Download, keywords: 'download save data', run: () => exportDatabase() },
      { id: 'help', label: 'Keyboard shortcuts', group: 'Actions', icon: Keyboard, hint: '?', run: () => setHelp(true) },
    ]
  }, [db.settings.theme, db.settings.sidebarCollapsed, navigate, setHelp, showQuickAdd])

  const items = useMemo(() => {
    const q = normalise(query)
    const matchedCommands = q ? commands.filter((c) => normalise(`${c.label} ${c.keywords ?? ''} ${c.group}`).includes(q)) : commands
    const results = q
      ? searchDatabase(db, query, 30).map<Command>((r) => ({
          id: `rec-${r.key}-${r.id}`,
          label: r.title,
          group: 'Records',
          icon: SEARCH_ICONS[r.key] ?? FileText,
          hint: COLLECTIONS[r.key].singular,
          keywords: r.snippet,
          run: () => navigate(r.href),
        }))
      : []
    // Records first when searching, commands first when idle.
    return q ? [...results, ...matchedCommands] : matchedCommands
  }, [query, commands, db, navigate])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const runItem = (c: Command | undefined) => {
    if (!c) return
    onClose()
    // Let the palette close before opening a dialog or navigating.
    setTimeout(c.run, 0)
  }

  const groups = items.reduce<Record<string, { item: Command; index: number }[]>>((acc, item, index) => {
    ;(acc[item.group] ||= []).push({ item, index })
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[14vh]">
      <motion.div className="absolute inset-0 bg-overlay backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        className="panel hud glow-ring relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden bg-panel/95"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(items.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            runItem(items[active])
          } else if (e.key === 'Tab') {
            e.preventDefault()
            input.current?.focus()
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="shrink-0 text-accent" />
          <input
            ref={input}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, goals, journal, notes… or type a command"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            aria-label="Search"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-subtle">
              Nothing matches “{query}”.{' '}
              <button type="button" className="text-accent hover:underline" onClick={() => runItem({ id: 'x', label: '', group: '', icon: CheckSquare, run: () => showQuickAdd('tasks', { title: query }) })}>
                Create a task called “{query}”
              </button>
            </div>
          )}
          {Object.entries(groups).map(([group, rows]) => (
            <div key={group} className="mb-1">
              <p className="eyebrow px-3 pt-2 pb-1.5">{group}</p>
              {rows.map(({ item, index }) => {
                const Icon = item.icon
                const isActive = index === active
                return (
                  <button
                    key={item.id}
                    id={`palette-${item.id}`}
                    data-index={index}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(index)}
                    onClick={() => runItem(item)}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', isActive ? 'bg-accent/10 text-ink' : 'text-ink-muted')}
                  >
                    <Icon size={16} className={cn('shrink-0', isActive ? 'text-accent' : 'text-ink-subtle')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{item.label}</span>
                      {item.group === 'Records' && item.keywords && <span className="block truncate text-[12px] text-ink-subtle">{item.keywords}</span>}
                    </span>
                    {item.hint && <span className="shrink-0 font-mono text-[10.5px] text-ink-subtle uppercase">{item.hint}</span>}
                    {isActive && <ArrowRight size={14} className="shrink-0 text-accent" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-ink-subtle sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>
              <CornerDownLeft size={10} />
            </Kbd>
            open
          </span>
          <span className="ml-auto">{items.filter((i) => i.group === 'Records').length ? `${items.filter((i) => i.group === 'Records').length} records found` : 'Searches everything stored on this device'}</span>
        </div>
      </motion.div>
    </div>
  )
}
