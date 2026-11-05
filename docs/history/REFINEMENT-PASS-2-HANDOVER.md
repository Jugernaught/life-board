> **Historical.** The operation-by-operation record of Refinement Pass 2 (Groups A–D). It is complete. Current status lives in [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md).

# Refinement Pass 2 — handover

Status record for the second refinement pass. It is kept up to date operation by operation, so the next session can continue from here. The code is authoritative; if this file disagrees with it, the code wins.

- **Authorised now:** Group C (user items 6–13).
- **Not yet authorised:** Groups A, B and D, and committing or pushing.
- **Plan:** `/root/.claude/plans/nested-sparking-fox.md` (session-local). Its Group C maps to user items 6–13 as listed below.

## 1. Environment and baseline evidence
| Check | Result |
| --- | --- |
| Timestamp | 2026-11-05 01:33:40 UTC |
| Branch | `claude/life-os` |
| HEAD | `456c7fe` (Refinement pass 1) |
| Initial `git status --short` | clean (no staged, modified or untracked files) |
| `npm run check` (typecheck, lint, vitest) | exit 0; 17 files, 123/123 tests passed; 01:33:40–01:34:27 UTC |
| `npm run test` | exit 0; 17 files, 123 passed, 0 failed, 0 skipped; 01:34:33–01:34:44 UTC |
| Last full e2e (end of pass 1, same HEAD) | 102/102 passed. A fresh e2e baseline is not needed: HEAD and the tree are unchanged since. |

## 2. Project guidance and constraints
- There is no `CLAUDE.md` yet; the continuity docs task is planned but not authorised in this batch.
- Constraints from the README and earlier sessions:
  - no fabricated data
  - confirm destructive actions
  - never silently discard data
  - no new dependencies
  - Prettier only with `--no-semi --single-quote --print-width 220`
  - write only `backdrop-filter` (never a hand-written `-webkit-` pair)
  - e2e tests must not use `waitForFunction` with a Promise
- Constraints from this authorisation:
  - Group C only
  - don't touch Group A/B features, routes or schemas
  - no new dependencies and no unrelated refactors
  - no stylistic rewrites of working code
  - no commit or push

## 3. Requirements and implementation criteria (items 6–13)

**Item 6 — Weekly review consolidation**
- *Source:* the same `WeeklyReviewPanel` is a tab on Goals, Journal ("Weekly reflection") and Analytics.
- *Criteria:*
  - Desktop: only Goals & Habits has a Weekly review tab.
  - Journal and Analytics have no such tab and show a link ("Weekly review → Goals & Habits") that opens `/goals?tab=review`.
  - Old `?tab=weekly` and `?tab=review` URLs fall back to each page's default tab (`useTabParam` already does this).
  - iPhone: the Journal and Analytics cells that pushed `habits/review` (a jump to another tab) are removed. The Habits tab keeps its Weekly Review cell.

**Item 7 — PageHeader consistency**
- *Source:* the same create action is visible twice in Finance, Goals, Fitness, Career, Learning, Schedule and Social.
- *Criteria:* each create action is visible at most once on screen.
  - Generic in-tab duplicates are removed: Finance Transactions toolbar; Habits panel "Habit"; Workouts toolbar; Sleep panel "Log sleep"; Applications toolbar; Education deadlines panel "Add"; Skills tab "Skill"; Sessions toolbar "Session"; Social People panel "Person"; Upcoming panel "Event".
  - Context-aware in-tab buttons stay, and the header hides its generic copy on that tab only:
    - Goals tab: "Goal" prefills the timeframe.
    - Schedule → Tasks tab: "New task" prefills dates from the scope.
  - "Add …" buttons inside empty states stay.

**Item 8 — Plan screen task-mode routing**
- *Source:* "All Tasks" and the Due ring on iPhone Today open Plan in Calendar mode.
- *Criteria:*
  - Plan's Calendar/Tasks mode is held in `useTabContext`.
  - "All Tasks" and the "Due today" ring open Plan in Tasks mode.
  - "Up next → Calendar" opens Calendar mode.
  - Choosing a mode in Plan still works and is remembered while the app is open.

