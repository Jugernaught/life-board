# LIFE OS for iPhone — progress log

This file tracks the iPhone version of LIFE OS so work can be resumed at any point. Update it as each stage changes.

_Last updated: stage 6 in progress (More sections)._

---

## 1. Audit of the existing application

**Purpose:** a private, local-first personal operating system. 13 sections (Command Centre, Career, Projects, Finance, Fitness, Goals & Habits, Learning, Journal, Schedule, Library, Social, Analytics, Settings) over a single local database. No backend; data lives in the browser's IndexedDB.

**Layers and how reusable they are on iPhone**

| Layer | Size | Reusable on mobile? | Notes |
| --- | --- | --- | --- |
| `src/data` — Zod schemas, types, constants, defaults, validation, migration | ~1.6k lines | **Yes, as-is** | UI-agnostic. Single source of truth. |
| `src/lib` — dates, money, formatting, utils | ~0.5k | **Yes, as-is** | Pure functions. |
| `src/selectors` — streaks, budgets, grades, agenda, analytics, reports, search | ~1.3k | **Yes, as-is** | Pure, unit-tested. |
| `src/store` + `src/storage` — Zustand store, lifecycle rules, persistence, backups | ~1.1k | **Yes, as-is** | Same IndexedDB database. |
| `src/forms` — form configs for all 34 record types + `EntityForm` | ~1.3k | **Yes** | Needs 16 px inputs / 44 pt targets (handled with scoped CSS), optional autofocus and a dirty flag. |
| `src/hooks` — `useToday`, `useFormatters`, `useListControls` | ~0.2k | **Yes** | `useGlobalHotkeys` is desktop-only. |
| `src/components/editor` — global create/edit store, `deleteRecord` with confirm + undo | ~0.2k | **Store and delete flow: yes.** Host: no (desktop modal). | |
| `src/components/ui` — buttons, inputs, modal, toast, confirm, badges, progress | ~1.6k | **Partly** | Badges, progress ring/bar, empty states, inputs reusable. Modal, Menu (hover popover) and URL-driven Tabs are desktop patterns. |
| `src/components/charts` — chart kit, heatmap | ~0.2k | **Yes** | Recharts is responsive; heatmap is touch-friendly. |
| `src/components/layout`, `command` | ~0.9k | **No** | Sidebar, top bar, keyboard palette. |
| `src/features/*` — the 13 desktop pages | ~8k | **No (layouts)**, logic patterns reused | Dense multi-column dashboards. |

**Desktop components unsuitable for iPhone (and the mobile replacement)**

| Desktop pattern | Problem on iPhone | Mobile replacement |
| --- | --- | --- |
| 264 px sidebar + top bar | Desktop chrome, unreachable on a phone | Bottom tab bar (5 tabs) + per-tab navigation stacks |
| Tabs synced to the URL | Too many tabs for 390 pt | Segmented controls and grouped lists that push detail screens |
| Centred modal dialogs | Not native; awkward with keyboard | Bottom sheets with grabber, swipe-down to dismiss, keyboard-aware |
| Hover-revealed actions, "…" popover menus | No hover on touch | Swipe actions on rows, action sheets |
| HTML5 drag-and-drop (project board, month grid) | **Doesn't work with touch on iOS** | Status picker / date & time pickers in sheets |
| Pointer-drag calendar blocks | Conflicts with scrolling | Tap a slot to create, tap a block to edit |
| Wide tables (transactions, activity) | Horizontal scrolling | Inset grouped lists, grouped by day |
| 14px inputs | iOS zooms the page on focus below 16 px | 16 px inputs, 44 pt rows |
| `<a download>` export | Unreliable in a home-screen web app | iOS share sheet (Save to Files), download as fallback |
| Desktop fonts (Chakra Petch, Inter) | Not native | SF Pro via the system font stack |

---

## 2. Architecture decision

### Options considered

| Option | Feasibility here | Verdict |
| --- | --- | --- |
| **Native SwiftUI app** | Needs a Mac with Xcode to build, an Apple Developer account ($99/yr) to install outside the simulator, and re-implementing all business logic in Swift. Cannot be built or tested in this environment; the owner currently has no computer. | Rejected |
| **React Native / Expo** | Could reuse the TypeScript logic, but every screen is rewritten, storage needs a new adapter, and getting it onto an iPhone needs Expo Go plus a running dev server, or an EAS build + Apple account. No iOS simulator here to test. | Rejected for now |
| **Capacitor wrapper** | Wraps a web app in a native shell, but still needs Xcode on a Mac to produce the app. | Possible later — the PWA below is the input it would wrap |
| **Dedicated iPhone web app (PWA)** — a separate app shell in the same repo, installed with *Add to Home Screen* | Runs full-screen from the home screen, works offline, reuses 100% of the data, store, selectors and forms. Deployable from a phone (already on Vercel/Netlify). Testable here with emulated iPhones. | **Chosen** |

### Trade-offs of the PWA approach (stated honestly)

