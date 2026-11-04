/**
 * Every screen path in the iPhone app. A path's first segment is its tab.
 * Kept free of React components so the navigator can use it without
 * importing any screens.
 */
export const TAB_IDS = ['today', 'plan', 'habits', 'journal', 'more'] as const
export type TabId = (typeof TAB_IDS)[number]

export const ROUTE_PATTERNS = [
  'today',
  'plan',
  'habits',
  'habits/habit/:id',
  'habits/goal/:id',
  'habits/review',
  'journal',
  'journal/entry/:id',
  'journal/write/:date',
  'journal/history',
  'journal/checkins',
  'more',
  'more/projects',
  'more/projects/:id',
  'more/career',
  'more/career/paths',
  'more/career/paths/:id',
  'more/career/education',
  'more/career/education/course/:id',
  'more/career/education/module/:id',
  'more/career/applications',
  'more/career/interviews',
  'more/career/companies',
  'more/career/milestones',
  'more/career/qualifications',
  'more/finance',
  'more/finance/transactions',
  'more/finance/budgets',
  'more/finance/savings',
  'more/finance/recurring',
  'more/finance/targets',
  'more/fitness',
  'more/fitness/workouts',
  'more/fitness/records',
  'more/fitness/activity',
  'more/fitness/sleep',
  'more/fitness/routines',
  'more/learning',
  'more/learning/skill/:id',
  'more/learning/sessions',
  'more/learning/courses',
  'more/learning/resources',
  'more/library',
  'more/social',
  'more/social/people',
  'more/social/dates',
  'more/notes',
  'more/analytics',
  'more/analytics/report',
  'more/settings',
  'more/settings/data',
  'more/settings/targets',
  'more/settings/categories',
] as const
export type RoutePattern = (typeof ROUTE_PATTERNS)[number]

export interface Match {
  pattern: RoutePattern
  params: Record<string, string>
}

export function matchPath(path: string): Match | null {
  const parts = path.split('/').filter(Boolean)
  for (const pattern of ROUTE_PATTERNS) {
    const pp = pattern.split('/')
    if (pp.length !== parts.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i])
      else if (pp[i] !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok) return { pattern, params }
  }
  return null
}

export const tabOf = (path: string): TabId | null => {
  const t = path.split('/')[0]
  return (TAB_IDS as readonly string[]).includes(t) ? (t as TabId) : null
}

/** The stack of screens leading to a path: every prefix that is itself a screen. */
export function buildStack(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  const out: string[] = []
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join('/')
    if (matchPath(prefix)) out.push(prefix)
  }
  return out
}

/** Parse a location hash like "#/more/projects/abc" into a valid path, or null. */
export function pathFromHash(hash: string): string | null {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (!path || !tabOf(path) || !matchPath(path)) return null
  return path
}
