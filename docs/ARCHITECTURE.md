# Architecture

This document explains how LIFE OS is put together, so you (or a future contributor) can change it with confidence.

> The code is the source of truth. If this page disagrees with it, fix this page.

## Entry points and file map

| Entry | Loads | What it is |
| --- | --- | --- |
| `index.html` | `src/main.tsx` → `src/app/App.tsx` | Desktop app (`/`). React Router routes are listed in `App.tsx`, and the sidebar order comes from `NAV_ITEMS` in `src/app/navigation.ts`. |
| `m/index.html` | `src/mobile/main.tsx` → `MobileApp.tsx` | iPhone app (`/m/`). See "The iPhone app" below and `src/mobile/CLAUDE.md`. |
| `electron/main.cjs` | the built `dist/` | Windows app (Electron, NSIS installer; `npm run electron:build`). |

| Folder | Contents |
| --- | --- |
| `src/data/` | Zod schemas (`schema.ts`), TypeScript types (`types.ts`), collection metadata and `RELATIONS` (`registry.ts`), empty database (`defaults.ts`), validation, migrations and merge (`validate.ts`) |
| `src/store/` | The store and undo history (`store.ts`), domain rules (`lifecycle.ts`), saving and cross-tab safety (`persistence.ts`), backups, import and restore (`backups.ts`) |
| `src/storage/` | `StorageAdapter` implementations: IndexedDB (default), localStorage, memory (tests) |
| `src/selectors/` | Pure functions that derive numbers and lists (agenda, streaks, budgets, analytics, …) |
| `src/forms/` | One `FormConfig` per area, `registry.ts`, and natural-language parsing (`smart.ts`) |
| `src/app/` | App shell, themes, and shared commands used by both apps: `taskCommands.ts` (`quickCreateTask`, `reschedule`, `rescheduleMany`, `duplicateTask`, `setSubtasks`), `financeCommands.ts` (`logRecurring`), `reminders.ts` (in-app and system notifications while the app is open), `useChangeToasts.ts` (`announceUndo`, `undoWithNotice`), `textScaleCss.ts` (the text-size build transform) |
| `src/features/` | Desktop screens, one folder per section (plus `planday`, `start` / getting started, `onboarding`) |
| `src/components/` | Shared desktop UI: `ui` (Panel, Button, Checkbox, EmptyState, …), `layout`, `editor` (EntityForm, EditorHost), `command` (search palette, Quick add, toasts), `charts`, `shared` |
| `src/lib/` | Dates (`dates.ts`, including `localInstant`), recurrence, formatting, utilities |
| `src/mobile/` | The iPhone app UI |
| `e2e/` | Playwright tests and the test-only sample fixture (see `e2e/CLAUDE.md`) |

**Dependencies:**
- **Runtime:** React 19, react-router, zustand (state), zod (validation), date-fns, framer-motion (motion), recharts (charts, lazy-loaded), lucide-react (icons), @fontsource fonts (bundled, so no font CDN).
- **Build:** Vite (Rolldown and Lightning CSS) and Tailwind v4.
- **Test:** Vitest with jsdom and fake-indexeddb, and Playwright.
- **Windows build:** Electron and electron-builder.

## Data flow

```
 ┌──────────────┐  actions.create / update / remove   ┌──────────────────────┐
 │  Screens &   │ ──────────────────────────────────▶ │  Store (Zustand)     │
 │  components  │ ◀────────────────────────────────── │  src/store/store.ts  │
 └──────────────┘   useCollection('tasks') etc.        │  • Zod validation    │
        ▲                                              │  • lifecycle rules   │
        │ derived numbers                              │  • activity log      │
 ┌──────┴───────┐                                      │  • rev + undo history│
 │  Selectors   │ (pure functions, unit tested)        └─────────┬────────────┘
 │ src/selectors│                                                │ subscribe
 └──────────────┘                                      ┌─────────▼────────────┐
                                                       │ Persistence          │
                                                       │ debounced save,      │
                                                       │ write-ahead stash,   │
                                                       │ cross-tab lock+merge,│
                                                       │ daily backups        │
                                                       └─────────┬────────────┘
                                                                 │ StorageAdapter
                                                       ┌─────────▼────────────┐
                                                       │ IndexedDB (default)  │
                                                       │ localStorage/memory  │
                                                       └──────────────────────┘
```

