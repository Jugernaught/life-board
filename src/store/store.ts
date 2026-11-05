/**
 * The central data store.
 *
 * All records live in one `Database` object held by a Zustand store. Screens
 * read from it with `useCollection('tasks')` etc. and change it only through
 * the actions below, which:
 *   - validate every record against its Zod schema,
 *   - apply domain rules (completion timestamps, status history …),
 *   - write an activity-log entry,
 *   - make deletions undoable and never cascade-delete linked records.
 *
 * Persistence (saving to IndexedDB) is wired up separately in persistence.ts,
 * which subscribes to this store.
 */
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createEmptyDatabase, normaliseSettings } from '@/data/defaults'
import { COLLECTIONS, RELATIONS } from '@/data/registry'
import { collectionSchemas } from '@/data/schema'
import type { ActivityAction, ActivityEntry, CollectionKey, Collections, Database, InputOf, Settings } from '@/data/types'
import { ACTIVITY_LIMIT, mergeDeletions } from '@/data/validate'
import { todayISO } from '@/lib/dates'
import { nextDueDate } from '@/lib/recurrence'
import { uid } from '@/lib/utils'
import { onCreate, onUpdate } from './lifecycle'

export { ACTIVITY_LIMIT }

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface StorageInfo {
  label: string
  kind: 'indexeddb' | 'localstorage' | 'memory'
  persistent: boolean
  warning?: string
}

export interface UndoToken<K extends CollectionKey = CollectionKey> {
  key: K
  record: Collections[K]
  index: number
  unlinked: { key: CollectionKey; id: string; field: string; value: string }[]
}

/**
 * A recent change that can be undone (Ctrl/Cmd+Z, or Undo on a notification).
 * Kept in memory only — the last HISTORY_LIMIT changes of this session.
 */
export type Change =
  | {
      id: string
      kind: 'update'
      key: CollectionKey
      prev: Collections[CollectionKey]
      label: string
      action: ActivityAction
      at: number
      /** The record's revision right after this change; undo only applies while it's still that (compare-and-swap). */
      afterRev: number
      spawned?: { key: CollectionKey; id: string }
    }
  | { id: string; kind: 'create'; key: CollectionKey; recordId: string; label: string; at: number; afterRev: number }
  | { id: string; kind: 'delete'; token: UndoToken; label: string; at: number }

export const HISTORY_LIMIT = 50

export interface AppState {
  db: Database
  /** Recent undoable changes, newest last. */
  history: Change[]
  ready: boolean
  /** Set when stored data could not be read. Saving is disabled until resolved. */
  loadError?: { message: string; raw?: unknown }
  /** Shown once after startup, e.g. when unreadable records were set aside. */
  notice?: string
  storage?: StorageInfo
  save: { status: SaveStatus; lastSavedAt?: string; error?: string }

  create<K extends CollectionKey>(key: K, input: Partial<InputOf<K>>, opts?: { silent?: boolean; linked?: boolean }): Collections[K]
  update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<InputOf<K>> | ((current: Collections[K]) => Partial<InputOf<K>>),
    opts?: { action?: ActivityAction; silent?: boolean; detail?: string; spawned?: { key: CollectionKey; id: string } },
  ): Collections[K] | undefined
  remove<K extends CollectionKey>(key: K, id: string): UndoToken<K> | undefined
  undo(token: UndoToken): void
  /**
   * Undo the most recent change. `undone` is false when the record has been
   * changed since, so undoing would overwrite newer work (the change is then dropped).
   */
  undoLast(): { change: Change; undone: boolean } | undefined
  /** Undo a specific change (from its notification). False if it's gone or the record changed since. */
  undoChange(id: string): boolean
  updateSettings(patch: Partial<Settings>): void
  /** Replace everything (import, restore, reset). Callers must back up first. */
  replaceDatabase(db: Database): void
  clearActivity(): void
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: { path: PropertyKey[]; message: string }[],
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

function validate<K extends CollectionKey>(key: K, candidate: unknown): Collections[K] {
  const parsed = collectionSchemas[key].record.safeParse(candidate)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(
      `Invalid ${COLLECTIONS[key].singular.toLowerCase()}: ${first?.path.join('.') || 'record'} — ${first?.message}`,
      parsed.error.issues,
    )
  }
  return parsed.data as unknown as Collections[K]
}

