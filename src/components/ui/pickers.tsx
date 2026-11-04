/** Specialised inputs: ratings, scales, tags, weekday pickers, colour swatches and list editors. */
import { type KeyboardEvent, useState } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { CalendarDays, GripVertical, Plus, Star, Trash2, X } from 'lucide-react'
import { ACCENT_COLORS, WEEKDAYS } from '@/data/constants'
import type { CheckItem } from '@/data/types'
import { toneColor } from '@/lib/tone'
import { cn, uid } from '@/lib/utils'
import { IconButton } from './Button'
import { Checkbox, Input, controlBase } from './inputs'

export function RatingInput({ value, onChange, max = 5, size = 20, label = 'Rating' }: { value?: number; onChange: (v: number | undefined) => void; max?: number; size?: number; label?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of ${max}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? undefined : n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star size={size} className={cn(n <= shown ? 'fill-amber text-amber drop-shadow-[0_0_5px_var(--color-amber)]' : 'text-ink-subtle/60')} />
        </button>
      ))}
      {value !== undefined && (
        <button type="button" onClick={() => onChange(undefined)} className="ml-1 text-[12px] text-ink-subtle hover:text-ink">
          Clear
        </button>
      )}
    </div>
  )
}

export function RatingDisplay({ value, size = 13 }: { value?: number; size?: number }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} className={i < value ? 'fill-amber text-amber' : 'text-ink-subtle/40'} />
      ))}
    </span>
  )
}

/** 1–5 scale with labels (mood, energy, confidence). */
export function ScaleInput({
  value,
  onChange,
  options,
  label,
  allowClear = true,
}: {
  value?: number
  onChange: (v: number | undefined) => void
  options: readonly { value: number; label: string; emoji?: string }[]
  label: string
  allowClear?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active && allowClear ? undefined : o.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-all',
              active ? 'border-accent/60 bg-accent/12 text-ink shadow-[0_0_16px_-6px_var(--color-accent)]' : 'border-line bg-panel-2/50 text-ink-subtle hover:border-line-strong hover:text-ink-muted',
            )}
          >
            <span className={cn('font-display text-[15px]', active ? 'text-accent' : '')}>{o.emoji ?? o.value}</span>
            <span className="leading-tight">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function WeekdayPicker({ value, onChange, weekStartsOn = 1 }: { value: number[]; onChange: (v: number[]) => void; weekStartsOn?: 0 | 1 }) {
  const days = weekStartsOn === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)]
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
      {days.map((d) => {
        const on = value.includes(d.value)
        return (
          <button
            key={d.value}
            type="button"
            aria-pressed={on}
            title={d.label}
            onClick={() => onChange(on ? value.filter((v) => v !== d.value) : [...value, d.value].sort())}
            className={cn(
              'h-9 w-11 rounded-lg border text-[12.5px] font-medium transition-all',
              on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line bg-panel-2/50 text-ink-subtle hover:text-ink-muted',
            )}
          >
            {d.short}
          </button>
        )
      })}
    </div>
  )
}

export function ColorSwatches({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {ACCENT_COLORS.list.map((c) => {
        const active = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn('size-8 rounded-full border-2 transition-transform hover:scale-105', active ? 'border-ink' : 'border-transparent')}
            style={{ background: toneColor(c.tone), boxShadow: active ? `0 0 14px ${toneColor(c.tone)}` : undefined }}
          />
        )
      })}
    </div>
  )
}

export function TagInput({ value, onChange, placeholder = 'Add tag and press Enter', suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [text, setText] = useState('')
  const listId = `tags-${placeholder.length}-${suggestions.length}`
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '')
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase())) return setText('')
    onChange([...value, t.slice(0, 40)])
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(text)
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className={cn(controlBase, 'flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5')}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-accent/10 py-0.5 pr-1 pl-2 text-[12px] text-accent">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="rounded p-0.5 hover:bg-accent/20">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={text}
        list={suggestions.length ? listId : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(text)}
        placeholder={value.length ? '' : placeholder}
        aria-label="Add tag"
        className="min-w-24 flex-1 bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-ink-subtle"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}

