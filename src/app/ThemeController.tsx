import { type ReactNode, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useSettings } from '@/store/store'

function useSystemDark() {
  const [dark, setDark] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

/** Applies theme, accent and motion preferences to the document. */
export function ThemeController({ children }: { children: ReactNode }) {
  const s = useSettings()
  const systemDark = useSystemDark()
  const theme = s.theme === 'system' ? (systemDark ? 'dark' : 'light') : s.theme
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = s.accent
    root.dataset.motion = s.motion === 'reduced' ? 'reduced' : s.motion === 'full' ? 'full' : 'system'
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#eef1f6' : '#05060a')
  }, [theme, s.accent, s.motion])
  return <MotionConfig reducedMotion={s.motion === 'reduced' ? 'always' : s.motion === 'full' ? 'never' : 'user'}>{children}</MotionConfig>
}
