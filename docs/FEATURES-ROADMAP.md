# Everyday features and roadmap

This is the result of an audit of LIFE OS against the apps people use every day for the same jobs: Things 3, Todoist, TickTick, Sunsama, Apple Reminders and Notion. It covers what was missing, what was built, and what comes next.

## What the audit found

LIFE OS was **broad but shallow in daily use**. All 13 sections worked and nothing was broken, but the actions people repeat dozens of times a day — adding, completing, rescheduling, repeating, undoing — lagged behind those apps:

1. **Capture was slow.** Quick add was a plain form; you couldn't type "dentist tomorrow 3pm !high".
2. **No repeating tasks.** Bills, reviews and chores had to be re-entered by hand.
3. **No subtasks.** A task couldn't hold a checklist.
4. **No reschedule.** Nothing like "Tomorrow" or "Next week", so overdue tasks piled up.
5. **Undo only covered deletes.** A mistaken tick or edit couldn't be undone, and there was no Ctrl/Cmd+Z.
6. **No error containment.** One failing widget could blank the whole page.
7. **No daily planning routine.** Priorities existed, but nothing walked you through choosing them.
8. **Cold start.** A new user saw an empty dashboard with no guidance.
9. **No reminders at all.**
10. **Missing basics:** no text-size setting; the command palette had no typo tolerance, recent items or quick actions; the iPhone app had no long-press menus or Home Screen shortcuts.

## What was built

| Feature | Where | How it works |
| --- | --- | --- |
| **Natural-language quick add** | Quick add, task/event forms, inline "add a task" boxes, Quick add widget — desktop and iPhone | Type `Pay rent every month 1 Dec !high #home @finance`. Dates (today, tomorrow, fri, next week, in 3 days, 12 Nov, 2026-12-01), times (5pm, 17:30, noon), repeats (every day / weekday / monday and thursday / 2 weeks / month), priority (`!`, `!!`, `!!!`, `!high`, `p1`), `#tags` and `@areas` are read as you type. Chips show what was understood, and tapping a chip keeps those words in the title. Fields you set by hand always win. Code: `src/lib/parseQuick.ts`, `src/forms/smart.ts`, `src/forms/SmartChips.tsx`. |
| **Repeating tasks** | Task form → Repeat | Daily, weekdays, weekly on chosen days, monthly, yearly, every N. Completing one creates the next, with its subtasks reset. The next date is counted from the due date, so "every Monday" stays on Mondays, and it never lands in the past. Code: `src/lib/recurrence.ts` and the store's `update`. |
| **Subtasks** | Task form → Subtasks; task rows | Rows show `2/5`. On desktop, click the count to tick subtasks inline. |
| **Reschedule** | Task menu (desktop), swipe → Later and long-press (iPhone) | Today / Tomorrow / This weekend / Next week / Pick a date… / Remove due date, each with Undo. Overdue lists offer **Move all to today**. |
| **Undo everything** | Notifications; Ctrl/Cmd+Z | Completing, editing, adding and deleting can all be undone; the last 50 changes are kept. Undoing a repeating task's completion also removes the next copy it created. |
| **Error boundaries** | Every page, dashboard widget and iPhone screen | If something fails to draw, only that part shows "couldn't be shown", with **Try again** and **Copy details**. Your data is never touched. |
| **Plan My Day** | Command Centre greeting, command palette, iPhone Today | Four short steps: catch up on overdue tasks → pick about 3 priorities → look over today's calendar and habits → an optional one-line intention, shown in your greeting until tomorrow. |
| **Getting started + starter templates** | Command Centre card, iPhone Today, palette | Six steps that tick themselves off from your real data. Templates offer 8 habits and 7 repeating routines (some with checklists). Only what you tick is added; nothing is pre-filled or invented. |
| **Local reminders** | Settings → Notifications (desktop and iPhone); per-task "Reminder" | A reminder before tasks with a due time and before timed events. It appears as a banner in the app and as a system notification when LIFE OS is in the background (if allowed). One you missed by up to 15 minutes still shows once. Reminders never repeat after a reload or in a second tab. See the limits below. |
| **Text size** | Settings → Appearance (desktop), Settings → Text Size (iPhone) | 90%, 100%, 110% or 125%. Only text is scaled, at build time: every font size becomes `calc(size × --text-scale)`. Layout, touch targets, menus and drag coordinates stay exact, which isn't true of CSS zoom. iPhone tab labels keep their size, as on iOS. |
| **Smarter command palette** | Ctrl/Cmd+K | Close spellings and abbreviations still match (`grocries`, `dentst`), listed after real matches and commands. Recently opened records come first. On a task, Ctrl/Cmd+Enter completes it without opening it. New commands: Plan my day, Starter templates. |
| **iPhone extras** | Task rows; Home Screen icon | Press and hold a task for Complete, Reschedule, Priority, Edit, Duplicate and Delete. The app manifest has shortcuts: New Task, Today, Write in Journal, Check In. |

