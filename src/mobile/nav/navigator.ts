/**
 * The iPhone app's navigator. Each tab keeps its own stack of screens (like
 * UIKit's UINavigationController inside a UITabBarController), so switching
 * tabs and coming back returns you exactly where you were.
 *
 * The active screen is mirrored into the URL hash (replaceState only), so a
 * reload reopens the same screen without needing any server routing.
 */
import { create } from 'zustand'
import { uid } from '@/lib/utils'
import { type TabId, TAB_IDS, buildStack, matchPath, pathFromHash, tabOf } from './paths'

export interface Entry {
  key: string
  path: string
}

const entry = (path: string): Entry => ({ key: uid(), path })
const rootStack = (tab: TabId) => [entry(tab)]

export interface NavState {
  tab: TabId
  stacks: Record<TabId, Entry[]>
  /** Open a screen: pushed in the current tab; a path in another tab switches to that tab and builds its stack. */
  push: (path: string) => void
  /** Go back one screen (animated when the stack view is mounted). */
  pop: () => void
  /** Remove the top screen immediately (used after an animation finishes). */
  commitPop: (tab: TabId) => void
  popToRoot: (tab?: TabId) => void
  switchTab: (tab: TabId) => void
  /** Reset to a known state (tests, onboarding). */
  reset: (path?: string) => void
}

/** Registered by each tab's stack view to animate pops. */
export const navControllers: Partial<Record<TabId, { pop: () => Promise<void> }>> = {}
/** Scroll containers of mounted screens, by entry key (tab re-tap scrolls to top). */
export const screenScrollers = new Map<string, HTMLElement>()

function initialState(path: string | null): Pick<NavState, 'tab' | 'stacks'> {
  const stacks = Object.fromEntries(TAB_IDS.map((t) => [t, rootStack(t)])) as Record<TabId, Entry[]>
  if (!path) return { tab: 'today', stacks }
  const tab = tabOf(path) as TabId
  stacks[tab] = buildStack(path).map(entry)
  return { tab, stacks }
}

export const useNav = create<NavState>((set, get) => ({
  ...initialState(typeof window !== 'undefined' ? pathFromHash(window.location.hash) : null),

  push: (path) => {
    const tab = tabOf(path)
    if (!tab || !matchPath(path)) return
    const { stacks, tab: current } = get()
    const stack = stacks[tab]
    if (tab === current) {
      // Like UINavigationController: a screen already in the stack is popped
      // back to; anything else is pushed on top of where you are, so Back
      // returns to the screen you came from (e.g. course → module → back).
      const at = stack.findIndex((e) => e.path === path)
      const next = at >= 0 ? stack.slice(0, at + 1) : [...stack, entry(path)]
      if (next.length === stack.length && at === stack.length - 1) return
      set({ stacks: { ...stacks, [tab]: next } })
      return
    }
    // Another tab: switch to it and rebuild its stack down to the screen,
    // keeping entries (and their scroll positions) that are already there.
    const built = buildStack(path)
    const next = built.map((p, i) => (stack[i]?.path === p ? stack[i] : entry(p)))
    set({ tab, stacks: { ...stacks, [tab]: next } })
  },

  pop: () => {
    const { tab, stacks } = get()
    if (stacks[tab].length < 2) return
    const controller = navControllers[tab]
    if (controller) void controller.pop()
    else get().commitPop(tab)
  },

  commitPop: (tab) => {
    const { stacks } = get()
    if (stacks[tab].length < 2) return
    set({ stacks: { ...stacks, [tab]: stacks[tab].slice(0, -1) } })
  },

  popToRoot: (tab) => {
    const t = tab ?? get().tab
    const { stacks } = get()
    if (stacks[t].length < 2) return
    if (stacks[t].length === 2 && t === get().tab) return get().pop()
    set({ stacks: { ...stacks, [t]: stacks[t].slice(0, 1) } })
  },

  switchTab: (tab) => set({ tab }),

  reset: (path) => set(initialState(path ?? null)),
}))

export const topPath = (s: Pick<NavState, 'tab' | 'stacks'>) => s.stacks[s.tab][s.stacks[s.tab].length - 1].path

/** Keep the URL hash in sync with the visible screen. */
export function syncHash() {
  if (typeof window === 'undefined') return () => {}
  const write = () => {
    const hash = `#/${topPath(useNav.getState())}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }
  write()
  return useNav.subscribe(write)
}

/** Convenience for event handlers. */
export const nav = {
  push: (path: string) => useNav.getState().push(path),
  pop: () => useNav.getState().pop(),
}
