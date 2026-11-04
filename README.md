# ATLAS

A private, local-first **personal operating system**: one command centre for your goals, studies, career, projects, money, health, learning, writing, reading and relationships — with analytics calculated only from what you record.

- **Everything stays on your device.** Data is stored in your browser (IndexedDB). No account, no server, no tracking.
- **Starts empty.** No sample data, no invented statistics. Every chart and number comes from your own entries.
- **Never silently loses data.** Changes save automatically, deletions ask first and can be undone, and imports, restores and resets always take a safety backup first.

---

## Quick start

You need [Node.js](https://nodejs.org) **20.19 or newer** (check with `node -v`).

```bash
npm install        # download dependencies (first time only)
npm run dev        # start the app
```

Open **http://localhost:5173**. The first-time setup asks for your name and preferences (all optional — you can skip it).

> Your data lives in the browser profile you use. Opening Atlas in a different browser, or clearing site data, starts fresh — so **export a backup regularly** (Settings → Data & backups).

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server with live reload |
| `npm run build` | Type-check and build an optimised version into `dist/` |
| `npm run preview` | Serve the built version locally |
| `npm run check` | Type-check, lint and run the unit tests |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) on desktop and phone sizes |
| `npm run test:all` | Everything above |

The first time you run browser tests on your own machine, install the browser once with `npx playwright install chromium`.

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
| 13 | **Settings** | Name, theme (dark/light/system) and accent, motion, currency, date/time formats, week start, working hours, default calendar view, dashboard widgets, personal targets, finance categories, privacy, and data: export, validated import with preview (merge or replace), backups and restore, reset. |

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
- **If stored data can't be read** (for example, it was written by a newer version), Atlas shows a recovery screen and does not overwrite anything; you can download the raw data.

## Preloading your own data

You can describe your life once in a JSON profile and turn it into an ordinary Atlas backup file to import. The app itself never loads it on its own: a new install still starts empty.

1. **Keep it private.** `private/` is git-ignored. Put your profile there and nowhere else:
   ```bash
   mkdir -p private && $EDITOR private/profile.json
   ```
2. **Write the profile.** Every section is optional. Amounts are in major units (e.g. `12.50`); the script converts them to pence. Each record needs a `key` (lower-case letters, digits and dashes). It becomes a stable id (`seed-<collection>-<key>`), so importing an updated seed changes records instead of duplicating them.
   ```json
   {
     "settings": { "displayName": "Alex", "currency": "GBP", "dateFormat": "dd/MM/yyyy", "weekStartsOn": 1 },
     "education": {
       "course": { "key": "degree", "name": "BSc Example", "institution": "Example University", "level": "Year 1" },
       "qualifications": [{ "key": "cert", "title": "Example Certificate", "kind": "other", "status": "completed", "grade": "A" }],
       "modules": [{ "key": "stats", "name": "Statistics" }],
       "assessments": [{ "key": "stats-exam", "title": "Statistics exam", "kind": "exam", "moduleKey": "stats", "dueDate": "2030-01-15" }],
       "term": { "teachingStart": "2030-01-06", "teachingEnd": "2030-03-28",
                 "breaks": [{ "key": "break", "title": "Reading week", "start": "2030-02-17", "end": "2030-02-21", "excludeFromTimetable": true }] },
       "timetable": [{ "key": "mon-stats", "weekday": "mon", "moduleKey": "stats", "start": "10:00", "end": "11:00", "cancelled": false }]
     },
     "finance": {
       "recurring": [
         { "key": "rent", "name": "Rent", "amount": 500, "category": "Housing", "frequency": "monthly", "dayOfMonth": 1 },
         { "key": "plan", "name": "Payment plan", "amount": 20, "category": "Other", "dayOfMonth": 15, "remainingPayments": 3 },
         { "key": "pay", "name": "Wages", "kind": "income", "amount": 80, "category": "Salary", "frequency": "weekly", "nextDate": "2030-01-03", "endDate": "2030-03-28" }
       ],
       "monthlyBudget": { "fromRecurring": true, "expectedTotal": 520 },
       "savingsGoals": [{ "key": "isa", "name": "ISA", "target": 1000 }]
     },
     "goals": [{ "key": "run", "title": "Run a 10k", "area": "health" }],
     "habits": [{ "key": "read", "name": "Read 20 minutes", "area": "learning" }],
     "careerPaths": [{ "key": "path", "name": "Data science" }]
   }
   ```
   More sections, all optional:
   ```json
   {
     "events":   [{ "key": "dentist", "title": "Dentist", "date": "2030-02-03", "start": "09:00", "end": "09:30", "location": "High St" }],
     "projects": [{ "key": "app", "name": "Side app", "kind": "business", "objectives": ["Ship MVP"], "milestones": [{ "title": "Beta", "dueDate": "2030-03-01" }] }],
     "notes":    [{ "key": "app-notes", "title": "App ideas", "body": "...", "projectKey": "app", "pinned": true }],
     "routines": [{ "key": "am", "name": "Morning", "timeOfDay": "morning", "days": "every day", "steps": ["Water", "Stretch"] }]
   }
   ```
   Goals also take `milestones`, habits take `days` (e.g. `["mon", "thu"]`) or `"schedule": "weekly"` with `timesPerWeek`, and career paths take a `roadmap`. Events with no `start` are all-day. To bring in a calendar, convert its export into `events` entries and use each event's own id as the `key`, so re-imports update rather than duplicate.

   A few things to know, because the data model has limits:
   - **Timetable:** calendar events have no repeat rule, so each slot is written out as one dated event per week between `teachingStart` and `teachingEnd`.
   - **End dates:** recurring items have no end date, so `endDate` / `remainingPayments` is worked out and written into the item's notes ("3 payments remaining, last on …"). Switch the item off when it ends.
   - **Next payment:** `dayOfMonth` picks the next matching date on or after today. With neither `dayOfMonth` nor `nextDate`, the first date is the build date.
   - **Budget:** `monthlyBudget.fromRecurring` totals your active recurring expenses into a total-spending budget. `expectedTotal` is an optional cross-check; the build fails if the sum differs.
   - **Assessments:** these need a date; a missing `dueDate` becomes the build date, marked as a placeholder in the notes.
   - **Amounts:** they must be above zero, so leave out anything whose amount you don't know yet.
