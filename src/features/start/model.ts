/**
 * Getting started: a short checklist that ticks itself off from your real
 * data, plus starter templates you can add in one go. Shared by desktop and
 * iPhone; the guide disappears once everything is done or it's dismissed.
 */
import { create } from 'zustand'
import type { Database } from '@/data/types'
import { HABIT_PACKS, type HabitTemplate, ROUTINE_PACKS, type RoutineTemplate } from '@/data/templates'
import { firstOnOrAfter } from '@/lib/recurrence'
import { uid } from '@/lib/utils'
import { actions } from '@/store/store'

export type StartStepId = 'task' | 'priority' | 'habit' | 'checkin' | 'plan' | 'backup'

export interface StartStep {
  id: StartStepId
  label: string
  hint: string
  done: boolean
}

export function startSteps(db: Pick<Database, 'tasks' | 'habits' | 'checkIns' | 'settings'>, exported: boolean): StartStep[] {
  return [
    { id: 'task', label: 'Add your first task', hint: 'Try typing “Call mum tomorrow 6pm !high”', done: db.tasks.length > 0 },
    { id: 'priority', label: 'Star a priority for today', hint: 'The few things that matter most', done: db.tasks.some((t) => !!t.focusDate) },
    { id: 'habit', label: 'Start a habit', hint: 'Or pick a few from the templates', done: db.habits.length > 0 },
    { id: 'checkin', label: 'Log how you feel', hint: 'Mood and energy in five seconds', done: db.checkIns.length > 0 },
    { id: 'plan', label: 'Plan your day', hint: 'A two-minute morning routine', done: !!db.settings.planDayLast },
    { id: 'backup', label: 'Save a backup', hint: 'Your data lives only on this device', done: exported },
  ]
}

export const showGettingStarted = (steps: StartStep[], dismissed: boolean) => !dismissed && steps.some((s) => !s.done)

const norm = (s: string) => s.trim().toLowerCase()

/** Template items already in your data (same name), so they aren't added twice. */
export function existingTemplateIds(db: Pick<Database, 'habits' | 'tasks'>): Set<string> {
  const habitNames = new Set(db.habits.map((h) => norm(h.name)))
  const taskTitles = new Set(db.tasks.filter((t) => t.status !== 'done' && t.repeat).map((t) => norm(t.title)))
  const out = new Set<string>()
  for (const p of HABIT_PACKS) for (const h of p.items) if (habitNames.has(norm(h.name))) out.add(h.id)
  for (const p of ROUTINE_PACKS) for (const r of p.items) if (taskTitles.has(norm(r.title))) out.add(r.id)
  return out
}

const habitById = new Map<string, HabitTemplate>(HABIT_PACKS.flatMap((p) => p.items.map((h) => [h.id, h] as const)))
const routineById = new Map<string, RoutineTemplate>(ROUTINE_PACKS.flatMap((p) => p.items.map((r) => [r.id, r] as const)))

/** Create the picked templates. Returns how many habits and tasks were added. */
export function addTemplates(ids: Iterable<string>, today: string): { habits: number; tasks: number } {
  let habits = 0
  let tasks = 0
  for (const id of ids) {
    const h = habitById.get(id)
    if (h) {
      actions.create('habits', { name: h.name, description: h.description, area: h.area, schedule: h.schedule, days: h.days ?? [], timesPerWeek: h.timesPerWeek ?? 3, color: h.color, startDate: today })
      habits++
      continue
    }
    const r = routineById.get(id)
    if (r) {
      actions.create('tasks', {
        title: r.title,
        area: r.area,
        priority: 'medium',
        status: 'todo',
        repeat: r.repeat,
        dueDate: firstOnOrAfter(r.repeat, today),
        checklist: (r.checklist ?? []).map((title) => ({ id: uid(), title, done: false })),
      })
      tasks++
    }
  }
  return { habits, tasks }
}

export const useTemplates = create<{ open: boolean; /** Bumped on every open, so a reopened dialog always starts fresh. */ session: number; show: () => void; hide: () => void }>((set) => ({
  open: false,
  session: 0,
  show: () => set((s) => ({ open: true, session: s.session + 1 })),
  hide: () => set({ open: false }),
}))

export const templates = { show: () => useTemplates.getState().show() }
