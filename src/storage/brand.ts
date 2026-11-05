/**
 * Storage identity. The app was called LIFE OS before it became ATLAS, and
 * everything it kept on a device — the IndexedDB database, localStorage keys,
 * backup files — was named `life-os`. New data uses `atlas`; this module
 * moves anything still under the old name across exactly once, so nobody
 * opens the renamed app to an empty screen.
 */

/** Prefix for every key, database, channel and file name the app owns. */
export const APP_KEY = 'atlas'
/** The name the same data was stored under before the rename. */
export const LEGACY_APP_KEY = 'life-os'

/** `atlas:<name>` — the namespaced localStorage key for `name`. */
export const storageKey = (name: string) => `${APP_KEY}:${name}`

const LEGACY_PREFIX = `${LEGACY_APP_KEY}:`

/**
 * Move every `life-os:*` localStorage entry to its `atlas:*` key. Safe to
 * call any number of times: once nothing old is left it does nothing.
 *
 * - An `atlas:*` value that already exists wins; the old copy is dropped.
 * - The old entry is removed *before* the new one is written, so a value
 *   close to the ~5 MB quota still fits. If the write fails anyway, the old
 *   entry is put back and the move stops — nothing is ever lost, it just
 *   tries again next launch.
 *
 * Returns how many entries were moved.
 */
export function migrateLegacyLocalStorage(store: Storage | undefined = globalThis.localStorage): number {
  if (!store) return 0
  let legacyKeys: string[]
  try {
    legacyKeys = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key)
    }
  } catch {
    return 0 // storage blocked (private mode, disabled site data)
  }

  let moved = 0
  for (const oldKey of legacyKeys) {
    const newKey = storageKey(oldKey.slice(LEGACY_PREFIX.length))
    try {
      const value = store.getItem(oldKey)
      if (value === null) continue
      if (store.getItem(newKey) !== null) {
        store.removeItem(oldKey)
        continue
      }
      store.removeItem(oldKey)
      try {
        store.setItem(newKey, value)
        moved++
      } catch {
        store.setItem(oldKey, value)
        return moved
      }
    } catch {
      return moved
    }
  }
  return moved
}
