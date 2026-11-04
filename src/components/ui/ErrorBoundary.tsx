import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** What failed, for the message ("This widget", "This page"). */
  label?: string
  /** Smaller card for widgets and list sections. */
  compact?: boolean
  /** Changing this value clears the error (e.g. the route path). */
  resetKey?: unknown
}
interface State {
  error?: Error
}

/**
 * Contains a rendering failure to the part of the screen it happened in, so
 * one broken widget or screen never blanks the whole app. Data is untouched —
 * nothing is written while showing this.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[LIFE OS] A part of the screen failed to render:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: undefined })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const label = this.props.label ?? 'This part of the screen'
    const copy = () => void navigator.clipboard?.writeText(`${error.name}: ${error.message}\n${error.stack ?? ''}`).catch(() => {})
    return (
      <div role="alert" className={this.props.compact ? 'panel flex flex-col items-start gap-2 p-4' : 'panel mx-auto my-8 flex max-w-lg flex-col items-start gap-3 p-6'} data-testid="error-boundary">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <AlertTriangle size={17} className="text-warn" aria-hidden />
          {label} couldn’t be shown
        </p>
        <p className="text-[13px] text-ink-muted">Your data is safe — nothing was changed. Try again, and if it keeps happening, copy the details to report it.</p>
        <p className="w-full truncate rounded-[var(--radius-control)] bg-ink/[0.05] px-2.5 py-1.5 font-[family-name:var(--font-code)] text-[12px] text-ink-muted">{error.message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => this.setState({ error: undefined })} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-btn)] bg-accent-fill px-3 text-[13px] font-semibold text-on-accent">
            <RotateCcw size={14} aria-hidden /> Try again
          </button>
          <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-btn)] border border-line-strong px-3 text-[13px] text-ink">
            <Copy size={14} aria-hidden /> Copy details
          </button>
        </div>
      </div>
    )
  }
}
