/**
 * What the root tab screens are showing (Plan: calendar or tasks, and the
 * selected day; Habits: habits or goals), so the floating action button next
 * to the tab bar can do exactly what the screen's own "+" would. With the
 * floating bar there is then one add button per screen, not two.
 */
import { create } from 'zustand'
import { useSettings } from '@/store/store'

interface TabContext {
  planMode: 'calendar' | 'tasks'
  planDate?: string
  habitsSegment: 'habits' | 'goals'
  set: (patch: Partial<Omit<TabContext, 'set'>>) => void
}

export const useTabContext = create<TabContext>((set) => ({
  planMode: 'calendar',
  planDate: undefined,
  habitsSegment: 'habits',
  set: (patch) => set(patch),
}))

/** Liquid Glass, Cyberpunk and Minimal Dark show a floating action button; Apple Clean doesn't. */
export const hasFloatingAction = (style: string) => style !== 'clean'

/** Root tab screens show their own "+" only when there's no floating action button. */
export const useShowsHeaderAdd = () => !hasFloatingAction(useSettings().uiStyle)
