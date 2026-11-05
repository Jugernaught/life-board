# Architecture

This document explains how ATLAS is put together, so you (or a future contributor) can change it with confidence.

## Data flow

```
 ┌──────────────┐  actions.create / update / remove   ┌──────────────────────┐
 │  Screens &   │ ──────────────────────────────────▶ │  Store (Zustand)     │
 │  components  │ ◀────────────────────────────────── │  src/store/store.ts  │
 └──────────────┘   useCollection('tasks') etc.        │  • Zod validation    │
        ▲                                              │  • lifecycle rules   │
        │ derived numbers                              │  • activity log      │
 ┌──────┴───────┐                                      │  • undo tokens       │
 │  Selectors   │ (pure functions, unit tested)        └─────────┬────────────┘
 │ src/selectors│                                                │ subscribe
 └──────────────┘                                      ┌─────────▼────────────┐
                                                       │ Persistence          │
                                                       │ debounced save,      │
                                                       │ write-ahead stash,   │
                                                       │ cross-tab sync,      │
                                                       │ daily backups        │
                                                       └─────────┬────────────┘
                                                                 │ StorageAdapter
                                                       ┌─────────▼────────────┐
                                                       │ IndexedDB (default)  │
                                                       │ localStorage/memory  │
                                                       └──────────────────────┘
```

1. **One database object.** All records live in a single `Database` object (`src/data/types.ts`) with one array per collection (`tasks`, `events`, `transactions`, …) plus `settings` and an `activity` log.
2. **Changes only go through actions.** `create`, `update`, `remove` and `undo` in `src/store/store.ts` validate every record against its Zod schema, apply domain rules from `src/store/lifecycle.ts` (completion timestamps, application status history, goal progress history, skill level history) and log activity.
3. **Deleting never cascades.** Records that point at a deleted record are *unlinked*, not deleted (see `RELATIONS` in `src/data/registry.ts`). Undo restores the record and its links.
4. **Numbers are derived, never stored.** Streaks, budgets, grades, progress, agenda items and analytics are computed on the fly by selectors in `src/selectors/`. There is nothing to get out of sync.
5. **Persistence** (`src/store/persistence.ts`) watches the store and saves 250 ms after the last change, flushes when the tab is hidden, stashes unsaved changes synchronously on page close, and notifies other tabs via `BroadcastChannel`.

## The data model

`src/data/schema.ts` is the source of truth. Each collection is declared with an `entity({...})` helper which produces:

- `input` — the editable fields (used by forms), and
- `record` — the same fields plus `id`, `createdAt`, `updatedAt` (used by the store and imports).

Schemas use `z.looseObject`, so unknown fields are **kept** rather than stripped. Dates are stored as local `yyyy-MM-dd` strings, moments in time as ISO timestamps, and money as integer pence (minor units) to avoid floating-point errors.

`src/data/registry.ts` holds metadata for each collection: names, which section/tab shows it, how to title and search it, and which fields reference other collections.

## Forms

Every create/edit dialog is generated from a `FormConfig` in `src/forms/` (one file per area) and rendered by `EntityForm`. A config lists fields (`text`, `money`, `date`, `select`, `checklist`, `custom`, …), defaults, optional cross-field `validate` rules and a `prepare` step. Validation always runs the record's Zod schema, so a form can never save something the data model rejects.

`EditorHost` renders a global dialog for any collection: `editor.create('tasks', defaults)` or `editor.edit('goals', id)` work from anywhere, and so do deep links like `/goals?open=goals:<id>` (used by search and the activity feed).

## Adding a field

1. Add it to the schema in `src/data/schema.ts` (make it `.optional()` or give it a `.default()` so existing data stays valid).
2. Add it to the form config in `src/forms/…`.
3. Show it where it's useful.

Because the field is optional/defaulted, no migration is needed.

## Changing the shape of data (migrations)

If you rename or restructure data, bump `SCHEMA_VERSION` in `schema.ts` and add a function to `MIGRATIONS` in `src/data/validate.ts` that upgrades from the previous version. Migrations run on start-up and on import. Data from a *newer* version than the app understands is refused (with a clear message) rather than risk losing fields.

## The LIFE OS → ATLAS rename

The app used to be called LIFE OS, and everything it stored was named `life-os`. Everything is now named `atlas` (`src/storage/brand.ts` holds the prefix; use `storageKey('name')` for any new localStorage key). Existing users are moved across once, automatically, without any risk of an empty start:

