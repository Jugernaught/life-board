import { type ReactNode, useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { useSettings } from '@/store/store'
import { applyAppearance, resolveAppearance } from './themes'

export function useSystemDark() {
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

/** Applies the visual style, light/dark, accent, motion and transparency preferences to the document. */
export function ThemeController({ children }: { children: ReactNode }) {
  const s = useSettings()
  const systemDark = useSystemDark()
  const a = resolveAppearance(s, s.theme, systemDark)
  useEffect(() => {
    applyAppearance(document.documentElement, a, { storageKey: 'life-os:appearance', modePref: s.theme })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.style, a.mode, a.accent, a.motion, a.transparency, a.effects, s.theme])
  return <MotionConfig reducedMotion={s.motion === 'reduced' ? 'always' : s.motion === 'full' ? 'never' : 'user'}>{children}</MotionConfig>
}
