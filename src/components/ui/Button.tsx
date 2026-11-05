import { type ButtonHTMLAttributes, type ComponentType, type ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

const variants: Record<ButtonVariant, string> = {
  primary: 'chamfer-sm rounded-[var(--radius-btn-primary)] bg-accent-fill text-on-accent font-semibold hover:brightness-110 active:brightness-95 shadow-[var(--glow-md)]',
  secondary: 'rounded-[var(--radius-btn)] border border-line-strong bg-panel-2/70 text-ink hover:border-accent/50 hover:bg-panel-3 hover:text-ink',
  ghost: 'rounded-[var(--radius-btn)] text-ink-muted hover:bg-panel-3/70 hover:text-ink',
  subtle: 'rounded-[var(--radius-btn)] bg-accent/10 text-accent hover:bg-accent/20',
  danger: 'rounded-[var(--radius-btn)] border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconType
  iconRight?: IconType
  loading?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'xs' ? 13 : size === 'lg' ? 18 : 15
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,border-color,filter,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={2} className="shrink-0" />
      )}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={2} className="shrink-0 opacity-70" />}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconType
  label: string
  size?: 'xs' | 'sm' | 'md'
  variant?: 'ghost' | 'secondary' | 'danger' | 'subtle'
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'sm', variant = 'ghost', active, className, type = 'button', ...rest },
  ref,
) {
  const dims = size === 'xs' ? 'size-6' : size === 'sm' ? 'size-8' : 'size-9'
  const iconSize = size === 'xs' ? 13 : size === 'sm' ? 16 : 18
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-btn)] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        dims,
        variant === 'ghost' && 'text-ink-muted hover:bg-panel-3/80 hover:text-ink',
        variant === 'secondary' && 'border border-line-strong bg-panel-2/70 text-ink-muted hover:border-accent/50 hover:text-ink',
        variant === 'danger' && 'text-ink-muted hover:bg-bad/15 hover:text-bad',
        variant === 'subtle' && 'bg-accent/10 text-accent hover:bg-accent/20',
        active && 'bg-accent/15 text-accent',
        className,
      )}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </button>
  )
})