function titleOf<K extends CollectionKey>(key: K, record: Collections[K]): string {
  try {
    return COLLECTIONS[key].title(record as never) || COLLECTIONS[key].singular
  } catch {
    return COLLECTIONS[key].singular
  }
}

function projectIdOf(key: CollectionKey, record: Record<string, unknown>): string | undefined {
  if (key === 'projects') return record.id as string
  if (key === 'tasks' || key === 'notes') return record.projectId as string | undefined
  return undefined
}

/**
 * Add an activity entry. Rapid repeat edits to the same record (e.g. ticking
 * several routine steps) are collapsed into one entry so the feed stays useful.
 */
interface ActivityInput {
  action: ActivityAction
  collection: string
  entityId: string
  label: string
  projectId?: string
  detail?: string
}

function logActivity(activity: ActivityEntry[], entry: ActivityInput, at: string): ActivityEntry[] {
  const last = activity[0]
  const next: ActivityEntry = { id: uid(), at, ...entry }
  if (
    last &&
    last.entityId === entry.entityId &&
    last.action === entry.action &&
    (entry.action === 'updated' || entry.action === 'logged') &&
    Date.parse(at) - Date.parse(last.at) < 2 * 60_000
  ) {
    return [{ ...next, id: last.id }, ...activity.slice(1)]
  }
  const out = [next, ...activity]
  return out.length > ACTIVITY_LIMIT ? out.slice(0, ACTIVITY_LIMIT) : out
}

const revOf = (r: { rev?: number } | undefined) => r?.rev ?? 0

/**
 * Unlink — never delete — records that point at `key/id` (RELATIONS), as a
 * new revision of each. Mutates the given (already copied) database and
 * returns what was unlinked, so a delete can put the links back on undo.
 */
function unlinkReferences(db: Database, key: CollectionKey, id: string, now: string): UndoToken['unlinked'] {
  const unlinked: UndoToken['unlinked'] = []
  for (const rel of RELATIONS.filter((r) => r.to === key)) {
    const rows = db[rel.from] as unknown as Record<string, unknown>[]
    if (!rows.some((row) => row[rel.field] === id)) continue
    ;(db as unknown as Record<string, unknown>)[rel.from] = rows.map((row) => {
      if (row[rel.field] !== id) return row
      unlinked.push({ key: rel.from, id: row.id as string, field: rel.field, value: id })
      const copy: Record<string, unknown> = { ...row, updatedAt: now, rev: revOf(row as { rev?: number }) + 1 }
      delete copy[rel.field]
      return copy
    })
  }
  return unlinked
}

/**
 * After an undo puts a record back to an earlier state as a new revision,
 * point older history entries that produced that state at the new revision,
 * so undoing step by step keeps working.
 */
function repoint(history: Change[], key: CollectionKey, id: string, fromRev: number, toRev: number): Change[] {
  return history.map((c) => {
    if (c.kind === 'update' && c.key === key && c.prev.id === id && c.afterRev === fromRev) return { ...c, afterRev: toRev }
    if (c.kind === 'create' && c.key === key && c.recordId === id && c.afterRev === fromRev) return { ...c, afterRev: toRev }
    return c
  })
}

/** Remember a deleted record so merges (another tab, an import) don't bring it back. */
function addDeletion(deletions: Database['deletions'] | undefined, key: CollectionKey, record: { id: string; rev?: number }, at: string): Database['deletions'] {
  return mergeDeletions(deletions ?? [], [{ key, id: record.id, rev: revOf(record), at }])
}

/** Add a change, merging rapid repeat edits of one record (autosave, typing) into one step. */
function pushHistory(history: Change[], change: Change): Change[] {
  const last = history[history.length - 1]
  if (last && change.kind === 'update' && last.kind === 'update' && last.key === change.key && last.prev.id === change.prev.id && change.action === 'updated' && last.action === 'updated' && !change.spawned && change.at - last.at < 3000) {
    return [...history.slice(0, -1), { ...change, prev: last.prev, at: change.at }]
  }
  const out = [...history, change]
  return out.length > HISTORY_LIMIT ? out.slice(-HISTORY_LIMIT) : out
}

