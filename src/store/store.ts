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
import { todayISO } from '@/lib/dates'
import { nextDueDate } from '@/lib/recurrence'
import { uid } from '@/lib/utils'
import { onCreate, onUpdate } from './lifecycle'

export const ACTIVITY_LIMIT = 3000

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
  | { id: string; kind: 'update'; key: CollectionKey; prev: Collections[CollectionKey]; label: string; action: ActivityAction; at: number; spawned?: { key: CollectionKey; id: string } }
  | { id: string; kind: 'create'; key: CollectionKey; recordId: string; label: string; at: number }
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
  /** Undo the most recent change; returns what was undone. */
  undoLast(): Change | undefined
  /** Undo a specific change (from its notification). */
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

/** Add a change, merging rapid repeat edits of one record (autosave, typing) into one step. */
function pushHistory(history: Change[], change: Change): Change[] {
  const last = history[history.length - 1]
  if (last && change.kind === 'update' && last.kind === 'update' && last.key === change.key && last.prev.id === change.prev.id && change.action === 'updated' && last.action === 'updated' && !change.spawned && change.at - last.at < 3000) {
    return [...history.slice(0, -1), { ...change, prev: last.prev, at: change.at }]
  }
  const out = [...history, change]
  return out.length > HISTORY_LIMIT ? out.slice(-HISTORY_LIMIT) : out
}

/** The next occurrence of a repeating task that was just completed. */
function nextOccurrenceOf(task: Collections['tasks'], now: string): Collections['tasks'] | undefined {
  if (!task.repeat || task.status !== 'done') return undefined
  const rest: Record<string, unknown> = { ...task }
  for (const k of ['id', 'completedAt', 'createdAt', 'updatedAt', 'focusDate']) delete rest[k]
  return validate('tasks', {
    ...rest,
    id: uid(),
    createdAt: now,
    updatedAt: now,
    status: 'todo',
    dueDate: nextDueDate(task.repeat, task.dueDate, todayISO()),
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
      const draft = { ...input, id: uid(), createdAt: now, updatedAt: now }
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
        const history = opts?.silent || opts?.linked ? s.history : pushHistory(s.history, { id: uid(), kind: 'create', key, recordId: final.id, label: titleOf(key, final), at: Date.now() })
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
      const merged = validate(key, { ...prev, ...changes, id: prev.id, createdAt: prev.createdAt, updatedAt: now })
      const { record, action, detail } = onUpdate(key, prev, merged, now)
      const final = validate(key, record)
      const resolvedAction = opts?.action ?? action
      // A repeating task that has just been completed comes back on its next date.
      const spawn = key === 'tasks' && resolvedAction === 'completed' ? nextOccurrenceOf(final as Collections['tasks'], now) : undefined
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
      const unlinked: UndoToken['unlinked'] = []
      const db = { ...state.db, [key]: list.filter((r) => r.id !== id) } as Database

      // Unlink — never delete — records that referenced this one.
      for (const rel of RELATIONS.filter((r) => r.to === key)) {
        const rows = db[rel.from] as unknown as Record<string, unknown>[]
        if (!rows.some((row) => row[rel.field] === id)) continue
        ;(db as unknown as Record<string, unknown>)[rel.from] = rows.map((row) => {
          if (row[rel.field] !== id) return row
          unlinked.push({ key: rel.from, id: row.id as string, field: rel.field, value: id })
          const copy: Record<string, unknown> = { ...row, updatedAt: now }
          delete copy[rel.field]
          return copy
        })
      }

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
      const token: UndoToken = { key, record, index, unlinked }
      set((s) => ({ db, history: pushHistory(s.history, { id: uid(), kind: 'delete', token, label: titleOf(key, record), at: Date.now() }) }))
      return token as UndoToken<typeof key>
    },

    undo(token) {
      const now = new Date().toISOString()
      set((s) => {
        const db = { ...s.db } as Database
        const list = [...(db[token.key] as { id: string }[])]
        if (!list.some((r) => r.id === token.record.id)) {
          list.splice(Math.min(token.index, list.length), 0, token.record as { id: string })
        }
        ;(db as unknown as Record<string, unknown>)[token.key] = list
        for (const link of token.unlinked) {
          const rows = db[link.key] as unknown as Record<string, unknown>[]
          ;(db as unknown as Record<string, unknown>)[link.key] = rows.map((row) =>
            row.id === link.id && row[link.field] === undefined ? { ...row, [link.field]: link.value } : row,
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
        // The change is undone; it can't be undone twice.
        return { db, history: s.history.filter((c) => !(c.kind === 'delete' && c.token === token)) }
      })
    },

    undoLast() {
      const last = get().history[get().history.length - 1]
      if (!last) return undefined
      get().undoChange(last.id)
      return last
    },

    undoChange(changeId) {
      const change = get().history.find((c) => c.id === changeId)
      if (!change) return false
      if (change.kind === 'delete') {
        get().undo(change.token)
        return true
      }
      const now = new Date().toISOString()
      set((s) => {
        const db = { ...s.db } as Database
        const rows = db as unknown as Record<string, { id: string }[]>
        let entityId: string
        if (change.kind === 'create') {
          rows[change.key] = rows[change.key].filter((r) => r.id !== change.recordId)
          entityId = change.recordId
        } else {
          rows[change.key] = rows[change.key].map((r) => (r.id === change.prev.id ? (change.prev as { id: string }) : r))
          if (change.spawned) rows[change.spawned.key] = rows[change.spawned.key].filter((r) => r.id !== change.spawned!.id)
          entityId = change.prev.id
        }
        db.activity = logActivity(s.db.activity, { action: 'restored', collection: change.key, entityId, label: change.label, detail: change.kind === 'create' ? 'Undid adding' : 'Undid change' }, now)
        return { db, history: s.history.filter((c) => c.id !== changeId) }
      })
      return true
    },

    updateSettings(patch) {
      set((s) => ({ db: { ...s.db, settings: normaliseSettings({ ...s.db.settings, ...patch }) } }))
    },

    replaceDatabase(db) {
      // Imports and restores aren't undoable step by step (they take a backup instead).
      set({ db: { ...db, settings: normaliseSettings(db.settings) }, history: [] })
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
