# LIFE OS — instructions for AI coding sessions

LIFE OS is a private, local-first personal operating system with 13 sections and 34 record types. It runs as:
- a desktop web app at `/`
- an iOS-style iPhone app at `/m/`
- a Windows app (Electron)

There is **no backend**: all data lives in the browser's IndexedDB on the device.

## Start of a session
1. Read `PROJECT_STATUS.md`. It has the current state, known issues and the exact next step.
2. Read only the relevant part of `docs/ARCHITECTURE.md`, which has a file map and the data flow.
3. Open only the files the task touches, plus the nested guide when working there:
   - `src/mobile/CLAUDE.md` for the iPhone app
   - `e2e/CLAUDE.md` for browser tests

Use targeted search (`rg`) rather than reading whole directories. Don't reread the codebase "to get oriented".

## End of every substantial task
- Update `PROJECT_STATUS.md`: what's done (verified only), what's unfinished, files touched, decisions, and the next starting point.
- Add an entry to `CHANGELOG.md`.
- If architecture, data shape, navigation or major behaviour changed, update `docs/ARCHITECTURE.md` (and `README.md` or `docs/IPHONE.md` for user-visible features).
- If a doc disagrees with the code, the code wins: fix the doc.

## Commands
| Command | Use |
| --- | --- |
| `npm run dev` | Serves both apps (`/`, `/m/`). Mobile offline support only works in builds. |
| `npm run check` | Typecheck, lint and unit tests (Vitest). Run before every commit. |
| `npx playwright test` | E2E on a production build: desktop, Android, iPhone SE, 15 Pro and 16 Pro Max. Takes about 6–8 minutes. Use `--project=desktop` or `-g "name"` for focused runs. |
| `npm run build` / `npm run preview` | Production build and serve (port 4173). |

## Non-negotiables
- **Never fabricate data.** No sample data ships in the app; `e2e/fixtures/sampleData.ts` is for tests only.
- **Never silently discard data.**
  - Destructive actions confirm first and take a backup.
  - Deletes unlink, never cascade (`RELATIONS`).
  - Undo is compare-and-swap: it refuses rather than overwrite newer work.
- **Every change goes through the store** (`actions.create`, `update`, `remove`, `undoChange` in `src/store/store.ts`). Don't write `db` directly. The store validates (Zod), applies lifecycle rules (`src/store/lifecycle.ts`), bumps `rev`, logs activity and records undo history.
- **Schema changes are additive.** Use `.optional()` or `.default()`. A restructure needs `SCHEMA_VERSION` plus a migration (`src/data/validate.ts`).
- **No new dependencies** unless clearly justified.
- **Don't claim integrations that don't exist** (sync, push to a closed app, banks). Say plainly what works.
- **One entry point per action:**
  - Desktop: the toolbar holds Search and New; page headers hold section create actions; in-tab "Add" buttons appear only in empty states.
  - iPhone: one add button per screen (see `src/mobile/CLAUDE.md`).

## Conventions
- **Forms:**
  - `FormConfig` in `src/forms/*` is rendered by `EntityForm`; `editor.create` and `editor.edit` open it anywhere.
  - New tasks and events read their title as natural language (`src/forms/smart.ts`).
- **Feedback:**
  - `toast({ title, action: { label: 'Undo', onClick } })`.
  - Undo buttons use `undoWithNotice(changeId)` (`src/app/useChangeToasts.ts`).
  - Deletes use `deleteRecord()`, which confirms and offers Undo.
- **Shared commands:**
  - tasks: `src/app/taskCommands.ts` (`quickCreateTask`, `reschedule`, `rescheduleMany`)
  - finance: `src/app/financeCommands.ts` (`logRecurring`)
- **Styling:**
  - Use theme tokens only (`src/styles/themes.css`, `src/mobile/ios.css`) and no hex in components.
  - Use the shared `Panel`, `Button`, `Checkbox` and `EmptyState`.
  - Font sizes scale with the Text size setting through a build-time transform (`src/app/textScaleCss.ts`); inline `style={{ fontSize }}` opts out.
- **Formatting:** if you use Prettier, always pass `--no-semi --single-quote --print-width 220`. The defaults reformat whole files. Prefer targeted edits.
- **CSS:** write only `backdrop-filter`. Lightning CSS mishandles a hand-written `-webkit-` pair.
- **Dates:**
  - Calendar dates are local `yyyy-MM-dd` strings.
  - Use `localInstant(date, time)` for wall-clock moments; it has a documented DST policy.
  - Money is integer minor units.

## Where things are
See the file map in `docs/ARCHITECTURE.md`. Themes are documented in `docs/THEMES.md`, the iPhone app in `docs/IPHONE.md`, and features and the roadmap in `docs/FEATURES-ROADMAP.md`. Earlier work logs are in `docs/history/` (read only if needed).
