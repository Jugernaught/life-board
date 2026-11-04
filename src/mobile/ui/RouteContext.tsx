import { createContext, useContext } from 'react'
import type { Entry } from '../nav/navigator'
import type { TabId } from '../nav/paths'

export interface RouteInfo {
  entry: Entry
  params: Record<string, string>
  tab: TabId
  depth: number
  isTop: boolean
  /** Title of the screen underneath, shown on the back button. */
  backTitle?: string
}

export const RouteContext = createContext<RouteInfo | null>(null)

export function useRoute(): RouteInfo {
  const r = useContext(RouteContext)
  if (!r) throw new Error('useRoute must be used inside a screen')
  return r
}
