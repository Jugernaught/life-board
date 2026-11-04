/**
 * Home Screen / app-icon shortcuts ("New Task", "Today", "Write Journal").
 * The manifest opens ./?action=<name>#/<screen>; once the app is ready we run
 * the action and tidy the address so a reload doesn't repeat it.
 */
import { useEffect } from 'react'
import { todayISO } from '@/lib/dates'
import { useUI } from '@/components/command/uiStore'
import { nav } from './nav/navigator'

export const LAUNCH_ACTIONS = ['new-task', 'journal', 'today', 'check-in'] as const
export type LaunchAction = (typeof LAUNCH_ACTIONS)[number]

export function readLaunchAction(search: string): LaunchAction | null {
  const a = new URLSearchParams(search).get('action')
  return a && (LAUNCH_ACTIONS as readonly string[]).includes(a) ? (a as LaunchAction) : null
}

export function runLaunchAction(action: LaunchAction) {
  switch (action) {
    case 'new-task':
      useUI.getState().showQuickAdd('tasks')
      break
    case 'journal':
      nav.push(`journal/write/${todayISO()}`)
      break
    case 'check-in':
      useUI.getState().showQuickAdd('checkIns')
      break
    case 'today':
      break
  }
}

/** Run the launch action once the app can show it (data loaded, past onboarding). */
export function useLaunchAction(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const action = readLaunchAction(window.location.search)
    if (!action) return
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    // Let the first screen mount so the sheet animates over it.
    const t = window.setTimeout(() => runLaunchAction(action), 250)
    return () => window.clearTimeout(t)
  }, [enabled])
}
