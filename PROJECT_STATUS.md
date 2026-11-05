# Project status

_Last updated: 2026-11-05, at the end of the session-continuity docs task. Branch `claude/life-os`._

Update this file at the end of every substantial task (see `CLAUDE.md`). Record only what has been verified, and replace sections rather than appending to them.

## Current state
- **Desktop (`/`), iPhone (`/m/`) and Windows (Electron)** are feature-complete for the current scope: 13 sections, 34 record types, four themes, local-first storage, backups, import and merge.
- **Refinement pass 2 is complete:** all 29 checklist items, Groups A–D. See `docs/FEATURES-ROADMAP.md` → "Refinement pass 2".
- **Last verified gates** (Group D commit `976baae`; the app code is unchanged since):
  - `npm run check`: typecheck and lint clean, 141/141 unit tests.
  - `npx playwright test`: 122/122 (37 desktop, 1 Android, 28 on each of three iPhone sizes).
  - Pixel contrast WCAG AA on the changed screens in every theme and mode.

## Completed and verified
- Data model and store:
  - Zod-validated records, with `rev` on every record and deletion markers.
  - Lifecycle rules.
  - Undo history (50 changes): compare-and-swap, with repointing after a successful undo.
  - Unlink on delete and on undoing a create (never cascade).
- Persistence:
  - IndexedDB with fallbacks.
  - 250 ms debounced save.
  - Pending and in-flight stash on page close.
  - Web Lock plus a save stamp, so a stale tab merges before writing.
  - Safety backups about every 20 hours.
  - Unreadable records are copied to a backup and then set aside.
- Backups, restore (reports rejected records), and import (replace, which keeps device preferences, or merge, which reports added, updated, kept and removed).
- Everyday features:
  - natural-language capture
  - repeating tasks with series identity
  - subtasks and reschedule
  - Plan My Day, Getting started and templates
  - reminders while the app is open (DST policy in `localInstant`)
  - text size
  - command palette
- One entry point per action on desktop and iPhone; one home for Weekly review (Goals & Habits).

## Known issues and limits
- **Settings across tabs:** settings are one object, so the tab that saves last wins (records merge individually).
- **Delete versus a later edit:** if a record is deleted in one place and edited later elsewhere, the edit is kept (by design: an edit after the delete wins).
- **No automated test of a live two-window race.** Unit tests simulate it with a second adapter.
- **iPhone tests use Chromium** with iPhone sizes and user agents. WebKit isn't installed in this environment, so check Safari-specific behaviour on a real device.
- **iPhone reminders** fire only while the app is open (or as Home Screen notifications on iOS 16.4+ when allowed). There is no push to a closed app, because there's no server.
- **Deferred product decisions** from pass 2:
  - merging similar concepts (habits and routines, two kinds of course, important dates and events)
  - progressive disclosure on crowded overview pages
  - enforcing one record per day

## Next priorities
From `docs/FEATURES-ROADMAP.md` → "Roadmap — next phase":
1. **Recently deleted (30 days).** Note that `db.deletions` markers hold only `{ key, id, rev, at }`, not the record. A trash needs its own store of deleted records with retention, plus restore through `actions` so `rev` and the markers stay right.
2. Repeating calendar events.
3. Habit notes and rest days.
4. Link tasks and habits to goals.
5. CSV and .ics export.

## Exact next starting point
No task is in progress, and the working tree is committed and pushed. Start a new task by reading this file, then the relevant section of `docs/ARCHITECTURE.md`. For the recommended next feature (Recently deleted), start at `remove` and `undo` in `src/store/store.ts` and at `mergeDeletions` in `src/data/validate.ts`.

## Last task: files touched
Docs only; no app code changed.
- New:
  - `CLAUDE.md`
  - `src/mobile/CLAUDE.md`
  - `e2e/CLAUDE.md`
  - `PROJECT_STATUS.md`
  - `CHANGELOG.md`
- Updated:
  - `docs/ARCHITECTURE.md`
  - `docs/IPHONE.md`
  - `docs/FEATURES-ROADMAP.md`
  - `README.md`
  - `playwright.config.ts` (a comment only)
- Moved:
  - `MOBILE_PROGRESS.md` → `docs/history/IPHONE-BUILD-LOG.md`
  - `docs/REFINEMENT-PASS-2-HANDOVER.md` → `docs/history/`

## Key decisions (keep unless deliberately revisited)
- **No backend.** Integrations aren't claimed, and the Settings note says they aren't connected. `docs/SUPABASE.md` is a guide, not a feature.
- **Ordering:** per-record `rev`, with `updatedAt` only as a tie-break. Device clocks are never trusted for ordering.
- **Undo never overwrites a newer change.** When it can't apply, it refuses and says so.
- **Deleting never cascades:** related records are unlinked.
- **Schema changes are additive** (optional or defaulted fields). A restructure needs `SCHEMA_VERSION` plus a migration.
- **The iPhone floating accessory** is the one add button in the non-Clean themes; Apple Clean uses a header "+".
- **`--ios-system-red`** is a dedicated token: the theme `--color-bad` is too pale in Minimal Dark for the iOS badge.
- **No Weekly Review cell on iPhone Today:** it would be a cross-tab jump, and Weekly Review lives in Habits.