/** The series a repeating task belongs to (older tasks, from before series ids, are their own series). */
export const seriesOf = (task: Pick<Collections['tasks'], 'id' | 'seriesId'>) => task.seriesId ?? task.id

/**
 * The next occurrence of a repeating task that was just completed — unless
 * that occurrence already exists (completed, reopened and completed again):
 * occurrences are identified by (series, due date), so there's never a second.
 */
function nextOccurrenceOf(task: Collections['tasks'], now: string, existing: readonly Collections['tasks'][]): Collections['tasks'] | undefined {
  if (!task.repeat || task.status !== 'done') return undefined
  const series = seriesOf(task)
  const dueDate = nextDueDate(task.repeat, task.dueDate, todayISO())
  const sameRule = JSON.stringify(task.repeat)
  const already = existing.some(
    (t) =>
      t.id !== task.id &&
      t.status !== 'done' &&
      t.dueDate === dueDate &&
      // Same series — or, for copies made before series ids existed, the same title and rule.
      (seriesOf(t) === series || (!t.seriesId && t.title === task.title && JSON.stringify(t.repeat) === sameRule)),
  )
  if (already) return undefined
  const rest: Record<string, unknown> = { ...task }
  for (const k of ['id', 'completedAt', 'createdAt', 'updatedAt', 'focusDate', 'rev']) delete rest[k]
  return validate('tasks', {
    ...rest,
    id: uid(),
    seriesId: series,
    createdAt: now,
    updatedAt: now,
    rev: 1,
    status: 'todo',
    dueDate,
    checklist: task.checklist.map((c) => ({ ...c, done: false, doneAt: undefined })),
  })
}

