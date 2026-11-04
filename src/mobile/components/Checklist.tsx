import { Trash2 } from 'lucide-react'
import type { CheckItem } from '@/data/types'
import { relativeDay } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'
import { CheckCircle } from '../ui/controls'
import { SwipeRow } from '../ui/SwipeRow'
import { InlineAdd } from './InlineAdd'

/** Milestones / roadmap steps / objectives as checkable rows with inline add. Use inside a Section. */
export function checklistRows(items: CheckItem[], onChange: (items: CheckItem[]) => void, today: string, color?: string) {
  return items.map((item) => (
    <SwipeRow key={item.id} actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => onChange(items.filter((i) => i.id !== item.id)) }]}>
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