**Item 9 — Static stat tiles**
- *Source:* tappable tiles duplicate cells and See All links that go to the same place (Social, Career).
- *Criteria:* the stat tiles on Social and Career are static (not buttons). Each destination stays reachable through its existing cell.

**Item 10 — More tab floating button**
- *Source:* on every More-tab screen the floating button popped back to the More root and focused search, losing the user's place.
- *Criteria:*
  - On the More tab the floating button is "Quick add" and never changes the navigation stack.
  - Search stays as the More root's own header field.

**Item 11 — Plan Your Day → Replan**
- *Source:* once planned (with no intention set), Plan Your Day couldn't be reopened on iPhone.
- *Criteria:* the Today priorities header link always shows: "Plan Your Day" before planning and "Replan" after, and both open the Plan sheet.

**Item 12 — Settings and Notes cleanup**
- *Source:* desktop Settings → Integrations is a whole tab of inactive features; iPhone Settings has five inert "Not connected" rows; "N more in Notes" isn't a link.
- *Criteria:*
  - The desktop Integrations tab is removed. Its content becomes a short "Not connected" note inside Privacy → How your data is handled.
  - iPhone: the five rows become one footer note.
  - The "N more in Notes" footer opens the Notes screen.

**Item 13 — Desktop-version link deduplication (iPhone)**
- *Source:* "Open Desktop Version" appears in both More and Settings, and the Settings one is a hand-made link.
- *Criteria:* it appears only in More.

## 4. Dependencies and order
- **Shared areas:**
  - `TabBar.tsx` (item 10) reads `tabContext.ts` (item 8), which pass 1 already set up.
  - `TodayScreen.tsx` is touched by items 8 and 11 only. Group D item 8 (priorities vs due) is not touched.
  - `SettingsScreens.tsx` is touched by items 12 and 13.
- **Persistence:** no schema or persistence change in Group C. The mode stays in memory.
- **Order:** 6 → 7 (desktop), then 8 → 11 → 9 → 10 → 12 → 13 (iPhone and Settings). Edits are sequential, with no parallel edits to the same file.

## 5. File allowlist
| File | Access | Item | Why |
| --- | --- | --- | --- |
| `docs/REFINEMENT-PASS-2-HANDOVER.md` | Modify | Handover | Status record |
| `src/features/journal/JournalPage.tsx` | Modify | 6 | Remove tab, add link |
| `src/features/analytics/AnalyticsPage.tsx` | Modify | 6 | Remove tab, add link |
| `src/mobile/screens/journal/JournalScreens.tsx` | Modify | 6 | Remove cross-tab cell |
| `src/mobile/screens/analytics/AnalyticsScreens.tsx` | Modify | 6 | Remove cross-tab cell |
| `src/features/goals/GoalsPage.tsx`, `src/features/goals/HabitsTab.tsx` | Modify | 7 | Remove Habit duplicate; hide header Goal on the goals tab |
| `src/features/finance/TransactionsTab.tsx` | Modify | 7 | Remove toolbar duplicate |
| `src/features/fitness/LogsTabs.tsx` | Modify | 7 | Remove Workout and Sleep duplicates |
| `src/features/career/ApplicationsTab.tsx`, `src/features/career/EducationTab.tsx` | Modify | 7 | Remove duplicates |
| `src/features/learning/LearningPage.tsx` | Modify | 7 | Remove Skill and Session duplicates |
| `src/features/schedule/SchedulePage.tsx` | Modify | 7 | Hide header Task on the tasks tab |
| `src/features/social/SocialPage.tsx` | Modify | 7 | Remove Person and Event duplicates |
| `src/mobile/nav/tabContext.ts` | Modify | 8 | Mode setter helper |
| `src/mobile/screens/plan/PlanScreen.tsx` | Modify | 8 | Mode from the shared store |
| `src/mobile/screens/today/TodayScreen.tsx` | Modify | 8, 11 | Mode-aware links; Replan |
| `src/mobile/screens/social/SocialScreens.tsx`, `src/mobile/screens/career/CareerScreens.tsx` | Modify | 9 | Static tiles |
| `src/mobile/nav/TabBar.tsx` | Modify | 10 | More floating button = Quick add |
| `src/features/settings/SettingsPage.tsx` | Modify | 12 | Integrations → Privacy note |
| `src/mobile/screens/settings/SettingsScreens.tsx` | Modify | 12, 13 | Footer note; remove desktop link |
| `src/mobile/components/NotesSection.tsx` | Modify | 12 | Notes link |
| `e2e/ios.spec.ts`, `e2e/features.spec.ts` | Modify | 6–13 | Tests for the new behaviour (existing tests unaffected unless listed) |
| `src/mobile/components/Stats.tsx`, `src/components/shared/WeeklyReviewPanel.tsx`, `src/mobile/screens/more/MoreScreen.tsx`, `src/mobile/nav/routes.tsx` | Read-only | 6, 9, 10, 13 | Reference only |