3. **Build and validate:**
   ```bash
   npm run seed:build      # private/profile.json → private/atlas-seed.json (use --today YYYY-MM-DD to pin dates)
   npm run seed:validate   # runs the app's own import validator in strict mode: must report 0 rejected records
   ```
4. **Import it:** Settings → Data & backups → Import → choose `private/atlas-seed.json`.
   - On a **fresh install**, choose **Replace everything**. Your records *and* settings (name, currency, date format, week start) are applied.
   - With existing data, choose **Merge**. Records are added or updated, but **your current settings are kept**, so set name, currency and so on in Settings → General afterwards.
5. **Optional end-to-end check:** `npx playwright test e2e/private-seed.spec.ts --project=desktop` imports the seed with Merge in a real browser, applies its settings, and saves screenshots to `private/screenshots/`. It skips itself when there is no private seed.

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

`npm run build` produces static files in `dist/` that any static host can serve (Netlify, Vercel, Cloudflare Pages, GitHub Pages…). Because Atlas uses normal URLs like `/finance`, the host must send unknown paths to `index.html` — `public/_redirects` (Netlify) and `vercel.json` (Vercel) already do this. Data still lives in each visitor's own browser; nothing is shared between visitors.

### GitHub Pages

`.github/workflows/deploy-pages.yml` runs the checks, builds and publishes the app on every push to `main` (or on demand from the Actions tab).

1. Repo **Settings → Pages → Source: GitHub Actions** (one-time).
2. Push to `main`. The site appears at `https://<username>.github.io/<repo-name>/`.

How it works: Pages serves the app under `/<repo-name>/`, so the workflow builds with `BASE_PATH=/<repo-name>/`. Vite uses that for asset URLs and the router uses it as its `basename`. Pages has no rewrite rules, so the workflow copies `index.html` to `404.html` and deep links like `/finance` still load the app. Without `BASE_PATH` the build targets `/` as before, so Vercel, Netlify and local dev are unchanged. To try the Pages build locally: `BASE_PATH=/life-board/ npm run build && npx vite preview`.

Pages on a private repo needs a paid GitHub plan (Pro, Team or Enterprise). On a free plan, make the repo public or use Vercel or Netlify instead. Data lives in IndexedDB per origin, so the Pages copy starts empty. Use Settings → Data to export from one copy and import into the other.

## Testing

- **70 unit & component tests** (`npm test`) cover dates and money maths, streaks, budgets, grades, agenda building, analytics ranges, search ranking, schema validation and migration, all storage adapters, persistence (including crash recovery and never overwriting unreadable data), backups, imports, forms and delete/undo.
- **19 browser tests** (`npm run test:e2e`) click through the real app on desktop and phone sizes: setup, every section, create/edit/complete/delete/undo, search, dashboard customisation, drag-and-drop on the calendar and project board, journal autosave, export/backup/restore and import validation.