export function createAppStore(initial: Database = createEmptyDatabase()) {
  return createStore<AppState>()((set, get) => ({
    db: initial,
    history: [],
    ready: false,
    save: { status: 'idle' },

    create(key, input, opts) {
      const now = new Date().toISOString()
      const draft = { ...input, id: uid(), createdAt: now, updatedAt: now, rev: 1 }
      const record = onCreate(key, validate(key, draft), now)
      const final = validate(key, record)
      set((s) => {
        const db = { ...s.db, [key]: [final, ...(s.db[key] as Collections[typeof key][])] } as Database
        if (!opts?.silent) {
          db.activity = logActivity(
            s.db.activity,
            { action: 'created', collection: key, entityId: final.id, label: titleOf(key, final), projectId: projectIdOf(key, final as never) },
            now,
          )
        }
        // `linked` records are undone together with the change they belong to (see update's `spawned`).
        const history = opts?.silent || opts?.linked ? s.history : pushHistory(s.history, { id: uid(), kind: 'create', key, recordId: final.id, label: titleOf(key, final), at: Date.now(), afterRev: revOf(final) })
        return { db, history }
      })
      return final
    },

    update(key, id, patch, opts) {
      const list = get().db[key] as Collections[typeof key][]
      const index = list.findIndex((r) => r.id === id)
      if (index === -1) return undefined
      const prev = list[index]
      const changes = typeof patch === 'function' ? patch(prev) : patch
      const now = new Date().toISOString()
      const merged = validate(key, { ...prev, ...changes, id: prev.id, createdAt: prev.createdAt, updatedAt: now, rev: revOf(prev) + 1 })
      const { record, action, detail } = onUpdate(key, prev, merged, now)
      const final = validate(key, record)
      const resolvedAction = opts?.action ?? action
      // A repeating task that has just been completed comes back on its next date.
      const spawn = key === 'tasks' && resolvedAction === 'completed' ? nextOccurrenceOf(final as Collections['tasks'], now, get().db.tasks) : undefined
      set((s) => {
        const items = [...(s.db[key] as Collections[typeof key][])]
        const i = items.findIndex((r) => r.id === id)
        if (i === -1) return s
        items[i] = final
        const db = { ...s.db, [key]: items } as Database
        if (spawn) db.tasks = [spawn, ...db.tasks]
        if (!opts?.silent) {
          db.activity = logActivity(
            s.db.activity,
            {
              action: resolvedAction,
              collection: key,
              entityId: id,
              label: titleOf(key, final),
              projectId: projectIdOf(key, final as never),
              detail: spawn ? `Repeats — next ${spawn.dueDate}` : (opts?.detail ?? detail),
            },
            now,
          )
        }
        const history = pushHistory(s.history, {
          id: uid(),
          kind: 'update',
          key,
          prev,
          label: titleOf(key, final),
          action: resolvedAction,
          at: Date.now(),
          afterRev: revOf(final),
          spawned: spawn ? { key: 'tasks', id: spawn.id } : opts?.spawned,
        })
        return { db, history }
      })
      return final
    },

    remove(key, id) {
      const state = get()
      const list = state.db[key] as Collections[typeof key][]
      const index = list.findIndex((r) => r.id === id)
      if (index === -1) return undefined
      const record = list[index]
      const now = new Date().toISOString()
      const db = { ...state.db, [key]: list.filter((r) => r.id !== id) } as Database
      const unlinked = unlinkReferences(db, key, id, now)

      db.activity = logActivity(
        state.db.activity,
        {
          action: 'deleted',
          collection: key,
          entityId: id,
          label: titleOf(key, record),
          projectId: projectIdOf(key, record as never),
          detail: unlinked.length ? `${unlinked.length} linked record(s) kept and unlinked` : undefined,
        },
        now,
      )
      db.deletions = addDeletion(state.db.deletions, key, record, now)
      const token: UndoToken = { key, record, index, unlinked }
      set((s) => ({ db, history: pushHistory(s.history, { id: uid(), kind: 'delete', token, label: titleOf(key, record), at: Date.now() }) }))
      return token as UndoToken<typeof key>
    },

    undo(token) {
      const now = new Date().toISOString()
      let restoredRev: number | undefined
      set((s) => {
        const db = { ...s.db } as Database
        const list = [...(db[token.key] as { id: string }[])]
        if (!list.some((r) => r.id === token.record.id)) {
          // Restoring is a new change: a higher revision than the deletion, so no merge undoes it.
          const restored = { ...(token.record as { id: string }), updatedAt: now, rev: revOf(token.record) + 1 }
          list.splice(Math.min(token.index, list.length), 0, restored)
          restoredRev = restored.rev
        }
        ;(db as unknown as Record<string, unknown>)[token.key] = list
        db.deletions = (s.db.deletions ?? []).filter((m) => !(m.key === token.key && m.id === token.record.id))
        for (const link of token.unlinked) {
          const rows = db[link.key] as unknown as Record<string, unknown>[]
          ;(db as unknown as Record<string, unknown>)[link.key] = rows.map((row) =>
            row.id === link.id && row[link.field] === undefined ? { ...row, [link.field]: link.value, updatedAt: now, rev: revOf(row as { rev?: number }) + 1 } : row,
          )
        }
        db.activity = logActivity(
          s.db.activity,
          {
            action: 'restored',
            collection: token.key,
            entityId: token.record.id,
            label: titleOf(token.key, token.record),
            projectId: projectIdOf(token.key, token.record as never),
          },
          now,
        )
        // The change is undone; it can't be undone twice. Earlier edits of the record stay undoable.
        let history = s.history.filter((c) => !(c.kind === 'delete' && c.token === token))
        if (restoredRev !== undefined) history = repoint(history, token.key, token.record.id, revOf(token.record), restoredRev)
        return { db, history }
      })
    },

    undoLast() {
      const last = get().history[get().history.length - 1]
      if (!last) return undefined
      const undone = get().undoChange(last.id)
      // A change that can no longer be undone safely never will be: drop it so older ones stay reachable.
      if (!undone) set((s) => ({ history: s.history.filter((c) => c.id !== last.id) }))
      return { change: last, undone }
    },

    undoChange(changeId) {
      const change = get().history.find((c) => c.id === changeId)
      if (!change) return false
      if (change.kind === 'delete') {
        get().undo(change.token)
        return true
      }
      const state = get()
      const rowsOf = (key: CollectionKey) => state.db[key] as unknown as { id: string; rev?: number }[]
      // Compare-and-swap: only undo while the record is exactly as this change left it.
      if (change.kind === 'create') {
        const current = rowsOf(change.key).find((r) => r.id === change.recordId)
        if (current && revOf(current) !== change.afterRev) return false
      } else {
        const current = rowsOf(change.key).find((r) => r.id === change.prev.id)
        if (!current || revOf(current) !== change.afterRev) return false
        if (change.spawned) {
          const spawned = rowsOf(change.spawned.key).find((r) => r.id === change.spawned!.id)
          if (spawned && revOf(spawned) > 1) return false
        }
      }
      const now = new Date().toISOString()
      set((s) => {
        const db = { ...s.db } as Database
        const rows = db as unknown as Record<string, { id: string; rev?: number }[]>
        let entityId: string
        let deletions = s.db.deletions ?? []
        let history = s.history.filter((c) => c.id !== changeId)
        const drop = (key: CollectionKey, id: string) => {
          const record = rows[key].find((r) => r.id === id)
          if (!record) return
          rows[key] = rows[key].filter((r) => r.id !== id)
          deletions = addDeletion(deletions, key, record, now)
          // Anything linked to it in the meantime is unlinked, exactly as a delete would.
          unlinkReferences(db, key, id, now)
        }
        if (change.kind === 'create') {
          drop(change.key, change.recordId)
          entityId = change.recordId
        } else {
          const current = rows[change.key].find((r) => r.id === change.prev.id)
          // The old values come back as a new revision, so merges treat the undo as the latest edit.
          const restored = { ...(change.prev as { id: string }), updatedAt: now, rev: revOf(current ?? change.prev) + 1 }
          rows[change.key] = rows[change.key].map((r) => (r.id === change.prev.id ? restored : r))
          if (change.spawned) drop(change.spawned.key, change.spawned.id)
          entityId = change.prev.id
          history = repoint(history, change.key, change.prev.id, revOf(change.prev), restored.rev)
        }
        db.deletions = deletions
        db.activity = logActivity(s.db.activity, { action: 'restored', collection: change.key, entityId, label: change.label, detail: change.kind === 'create' ? 'Undid adding' : 'Undid change' }, now)
        return { db, history }
      })
      return true
    },

    updateSettings(patch) {
      set((s) => ({ db: { ...s.db, settings: normaliseSettings({ ...s.db.settings, ...patch }) } }))
    },

    replaceDatabase(db) {
      // Imports and restores aren't undoable step by step (they take a backup instead).
      set({ db: { ...db, deletions: db.deletions ?? [], settings: normaliseSettings(db.settings) }, history: [] })
    },

    clearActivity() {
      set((s) => ({ db: { ...s.db, activity: [] } }))
    },
  }))
}