## 6. Pre-implementation gate
- **Ambiguities resolved:**
  - Context-aware duplicates (item 7) keep the in-tab button, so no function is lost.
  - Item 12's Integrations content is folded in, not deleted.
- **Deferrals:** none.
- **Gate:** PASSED. All 8 items are traced to criteria, the allowlist is populated, and nothing is outside Group C.

## 7. Operation log
| Time (UTC) | Operation | Result | Files |
| --- | --- | --- | --- |
| 01:33:40 | Baseline: git, `npm run check` | exit 0, 123/123 | — |
| 01:34:33 | Baseline: `npm run test` | exit 0, 123/123 | — |
| 01:35–01:37 | Read-only inspection of all Group C sites | Allowlist built | — |
| 01:37–01:38 | Item 6: Journal and Analytics weekly-review tabs → header links; iPhone cross-tab cells removed | tsc and eslint clean | `JournalPage.tsx`, `AnalyticsPage.tsx`, `JournalScreens.tsx`, `AnalyticsScreens.tsx` |
| 01:38–01:39 | Item 7: 10 duplicate in-tab create buttons removed; header Goal/Task hidden on their context-aware tabs | tsc and eslint clean | `TransactionsTab`, `HabitsTab`, `LogsTabs`, `ApplicationsTab`, `EducationTab`, `LearningPage`, `SocialPage`, `GoalsPage`, `SchedulePage` |
| 01:39 | Item 8: Plan mode held in `useTabContext`; `openPlan()`; Today links mode-aware | tsc and eslint clean | `tabContext.ts`, `PlanScreen.tsx`, `TodayScreen.tsx` |
| 01:39 | Item 11: Plan link always shown, reading "Replan" once planned; e2e expectation updated | tsc and eslint clean | `TodayScreen.tsx`, `e2e/ios.spec.ts:517` |
| 01:40 | Item 9: 5 tappable stat tiles made static | tsc and eslint clean | `SocialScreens.tsx`, `CareerScreens.tsx` |
| 01:40–01:41 | Item 10: More floating button = Quick add (no stack pop) | tsc and eslint clean | `TabBar.tsx` |
| 01:41–01:42 | Item 12: desktop Integrations tab → Privacy note; iPhone "Not connected" rows → footer; "more in Notes" link | tsc and eslint clean | `SettingsPage.tsx`, `SettingsScreens.tsx`, `NotesSection.tsx` |
| 01:42 | Item 13: duplicate "Open Desktop Version" removed from iPhone Settings | tsc and eslint clean | `SettingsScreens.tsx` |
| 01:42–01:43 | Post-group diff review | Only allowlisted files changed; no duplicated logic; imports pruned | — |
| 01:43 | New e2e tests: 1 desktop, 3 iPhone (run on 3 devices) | Written | `e2e/features.spec.ts`, `e2e/ios.spec.ts` |
| 01:43–01:46 | Desktop and Android e2e (features, core, sections, mobile, themes) | 36 passed, 1 failed: my test assumed a goal existed. The app correctly shows "Set your first goal" when there are none. | — |
| 01:46–01:49 | Fixed the test (empty state first, then with a goal) and the label selector; reran | 1 passed | `e2e/features.spec.ts` |
| 01:50–01:53 | iPhone e2e, all 3 devices | 75/75 passed | — |
| 01:53–02:00 | Full gates: `npm run check`, then full `npx playwright test` | check exit 0 (123/123); e2e exit 0 (112/112) | — |
| 02:00–02:01 | Screenshots: Journal header link, Privacy note, iPhone Settings note | Render as intended, no console errors | Scratch only (not in repo) |

