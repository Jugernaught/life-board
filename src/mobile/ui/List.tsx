import { type ComponentType, type ReactNode, Children, isValidElement } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Tone } from '@/data/constants'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'

type IconType = ComponentType<{ size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }>

/** iOS "inset grouped" section: a rounded group of rows with an optional header and footer. */
export function Section({ header, footer, children, className, headerAction, plain }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; headerAction?: ReactNode; plain?: boolean }) {
  const items = Children.toArray(children).filter(Boolean)
  return (
    <section className={cn('mx-4 mb-7', className)}>
      {(header || headerAction) && (
        <div className="mb-1.5 flex items-end justify-between gap-2 px-4">
          {header && <h2 className="ios-footnote font-normal tracking-[0.01em] text-ink-subtle uppercase">{header}</h2>}
          {headerAction}
        </div>
      )}
      {plain ? (
        children
      ) : (
        <div className="overflow-hidden rounded-[12px] bg-[var(--ios-cell)]" role="list">
          {items.map((child, i) => (
            <div key={isValidElement(child) && child.key != null ? child.key : i} role="listitem" className="relative">
              {i > 0 && <div className="pointer-events-none absolute top-0 right-0 left-[var(--sep-inset,16px)] z-[2] h-px origin-top scale-y-50 bg-[var(--color-line-strong)]" aria-hidden />}
              {child}
            </div>
          ))}
        </div>
      )}
      {footer && <p className="ios-footnote mt-1.5 px-4 text-ink-subtle">{footer}</p>}
    </section>
  )
}

/** Header-style "See All" link for a section. */
export function SeeAll({ onClick, label = 'See All' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="ios-subhead -mb-0.5 text-accent active:opacity-50">
      {label}
    </button>
  )
}

/** Coloured rounded-square icon used in Settings-style rows. */
export function IconTile({ icon: Icon, tone = 'cyan', size = 29 }: { icon: IconType; tone?: Tone; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[7px] text-white" style={{ width: size, height: size, background: toneColor(tone) }} aria-hidden>
      <Icon size={Math.round(size * 0.62)} strokeWidth={2.2} />
    </span>
  )
}

export interface CellProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned secondary value. */
  detail?: ReactNode
  icon?: IconType
  iconTone?: Tone
  leading?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  onClick?: () => void
  destructive?: boolean
  tint?: boolean
  className?: string
  testId?: string
  ariaLabel?: string
  multiline?: boolean
}

/** A list row (44pt minimum). Tappable when `onClick` is given. */
export function Cell({ title, subtitle, detail, icon, iconTone, leading, trailing, chevron, onClick, destructive, tint, className, testId, ariaLabel, multiline }: CellProps) {
  const content = (
    <>
      {icon ? <IconTile icon={icon} tone={iconTone} /> : leading}
      <span className="min-w-0 flex-1 py-[11px]">
        <span className={cn('ios-body block', multiline ? 'whitespace-pre-line' : 'truncate', destructive ? 'text-bad' : tint ? 'text-accent' : 'text-ink')}>{title}</span>
        {subtitle && <span className={cn('ios-subhead mt-0.5 block text-ink-subtle', multiline ? 'line-clamp-3' : 'truncate')}>{subtitle}</span>}
      </span>
      {detail !== undefined && detail !== null && <span className="ios-body max-w-[45%] shrink-0 truncate text-right text-ink-subtle">{detail}</span>}
      {trailing}
      {chevron && <ChevronRight size={18} className="-mr-1 shrink-0 text-[var(--color-ink-subtle)] opacity-60" aria-hidden />}
    </>
  )
  const cls = cn('flex min-h-11 w-full items-center gap-3 px-4 text-left', className)
  const style = { '--sep-inset': icon || leading ? '60px' : '16px' } as React.CSSProperties
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'ios-press')} style={style} data-testid={testId} aria-label={ariaLabel}>
      {content}
    </button>
  ) : (
    <div className={cls} style={style} data-testid={testId}>
      {content}
    </div>
  )
}

/** A full-width coloured action row (e.g. "Add Transaction", "Delete Project"). */
export function ActionCell({ children, onClick, destructive, icon: Icon, testId, disabled }: { children: ReactNode; onClick: () => void; destructive?: boolean; icon?: IconType; testId?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className={cn('ios-press ios-body flex min-h-11 w-full items-center gap-2.5 px-4 text-left disabled:opacity-40', destructive ? 'text-bad' : 'text-accent')}>
      {Icon && <Icon size={20} />}
      {children}
    </button>
  )
}

/** Empty placeholder shown inside a section. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="ios-subhead px-4 py-3.5 text-ink-subtle">{children}</p>
}
