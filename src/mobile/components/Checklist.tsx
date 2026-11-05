import { Trash2 } from 'lucide-react'
import type { CheckItem } from '@/data/types'
import { relativeDay } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'
import { appStore } from '@/store/store'
import { undoWithNotice } from '@/app/useChangeToasts'
import { toast } from '@/components/ui/toast'
import { CheckCircle } from '../ui/controls'
import { SwipeRow } from '../ui/SwipeRow'
import { InlineAdd } from './InlineAdd'

/**
 * Remove a step, with Undo like every other delete. The steps live in their
 * record, so Undo is that record's own undo step: it won't overwrite anything
 * changed since (it says so instead).
 */
function removeStep(items: CheckItem[], item: CheckItem, onChange: (items: CheckItem[]) => void) {
  const before = appStore.getState().history.at(-1)?.id
  onChange(items.filter((i) => i.id !== item.id))
  const change = appStore.getState().history.at(-1)?.id
  toast({ title: 'Step removed', description: item.title, tone: 'success', action: change && change !== before ? { label: 'Undo', onClick: () => undoWithNotice(change) } : undefined })
}

/** Milestones / roadmap steps / objectives as checkable rows with inline add. Use inside a Section. */
export function checklistRows(items: CheckItem[], onChange: (items: CheckItem[]) => void, today: string, color?: string) {
  return items.map((item) => (
    <SwipeRow key={item.id} actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => removeStep(items, item, onChange) }]}>
      <div className="flex items-center gap-3 px-4">
        <CheckCircle
          checked={item.done}
          color={color}
          size={22}
          label={`${item.done ? 'Mark not done' : 'Complete'}: ${item.title}`}
          onToggle={() => onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done, doneAt: !i.done ? new Date().toISOString() : undefined } : i)))}
        />
        <span className={cn('ios-body min-w-0 flex-1 py-[11px]', item.done ? 'text-ink-subtle line-through' : 'text-ink')}>{item.title}</span>
        {item.dueDate && <span className={cn('ios-footnote shrink-0', !item.done && item.dueDate < today ? 'text-bad' : 'text-ink-subtle')}>{relativeDay(item.dueDate, today)}</span>}
      </div>
    </SwipeRow>
  ))
}

export function checklistAdd(items: CheckItem[], onChange: (items: CheckItem[]) => void, placeholder: string) {
  return <InlineAdd key="__add" placeholder={placeholder} onAdd={(title) => onChange([...items, { id: uid(), title, done: false }])} />
}
