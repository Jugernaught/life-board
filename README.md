# LIFE//OS

A private, local-first **personal operating system**: one command centre for your goals, studies, career, projects, money, health, learning, writing, reading and relationships — with analytics calculated only from what you record.

- **Everything stays on your device.** Data is stored in your browser (IndexedDB). No account, no server, no tracking.
- **Starts empty.** No sample data, no invented statistics. Every chart and number comes from your own entries.
- **Never silently loses data.** Changes save automatically, deletions ask first and can be undone, and imports, restores and resets always take a safety backup first.
- **Four complete themes** — *Liquid Glass* (the flagship: translucent floating navigation over a soft wallpaper), *Apple Clean*, *Cyberpunk* and *Minimal Dark* — switch instantly in Settings → Appearance with live previews. Every section, desktop and iPhone. See [`docs/THEMES.md`](docs/THEMES.md).
- **A dedicated iPhone version** at `/m/` — bottom tabs, swipe gestures, sheets, light and dark mode — that installs on your Home Screen and works offline. Same data, same logic. See [`docs/IPHONE.md`](docs/IPHONE.md).

---

## Quick start

You need [Node.js](https://nodejs.org) **20.19 or newer** (check with `node -v`).

```bash
npm install        # download dependencies (first time only)
npm run dev        # start the app
```

Open **http://localhost:5173** for the desktop version, or **http://localhost:5173/m/** for the iPhone version. The first-time setup asks for your name and preferences (all optional — you can skip it).

> Your data lives in the browser profile you use. Opening LIFE OS in a different browser, or clearing site data, starts fresh — so **export a backup regularly** (Settings → Data & backups).

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with live reload |
| `npm run build` | Type-check and build an optimised version into `dist/` |
| `npm run preview` | Serve the built version locally |
| `npm run check` | Type-check, lint and run the unit tests |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) on desktop, an Android phone and three iPhone sizes |
| `npm run test:all` | Everything above |

The first time you run browser tests on your own machine, install the browser once with `npx playwright install chromium`.

---

### Windows app

LIFE OS can be packaged as a Windows desktop app (Electron):

```bash
npm run electron:dev     # build and open the app in a desktop window
npm run electron:build   # create release/LIFE OS Setup <version>.exe
```

The desktop app keeps its own local data, separate from the browser version. To move data across, use Settings → Data & backups → Export in the old one, then Import in the new one. The installer is unsigned, so Windows SmartScreen may show "unknown publisher" (choose More info → Run anyway).

---

## What's inside

| # | Section | Highlights |
| --- | --- | --- |
| 01 | **Command Centre** | Greeting and live clock, today's priorities, tasks due/overdue, next 7 days (pulled from every section), habits, this week vs last week, goals, projects, quick add, recent activity, notes, money, check-in, reading, people. Widgets can be shown/hidden, resized and reordered. |
| 02 | **Career & Education** | Several career paths at once with roadmaps and a side-by-side comparison (radar chart); courses → modules → assignments/exams with weighted grade tracking; application pipeline with automatic status history; company research; interview practice with a random question drill; CV & portfolio milestones. |
| 03 | **Projects & Business** | Projects with objectives, tasks, milestones, deadlines, priority, notes, resources and a full change history. Grid or drag-and-drop status board (Planning / Active / On Hold / Completed), progress charts. |
| 04 | **Personal Finances** | Manual income/expense entry (GBP by default), monthly budgets per category or in total, savings goals with contributions, recurring items you log with one click, financial targets, and charts for monthly income vs spending, spending breakdown, cash-flow trend and savings progress. |
| 05 | **Fitness & Routines** | Workouts with exercises (builds personal records), daily activity, sleep (handles past midnight), routines as daily checklists, wellbeing notes, weekly summaries and a consistency calendar. No appearance-based scores. |
| 06 | **Goals & Habits** | Daily → yearly and short/long-term goals in any life area, tracked by %, milestones or a numeric target. Habits (every day, chosen days, or N× per week) with streaks, 7-day check-in grid and completion calendars. Weekly review. |
| 07 | **Learning & Skills** | Skills with their own roadmap, objectives and proficiency history; courses; study sessions (with a focus timer); resources; notes; learning history timeline and charts of time invested. |
| 08 | **Journal & Reflections** | Private writing that autosaves as you type, optional reflection prompts, lessons/challenges/achievements, mood & energy check-ins with trends, searchable history, optional preview blur. |
| 09 | **Daily Schedule** | Day / week / month calendar with time blocks; drag to move, drag the edge to resize, click an empty slot to add. Shows deadlines, exams, interviews, milestones, birthdays and payments from every section. Full task manager. |
| 10 | **Reading & Media** | Books, articles, podcasts, films, documentaries and courses with status, dates, rating, progress, notes and key takeaways. Search, filters and yearly stats. |
| 11 | **Social Life** | Social events, important dates (repeat yearly), people to reconnect with on a chosen rhythm, social commitments and goals, private reflections. Stores only what's needed — a first name is enough. |
| 12 | **Analytics & Reports** | Any date range, this period vs previous, progress against your own targets, trends for tasks, habits, learning, fitness, money, mood and reading, category (life-area) comparisons, printable weekly/monthly reports with an 8-week/6-month history table, and the weekly review. No single "life score". |
| 13 | **Settings** | Name, **Appearance** (four themes with live previews, light/dark/automatic, accent colour, motion, ambient effects, reduce transparency), currency, date/time formats, week start, working hours, default calendar view, dashboard widgets, personal targets, finance categories, privacy, and data: export, validated import with preview (merge or replace), backups and restore, reset. |

