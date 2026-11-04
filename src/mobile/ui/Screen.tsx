import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { nav, screenScrollers } from '../nav/navigator'
import { useRoute } from './RouteContext'

/**
 * UIKit's back button: the previous screen's title; "Back" when that doesn't
 * fit beside the title; just the chevron when even "Back" doesn't fit.
 */
export function backLabelFor(mode: 'title' | 'back' | 'none', backTitle: string | undefined) {
  if (mode === 'none') return ''
  return mode === 'back' || !backTitle ? 'Back' : backTitle
}

function useBackLabelMode(backTitle: string | undefined, title: string) {
  const ref = useRef<HTMLSpanElement>(null)
  const [mode, setMode] = useState<'title' | 'back' | 'none'>('title')
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))
  useEffect(() => {
    const on = () => setWidth(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // Re-measure when the bar is first laid out (e.g. a tab that was hidden becomes visible).
  const [shown, setShown] = useState(0)
  useEffect(() => {
    // The grid column's width doesn't depend on the label, so this can't loop.
    const el = ref.current?.closest<HTMLElement>('[data-nav-side]')
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== last) {
        last = el.clientWidth
        setShown((n) => n + 1)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Start from the full title whenever the inputs change, then step down until it fits.
  useLayoutEffect(() => setMode('title'), [backTitle, title, width, shown])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || mode === 'none') return
    if (el.scrollWidth > el.clientWidth + 1) setMode(mode === 'title' && backTitle !== 'Back' ? 'back' : 'none')
  }, [mode, backTitle, title, width, shown])
  return { ref, mode }
}

/**
 * A full-screen page with an iOS navigation bar.
 *
 * - `large` titles sit in the content and collapse into the bar as you scroll
 *   (like Mail or Settings); pushed detail screens use an inline title.
 * - The back button shows the previous screen's title.
 * - The page is its own scroll container, so each screen keeps its scroll
 *   position while you navigate away and back.
 */
export function Screen({
  title,
  large = false,
  trailing,
  leading,
  subtitle,
  header,
  children,
  className,
  bottomBar,
  testId,
}: {
  title: string
  large?: boolean
  trailing?: ReactNode
  leading?: ReactNode
  subtitle?: ReactNode
  /** Content directly under the large title (search field, segmented control). */
  header?: ReactNode
  children: ReactNode
  className?: string
  /** A toolbar pinned above the tab bar (e.g. a composer). */
  bottomBar?: ReactNode
  testId?: string
}) {
  const route = useRoute()
  const scroller = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [titleHidden, setTitleHidden] = useState(!large)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    screenScrollers.set(route.entry.key, el)
    const onScroll = () => {
      setScrolled(el.scrollTop > 2)
      if (large) setTitleHidden(el.scrollTop < 38)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      screenScrollers.delete(route.entry.key)
    }
  }, [route.entry.key, large])

  const canGoBack = route.depth > 0
  const back = useBackLabelMode(route.backTitle, title)
  const inlineTitleVisible = !large || !titleHidden

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--ios-grouped)]" data-testid={testId}>
      {/* Navigation bar */}
      <header
        className={cn('absolute inset-x-0 top-0 z-20 transition-[background-color,box-shadow] duration-200', scrolled || !large ? 'ios-bar ios-hairline-b' : 'bg-transparent')}
        style={{ paddingTop: 'var(--safe-top)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
      >
        {/* Equal side columns keep the title centred; each side truncates instead of overlapping. */}
        <div className="grid h-[var(--navbar-h)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1">
          <div className="flex min-w-0 items-center" data-nav-side>
            {leading ??
              (canGoBack && (
                <button
                  type="button"
                  onClick={() => nav.pop()}
                  className="flex h-11 max-w-full min-w-11 items-center gap-0.5 pr-2 text-accent active:opacity-50"
                  aria-label={`Back to ${route.backTitle ?? 'previous screen'}`}
                  data-testid="nav-back"
                >
                  <ChevronLeft size={30} strokeWidth={2.2} className="-ml-1 shrink-0" />
                  <span ref={back.ref} className="ios-body truncate" data-testid="nav-back-label">
                    {backLabelFor(back.mode, route.backTitle)}
                  </span>
                </button>
              ))}
          </div>
          <h1
            className={cn('ios-headline pointer-events-none max-w-[56vw] truncate px-1 text-center text-ink transition-opacity duration-150', inlineTitleVisible ? 'opacity-100' : 'opacity-0')}
            aria-hidden={large}
          >
            {title}
          </h1>
          <div className="flex min-w-0 items-center justify-end gap-1 pr-1">{trailing}</div>
        </div>
      </header>

      <main
        ref={scroller}
        className={cn('ios-scroll relative flex-1', className)}
        style={{
          paddingTop: 'calc(var(--safe-top) + var(--navbar-h))',
          paddingBottom: bottomBar ? 'calc(var(--tabbar-h) + var(--kb) + 64px)' : 'calc(var(--tabbar-h) + var(--kb) + 28px)',
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
        }}
        data-screen-scroll
      >
        {large && (
          <div className="px-4 pt-1 pb-2">
            <h1 className="ios-large-title text-ink" data-testid="large-title">
              {title}
            </h1>
            {subtitle && <div className="ios-subhead mt-0.5 text-ink-subtle">{subtitle}</div>}
          </div>
        )}
        {!large && subtitle && <div className="ios-subhead px-4 pt-2 text-ink-subtle">{subtitle}</div>}
        {header && <div className={cn('px-4 pb-3', large ? 'pt-1' : 'pt-3')}>{header}</div>}
        {/* Grouped lists start a little below the bar, as in iOS Settings. */}
        {!large && !header && <div className="h-4" aria-hidden />}
        {children}
      </main>
      {bottomBar && (
        <div className="ios-bar ios-hairline-t absolute inset-x-0 z-20 px-4 py-2" style={{ bottom: 'calc(var(--tabbar-h) + var(--kb))' }}>
          {bottomBar}
        </div>
      )}
    </div>
  )
}

/** A text or icon button for the navigation bar (44pt hit area, tint colour). */
export function NavButton({ children, onClick, label, bold, disabled, testId }: { children: ReactNode; onClick: () => void; label?: string; bold?: boolean; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-testid={testId}
      className={cn('flex h-11 min-w-11 items-center justify-center px-2 text-accent active:opacity-50 disabled:opacity-35', bold ? 'ios-headline' : 'ios-body')}
    >
      {children}
    </button>
  )
}
