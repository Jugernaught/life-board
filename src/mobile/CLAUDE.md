# iPhone app (`/m/`) — working notes

The iPhone app is a separate UI over the shared data layer (`src/data`, `src/store`, `src/selectors`, `src/forms`, `src/lib`). Never fork data logic into `src/mobile`; call `actions.*` and the shared commands (`@/app/taskCommands`, `@/app/financeCommands`). User guide: `docs/IPHONE.md`. Structure: `docs/ARCHITECTURE.md` → "The iPhone app".

## Navigation
- `nav/paths.ts` — every screen path (`ROUTE_PATTERNS`); the first segment is the tab (`TAB_IDS`: today, plan, habits, journal, more). A new screen needs a pattern here **and** a lazy entry in `nav/routes.tsx`. `e2e/ios.spec.ts` opens every static pattern, so a missing route fails there.
- `nav/navigator.ts` — one stack per tab. `nav.push(path)`, `nav.pop()`; opening another tab's path rebuilds that tab's stack. The top screen is mirrored into the URL hash (`/m/#/more/settings/data`), which is how tests open screens directly.
- `nav/tabContext.ts` — what the root tab screens show (`planMode`, `planDate`, `habitsSegment`). Use `openPlan('tasks' | 'calendar', nav.push)` to open Plan on a given mode; don't add local state that duplicates it.

## One add button per screen
- Liquid Glass, Cyberpunk and Minimal Dark show a **floating accessory** beside the tab bar (`nav/TabBar.tsx`). It does what that screen's "+" would do (it reads `tabContext`). On More screens it is Quick add and doesn't pop the stack.
- Apple Clean has no floating accessory, so root screens show a header "+", gated by `useShowsHeaderAdd()`.
- In-list "Add …" cells appear only when the list is empty. `InlineAdd` rows (type-and-return capture) are the exception, used for priorities, due tasks, day lists and project tasks. Task inline adds call `quickCreateTask`, so natural-language dates work.

## UI kit (`ui/`)
- `Screen` (large title, nav bar, `trailing` buttons via `NavButton`), `Section` / `Cell` / `ActionCell` / `EmptyRow` / `SeeAll` (`List.tsx`), `SwipeRow` (swipe actions and long-press), `Sheet`, `ActionSheet` (it also renders the shared confirm dialog), and `controls.tsx` (`Segmented`, `IosSwitch`, `SearchField`, `Chips`, `CheckCircle`, `StarRating`).
- Records open with `openRecord(key, id)` (`editor/openRecord.ts`). Create and edit go through the shared `editor` store, rendered as bottom sheets by `MobileEditorHost` with an unsaved-changes guard.
- Deletes: `deleteRecord()`, which confirms and offers Undo. For a sub-item deleted inside a record (a checklist step or a category), show a toast whose Undo calls `undoWithNotice`.

## iOS conventions
- Labels and buttons use iOS **Title Case** ("Write Today’s Entry", "Move 3 Overdue to Today"). Footers and body text use sentence case.
- Type classes come from `ios.css` (`ios-body`, `ios-subhead`, `ios-footnote`, …). Colours come from tokens (`--ios-cell`, `--ios-system-red`, theme `--color-*`) and never hex.
- Every editable control is at least 16px (iOS zooms smaller inputs on focus) and at least 44pt tall.
- Safe areas use `--safe-top` / `--safe-bottom`; the on-screen keyboard height is `--kb`. Tests inject notch insets per device.
- Charts are imported only by the screens that draw them, so the first load stays small.
- Offline support (`/m/sw.js`) is generated at build time by `vite.config.ts`. It only works in `npm run build` / `preview`, not in `dev`.

## Testing
`e2e/ios.spec.ts` runs on iPhone SE, 15 Pro and 16 Pro Max. See `e2e/CLAUDE.md`. The floating tab bar can cover the lower part of the screen, so scroll a target into view before tapping it.
