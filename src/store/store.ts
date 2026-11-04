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

export interface AppState {
  db: Database
  ready: boolean
  /** Set when stored data could not be read. Saving is disabled until resolved. */
  loadError?: { message: string; raw?: unknown }
  /** Shown once after startup, e.g. when unreadable records were set aside. */
  notice?: string
  storage?: StorageInfo
  save: { status: SaveStatus; lastSavedAt?: string; error?: string }

  create<K extends CollectionKey>(key: K, input: Partial<InputOf<K>>, opts?: { silent?: boolean }): Collections[K]
  update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<InputOf<K>> | ((current: Collections[K]) => Partial<InputOf<K>>),
    opts?: { action?: ActivityAction; silent?: boolean; detail?: string },
  ): Collections[K] | undefined
  remove<K extends CollectionKey>(key: K, id: string): UndoToken<K> | undefined
  undo(token: UndoToken): void
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

export function createAppStore(initial: Database = createEmptyDatabase()) {
  return createStore<AppState>()((set, get) => ({
    db: initial,
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
        return { db }
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
      set((s) => {
        const items = [...(s.db[key] as Collections[typeof key][])]
        const i = items.findIndex((r) => r.id === id)
        if (i === -1) return s
        items[i] = final
        const db = { ...s.db, [key]: items } as Database
        if (!opts?.silent) {
          db.activity = logActivity(
            s.db.activity,
            {
              action: opts?.action ?? action,
              collection: key,
              entityId: id,
              label: titleOf(key, final),
              projectId: projectIdOf(key, final as never),
              detail: opts?.detail ?? detail,
            },
            now,
          )
        }
        return { db }
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
      set({ db })
      return { key, record, index, unlinked }
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
        return { db }
      })
    },

    updateSettings(patch) {
      set((s) => ({ db: { ...s.db, settings: normaliseSettings({ ...s.db.settings, ...patch }) } }))
    },

    replaceDatabase(db) {
      set({ db: { ...db, settings: normaliseSettings(db.settings) } })
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
  create: <K extends CollectionKey>(key: K, input: Partial<InputOf<K>>, opts?: { silent?: boolean }) => appStore.getState().create(key, input, opts),
  update: <K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<InputOf<K>> | ((current: Collections[K]) => Partial<InputOf<K>>),
    opts?: { action?: ActivityAction; silent?: boolean; detail?: string },
  ) => appStore.getState().update(key, id, patch, opts),
  remove: <K extends CollectionKey>(key: K, id: string) => appStore.getState().remove(key, id),
  undo: (token: UndoToken) => appStore.getState().undo(token),
  updateSettings: (patch: Partial<Settings>) => appStore.getState().updateSettings(patch),
  getDb: () => appStore.getState().db,
  get: <K extends CollectionKey>(key: K, id: string) => (appStore.getState().db[key] as Collections[K][]).find((r) => r.id === id),
}