1. **One database object.** All records live in a single `Database` object (`src/data/types.ts`) with one array per collection (`tasks`, `events`, `transactions`, …), plus `settings`, an `activity` log (capped at 3,000 entries) and `deletions` (deletion markers; see below).
2. **Changes only go through actions.** `create`, `update`, `remove`, `undo` and `undoChange` in `src/store/store.ts` validate every record against its Zod schema, apply domain rules from `src/store/lifecycle.ts`, bump the record's `rev`, log activity and record undo history. The domain rules are: completion timestamps and dates (tasks, media, learning courses), the next copy of a repeating task, application status history, goal progress history and skill level history.
3. **Deleting never cascades.** Records that point at a deleted record are *unlinked*, not deleted (see `RELATIONS` in `src/data/registry.ts`). Undo restores the record and its links.
4. **Numbers are derived, never stored.** Streaks, budgets, grades, progress, agenda items and analytics are computed on the fly by selectors in `src/selectors/`. There is nothing to get out of sync.
5. **Persistence** (`src/store/persistence.ts`) watches the store and saves 250 ms after the last change. It flushes when the tab is hidden, stashes unsaved changes synchronously to localStorage on page close (including a save still in flight) and restores them on the next start, and takes a safety backup about every 20 hours. If some records can't be read at startup, an exact copy of the stored data is kept as a backup before they are set aside, and the cleaned data is saved once (so it isn't backed up again on every launch).

## Revisions, deletions and undo

- **`rev`.** Every record carries an integer `rev` (`base` in `schema.ts`; optional, so older data reads as 0). `create` sets 1, and every `update`, restore or undo sets the current value + 1. Ordering never depends on device clocks.
- **Deletion markers.** `remove` adds `{ key, id, rev, at }` to `db.deletions`. Undoing the delete removes the marker. Markers older than 180 days are pruned, and at most 5,000 are kept.
- **Merging** (`mergeDatabases` in `validate.ts`, used by merge-import and cross-tab saves):
  - Between two copies of a record, the higher `rev` wins; on a tie, the later `updatedAt` wins.
  - A record survives a deletion marker only if its `rev` is higher than the marker's, which means it was edited after the delete.
  - The result reports the number of records `added`, `updated`, `kept` and `removed`.
- **Undo history** (`HISTORY_LIMIT` 50 changes) records each change with `afterRev`. `undoChange` is **compare-and-swap**:
  - It applies only if the record's current `rev` still equals `afterRev`, and any task spawned by the change is untouched.
  - Otherwise it refuses with "Can't undo — it's been changed since" (`announceUndo`) rather than overwrite newer work.
  - After a successful undo, older history entries for that record are repointed to the new `rev`, so several undos in a row still work.
- **Undoing a create** unlinks the records that pointed at it (`unlinkReferences`, shared with `remove`).
- **Repeating tasks** carry `seriesId`, the id of the first task in the series. An occurrence's identity is (series, due date), so completing, reopening and completing again never spawns a second copy.

## Several tabs at once

- Saves run inside a Web Lock (`navigator.locks`, named `life-os-db`) when the browser supports it.
- Each save writes a stamp to localStorage (`life-os:save-stamp`) and announces itself on the `BroadcastChannel` `life-os`.
- If another tab saved since this tab last loaded, the save first reads the stored copy, merges it with `mergeDatabases`, applies the result, and only then writes. Two tabs editing different records therefore both keep their work.
- A tab with no pending save simply reloads the newer data.
- **Known limits:**
  - Settings are a single object, so the tab that saves last wins.
  - A delete in one place and a later edit of the same record in another keeps the edit (by design).

## Times and DST

- Calendar dates are local `yyyy-MM-dd` strings, and repeat rules are date-only, so a clock change can't move or duplicate an occurrence.
- Wall-clock moments (reminders) come from `localInstant(date, time)` in `src/lib/dates.ts`:
  - An ambiguous fall-back time resolves to the **first** occurrence.
  - A time skipped by spring-forward moves **forward**.
- The policy is tested under `Europe/London` in `src/lib/dst.test.ts`.

## The data model

`src/data/schema.ts` is the source of truth. Each collection is declared with an `entity({...})` helper which produces:

- `input` — the editable fields (used by forms), and
- `record` — the same fields plus `id`, `createdAt`, `updatedAt` and `rev` (used by the store and imports).

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

## Adding a new collection