- **Pros:** single codebase for logic; nothing duplicated below the UI; no App Store review or fees; updates instantly; installable from Safari; works offline with a service worker; same data model, validation, backups and import/export as desktop.
- **Cons:** no App Store listing; no native haptics (iOS Safari doesn't support the Vibration API); no push notifications unless a push server is added (iOS 16.4+ supports web push for installed apps); no widgets or Siri. Storage is per *browser container* — the home-screen app and Safari keep separate data, so use Export/Import to move data between them. Native-only behaviours (status-bar tap to scroll to top, system-level back swipe) are re-created in JavaScript where possible.

### Structure

```
m/index.html                 Second Vite entry → served at /m/ (separate from the desktop app at /)
public/m/                    Web app manifest and home-screen icons
src/mobile/
  main.tsx, MobileApp.tsx    Entry, theme, gate (splash / recovery / onboarding), hosts
  ios.css                    iOS design tokens, scoped with data-shell="ios" (desktop untouched)
  nav/                       Own stack navigator: per-tab stacks, push/pop animations, edge-swipe back, tab bar
  ui/                        Screen (large-title nav bar), inset grouped lists, swipe rows, sheets, segmented control, switch…
  editor/                    Sheet-based editor host + quick add, reusing the shared editor store and form configs
  screens/                   Today, Plan, Habits, Journal, More → every other section
```

- **Shared, unchanged:** `src/data`, `src/lib`, `src/selectors`, `src/store`, `src/storage`, form configs.
- **Small additive changes to shared code:** `EntityForm` (optional autofocus, dirty callback), `Toaster` (top placement), confirm store export, a `mobileTheme` setting, and extracting the journal autosave and study-timer logic into hooks so desktop and mobile share them.
- **Same data on the same browser:** both shells use the same IndexedDB database, so on one device the desktop and iPhone versions see the same records.
- **Navigation:** custom stack navigator rather than the router, so each tab keeps its own stack and scroll position (like UIKit), pushed screens slide in with the previous one in parallax, and a left-edge swipe pops. The current route is mirrored into the URL hash so a reload returns to the same screen. No server routing is needed.

### Information architecture (tab bar)

| Tab | Contains |
| --- | --- |
| **Today** | Greeting, progress rings, priorities, due/overdue, up next, habits, check-in, this week |
| **Plan** | Calendar (week strip, month, day list/timeline) and Tasks (scopes, swipe actions) |
| **Habits** | Habits (today, 7-day dots, streaks, heatmap detail), Goals (progress controls), Weekly review |
| **Journal** | Today's entry, check-ins, history with search, entry editor with prompts |
| **More** | Search everything; Projects, Career & Education, Finances, Fitness, Learning, Library, Social, Notes, Analytics, Settings |

---

## 3. Implementation plan

1. Shared-code hooks and small additive props (no behaviour change for desktop).
2. Entry, build (multi-page + service worker), manifest and icons.
3. iOS design tokens and base UI kit.
4. Navigator, tab bar, screens, sheets, editor host, quick add, action-sheet confirm.
5. Today, Plan, Habits, Journal.
6. More: Projects, Finance, Fitness, Learning, Career, Library, Social, Notes, Analytics, Settings & Data.
7. Mobile onboarding, install hint, desktop ↔ mobile links.
8. Tests: unit (navigator), Playwright on iPhone SE / 15 Pro / 16 Pro Max in light and dark, axe audit, performance budget.
9. Fix everything found; update docs.

---

## 4. Technical limitations (known up front)

- **Real iOS Safari is not available here.** Tests use Chromium emulating iPhone sizes, touch and user agents. WebKit-specific behaviour (keyboard, standalone status bar, rubber-banding) must be confirmed on a real iPhone.
- **Safe-area insets can't be emulated by Chromium.** Insets are read through CSS variables (`--safe-top` etc.) so tests can inject notch/home-indicator values and verify layout.
- **On-screen keyboard can't be emulated.** Keyboard handling uses `visualViewport` (sheets move above the keyboard; focused fields scroll into view); verified by logic and by checking 16 px inputs.
- **No haptics, no push, no widgets** (see trade-offs).
- **Separate storage per container** on iOS: Safari vs home-screen app.

---

## 5. Completed work

- [x] Audit, architecture decision, plan (this file)
- [x] Stage 1 — shared code: `useJournalDraft` and `useStudyTimer` hooks extracted (desktop now uses them), `mobileTheme` setting, top-placed toasts, exported confirm store, `EntityForm` `autoFocus` / `onDirtyChange` props
- [x] Stage 2 — `m/index.html` entry, multi-page Vite build, generated offline service worker (`/m/sw.js`), web app manifest, home-screen icons
- [x] Stage 3 — iOS tokens (`src/mobile/ios.css`, light + dark, AA contrast), UI kit: Screen (large titles), lists, swipe rows, sheets, action sheets, segmented control, switch, search, chips, keyboard inset
- [x] Stage 4 — navigator (per-tab stacks, hash sync, unit tested), stack view (parallax push/pop, edge-swipe back), tab bar (badge, re-tap to root/top), sheet editor host with unsaved-changes guard, quick add
- [x] Stage 5 — Today, Plan (week strip, month grid, list/hours timeline, tasks), Habits (habits, goals, habit/goal detail, weekly review), Journal (editor, history, mood & energy)
- [x] Onboarding, recovery screen, More (with global search)
- [x] Projects, Finances

## 6. Outstanding tasks

- [ ] Fitness, Learning, Career, Library, Social, Notes, Analytics, Settings & Data screens (temporary placeholders exist, marked `TEMP_STUB`)
- [ ] Desktop ↔ iPhone links
- [ ] Tests and audits (stage 8), fixes (stage 9), docs

## 7. Known bugs

_None open._ (Fixed: bars too translucent; Plan day heading too long on narrow phones.)

## 8. Next implementation steps

Write the remaining More screens, replacing every `TEMP_STUB` file.