/** The app-wide store instance. */
export const appStore = createAppStore()

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}

export function useCollection<K extends CollectionKey>(key: K): Collections[K][] {
  return useStore(appStore, (s) => s.db[key] as Collections[K][])
}

export function useRecord<K extends CollectionKey>(key: K, id: string | undefined): Collections[K] | undefined {
  return useStore(appStore, (s) => (id ? (s.db[key] as Collections[K][]).find((r) => r.id === id) : undefined))
}

export function useSettings(): Settings {
  return useStore(appStore, (s) => s.db.settings)
}

export function useDatabase(): Database {
  return useStore(appStore, (s) => s.db)
}

/** Imperative access for event handlers (no re-render subscription). */
export const actions = {
  create: <K extends CollectionKey>(key: K, input: Partial<InputOf<K>>, opts?: { silent?: boolean; linked?: boolean }) => appStore.getState().create(key, input, opts),
  update: <K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<InputOf<K>> | ((current: Collections[K]) => Partial<InputOf<K>>),
    opts?: { action?: ActivityAction; silent?: boolean; detail?: string; spawned?: { key: CollectionKey; id: string } },
  ) => appStore.getState().update(key, id, patch, opts),
  remove: <K extends CollectionKey>(key: K, id: string) => appStore.getState().remove(key, id),
  undo: (token: UndoToken) => appStore.getState().undo(token),
  undoLast: () => appStore.getState().undoLast(),
  undoChange: (id: string) => appStore.getState().undoChange(id),
  updateSettings: (patch: Partial<Settings>) => appStore.getState().updateSettings(patch),
  getDb: () => appStore.getState().db,
  get: <K extends CollectionKey>(key: K, id: string) => (appStore.getState().db[key] as Collections[K][]).find((r) => r.id === id),
}