1. Add an `entity({...})` schema and register it in `collectionSchemas` (schema.ts).
2. Add its type to `Collections` (types.ts) and metadata to `COLLECTIONS` (registry.ts), plus any `RELATIONS`.
3. Add a form config and register it in `src/forms/registry.ts`.
4. Build the screen in `src/features/…`.

## The iPhone app (`/m/`)

A second Vite entry (`m/index.html` → `src/mobile/main.tsx`) renders a separate iOS-style shell over the **same** data layer — `src/data`, `src/lib`, `src/selectors`, `src/store`, `src/storage` and the form configs are shared unchanged, and both apps open the same IndexedDB database. Only the UI is separate:

- `src/mobile/nav/` — the navigator. `tabContext.ts` holds what the root tab screens show (Plan mode and day, Habits segment), so the floating action button does exactly what the screen's own "+" would. `paths.ts` lists every screen path (first segment = tab); `navigator.ts` keeps one stack per tab (push on top within a tab, pop back to a screen already in the stack, rebuild the stack when opening another tab's screen), mirrors the top screen into the URL hash, and is unit-tested. `StackView` animates push/pop with parallax and handles the left-edge swipe; tabs mount the first time they are opened, then stay mounted so scroll position and state survive.
- `src/mobile/ui/` — the UI kit: `Screen` (large titles, nav bar with UIKit-style back label), grouped lists, `SwipeRow`, `Sheet`, `ActionSheet` (also renders the shared confirm dialog), segmented control, switch, chips, star rating.
- `src/mobile/editor/` — the shared editor store rendered as bottom sheets (with an unsaved-changes guard) and Quick Add.
- `src/mobile/screens/` — one folder per section. Screens are lazy-loaded; charts live only in screens that draw them so the chart library isn't part of the first load.
- `src/mobile/ios.css` — iOS tokens scoped to `<html data-shell="ios">`, so the desktop styles are untouched. Safe areas go through `--safe-*` variables (tests inject notch values); `--kb` is the on-screen keyboard height from `visualViewport`.
- Offline: a Vite plugin in `vite.config.ts` writes `/m/sw.js` at build time with a precache list of everything the iPhone entry can load (network-first for the page, cache-first for hashed assets, `ignoreVary` because module scripts are requested with an `Origin` header).
- Base path: `BASE_PATH` (GitHub Pages deploy) lets one build run at a domain root or a sub-path. Both apps and the service worker follow it.
- Text size: the `life-os:text-scale` Vite plugin rewrites every `font-size` in app CSS to multiply by `--text-scale` (`src/app/textScaleCss.ts`). That's why components need no special handling; an inline `style={{ fontSize }}` isn't scaled.
- Code splitting (`vite.config.ts`): React, charts, animation, router and other vendor code go into separate long-lived chunks; groups don't pull in their dependencies, so React never ends up inside the charts chunk.

## Styling

Four interchangeable themes — **Liquid Glass** (default), **Apple Clean**, **Cyberpunk** and **Minimal Dark** — are pure design tokens. `src/app/themes.ts` is the registry; `src/styles/themes.css` holds every token (palette, type, shape, the three materials `surface` / `chrome` / `float`, effects, layout, navigation, controls, motion) keyed by `data-style`, `data-theme`, `data-accent`, `data-transparency` and `data-effects` on `<html>` (set by `ThemeController`, or `useAppearance` on iPhone). Shared utilities in `src/styles/index.css` (`panel`, `chrome`, `float`, `glass-button`, `eyebrow`, `title`, `hud`, `chamfer`, `cyber-only`, `not-cyber`) consume them, so components never hard-code a theme. Token selectors aren't tied to `:root`, which lets the Appearance page render live previews of other themes. Chart series colours (`--color-chart-1…6`) were validated for colour-vision deficiency and contrast in light and dark. Full details, how to add a theme, and how contrast is verified: [`THEMES.md`](THEMES.md).

## Testing

- `src/**/*.test.ts(x)` — Vitest unit and component tests (jsdom; `fake-indexeddb` for the IndexedDB adapter).
- `e2e/*.spec.ts` — Playwright browser tests against a production build: `core`/`sections` on desktop, `mobile` (desktop app) on an Android phone, `ios` (the iPhone app) on iPhone SE, 15 Pro and 16 Pro Max. `e2e/fixtures/sampleData.ts` builds a sample backup **for tests only**; it is never bundled into the app.
