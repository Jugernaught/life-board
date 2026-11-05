/**
 * Task actions that talk back: each shows a short confirmation with Undo.
 * Shared by desktop and iPhone so both behave the same.
 */
import type { Task } from '@/data/types'
import { relativeDay, todayISO } from '@/lib/dates'
import { rescheduleTask } from '@/lib/taskOps'
import { actions, appStore } from '@/store/store'
import { promptDate } from '@/components/ui/datePrompt'
import { toast } from '@/components/ui/toast'
import { chipLabel } from '@/forms/SmartChips'
import { applySmart, eventSmart, parseSmart, taskSmart } from '@/forms/smart'
import type { FormContext } from '@/forms/types'

const lastChangeId = () => appStore.getState().history.at(-1)?.id

const undoAll = (ids: (string | undefined)[]) => () => {
  // Newest first so each record goes back to exactly where it was; one notice if any had changed since.
  const results = [...ids].reverse().map((id) => (id ? actions.undoChange(id) : true))
  if (results.includes(false)) toast({ title: 'Some changes couldn’t be undone', description: 'They were changed again since — nothing newer was overwritten.', tone: 'warning' })
}

export function reschedule(task: Task, date: string | undefined, today: string) {
  if ((task.dueDate ?? undefined) === date) return
  rescheduleTask(task.id, date)
  const id = lastChangeId()
  toast({
    title: date ? `Moved to ${relativeDay(date, today).toLowerCase()}` : 'Due date removed',
    description: task.title,
    tone: 'success',
    action: { label: 'Undo', onClick: undoAll([id]) },
  })
}

export async function rescheduleToPickedDate(task: Task, today: string) {
  const date = await promptDate({ title: 'Reschedule to…', initial: task.dueDate ?? today })
  if (date) reschedule(task, date, today)
}

/** Move a list of tasks to one day (e.g. every overdue task to today). */
export function rescheduleMany(tasks: readonly Task[], date: string, today: string) {
  const ids: (string | undefined)[] = []
  for (const t of tasks) {
    if (t.dueDate === date) continue
    rescheduleTask(t.id, date)
    ids.push(lastChangeId())
  }
  if (!ids.length) return
  toast({
    title: `${ids.length} task${ids.length === 1 ? '' : 's'} moved to ${relativeDay(date, today).toLowerCase()}`,
    tone: 'success',
    action: { label: 'Undo', onClick: undoAll(ids) },
  })
}

export function duplicateTask(task: Task) {
  const rest: Record<string, unknown> = { ...task }
  // A duplicate starts its own repeating series (and its own revisions).
  for (const k of ['id', 'createdAt', 'updatedAt', 'completedAt', 'seriesId', 'rev']) delete rest[k]
  const copy = actions.create('tasks', { ...rest, status: 'todo', checklist: (task.checklist ?? []).map((c) => ({ ...c, done: false, doneAt: undefined })) } as never)
  toast({ title: 'Task duplicated', description: copy.title, tone: 'success', action: { label: 'Undo', onClick: undoAll([lastChangeId()]) } })
  return copy
}

export function setSubtasks(task: Task, checklist: Task['checklist']) {
  actions.update('tasks', task.id, { checklist })
}

/**
 * Create a task from one line of text ("Call mum tomorrow 6pm !high"), as the
 * inline "add a task" boxes do. `defaults` (e.g. due today) apply unless the
 * text says otherwise. Confirms with what was understood.
 */
export function quickCreateTask(text: string, defaults: Partial<Task> = {}) {
  const db = actions.getDb()
  const ctx: FormContext = { db, settings: db.settings, today: todayISO() }
  const values = applySmart(taskSmart, { tags: [], checklist: [], ...defaults, title: text.trim() }, ctx, new Set(), new Set())
  const parsed = parseSmart(text, ctx, taskSmart, new Set())
  const created = actions.create('tasks', values as never)
  const understood = parsed.tokens.map((t) => t.kind)
  const summary = [...new Set(understood)].map((k) => chipLabel(k, parsed, ctx)).filter(Boolean).join(' · ')
  // Only speak up when the text was read for something (plain adds show in the list already).
  if (summary) toast({ title: 'Task added', description: `${created.title} — ${summary}`, tone: 'success', action: { label: 'Undo', onClick: undoAll([lastChangeId()]) } })
  return created
}

/** Same for events: "Dentist Friday 3pm" (all-day today unless a date/time is given). */
export function quickCreateEvent(text: string, defaults: Record<string, unknown> = {}) {
  const db = actions.getDb()
  const ctx: FormContext = { db, settings: db.settings, today: todayISO() }
  const values = applySmart(eventSmart, { date: ctx.today, allDay: true, ...defaults, title: text.trim() }, ctx, new Set(), new Set())
  const created = actions.create('events', values as never)
  toast({ title: 'Event added', description: created.title, tone: 'success', action: { label: 'Undo', onClick: undoAll([lastChangeId()]) } })
  return created
}
