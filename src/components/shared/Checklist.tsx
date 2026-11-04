import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Trash2 } from 'lucide-react'
import type { CheckItem } from '@/data/types'
import { relativeDay } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'
import { IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/inputs'
import { ProgressBar } from '@/components/ui/display'

/** Interactive checklist (milestones, roadmap steps, objectives) with inline add. */
export function Checklist({
  items,
  onChange,
  placeholder = 'Add a step…',
  today,
  showProgress,
  emptyText = 'Nothing here yet.',
  tone,
}: {
  items: CheckItem[]
  onChange: (items: CheckItem[]) => void
  placeholder?: string
  today: string
  showProgress?: boolean
  emptyText?: string
  tone?: string
}) {
  const done = items.filter((i) => i.done).length
  return (
    <div>
      {showProgress && items.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <ProgressBar value={(done / items.length) * 100} size="sm" className="flex-1" label="Checklist progress" />
          <span className="font-mono text-[11.5px] text-ink-muted tabular">
            {done}/{items.length}
          </span>
        </div>
      )}
      {items.length === 0 && <p className="mb-1 text-[12.5px] text-ink-subtle">{emptyText}</p>}
      <ul className="-mx-1.5 space-y-0.5">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const overdue = !item.done && item.dueDate && item.dueDate < today
            return (
              <motion.li key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-panel-3/40">
                <Checkbox
                  checked={item.done}
                  tone={tone}
                  onChange={(v) => onChange(items.map((i) => (i.id === item.id ? { ...i, done: v, doneAt: v ? new Date().toISOString() : undefined } : i)))}
                  label={<span className="sr-only">Mark {item.title} {item.done ? 'not done' : 'done'}</span>}
                />
                <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', item.done ? 'text-ink-subtle line-through' : 'text-ink')}>{item.title}</span>
                {item.dueDate && (
                  <span className={cn('inline-flex shrink-0 items-center gap-1 font-mono text-[11px]', overdue ? 'text-bad' : 'text-ink-subtle')}>
                    <CalendarDays size={11} />
                    {relativeDay(item.dueDate, today)}
                  </span>
                )}
                <IconButton
                  icon={Trash2}
                  label={`Remove ${item.title}`}
                  size="xs"
                  variant="danger"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                />
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem('title') as HTMLInputElement
          const title = input.value.trim()
          if (!title) return
          onChange([...items, { id: uid(), title, done: false }])
          input.value = ''
        }}
      >
        <input
          name="title"
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className="h-8 w-full rounded-md border border-dashed border-line-strong bg-transparent px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-subtle focus:border-accent/60"
        />
      </form>
    </div>
  )
}
