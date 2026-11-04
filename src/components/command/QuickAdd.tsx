import { useMemo, useState } from 'react'
import { BookOpen, CalendarPlus, CheckSquare, ChevronDown, Dumbbell, FileText, GraduationCap, PencilLine, PoundSterling, Repeat, Smile, Target } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import { EntityForm } from '@/forms/EntityForm'
import { FORMS } from '@/forms/registry'
import { useToday } from '@/hooks/useNow'
import { ValidationError, actions, useDatabase } from '@/store/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import { type QuickAddType, useUI } from './uiStore'

export const QUICK_TYPES: { type: QuickAddType; label: string; icon: typeof CheckSquare }[] = [
  { type: 'tasks', label: 'Task', icon: CheckSquare },
  { type: 'events', label: 'Event', icon: CalendarPlus },
  { type: 'goals', label: 'Goal', icon: Target },
  { type: 'notes', label: 'Note', icon: FileText },
  { type: 'transactions', label: 'Money', icon: PoundSterling },
  { type: 'journal', label: 'Journal', icon: PencilLine },
  { type: 'checkIns', label: 'Check-in', icon: Smile },
  { type: 'workouts', label: 'Workout', icon: Dumbbell },
  { type: 'studySessions', label: 'Study', icon: GraduationCap },
  { type: 'media', label: 'Library', icon: BookOpen },
  { type: 'habits', label: 'Habit', icon: Repeat },
]

/** Create common records from anywhere without leaving the current screen. */
export function QuickAdd() {
  const { quickAdd, hideQuickAdd, showQuickAdd } = useUI()
  const db = useDatabase()
  const today = useToday()
  const [allFields, setAllFields] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const type = quickAdd.type
  const config = FORMS[type]
  const ctx = { db, settings: db.settings, today }
  const formId = `quick-add-${type}`
  const initial = useMemo(
    () => ({ ...(config.defaults?.(ctx) ?? {}), ...(quickAdd.defaults ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, quickAdd.defaults, resetKey, quickAdd.open],
  )
  const [keepOpen, setKeepOpen] = useState(false)

  const save = (data: Record<string, unknown>) => {
    try {
      const created = actions.create(type, data as never)
      toast({ title: `${COLLECTIONS[type].singular} added`, description: COLLECTIONS[type].title(created as never) })
      if (keepOpen) setResetKey((k) => k + 1)
      else hideQuickAdd()
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof ValidationError ? e.message : String(e), tone: 'error' })
    }
  }

  const only = allFields || !config.quickFields ? undefined : config.quickFields

  return (
    <Modal
      open={quickAdd.open}
      onClose={hideQuickAdd}
      title="Quick add"
      description="Capture it now — refine it later."
      size={allFields && config.size === 'lg' ? 'lg' : 'md'}
      footer={
        <>
          {config.quickFields && (
            <button type="button" onClick={() => setAllFields((v) => !v)} className="mr-auto flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
              <ChevronDown size={14} className={cn('transition-transform', allFields && 'rotate-180')} />
              {allFields ? 'Fewer fields' : 'All fields'}
            </button>
          )}
          <label className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
            <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="accent-[var(--color-accent)]" />
            Add another
          </label>
          <Button variant="ghost" onClick={hideQuickAdd}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            Add {COLLECTIONS[type].singular.toLowerCase()}
          </Button>
        </>
      }
    >
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="What to add">
        {QUICK_TYPES.map((t) => {
          const Icon = t.icon
          const active = t.type === type
          return (
            <button
              key={t.type}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => showQuickAdd(t.type)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-all',
                active ? 'border-accent/50 bg-accent/12 text-accent shadow-[0_0_14px_-6px_var(--color-accent)]' : 'border-line bg-panel-2/40 text-ink-muted hover:text-ink',
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>
      <EntityForm key={`${type}-${resetKey}-${allFields}`} config={config as never} initial={initial} ctx={ctx} formId={formId} onSubmit={save} only={only} />
    </Modal>
  )
}