| What | Before | Now | How it moves |
| --- | --- | --- | --- |
| IndexedDB database | `life-os` | `atlas` | `migrateLegacyDatabase` (`src/storage/indexedDb.ts`): only if `atlas` is empty, copies state + every backup in one transaction, then deletes `life-os`. If the copy fails the app runs from `life-os` that session and retries next launch. It never creates `life-os` on a fresh install. |
| localStorage keys | `life-os:*` | `atlas:*` | `migrateLegacyLocalStorage` (`src/storage/brand.ts`), run at the top of both entry points and again by `createStorage`. Removes the old key first so a near-quota value still fits, and puts it back if the write fails. An existing `atlas:*` value always wins. The pre-paint theme scripts in `index.html`/`m/index.html` read either name. |
| Backup files | `"app": "life-os"`, `life-os-backup-*.json` | `"app": "atlas"`, `atlas-backup-*.json` | `unwrapBackup` accepts both ids (`LEGACY_BACKUP_APP_IDS`). |
| iPhone offline cache | `life-os-m-*` | `atlas-m-*` | The service worker deletes old caches of either name. |
| Desktop profile folder / origin | `%APPDATA%\LIFE OS` (or `%APPDATA%\life-os` from an interim build), `app://life-os` | `%APPDATA%\ATLAS`, `app://atlas` | `electron/profile.cjs`: an install that already has a LIFE OS profile keeps using that folder *and* origin (changing either would hide the data); inside it the web-side moves above apply. |
| Windows `appId` | `app.lifeos.desktop` | unchanged | Kept on purpose: it identifies the installed app, so the ATLAS installer upgrades LIFE OS in place instead of installing beside it. Never shown to users. |

Covered by `src/storage/brand.test.ts`, `electron/profile.test.ts` and `e2e/rename.spec.ts` (seeds a real browser with LIFE OS-era storage and opens ATLAS).

## Adding a new collection

1. Add an `entity({...})` schema and register it in `collectionSchemas` (schema.ts).
2. Add its type to `Collections` (types.ts) and metadata to `COLLECTIONS` (registry.ts), plus any `RELATIONS`.
3. Add a form config and register it in `src/forms/registry.ts`.
4. Build the screen in `src/features/…`.

## The iPhone app (`/m/`)

A second Vite entry (`m/index.html` → `src/mobile/main.tsx`) renders a separate iOS-style shell over the **same** data layer — `src/data`, `src/lib`, `src/selectors`, `src/store`, `src/storage` and the form configs are shared unchanged, and both apps open the same IndexedDB database. Only the UI is separate:

- `src/mobile/nav/` — the navigator. `paths.ts` lists every screen path (first segment = tab); `navigator.ts` keeps one stack per tab (push on top within a tab, pop back to a screen already in the stack, rebuild the stack when opening another tab's screen), mirrors the top screen into the URL hash, and is unit-tested. `StackView` animates push/pop with parallax and handles the left-edge swipe; tabs mount the first time they are opened, then stay mounted so scroll position and state survive.
- `src/mobile/ui/` — the UI kit: `Screen` (large titles, nav bar with UIKit-style back label), grouped lists, `SwipeRow`, `Sheet`, `ActionSheet` (also renders the shared confirm dialog), segmented control, switch, chips, star rating.
- `src/mobile/editor/` — the shared editor store rendered as bottom sheets (with an unsaved-changes guard) and Quick Add.
- `src/mobile/screens/` — one folder per section. Screens are lazy-loaded; charts live only in screens that draw them so the chart library isn't part of the first load.
- `src/mobile/ios.css` — iOS tokens scoped to `<html data-shell="ios">`, so the desktop styles are untouched. Safe areas go through `--safe-*` variables (tests inject notch values); `--kb` is the on-screen keyboard height from `visualViewport`.
- Offline: a Vite plugin in `vite.config.ts` writes `/m/sw.js` at build time with a precache list of everything the iPhone entry can load (network-first for the page, cache-first for hashed assets, `ignoreVary` because module scripts are requested with an `Origin` header).
- Code splitting (`vite.config.ts`): React, charts, animation, router and other vendor code go into separate long-lived chunks; groups don't pull in their dependencies, so React never ends up inside the charts chunk.

## Styling

Four interchangeable themes — **Liquid Glass** (default), **Apple Clean**, **Cyberpunk** and **Minimal Dark** — are pure design tokens. `src/app/themes.ts` is the registry; `src/styles/themes.css` holds every token (palette, type, shape, the three materials `surface` / `chrome` / `float`, effects, layout, navigation, controls, motion) keyed by `data-style`, `data-theme`, `data-accent`, `data-transparency` and `data-effects` on `<html>` (set by `ThemeController`, or `useAppearance` on iPhone). Shared utilities in `src/styles/index.css` (`panel`, `chrome`, `float`, `glass-button`, `eyebrow`, `title`, `hud`, `chamfer`, `cyber-only`, `not-cyber`) consume them, so components never hard-code a theme. Token selectors aren't tied to `:root`, which lets the Appearance page render live previews of other themes. Chart series colours (`--color-chart-1…6`) were validated for colour-vision deficiency and contrast in light and dark. Full details, how to add a theme, and how contrast is verified: [`THEMES.md`](THEMES.md).

## Testing

- `src/**/*.test.ts(x)` — Vitest unit and component tests (jsdom; `fake-indexeddb` for the IndexedDB adapter).
- `e2e/*.spec.ts` — Playwright browser tests against a production build: `core`/`sections` on desktop, `mobile` (desktop app) on an Android phone, `ios` (the iPhone app) on iPhone SE, 15 Pro and 16 Pro Max. `e2e/fixtures/sampleData.ts` builds a sample backup **for tests only**; it is never bundled into the app.
