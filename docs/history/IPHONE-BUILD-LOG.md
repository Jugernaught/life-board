> **Historical.** This is the build log of the first iPhone version. It is kept for its design decisions; current status lives in [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md).

# LIFE OS for iPhone — progress log

This file tracks the iPhone version of LIFE OS so work can be resumed at any point. Update it as each stage changes.

_Last updated: all stages complete — implemented, tested on three iPhone sizes, documented._

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
- [x] **Stage 1 — shared code (additive only):** `useJournalDraft` and `useStudyTimer` hooks extracted (desktop now uses them too), `mobileTheme` setting, top-placed toasts, exported confirm store, `EntityForm` `autoFocus` / `onDirtyChange`, `formatBytes` GB unit, read-only `Heatmap` is keyboard-focusable
- [x] **Stage 2 — build:** `m/index.html` entry, multi-page Vite build, generated offline service worker (`/m/sw.js`), web app manifest, Home Screen icons, Vercel/Netlify rewrites and headers for `/m/`
- [x] **Stage 3 — design system:** iOS tokens (`src/mobile/ios.css`, light + dark, WCAG AA), UI kit: Screen with large titles, grouped lists, swipe rows, sheets, action sheets, segmented control, switch, search, chips, star rating, keyboard inset
- [x] **Stage 4 — navigation:** per-tab stacks (UIKit semantics), hash restore, parallax push/pop, edge-swipe back, tab bar (badge, re-tap to root/top), lazy tab mounting, sheet editor with unsaved-changes guard, quick add, UIKit-style back labels
- [x] **Stage 5 — core tabs:** Today, Plan (week strip, month grid, list/hours timeline, tasks), Habits (habits, goals, details, weekly review), Journal (editor, history, mood & energy)
- [x] **Stage 6 — More:** Projects, Career & Education (paths with scoring, courses → modules → assessments, applications, interview practice, companies, CV & portfolio, qualifications), Finances, Fitness, Learning (focus timer, skills with proficiency & roadmap), Library, Social, Notes, Analytics (ranges incl. custom, comparisons, targets, trends, areas, shareable reports), Settings, Targets, Categories, Data & Backups (export via share sheet, validated import preview, backups, protection, erase/reset)
- [x] **Stage 7 — onboarding & links:** iPhone onboarding and recovery screens, install hint, desktop banner on phones and a Settings link to `/m/`, link back to desktop
- [x] **Stage 8 — tests & audits:**
  - `e2e/ios.spec.ts`: 15 tests × iPhone SE (light), 15 Pro (dark), 16 Pro Max (light) = **45 passing**
  - desktop + Android suites still **19/19 passing**; unit tests **80/80**
  - axe-core audit of every screen, detail screens and sheets in light and dark: **0 violations**
  - visual review of the screens on iPhone SE (light) and 15 Pro (dark) with sample data
- [x] **Stage 9 — fixes and docs:** everything found below was fixed; `docs/IPHONE.md`, README and `docs/ARCHITECTURE.md` updated

### Bugs found by testing, all fixed

| Found by | Problem | Fix |
| --- | --- | --- |
| Offline e2e | Lazily loaded screens failed offline: module scripts carry an `Origin` header and the precached responses had `Vary: Origin`, so the cache missed | Service worker matches with `ignoreVary` (safe: hashed files never change) |
| Performance e2e | Rolldown's chunk groups pulled React into the **charts** chunk, so both apps downloaded the 433 KB chart library on first load | Explicit code-splitting groups without recursive dependency capture; charts now load only on chart screens (desktop benefits too) |
| Performance e2e | All five tabs mounted at start, so the Journal tab's chart loaded on Today | Tabs mount on first visit (like UITabBarController); Mood & Energy chart in its own module |
| Visual review | Long back labels overlapped titles on iPhone SE | Nav bar grid with equal side columns; back label measures itself and falls back to “Back”, then chevron only |
| Visual review | Separators under swipe rows were hidden; red delete action showed through rounded corners | Separator above the row layer; actions invisible until the row moves |
| Visual review | Chip rows touched the screen edge; selected chip could be off-screen | Consistent padding; selected chip scrolls into view |
| Layout e2e | “See All”, “Choose a skill” and month title buttons were 20–22 px tall | 44 pt hit areas without changing the look |
| axe | Content outside landmarks; unnamed progress bars; a link nested inside a row button; 4.45:1 caption contrast; non-focusable scroll area | `main` per screen; decorative progress lines hidden from assistive tech; trailing controls beside (not inside) row buttons; higher-contrast caption; focusable read-only heatmap |
| Review | “This week” learning compared a part-way week with all of last week | Compares with the same days of last week |
| Review | Stat deltas showed raw minutes/pence | `StatTile` takes a formatter |
| Review | Opening a linked record (course → module) dropped the previous screen from the stack | In-tab pushes always go on top; existing screens are popped back to |
| Review | Long action sheets could overflow on iPhone SE | Scrollable, height-capped action sheets |

## 6. Outstanding tasks

None for this scope. Possible next steps are listed in section 8.

## 7. Known limitations (not bugs)

- **Tested in Chromium with iPhone profiles, not real Safari.** WebKit isn't installable here. Things to confirm on a real iPhone: keyboard behaviour in sheets (`visualViewport`), standalone status bar colour, rubber-band scrolling, the share sheet (`navigator.share` with files).
- **Separate storage** for the Home Screen app vs Safari (iOS rule) — explained in the app and in `docs/IPHONE.md`.
- **No haptics, push notifications, widgets, Siri or Apple Health** — need a native app or a server.
- **Drag-and-drop** (project board, calendar blocks) is replaced by pickers in sheets — HTML drag-and-drop doesn't work with touch on iOS.

## 8. Next steps (optional)

1. Try it on a real iPhone: deploy, open `/m/` in Safari, Add to Home Screen, and check the four WebKit items above.
2. Web push reminders (needs a small push server; iOS 16.4+ supports it for installed web apps).
3. If App Store distribution is wanted later: wrap `/m/` with Capacitor (needs a Mac with Xcode and an Apple Developer account).
4. Sync between iPhone and computer via the Supabase adapter described in `docs/SUPABASE.md`.
