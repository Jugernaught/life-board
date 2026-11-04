import { useEffect, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { MemoryRouter } from 'react-router'
import { useApp, useSettings } from '@/store/store'
import { applyAppearance, resolveAppearance } from '@/app/themes'
import { useSystemDark } from '@/app/ThemeController'
import { useChangeToasts } from '@/app/useChangeToasts'
import { useReminders } from '@/app/reminders'
import { StartupNotice } from '@/app/StartupNotice'
import { Toaster } from '@/components/ui/toast'
import { MobileEditorHost } from './editor/MobileEditorHost'
import { openRecord } from './editor/openRecord'
import { QuickAddSheet } from './editor/QuickAddSheet'
import { useNav, syncHash } from './nav/navigator'
import { TAB_IDS, type TabId } from './nav/paths'
import { StackView } from './nav/StackView'
import { TabBar } from './nav/TabBar'
import { MobileOnboarding } from './screens/onboarding/MobileOnboarding'
import { MobileRecovery } from './screens/onboarding/MobileRecovery'
import { TemplatesSheet } from './screens/today/GettingStarted'
import { PlanDaySheet } from './screens/today/PlanDaySheet'
import { ActionSheetHost } from './ui/ActionSheet'
import { MobileDatePromptHost } from './ui/DatePromptSheet'
import { ScreenLoading } from './ui/ScreenLoading'
import { useSheetDepth } from './ui/sheetStore'
import { useKeyboardInset } from './ui/useKeyboardInset'
import { useLaunchAction } from './launchActions'

/** Applies the visual style, light/dark (follows iOS by default), accent, motion and transparency. */
function useAppearance() {
  const s = useSettings()
  const systemDark = useSystemDark()
  const a = resolveAppearance(s, s.mobileTheme, systemDark)
  useEffect(() => {
    applyAppearance(document.documentElement, a, { storageKey: 'life-os:m-appearance', modePref: s.mobileTheme, themeColorVar: '--ios-grouped', textScale: s.textScale })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.style, a.mode, a.accent, a.motion, a.transparency, a.effects, s.mobileTheme, s.textScale])
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
  useChangeToasts()
  useReminders(openRecord)
  useLaunchAction(ready && !loadError && settings.onboarded)
  return (
    <MemoryRouter>
      <MotionConfig reducedMotion={motionPref === 'reduced' ? 'always' : motionPref === 'full' ? 'never' : 'user'}>
        <div className="absolute inset-0 bg-black">
          {!ready ? <ScreenLoading /> : loadError ? <MobileRecovery /> : !settings.onboarded ? <MobileOnboarding /> : <Stage />}
        </div>
        <MobileEditorHost />
        <QuickAddSheet />
        <ActionSheetHost />
        <MobileDatePromptHost />
        <PlanDaySheet />
        <TemplatesSheet />
        <StartupNotice />
        <Toaster placement="top" />
      </MotionConfig>
    </MemoryRouter>
  )
}
