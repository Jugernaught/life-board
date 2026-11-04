import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import { EntityForm } from '@/forms/EntityForm'
import { FORMS } from '@/forms/registry'
import { useToday } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { ValidationError, actions, useDatabase } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { QUICK_TYPES } from '@/components/command/QuickAdd'
import { useUI } from '@/components/command/uiStore'
import { NavButton } from '../ui/Screen'
import { Sheet } from '../ui/Sheet'

/** Capture anything from anywhere: task, event, goal, note, money, journal… */
export function QuickAddSheet() {
  const { quickAdd, hideQuickAdd, showQuickAdd } = useUI()
  const db = useDatabase()
  const today = useToday()
  const [allFields, setAllFields] = useState(false)
  const type = quickAdd.type
  const config = FORMS[type]
  const ctx = { db, settings: db.settings, today }
  const initial = useMemo(
    () => ({ ...(config.defaults?.(ctx) ?? {}), ...(quickAdd.defaults ?? {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, quickAdd.defaults, quickAdd.open],
  )
  const save = (data: Record<string, unknown>) => {
    try {
      const created = actions.create(type, data as never)
      toast({ title: `${COLLECTIONS[type].singular} added`, description: COLLECTIONS[type].title(created as never) })
      hideQuickAdd()
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof ValidationError ? e.message : String(e), tone: 'error' })
    }
  }
  return (
    <Sheet
      open={quickAdd.open}
      onClose={hideQuickAdd}
      title="New"
      testId="quick-add-sheet"
      leading={<NavButton onClick={hideQuickAdd}>Cancel</NavButton>}
      trailing={
        <button type="submit" form="m-quick-add" className="ios-headline flex h-11 items-center px-3 text-accent active:opacity-50" data-testid="quick-add-save">
          Add
        </button>
      }
    >
      <div className="overflow-x-auto px-4 pt-2 pb-3" role="radiogroup" aria-label="What to add">
        <div className="flex w-max gap-2">
          {QUICK_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={t.type === type}
              onClick={() => showQuickAdd(t.type)}
              className={cn('ios-subhead flex h-9 items-center gap-1.5 rounded-full px-3.5 font-medium', t.type === type ? 'bg-accent text-on-accent' : 'bg-[var(--ios-fill)] text-ink')}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4">
        <EntityForm key={`${type}-${allFields}-${quickAdd.open}`} config={config as never} initial={initial} ctx={ctx} formId="m-quick-add" onSubmit={save} only={allFields || !config.quickFields ? undefined : config.quickFields} />
        {config.quickFields && (
          <button type="button" onClick={() => setAllFields((v) => !v)} className="ios-subhead mt-4 flex items-center gap-1 text-accent">
            <ChevronDown size={16} className={cn('transition-transform', allFields && 'rotate-180')} />
            {allFields ? 'Fewer details' : 'More details'}
          </button>
        )}
      </div>
    </Sheet>
  )
}