## 8. Final status (Group C)
| Item | Status | Evidence |
| --- | --- | --- |
| 6 Weekly review consolidation | Completed | e2e `weekly review has one home…` (link to `/goals?tab=review`, old `?tab=review` falls back); iPhone `Settings: … Weekly Reflection` count 0 |
| 7 PageHeader consistency | Completed | e2e `…every create action is shown once…` across 9 section tabs, including the Goals empty and filled states |
| 8 Plan task-mode routing | Completed | iPhone e2e `Today links open Plan on the right view…` (Tasks and Calendar) × 3 devices |
| 9 Static stat tiles | Completed | iPhone e2e `More: … one link per destination` (no tile button; cell present) |
| 10 More floating button | Completed | iPhone e2e: Quick add opens on a deep More screen and the stack is kept |
| 11 Plan Your Day → Replan | Completed | iPhone e2e: "Plan Your Day" before planning, "Replan" after |
| 12 Settings and Notes cleanup | Completed | desktop e2e: no Integrations tab, Privacy note present; iPhone e2e: footer note, and "more in Notes" opens Notes after 6 notes |
| 13 Desktop link deduplication | Completed | iPhone e2e: not in Settings, present in More |

- **Contrast:** the new text uses existing tokens and classes (`ios-footnote text-ink-subtle`, the Privacy panel's text colour, ghost `Button`), which passed the pass-1 pixel audit. No new pixel audit was run for Group C.
- **Artifacts:** `test-results/` and `dist/` are git-ignored. Logs and screenshots are in the session scratchpad only.
- **Not done (by authorisation):** Groups A, B and D, the continuity docs (`CLAUDE.md` etc.), and commit or push.

## 9. Next starting point
Ask for authorisation to (a) commit Group C and (b) start the next group. The plan's order is A → B → D. Group A starts with item 1 (`rev`, deletion markers, Web Locks merge in `src/store/persistence.ts`).

---

# Group A — core data and persistence (items 1, 3, 5, 22, 29)

- **Authorised:** 2026-11-05 ("Go" after the Group C commit `24f41e0`).
- **Baseline:** 02:07:02 UTC, clean tree at `24f41e0`; `npm run check` exit 0, 123/123.
- **Architecture check (clarification 6):** there is no `dbEnvelope`. The database is one object saved through an adapter, and merge is `mergeDatabases`. The work adapts to that by adding fields to the existing database and to the record base rather than introducing an envelope.

## Changes
| Item | What changed | Files |
| --- | --- | --- |
| 1 | **Revisions.** Every record carries `rev` (1 on create, +1 on each change, unlinking and restoring). It is optional, and missing reads as 0, so old data loads unchanged. | `data/schema.ts`, `data/types.ts`, `store/store.ts` |
| 1 | **Deletion markers.** A top-level `deletions: {key, id, rev, at}[]` list. A delete adds a marker and undoing the delete removes it. Markers older than 180 days are pruned, and at most 5,000 are kept. | `data/schema.ts`, `data/defaults.ts`, `data/validate.ts`, `store/store.ts` |
| 1 | **Merge rule.** The higher `rev` wins, then the later `updatedAt`, so device clocks don't decide. A deleted record stays deleted unless the other side edited it later (higher `rev` than the marker). Marker lists are combined. The result reports `removed`. | `data/validate.ts` (`newerCopy`, `mergeDeletions`, `mergeDatabases`) |
| 1 | **Cross-tab.** Writes run inside a Web Lock (`navigator.locks`) where supported. Inside the lock, if the "last save" stamp (`life-os:save-stamp` in localStorage) shows another tab saved since this tab last synced, the tab loads, merges and then writes. A "saved" broadcast during a pending save sets a fallback flag. | `store/persistence.ts` |
| 3 | **Compare-and-swap undo.** Each change records `afterRev`, and undo applies only while the record (and any copy it spawned) is unchanged since. An undo writes a new revision, and earlier history entries for that state are re-pointed, so step-by-step undo keeps working. `undoLast` returns `{change, undone}` and drops a stale step. All Undo buttons go through `undoWithNotice`, which explains a refusal. | `store/store.ts`, `app/useChangeToasts.ts`, `app/taskCommands.ts`, `app/financeCommands.ts`, `hooks/useGlobalHotkeys.ts` (unchanged call, new type) |
| 5 | **Completion dates set in one place.** Library items and learning courses get a finished date when completed (a date you chose is kept). Courses clear it when reopened; library items clear it when moved back to "want", and keep it when abandoned. This matches the forms. Completing a goal records 100% in its history once. | `store/lifecycle.ts` |
| 22 | **Replace-import keeps this device's preferences** (`sidebarCollapsed`, `textScale`, `motion`, `reduceTransparency`, `effects`). Merge already kept all current settings. | `store/backups.ts` |
| 29 | **Data polish.** The merged activity log is capped at `ACTIVITY_LIMIT` (the constant moved to the data layer to avoid an import cycle). After unreadable records are set aside, the cleaned data is saved once. `restoreBackup` returns `{rejected}`, and both Settings screens show it. A merge import says how many deleted records stay deleted. | `data/validate.ts`, `store/persistence.ts`, `store/backups.ts`, `features/settings/DataSettings.tsx`, `mobile/screens/settings/SettingsScreens.tsx` |

## Verification
| Time (UTC) | Check | Result |
| --- | --- | --- |
| 02:07 | Baseline `npm run check` | exit 0, 123/123 |
| 02:13 | `validate.test.ts` (new: revision beats a skewed clock; deletions respected unless edited later; markers combined and pruned; activity capped) | 13/13 |
| 02:13 | `store.test.ts` (new: revisions and markers; compare-and-swap refusal without loss; step-by-step undo back to before creation; create-undo refused after an edit; spawned copy at rev 1; completion dates; goal 100% once) | 18/18 |
| 02:14 | `persistence.test.ts` (new: another tab's save merged, not overwritten; cleaned data saved once after setting records aside; replace-import keeps device preferences; restore reports rejected records) | 14/14 |
| 02:16 | `npm run check` | exit 0; 135/135 unit tests |
| 02:16–02:22 | Full `npx playwright test` (desktop, Android, iPhone SE, 15 Pro, 16 Pro Max) | exit 0; 112/112 |

## Status
| Item | Status |
| --- | --- |
| 1 | Completed. Two tabs' concurrent saves were tested with an in-memory adapter (unit test). The Web Lock path ran on every save in the 112 Chromium e2e runs. A live two-window race isn't automated, because its timing can't be forced reliably. |
| 3 | Completed |
| 5 | Completed |
| 22 | Completed |
| 29 | Completed |

## Known limits (documented, not hidden)
- Settings merge: when two tabs change settings at the same moment, the saving tab's settings win. Records are merged per record.
- Deleting a record on one device and editing it on another before syncing keeps the edit (it has a higher revision). This is intentional, so work isn't lost.

## Next starting point
Group B: item 2 (unlink relations when undoing a create) and item 4 (repeat `seriesId` and occurrence identity, `localInstant` DST policy). Then Group D.

---

# Group B — tasks and recurrence (items 2, 4)

- **Authorised:** 2026-11-05 ("Start" after the Group A commit `6994382`).
- **Baseline:** 02:25:15 UTC, clean tree; `npm run check` exit 0, 135/135.

## Changes
| Item | What changed | Files |
| --- | --- | --- |
| 2 | **Undoing an add unlinks related records.** `unlinkReferences()` is extracted from `remove` (it uses `RELATIONS`) and used by both delete and undo. Undoing an add, or removing a spawned copy during undo, now unlinks anything linked to it since: a new revision for each, never a delete. | `store/store.ts` |
| 4 | **Series identity.** Repeating tasks carry an optional `seriesId` (the first task's id), copied to every occurrence. An occurrence's identity is `(series, due date)`, computed from the rule. A completion doesn't spawn when that occurrence already exists open, which fixes reopen → re-complete making a second copy. Older copies without `seriesId` are matched by title and rule. A duplicated task starts its own series. | `data/schema.ts`, `store/store.ts` (`seriesOf`, `nextOccurrenceOf`), `app/taskCommands.ts` |
| 4 | **DST policy (clarification 2).** `localInstant(date, time)` in `lib/dates.ts` documents and centralises it. When clocks go back, the first occurrence of an ambiguous time is used; when they go forward, a time that doesn't exist moves forward by the gap. Reminders use it. Repeat rules work in whole dates, so DST can't shift or duplicate an occurrence. Clarification 3 (several occurrences per day) doesn't apply: one occurrence per day per series. | `lib/dates.ts`, `app/reminders.ts` |
| — | **Test robustness.** The Group C e2e test "Today links open Plan" scrolls the Calendar link clear of the floating tab bar before tapping it. On iPhone 15 Pro it sat partly under the "+" button and failed 1 run in 7. | `e2e/ios.spec.ts` |

## Verification
| Time (UTC) | Check | Result |
| --- | --- | --- |
| 02:25 | Baseline `npm run check` | exit 0, 135/135 |
| 02:28 | `store.test.ts` and the new `lib/dst.test.ts`. New store tests: undoing an add unlinks a task; complete → reopen → complete makes one next copy in one series; an older copy without `seriesId` counts as the same series. New DST tests, run in Europe/London whatever the machine's zone: 01:30 on 25 Oct 2026 = 00:30Z (first occurrence); 01:30 on 29 Mar 2026 = 01:30Z (moved forward to 02:30 BST); daily and weekly dates stay put. | 24/24 |
| 02:29 | `npm run check` | exit 0; 141/141 |
| 02:30–02:38 | Full e2e | 111/112. One intermittent failure on iPhone 15 Pro in a Group C test (cause above). 6/6 on rerun before the fix. |
| 02:39 | That test after the fix, ×4 on 3 iPhones | 12/12 |
| 02:40–02:49 | Full `npx playwright test`, then `npm run check` | e2e exit 0, 112/112; check exit 0, 141/141 |

## Status
| Item | Status |
| --- | --- |
| 2 | Completed |
| 4 | Completed. The DST policy is verified by a unit test pinned to Europe/London. Reminders fire from the same helper. |

## Next starting point
Group D (items 8, 10, 11, 12, 14, 16, 18, 19, 20, 21, 24, 25, 26, 28), then the continuity docs (`CLAUDE.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`).

---

# Group D — components, forms and accessibility (items 8, 10, 11, 12, 14, 16, 18, 19, 20, 21, 24, 25, 26, 28)

- **Authorised:** 2026-11-05 ("Do everything").
- **Baseline:** 03:08:35 UTC, clean tree at `5c5f881`; `npm run check` exit 0, 141/141.

## Changes
| Item | What changed | Files |
| --- | --- | --- |
| 8 | **Priorities aren't listed twice.** iPhone Today's Due list leaves out today's priorities, while the ring still counts them. If every due item is a priority, it says "Everything due today is in your priorities above." | `mobile/screens/today/TodayScreen.tsx` |
| 10 | **Add cells only when the list is empty.** "Add Person", "Add Skill", "Add Course" and "Add Social Goal" duplicated the header "+" or its sheet, so they now show only while their list is empty (the Group C empty-state rule). The Social commitments inline add stays: it's quick inline capture, like Today's. | `SocialScreens.tsx`, `LearningScreens.tsx`, `CareerScreens.tsx` |
| 11 | **"No … match your search or filters"** for learning courses, workouts, companies and the applications list. It shows only when the list has records but none match. | `LearningPage.tsx`, `LogsTabs.tsx`, `PrepTabs.tsx`, `ApplicationsTab.tsx` |
| 12 | **Every task-creating inline add on iPhone uses `quickCreateTask`:** Today priorities, Plan's day list, Project tasks and Social commitments. Each reads dates and priority from the text and offers Undo. | `TodayScreen.tsx`, `PlanScreen.tsx`, `ProjectsScreens.tsx`, `SocialScreens.tsx` |
| 14 | **Shorter Today.** "This week" is removed; its figures are in Habits → Weekly Review and Analytics. "Recent activity" moved to Settings → Data & Backups as `RecentActivity` (10 entries, each with its day and time). The duplicate check-in card is removed from the Journal root, which has "Mood & Energy". **Deviation:** the plan said "replace This week with a Weekly Review cell", but that cell would jump to another tab, which Group C removed elsewhere, so no cell was added. | `TodayScreen.tsx`, new `mobile/components/RecentActivity.tsx`, `SettingsScreens.tsx`, `JournalScreens.tsx` |
| 16 | **Starter Templates entry points:** desktop Habits tab (a "Templates" button) and iPhone Habits screen (a cell). | `goals/HabitsTab.tsx`, `mobile/screens/habits/HabitsScreens.tsx` |
| 18 | **Data settings feedback.** Export shows a toast (and an error toast). "Clear log" runs through `run()`, so a failed backup is reported and nothing is cleared. Erase and Factory reset show a loading state and each disables the other. Reading an import file shows a busy button. | `settings/DataSettings.tsx` |
| 19 | **The applications board wraps** (1 → 2 → 3 → 6 columns) instead of a fixed 1100px width that scrolled sideways on laptops. | `career/ApplicationsTab.tsx` |
| 20 | **Target inputs show their range** in the description, and an inline error (with `role="alert"`) instead of silently ignoring an out-of-range value. | `settings/SettingsPage.tsx` |
| 21 | **Undo for iPhone deletes.** Deleting a checklist step shows a toast with Undo, which is the record's own undo step (it won't overwrite later changes). Removing a category shows Undo, which puts it back in place. | `mobile/components/Checklist.tsx`, `SettingsScreens.tsx` |
| 24 | **Working-hours footer is accurate:** Plan's timeline opens at your start time, and the desktop calendar shades working hours. | `SettingsScreens.tsx` |
| 25 | **Naming.** "Financial Targets" and "Personal Targets". More labels match the screen titles (Career, Fitness, Learning, Library, Analytics), and Social's "People" cell is "Reconnect". Registry label "Learning course". "Write Today's Entry". The Journal streak shows only when it's above 0. | `MoreScreen.tsx`, `routes.tsx`, `FinanceScreens.tsx`, `SettingsScreens.tsx`, `SocialScreens.tsx`, `JournalScreens.tsx`, `data/registry.ts` |
| 26 | **Shared components.** `Panel` replaces the plain `div.panel` (×5). `Checkbox` replaces native checkboxes (×4). The Sleep button uses Plus. **Adaptation:** the hard-coded `#ff3b30` became a named `--ios-system-red` token, not `--color-bad`, because white badge text on Minimal Dark's pastel `--color-bad` would be about 2.4:1. Same look, one source. | `ProjectsPage.tsx`, `LibraryPage.tsx`, `ProjectDetailPage.tsx`, `HabitsTab.tsx`, `PlanningTabs.tsx`, `PrepTabs.tsx`, `FitnessPage.tsx`, `mobile/ios.css`, `TabBar.tsx`, `PlanScreen.tsx` |
| 28 | **Transactions open from the keyboard:** the description cell is a button; the row click remains for the mouse. | `finance/TransactionsTab.tsx` |

## Verification
| Time (UTC) | Check | Result |
| --- | --- | --- |
| 03:08 | Baseline `npm run check` | exit 0, 141/141 |
| 03:16 | `npm run check` after implementation | exit 0, 141/141 |
| 03:17 | New desktop e2e "group D": no-match state, Templates button, export toast with a real download, target range error and recovery, keyboard-opened transaction, no sideways scroll on the applications page at 1280px | 1/1 |
| 03:17 | New iPhone e2e ×3 devices: priority not duplicated, activity in Data with "Today HH:MM", Habits → Starter Templates, More → "Career" title, "Personal Targets", category removal undone | 9/9 |
| 03:18–03:24 | `npm run check`; full `npx playwright test` | 141/141; 122/122 |
| 03:24–03:29 | Pixel-contrast audit: 13 desktop pages × 6 theme combinations, and the iPhone feature scenes × 6 | All text meets WCAG AA (5,635 and 858 text runs) |

## Status
All 14 items are completed (two deviations, recorded above).
