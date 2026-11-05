# Changelog

Newest first. Each entry gives what changed for someone using the app, then the commit(s). The detailed record of each change is in `git log`. Larger passes have their own write-ups in `docs/FEATURES-ROADMAP.md` and `docs/history/`.

## 2026-11-05 — Session-continuity docs
- Added `CLAUDE.md` (rules and conventions for AI coding sessions), `src/mobile/CLAUDE.md`, `e2e/CLAUDE.md`, `PROJECT_STATUS.md` and this changelog.
- `docs/ARCHITECTURE.md` now has a file map, entry points, dependencies, revisions and deletion markers, cross-tab saving, compare-and-swap undo, and the DST policy.
- Historical logs moved to `docs/history/`: `IPHONE-BUILD-LOG.md` (was `MOBILE_PROGRESS.md`) and `REFINEMENT-PASS-2-HANDOVER.md`.
- Fixed stale descriptions in `README.md` (test counts) and `docs/IPHONE.md` (the Today and More tabs, and what the floating button does).
- The app itself is unchanged.

## 2026-11-05 — Refinement pass 2 (Groups A–D)
- **Group D: screens, forms and accessibility** (`976baae`)
  - iPhone Today:
    - Shorter.
    - Priorities aren't repeated under Due.
    - Recent activity moved to Settings → Data & Backups, with dates.
  - Duplicate add rows and buttons are gone.
  - "No … match" states for filtered lists.
  - Starter templates can be opened from Habits on both apps.
  - Data settings: loading states and toasts.
  - Targets: inline range errors.
  - Checklist and category deletes on iPhone can be undone.
  - Clearer names.
  - Shared `Panel` and `Checkbox` replace one-offs.
  - Transaction rows open with the keyboard.
- **Group B: repeating tasks** (`5c5f881`)
  - Undoing a create unlinks related records.
  - Repeating tasks keep a series id, so completing, reopening and completing again never makes a duplicate.
  - Documented and tested daylight-saving policy for reminder times (`localInstant`).
- **Group A: data safety** (`6994382`)
  - Every record has a revision number (`rev`).
  - Deletes leave deletion markers, so merges no longer depend on device clocks and deleted records can't come back.
  - Two tabs saving at once merge under a browser lock instead of overwriting.
  - Undo refuses rather than overwrite a newer change.
  - Completion dates for media and courses are set in one place.
  - Replace-import keeps this device's display preferences.
  - The activity log stays capped after a merge.
  - Restore reports records it couldn't read.
- **Group C: one home per feature** (`24f41e0`)
  - Weekly review lives only in Goals & Habits.
  - One create button per action on desktop.
  - iPhone Today links open the right Plan mode.
  - Replan is always reachable.
  - Static stat tiles.
  - Integrations is a plain "not connected" note.

## 2026-11-04 — Refinement pass 1 (`456c7fe`)
- One entry point per action:
  - one search box and one New button on desktop
  - one add button per iPhone screen
- iPhone Today puts the day first.
- Logging a recurring payment is a single undoable change.
- Saves in flight are stashed when the page closes.

## 2026-11-04 — Everyday essentials (`ce9e0d3`)
- One-line natural-language capture for tasks and events.
- Repeating tasks, subtasks, reschedule and pick-a-date.
- Undo history with Ctrl+Z.
- Plan My Day, Getting started and templates.
- In-app and system reminders.
- Text size setting.
- Command palette.
- Error boundaries.

## 2026-11-04 — Themes (`6aa1798`)
- The UI became a four-theme system: Liquid Glass (default), Apple Clean, Cyberpunk and Minimal Dark.
- Each theme has light and dark modes, accents, Reduce Transparency and effects settings.
- The Appearance page has live previews on desktop and iPhone.

## 2026-11-04 — Windows app (`eba6f1e`)
- Electron wrapper with an NSIS installer.

## 2026-11-04 — iPhone app (`0b0496a`, `2e07996`, `c47453c`)
- A separate iOS-style app at `/m/` over the same data:
  - tab stacks with edge-swipe back
  - bottom-sheet editors
  - offline support once added to the Home Screen
  - tests on three iPhone sizes
- Base-path aware, so it works on GitHub Pages.

## 2026-11-04 — Deploy (`9f51f75`)
- GitHub Pages deploy through Actions.

## 2026-11-04 — LIFE OS first build (`68df281`, `99706e6`, `afc93c0`, `58faf98`, `6711871`)
- Local-first personal operating system:
  - 13 sections
  - Zod data model
  - IndexedDB persistence with backups and crash recovery
  - search
  - analytics
- Playwright tests.
- README, architecture and Supabase guides.
- WCAG AA contrast.
- Goal completion chart.

## 2026-11-03 — Initial commit (`1bde550`)
