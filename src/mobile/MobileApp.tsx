import { useEffect, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { MemoryRouter } from 'react-router'
import { useApp, useSettings } from '@/store/store'
import { StartupNotice } from '@/app/StartupNotice'
import { Toaster } from '@/components/ui/toast'
import { MobileEditorHost } from './editor/MobileEditorHost'
import { QuickAddSheet } from './editor/QuickAddSheet'
import { useNav, syncHash } from './nav/navigator'
import { TAB_IDS, type TabId } from './nav/paths'
import { StackView } from './nav/StackView'
import { TabBar } from './nav/TabBar'
import { MobileOnboarding } from './screens/onboarding/MobileOnboarding'
import { MobileRecovery } from './screens/onboarding/MobileRecovery'
import { ActionSheetHost } from './ui/ActionSheet'
import { ScreenLoading } from './ui/ScreenLoading'
import { useSheetDepth } from './ui/sheetStore'
import { useKeyboardInset } from './ui/useKeyboardInset'

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

/** Applies light/dark appearance (follows iOS by default), accent and motion. */
function useAppearance() {
  const s = useSettings()
  const systemDark = useSystemDark()
  const theme = s.mobileTheme === 'system' ? (systemDark ? 'dark' : 'light') : s.mobileTheme
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = s.accent
    root.dataset.motion = s.motion === 'reduced' ? 'reduced' : s.motion === 'full' ? 'full' : 'system'
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7')
    try {
      localStorage.setItem('life-os:m-theme', s.mobileTheme)
    } catch {
      // Only affects the pre-paint colour on next launch.
    }
  }, [theme, s.accent, s.motion, s.mobileTheme])
  return s.motion
}

function Stage() {
  const tab = useNav((s) => s.tab)
  const sheetOpen = useSheetDepth((s) => s.depth > 0)
  useEffect(() => syncHash(), [])
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set([tab]))
  if (!visited.has(tab)) setVisited(new Set([...visited, tab]))
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      animate={sheetOpen ? { scale: 0.93, borderRadius: 12, y: 8 } : { scale: 1, borderRadius: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      style={{ transformOrigin: '50% 0%' }}
    >
      {/* Like UITabBarController, a tab's screens load the first time it's opened, then stay mounted. */}
      {TAB_IDS.filter((t) => visited.has(t)).map((t) => (
        <StackView key={t} tab={t} active={t === tab} />
      ))}
      <TabBar />
    </motion.div>
  )
}

export function MobileApp() {
  const ready = useApp((s) => s.ready)
  const loadError = useApp((s) => s.loadError)
  const settings = useSettings()
  const motionPref = useAppearance()
  useKeyboardInset()
  return (
    <MemoryRouter>
      <MotionConfig reducedMotion={motionPref === 'reduced' ? 'always' : motionPref === 'full' ? 'never' : 'user'}>
        <div className="absolute inset-0 bg-black">
          {!ready ? <ScreenLoading /> : loadError ? <MobileRecovery /> : !settings.onboarded ? <MobileOnboarding /> : <Stage />}
        </div>
        <MobileEditorHost />
        <QuickAddSheet />
        <ActionSheetHost />
        <StartupNotice />
        <Toaster placement="top" />
      </MotionConfig>
    </MemoryRouter>
  )
}