### On iPhone

The iPhone version (`/m/`) is a separate app shell built for one-handed use: **Today · Plan · Habits · Journal · More** tabs, per-tab navigation with swipe-back, swipe actions on rows, bottom sheets for forms, iOS-style lists, light/dark following your phone, safe areas for the notch and home indicator, and offline support. Every section and record type is available. Install it with Safari → Share → *Add to Home Screen*. Details, gestures and limitations: [`docs/IPHONE.md`](docs/IPHONE.md).

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl K` / `⌘K` or `/` | Search everything and run commands |
| `N` | Quick add (task, event, goal, note, transaction, journal, workout…) |
| `G` then a letter | Go to a section — `H` home, `C` career, `P` projects, `F` finance, `W` fitness, `G` goals, `L` learning, `J` journal, `S` schedule, `R` reading, `O` social, `A` analytics, `,` settings |
| `[` | Collapse / expand the sidebar |
| `?` | Show all shortcuts |

---

## How it's built (the short version)

| Choice | Why |
| --- | --- |
| **React + TypeScript** (Vite) | TypeScript catches mistakes before the app runs; Vite starts instantly and builds small, fast bundles. Each section loads on demand. |
| **Tailwind CSS v4** with design tokens | All colours are CSS variables in `src/styles/index.css`, so themes and accents switch instantly and stay consistent. |
| **Framer Motion**, **Recharts**, **lucide-react** | Animation, charts and icons. Chart colours were run through a colour-vision-deficiency validator, and every chart has a table view. |
| **Zod** schemas as the single source of truth | `src/data/schema.ts` describes every record. Types, form validation and backup-file validation all come from it. |
| **Zustand** store + **IndexedDB** | One in-memory store holds your data; a small persistence layer saves it to IndexedDB (localStorage as a fallback). Screens never touch storage directly. |
| Fonts bundled locally | No requests to Google or anyone else while you use the app. |

```
src/
  app/            App shell, routes, theme, recovery screen
  components/     Reusable UI (buttons, inputs, modals, charts, layout, command palette, editor)
  data/           Data model: schemas, types, constants, defaults, validation & migration
  features/       One folder per section (career, finance, journal, …)
  forms/          Form definitions for every record type, and the form renderer
  hooks/          Small React hooks (formatters, time, keyboard shortcuts, list filtering)
  lib/            Pure helpers: dates, money, formatting
  selectors/      All calculations (streaks, budgets, grades, agenda, analytics, reports, search)
  storage/        Storage adapters (IndexedDB, localStorage, memory)
  store/          The data store, domain rules, persistence and backups
e2e/              Browser tests and the test-only sample data fixture
docs/             Architecture notes and the Supabase integration guide
```

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Your data

- **Saving:** automatic, about a quarter of a second after each change. The sidebar shows *Saved locally · time*. If a tab closes mid-save, the change is kept in a small write-ahead slot and recovered on next start.
- **Several tabs:** open tabs tell each other about saves and reload, so they don't overwrite each other.
- **Backups:** one automatic backup per day (configurable), plus safety backups before any import, restore or reset. Restore, download or delete them in Settings → Data & backups.
- **Export / import:** a single JSON file containing everything. Imports are fully validated and previewed (with counts and any invalid records listed) before anything changes; choose *merge* or *replace*.
- **If stored data can't be read** (for example, it was written by a newer version), LIFE OS shows a recovery screen and does not overwrite anything; you can download the raw data.

## Features that need external services (not active)

These are deliberately **not** simulated. Each needs an outside service and some configuration:

| Feature | What it would need |
| --- | --- |
| Sync across devices | A backend such as Supabase plus sign-in — see [`docs/SUPABASE.md`](docs/SUPABASE.md). The storage layer is ready for an adapter. |
| Google / Outlook calendar sync | OAuth app credentials and a small server to hold tokens. |
| Bank connections | A regulated Open Banking provider (e.g. TrueLayer, GoCardless) and a server. |
| Reminders / notifications | Push notifications (service worker + push server). |
| Fitness trackers | Apple Health / Google Fit / Fitbit APIs or a companion mobile app. |

## Deploying

`npm run build` produces static files in `dist/` that any static host can serve (Netlify, Vercel, Cloudflare Pages, GitHub Pages…). Because LIFE OS uses normal URLs like `/finance`, the host must send unknown paths to `index.html`, and `/m/...` paths to `m/index.html` — `public/_redirects` + `public/_headers` (Netlify) and `vercel.json` (Vercel) already do this, and keep the iPhone app's service worker (`/m/sw.js`) uncached so updates arrive. Data still lives in each visitor's own browser; nothing is shared between visitors.

### GitHub Pages

`.github/workflows/deploy-pages.yml` runs the checks, builds and publishes the app on every push to `main` (or on demand from the Actions tab).

1. Repo **Settings → Pages → Source: GitHub Actions** (one-time).
2. Push to `main`. The site appears at `https://<username>.github.io/<repo-name>/`.

How it works: Pages serves the app under `/<repo-name>/`, so the workflow builds with `BASE_PATH=/<repo-name>/`. Vite uses that for asset URLs and the router uses it as its `basename`. Pages has no rewrite rules, so the workflow copies `index.html` to `404.html` and deep links like `/finance` still load the app. Without `BASE_PATH` the build targets `/` as before, so Vercel, Netlify and local dev are unchanged. To try the Pages build locally: `BASE_PATH=/life-board/ npm run build && npx vite preview`.

Pages on a private repo needs a paid GitHub plan (Pro, Team or Enterprise). On a free plan, make the repo public or use Vercel or Netlify instead. Data lives in IndexedDB per origin, so the Pages copy starts empty. Use Settings → Data to export from one copy and import into the other.

## Testing

- **80 unit & component tests** (`npm test`) cover dates and money maths, streaks, budgets, grades, agenda building, analytics ranges, search ranking, schema validation and migration, all storage adapters, persistence (including crash recovery and never overwriting unreadable data), backups, imports, forms, delete/undo and the iPhone navigator.
- **64 browser tests** (`npm run test:e2e`) run on a production build:
  - **Desktop & Android (19):** setup, every section, create/edit/complete/delete/undo, search, dashboard customisation, drag-and-drop on the calendar and project board, journal autosave, export/backup/restore and import validation.
  - **iPhone SE, 15 Pro and 16 Pro Max (15 each), light and dark:** onboarding, tab stacks, back button and edge-swipe, swipe-to-delete with confirm and undo, quick add, unsaved-changes guard, habits, journal autosave across reload, transactions, appearance, export/backups, recovery screen, offline start, desktop ↔ iPhone link, and a layout audit of every screen (no sideways scrolling, 16px inputs so iOS doesn't zoom, 24px+ touch targets, safe areas) plus a performance budget (no chart code on first load).
