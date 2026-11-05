import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** iOS segmented control. */
export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: ReactNode }[]; className?: string; ariaLabel: string }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex h-8 rounded-[9px] bg-[var(--ios-fill)] p-[2px]', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('relative z-0 flex-1 truncate rounded-[7px] px-2 text-[13px] leading-none font-medium transition-colors', active ? 'font-semibold text-ink' : 'text-ink')}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-[7px] bg-[var(--ios-seg-selected)] shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** iOS switch (51×31). */
export function IosSwitch({ checked, onChange, label, disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40"
      style={{ background: checked ? 'var(--ios-switch-on)' : 'var(--ios-fill-2)' }}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)]"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 36 }}
      />
    </button>
  )
}

/** iOS search field with a Cancel button while focused. */
export function SearchField({ value, onChange, placeholder = 'Search', testId }: { value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-[10px] bg-[var(--ios-fill)] px-2">
        <Search size={17} className="shrink-0 text-ink-subtle" aria-hidden />
        <input
          ref={input}
          type="search"
          enterKeyHint="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="!min-h-0 h-9 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="flex size-7 items-center justify-center rounded-full text-ink-subtle">
            <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--color-ink-subtle)] text-[var(--ios-cell)]">
              <X size={12} strokeWidth={3} />
            </span>
          </button>
        )}
      </label>
      {(focused || value) && (
        <button
          type="button"
          className="ios-body shrink-0 text-accent active:opacity-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            input.current?.blur()
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

/** Horizontally scrolling filter chips. */
export function Chips<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: ReactNode; count?: number }[]; ariaLabel: string }) {
  const row = useRef<HTMLDivElement>(null)
  // Keep the selected chip visible (e.g. a preset far along the row).
  useEffect(() => {
    const el = row.current
    const active = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !active) return
    const left = active.offsetLeft - 16
    const right = active.offsetLeft + active.offsetWidth + 16 - el.clientWidth
    if (el.scrollLeft > left) el.scrollLeft = left
    else if (el.scrollLeft < right) el.scrollLeft = right
  }, [value])
  return (
    <div ref={row} className="relative -mx-4 overflow-x-auto px-4" role="radiogroup" aria-label={ariaLabel}>
      <div className="flex w-max gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn('ios-subhead flex h-9 items-center gap-1.5 rounded-full px-3.5 font-medium transition-colors', active ? 'bg-accent-fill text-on-accent' : 'bg-[var(--ios-cell)] text-ink')}
            >
              {o.label}
              {typeof o.count === 'number' && o.count > 0 && <span className={cn('text-[12px] tabular-nums', active ? 'opacity-80' : 'text-ink-subtle')}>{o.count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Round check button used for tasks, habits and checklist rows (44pt hit area). */
export function CheckCircle({ checked, onToggle, label, color, size = 24, testId }: { checked: boolean; onToggle: () => void; label: string; color?: string; size?: number; testId?: string }) {
  const c = color ?? 'var(--color-accent)'
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} data-testid={testId} className="-m-2.5 flex size-11 shrink-0 items-center justify-center">
      <motion.span
        className="flex items-center justify-center rounded-full border-2"
        style={{ width: size, height: size, borderColor: checked ? c : 'var(--color-ink-subtle)', background: checked ? c : 'transparent' }}
        animate={{ scale: checked ? [1, 0.85, 1] : 1 }}
        transition={{ duration: 0.25 }}
      >
        {checked && (
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="var(--ios-cell)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </motion.span>
    </button>
  )
}

/** 1–5 stars with 44pt touch targets. Tapping the current value clears it. */
export function StarRating({ value, onChange, label, max = 5, testId }: { value?: number; onChange: (v: number | undefined) => void; label: string; max?: number; testId?: string }) {
  return (
    <div className="-mx-2 flex items-center" role="radiogroup" aria-label={label} data-testid={testId}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of ${max}`} onClick={() => onChange(value === n ? undefined : n)} className="flex size-11 items-center justify-center active:scale-90">
          <Star size={24} className={cn(n <= (value ?? 0) ? 'fill-[var(--color-amber)] text-[var(--color-amber)]' : 'text-ink-subtle')} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  )
}
