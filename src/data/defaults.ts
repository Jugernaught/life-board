/**
 * Defaults for a brand-new Atlas. Note what is NOT here: no sample tasks,
 * no fake transactions, no invented progress. A new install starts empty.
 */
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './constants'
import { COLLECTION_KEYS, SCHEMA_VERSION, WIDGET_IDS, WIDGET_SIZES, settings as settingsSchema } from './schema'
import type { Database, Settings, WidgetId, WidgetPref, WidgetSize } from './types'

export const WIDGET_META: Record<WidgetId, { title: string; description: string; size: WidgetSize; defaultVisible: boolean }> = {
  priorities: { title: "Today's priorities", description: 'The few tasks you have chosen to focus on today', size: 'm', defaultVisible: true },
  today: { title: 'Due today', description: 'Tasks due today and anything overdue', size: 'm', defaultVisible: true },
  upcoming: { title: 'Upcoming', description: 'Events, deadlines and occasions over the next 7 days', size: 'l', defaultVisible: true },
  habits: { title: 'Habits', description: "Check off today's habits", size: 's', defaultVisible: true },
  weekly: { title: 'This week', description: 'What you have recorded this week vs last week', size: 'xl', defaultVisible: true },
  goals: { title: 'Goal progress', description: 'Active goals and how far along they are', size: 'm', defaultVisible: true },
  projects: { title: 'Active projects', description: 'Projects in progress with completion', size: 'm', defaultVisible: true },
  quickadd: { title: 'Quick add', description: 'Create tasks, events, goals and notes in place', size: 's', defaultVisible: true },
  activity: { title: 'Recent activity', description: 'A log of what you have changed recently', size: 'l', defaultVisible: true },
  notes: { title: 'Notes', description: 'Pinned and recent notes', size: 's', defaultVisible: true },
  finance: { title: 'Money this month', description: 'Income, spending and budget use this month', size: 's', defaultVisible: false },
  checkin: { title: 'Check-in', description: 'Log your mood and energy', size: 's', defaultVisible: false },
  reading: { title: 'Now reading', description: 'Books and media in progress', size: 's', defaultVisible: false },
  social: { title: 'Stay connected', description: 'People to reconnect with and upcoming occasions', size: 's', defaultVisible: false },
}

export function defaultDashboard(): WidgetPref[] {
  return WIDGET_IDS.map((id) => ({ id, visible: WIDGET_META[id].defaultVisible, size: WIDGET_META[id].size }))
}

export function defaultSettings(): Settings {
  const s = settingsSchema.parse({})
  return {
    ...s,
    dashboard: defaultDashboard(),
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
  }
}

export function createEmptyDatabase(): Database {
  const db = { schemaVersion: SCHEMA_VERSION, settings: defaultSettings(), activity: [] } as unknown as Database
  for (const key of COLLECTION_KEYS) (db as unknown as Record<string, unknown[]>)[key] = []
  return db
}

/**
 * Bring a (possibly older or partial) settings object up to date: missing
 * fields get defaults, and the dashboard list gains any widgets added in
 * newer versions while keeping your order and visibility choices.
 */
export function normaliseSettings(input: Partial<Settings> | undefined): Settings {
  const defaults = defaultSettings()
  const source = { ...defaults, ...(input ?? {}) } as Record<string, unknown>
  // Validate field by field: one bad or unknown value (e.g. from a newer
  // version) falls back to its default instead of rejecting all settings.
  const shape = settingsSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>
  const checked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'dashboard') continue
    const field = shape[key]
    if (!field) {
      checked[key] = value // unknown key: keep it untouched
      continue
    }
    const r = field.safeParse(value)
    checked[key] = r.success ? r.data : (defaults as Record<string, unknown>)[key]
  }
  const seen = new Set<string>()
  const dashboard: WidgetPref[] = []
  for (const raw of Array.isArray(source.dashboard) ? (source.dashboard as unknown[]) : []) {
    const w = raw as Partial<WidgetPref>
    if (!w || !WIDGET_IDS.includes(w.id as WidgetId) || seen.has(w.id as string)) continue
    seen.add(w.id as string)
    dashboard.push({ id: w.id as WidgetId, visible: w.visible !== false, size: WIDGET_SIZES.includes(w.size as WidgetSize) ? (w.size as WidgetSize) : WIDGET_META[w.id as WidgetId].size })
  }
  const merged = settingsSchema.parse({ ...checked, dashboard }) as Settings
  for (const w of defaults.dashboard) if (!seen.has(w.id)) dashboard.push(w)
  merged.dashboard = dashboard
  if (!merged.expenseCategories.length) merged.expenseCategories = defaults.expenseCategories
  if (!merged.incomeCategories.length) merged.incomeCategories = defaults.incomeCategories
  return merged
}
