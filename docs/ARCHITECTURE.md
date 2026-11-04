# Architecture

This document explains how LIFE OS is put together, so you (or a future contributor) can change it with confidence.

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

## Adding a new collection

1. Add an `entity({...})` schema and register it in `collectionSchemas` (schema.ts).
2. Add its type to `Collections` (types.ts) and metadata to `COLLECTIONS` (registry.ts), plus any `RELATIONS`.
3. Add a form config and register it in `src/forms/registry.ts`.
4. Build the screen in `src/features/…`.

## Styling

Design tokens (colours, fonts, radius) are CSS variables declared in `src/styles/index.css` inside Tailwind's `@theme`. Light theme and accent presets override those variables via `data-theme` / `data-accent` attributes on `<html>` (set by `ThemeController`). Reusable visual utilities (`panel`, `hud`, `chamfer`, `glow-ring`, `eyebrow`) live in the same file. Chart series colours (`--color-chart-1…6`) were validated for colour-vision deficiency and contrast in both themes.

## Testing

- `src/**/*.test.ts(x)` — Vitest unit and component tests (jsdom; `fake-indexeddb` for the IndexedDB adapter).
- `e2e/*.spec.ts` — Playwright browser tests against a production build. `e2e/fixtures/sampleData.ts` builds a sample backup **for tests only**; it is never bundled into the app.