### Honest limits

- **Reminders need LIFE OS to be open** — a browser tab, even in the background, or the Windows app. They can't arrive while it's fully closed, because that needs a push server, and LIFE OS keeps your data on your device. Settings says this plainly.
- **iPhone system notifications** need LIFE OS added to the Home Screen (iOS 16.4+) and allowed in iPhone Settings. Otherwise reminders appear as in-app banners.
- **Home Screen shortcuts** (long-press the app icon) work on Android and for installed desktop Chrome/Edge apps. **iOS doesn't support web-app shortcuts**; on iPhone, the long-press menus inside the app give the same speed.
- **Chart axis labels** keep a fixed size under Text size; the chart axes are sized for them.

## Why these, in this order

Each feature was chosen by how often it's used × how much friction it removes × whether existing parts could be reused:

- **Capture, repeat, reschedule and undo** are used many times a day, and each is the top complaint people raise when switching to a new task app.
- **Error boundaries** are cheap insurance against the worst outcome — a blank screen — in an app that holds people's lives.
- **Plan My Day and Getting started** turn a capable app into a daily habit; they're the difference between "nice" and "I open this every morning".
- **Reminders and text size** were missing basics. They were built within real limits (no server; text-only scaling) rather than faked.

## Roadmap — next phase

| # | Feature | Why | Size |
| --- | --- | --- | --- |
| 13 | **Recently deleted (30 days)** | Recover anything after the Undo notice has gone | M–L |
| 14 | **Repeating calendar events** | Weekly classes, meetings, sessions | L |
| 15 | **Habit notes and rest days** | Fairer streaks; context for a missed day | M |
| 16 | **Link tasks and habits to goals** | Goals move as you do the work | M |
| 17 | **CSV export (money, tasks) and calendar (.ics) export** | Use your data in spreadsheets and other calendars | S–M |

## Longer term

| # | Feature | Notes |
| --- | --- | --- |
| 18 | Keyboard list navigation (j/k/x/e) and multi-select | Power-user speed on desktop |
| 19 | General focus timer (Pomodoro) linked to a task | Builds on the study timer |
| 20 | Narrower store subscriptions in dashboard widgets | Only needed once data grows large; today everything re-renders cheaply |
| 21 | App lock / encrypted journal | WebCrypto, with a passphrase you must not lose |
| 22 | Sync, push notifications, calendar and bank connections | Need a backend; see `docs/SUPABASE.md` |

## Tests

- Unit tests cover:
  - the parser (dates across weeks and years, times, repeats, ignored words, switched-off pieces)
  - recurrence (month ends, leap years, weekdays, never in the past)
  - undo history and repeating spawns
  - the smart form
  - reschedule options
  - reminder planning (switches, per-task leads, missed grace, re-arming)
  - Plan My Day selection
  - templates
  - fuzzy search
  - the text-size CSS transform
  - the error boundary
- Browser tests:
  - `e2e/features.spec.ts` (desktop, at a fixed date)
  - the "everyday features" block in `e2e/ios.spec.ts` (iPhone SE, 15 Pro and 16 Pro Max)
- New dialogs, sheets and menus passed a pixel-level contrast audit (WCAG AA) in all four themes in light and dark, and an axe scan.