/** Editable list of plain strings (e.g. key takeaways). */
export function ListEditor({ value, onChange, placeholder = 'Add an item', addLabel = 'Add' }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    onChange([...value, t])
    setText('')
  }
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {value.map((item, i) => (
          <motion.div key={`${i}-${item}`} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
            <Input value={item} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} aria-label={`Item ${i + 1}`} />
            <IconButton icon={Trash2} label="Remove item" variant="danger" onClick={() => onChange(value.filter((_, j) => j !== i))} className="mt-1" />
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <IconButton icon={Plus} label={addLabel} variant="secondary" size="md" onClick={add} />
      </div>
    </div>
  )
}

/**
 * Checklist editor for milestones / roadmap steps / objectives: add, rename,
 * tick, set an optional due date, reorder by dragging, and remove.
 */
export function ChecklistEditor({ value, onChange, placeholder = 'Add a step', withDates = true }: { value: CheckItem[]; onChange: (v: CheckItem[]) => void; placeholder?: string; withDates?: boolean }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (!t) return
    onChange([...value, { id: uid(), title: t, done: false }])
    setText('')
  }
  const patch = (id: string, p: Partial<CheckItem>) => onChange(value.map((v) => (v.id === id ? { ...v, ...p } : v)))
  return (
    <div className="space-y-2">
      <Reorder.Group axis="y" values={value} onReorder={onChange} className="space-y-1.5">
        {value.map((item) => (
          <ChecklistRow key={item.id} item={item} withDates={withDates} onPatch={(p) => patch(item.id, p)} onRemove={() => onChange(value.filter((v) => v.id !== item.id))} />
        ))}
      </Reorder.Group>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <IconButton icon={Plus} label="Add" variant="secondary" size="md" onClick={add} />
      </div>
    </div>
  )
}

function ChecklistRow({ item, onPatch, onRemove, withDates }: { item: CheckItem; onPatch: (p: Partial<CheckItem>) => void; onRemove: () => void; withDates: boolean }) {
  const controls = useDragControls()
  const [showDate, setShowDate] = useState(!!item.dueDate)
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2/40 py-1 pr-1 pl-1.5 sm:flex-nowrap">
      <button type="button" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none rounded p-1 text-ink-subtle hover:text-ink active:cursor-grabbing">
        <GripVertical size={14} />
      </button>
      <Checkbox
        checked={item.done}
        size="sm"
        onChange={(done) => onPatch({ done, doneAt: done ? new Date().toISOString() : undefined })}
        label={<span className="sr-only">Mark {item.title} done</span>}
      />
      <input
        value={item.title}
        onChange={(e) => onPatch({ title: e.target.value })}
        aria-label="Step title"
        className={cn('min-w-0 flex-1 bg-transparent py-1.5 text-[14px] outline-none', item.done && 'text-ink-subtle line-through')}
      />
      {withDates &&
        (showDate ? (
          <input
            type="date"
            value={item.dueDate ?? ''}
            onChange={(e) => onPatch({ dueDate: e.target.value || undefined })}
            aria-label="Due date"
            className="h-8 rounded-md border border-line bg-panel-2 px-2 text-[12.5px] text-ink-muted outline-none focus:border-accent/50"
          />
        ) : (
          <IconButton icon={CalendarDays} label="Add due date" size="xs" onClick={() => setShowDate(true)} />
        ))}
      <IconButton icon={Trash2} label="Remove step" size="xs" variant="danger" onClick={onRemove} />
    </Reorder.Item>
  )
}

/** 0–5 proficiency picker shown as segmented bars. */
export function LevelPicker({ value, onChange, min = 0, labels }: { value: number; onChange: (v: number) => void; min?: number; labels: readonly { value: number; label: string }[] }) {
  return (
    <div>
      <div className="flex gap-1" role="radiogroup" aria-label="Level">
        {labels
          .filter((l) => l.value >= min)
          .map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={value === l.value}
              aria-label={`${l.value} — ${l.label}`}
              title={l.label}
              onClick={() => onChange(l.value)}
              className={cn(
                'h-8 flex-1 rounded-md border font-mono text-[12px] transition-all',
                l.value <= value && l.value > 0 ? 'border-accent/50 bg-accent/20 text-accent' : 'border-line bg-panel-2/50 text-ink-subtle hover:text-ink-muted',
                value === l.value && 'ring-1 ring-accent/60',
              )}
            >
              {l.value}
            </button>
          ))}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-subtle">{labels.find((l) => l.value === value)?.label}</p>
    </div>
  )
}
