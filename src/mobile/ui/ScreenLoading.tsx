/** Placeholder while a screen's code loads (usually instant; cached offline). */
export function ScreenLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--ios-grouped)]" role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-[2.5px] border-[var(--color-line-strong)] border-t-[var(--color-ink-subtle)]" />
    </div>
  )
}
