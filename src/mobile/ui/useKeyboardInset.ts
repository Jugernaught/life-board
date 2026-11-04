import { useEffect } from 'react'

/**
 * Tracks the on-screen keyboard through the Visual Viewport API and exposes
 * its height as the CSS variable --kb, so sheets and composers can sit above
 * it. (iOS doesn't resize the layout viewport when the keyboard opens.)
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // Ignore small differences (browser chrome), only real keyboards.
      root.style.setProperty('--kb', `${inset > 80 ? Math.round(inset) : 0}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}
