import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

const KEY = 'life-os:mobile-banner-dismissed'

/** True on phone-sized touch screens (not on a narrow desktop window). */
export function isPhone(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(max-width: 640px) and (pointer: coarse)').matches
}

/**
 * On a phone, offers the dedicated iPhone version (/m/). Dismissing it is
 * remembered on this device. The desktop version keeps working either way.
 */
export function MobileBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(KEY) === '1'
    } catch {
      // No storage: show the banner; dismissing just won't be remembered.
    }
    setShow(isPhone() && !dismissed)
  }, [])
  if (!show) return null
  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // Ignore — it simply shows again next time.
    }
  }
  return (
    <div role="region" aria-label="iPhone version" className="no-print flex items-center gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2.5 text-[13px]" data-testid="mobile-banner">
      <Smartphone size={18} className="shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 text-ink">
        On a phone? <span className="text-ink-muted">The iPhone version is built for touch, with the same data.</span>
      </p>
      <a href="/m/" className="shrink-0 rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent" data-testid="mobile-banner-open">
        Open
      </a>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:text-ink">
        <X size={16} />
      </button>
    </div>
  )
}
