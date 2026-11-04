import { NAV_ITEMS } from '@/app/navigation'
import { Kbd } from '@/components/ui/display'
import { Modal } from '@/components/ui/Modal'
import { useUI } from './uiStore'

const GENERAL = [
  { keys: ['Ctrl', 'K'], label: 'Search & command menu (⌘K on Mac)' },
  { keys: ['/'], label: 'Search' },
  { keys: ['N'], label: 'Quick add' },
  { keys: ['Ctrl', 'Z'], label: 'Undo last change (⌘Z on Mac)' },
  { keys: ['Ctrl', 'Enter'], label: 'In search: complete the highlighted task' },
  { keys: ['['], label: 'Collapse / expand sidebar' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close dialog' },
]

export function ShortcutsHelp() {
  const { helpOpen, setHelp } = useUI()
  return (
    <Modal open={helpOpen} onClose={() => setHelp(false)} title="Keyboard shortcuts" description="Shortcuts work anywhere except while typing in a field." size="md">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">General</p>
          <ul className="space-y-2">
            {GENERAL.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 text-[13px] text-ink-muted">
                <span>{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-2">Go to (press G, then…)</p>
          <ul className="space-y-2">
            {NAV_ITEMS.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 text-[13px] text-ink-muted">
                <span>{n.label}</span>
                <span className="flex gap-1">
                  <Kbd>G</Kbd>
                  <Kbd>{n.key.toUpperCase()}</Kbd>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}
