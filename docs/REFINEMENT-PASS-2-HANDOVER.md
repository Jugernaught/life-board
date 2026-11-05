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
