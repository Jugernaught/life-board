import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export const controlBase =
  'w-full rounded-lg border border-line bg-panel-2/60 text-[14px] text-ink placeholder:text-ink-subtle transition-[border-color,box-shadow,background] duration-150 hover:border-line-strong focus:border-accent/60 focus:bg-panel-2 focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50 aria-[invalid=true]:border-bad/60 aria-[invalid=true]:ring-bad/10'

export function Label({ htmlFor, children, required, className }: { htmlFor?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-[12px] font-medium tracking-wide text-ink-muted', className)}>
      {children}
      {required && (
        <span className="ml-0.5 text-accent" aria-hidden>
          *
        </span>
      )}
    </label>
  )
}

export interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="mt-1.5 text-[12px] text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode; trailing?: ReactNode }>(
  function Input({ className, invalid, leading, trailing, ...rest }, ref) {
    if (leading || trailing) {
      return (
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle">{leading}</span>}
          <input
            ref={ref}
            aria-invalid={invalid || undefined}
            className={cn(controlBase, 'h-10 px-3', leading && 'pl-9', trailing && 'pr-10', className)}
            {...rest}
          />
          {trailing && <span className="absolute inset-y-0 right-2 flex items-center text-ink-subtle">{trailing}</span>}
        </div>
      )
    }
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, 'h-10 px-3', className)} {...rest} />
  },
)

/** Textarea that grows with its content. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; autoGrow?: boolean }>(
  function Textarea({ className, invalid, autoGrow = true, rows = 3, ...rest }, forwardedRef) {
    const inner = useRef<HTMLTextAreaElement | null>(null)
    useLayoutEffect(() => {
      const el = inner.current
      if (!el || !autoGrow) return
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight + 2, 640)}px`
    }, [rest.value, autoGrow])
    return (
      <textarea
        ref={(el) => {
          inner.current = el
          if (typeof forwardedRef === 'function') forwardedRef(el)
          else if (forwardedRef) forwardedRef.current = el
        }}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, 'block resize-y px-3 py-2.5 leading-relaxed', className)}
        {...rest}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { invalid?: boolean; size?: 'sm' | 'md' }>(function Select(
  { className, invalid, children, size = 'md', ...rest },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, 'cursor-pointer appearance-none pr-9 pl-3', size === 'sm' ? 'h-8 text-[13px]' : 'h-10')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-subtle" />
    </div>
  )
})

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  size = 'md',
  tone,
  id,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  className?: string
  size?: 'sm' | 'md'
  tone?: string
  id?: string
  disabled?: boolean
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const box = size === 'sm' ? 'size-4' : 'size-[18px]'
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-center gap-2.5 select-none', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input id={inputId} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cn(
          box,
          'relative inline-flex shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60',
          checked ? 'border-transparent' : 'border-line-strong bg-panel-2 hover:border-accent/60',
        )}
        style={checked ? { background: tone ?? 'var(--color-accent)', boxShadow: `0 0 12px -2px ${tone ?? 'var(--color-accent)'}` } : undefined}
        aria-hidden
      >
        {checked && (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}>
            <Check size={size === 'sm' ? 11 : 13} strokeWidth={3.5} className="text-on-accent" />
          </motion.span>
        )}
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  )
}

export function Switch({ checked, onChange, label, description, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; id?: string; disabled?: boolean }) {
  const autoId = useId()
  const switchId = id ?? autoId
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <label htmlFor={switchId} className="min-w-0 cursor-pointer">
          {label && <span className="block text-sm text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[12.5px] text-ink-subtle">{description}</span>}
        </label>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-accent/60 bg-accent/25' : 'border-line-strong bg-panel-3',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 35 }}
          className={cn('mx-0.5 block size-[18px] rounded-full', checked ? 'ml-auto bg-accent shadow-[0_0_10px_var(--color-accent)]' : 'bg-ink-subtle')}
        />
      </button>
    </div>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
  fullWidth,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly SegmentOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
  fullWidth?: boolean
}) {
  const groupId = useId()
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-lg border border-line bg-panel-2/60 p-0.5', fullWidth && 'flex w-full', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.title}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative z-0 inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              fullWidth && 'flex-1',
              active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 -z-10 rounded-md border border-accent/30 bg-panel-3 shadow-[0_0_14px_-6px_var(--color-accent)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  ariaLabel?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        placeholder={placeholder}
        className={cn(controlBase, 'h-9 pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:text-ink">
          <X size={13} />
        </button>
      )}
    </div>
  )
}

/**
 * Numeric input that keeps what you type as text (so "12." or "-" mid-typing
 * isn't wiped) and reports a number, `undefined` when empty, or NaN when the
 * text can't be read as a number — the form shows that as an error.
 */
export function NumberInput({
  value,
  onChange,
  parse = (t) => Number(t),
  format = (v) => String(v),
  invalid,
  className,
  ...rest
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  parse?: (text: string) => number | null
  format?: (v: number) => string
  invalid?: boolean
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { leading?: ReactNode; trailing?: ReactNode }) {
  const [text, setText] = useState(() => (value === undefined || Number.isNaN(value) ? '' : format(value)))
  const lastEmitted = useRef<number | undefined>(value)
  useEffect(() => {
    // Sync when the value changes from outside (e.g. form reset).
    if (value !== lastEmitted.current && !(Number.isNaN(value) && Number.isNaN(lastEmitted.current))) {
      lastEmitted.current = value
      setText(value === undefined || Number.isNaN(value) ? '' : format(value))
    }
  }, [value, format])
  return (
    <Input
      inputMode="decimal"
      value={text}
      invalid={invalid}
      className={className}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        let next: number | undefined
        if (t.trim() === '') next = undefined
        else {
          const parsed = parse(t.trim())
          next = parsed === null || !Number.isFinite(parsed) ? Number.NaN : parsed
        }
        lastEmitted.current = next
        onChange(next)
      }}
      {...rest}
    />
  )
}
