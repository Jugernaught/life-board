# ATLAS for iPhone

A separate, touch-first version of ATLAS built for iPhone. It lives at **`/m/`** next to the desktop app (`/`), shares all of its data and logic, and installs on your Home Screen like an app.

## Install it on your iPhone

1. Deploy the app (see the README's *Deploying* section). For a quick try from a computer on the same Wi-Fi, `npm run dev -- --host` prints a network address you can open on the iPhone — but offline support needs a deployed (HTTPS) build.
2. On your iPhone, open **Safari** and go to `https://<your-site>/m/`.
3. Tap the **Share** button (square with an up arrow) → **Add to Home Screen** → **Add**.
4. Open ATLAS from its new icon. It runs full-screen, without Safari's toolbars, and works offline after the first visit.

The desktop version shows an *“On a phone? Open the iPhone version”* banner on phones, and Settings → General has an *iPhone version* link.

### Where your data lives — read this once

- Data is stored **on the iPhone only**, inside the browser storage of whichever way you open it.
- **The Home Screen app and Safari keep separate copies.** iOS gives installed web apps their own storage. To move data between them, use **More → Settings → Data & Backups → Export Backup** in one and **Import From File…** in the other.
- On the **same browser**, the desktop (`/`) and iPhone (`/m/`) versions see the **same data** — they're two views of one database.
- If you use it in Safari **without** adding it to the Home Screen, Safari may delete its storage after about 7 days without a visit (an iOS rule for websites). Installed Home Screen apps are exempt. Export a backup now and then either way.

## How it's organised

| Tab | What's there |
| --- | --- |
| **Today** | Progress rings, priorities, tasks due/overdue, up next, habits, mood & energy check-in, this week vs last week, recent activity |
| **Plan** | Calendar (swipeable week strip, month grid, list or hour timeline — tap an hour to add) and Tasks (Today, Upcoming, Overdue, No date, All, Completed) |
| **Habits** | Habits with 7-day dots and streaks, habit detail with a tappable history calendar, goals with progress controls and milestones, weekly review |
| **Journal** | Today's entry (autosaves), reflection prompts, searchable history, mood & energy trend |
| **More** | Search everything, plus Projects, Career & Education, Finances, Fitness, Learning, Library, Social, Notes, Analytics, Settings |

### Themes

More → Settings → **Theme** offers the same four themes as the desktop version, with a live miniature of each:

- **Liquid Glass** — a floating glass tab bar with a sliding selection lens, plus a contextual button beside it (Quick add on Today, New task on Plan, New habit on Habits, Write on Journal, Search on More). Navigation-bar buttons sit in glass capsules.
- **Apple Clean** — the classic iOS look with a full-width tab bar.
- **Cyberpunk** and **Minimal Dark** — dark-only, with a floating tab bar.

*Reduce Transparency* replaces glass with solid surfaces. The theme is shared with the desktop version on the same browser.

### Gestures and controls

- **Swipe from the left edge** to go back (or tap **‹ Back**). Each tab keeps its own place — switch tabs and come back to exactly where you were.
- **Tap the current tab again** to go back to its first screen; tap once more to scroll to the top.
- **Swipe a row left** for actions (Delete, Priority, Pause, Status, +1…). Deletions ask first and can be undone from the message that appears.
- **New and edit forms open as sheets.** Drag the sheet down or tap Cancel to close; if you've typed something, it asks before discarding it.
- **+** in the top right adds something relevant to the screen you're on.

## What's different from desktop (on purpose)

| Desktop | iPhone |
| --- | --- |
| Drag-and-drop project board and calendar blocks | Status and times are set in sheets — HTML drag-and-drop doesn't work with touch on iOS |
| Wide tables | Grouped lists, by day or status |
| Many charts side by side | One chart at a time (pick it with the chips) |
| Customisable dashboard widgets | A fixed Today screen designed for one-handed use |
| Print / save as PDF report | Share the report text (Notes, Mail, Messages…) |
| Download backup file | Share sheet → *Save to Files* (download if sharing isn't available) |

Everything is still there: every record type can be created, edited and deleted on iPhone.

## What a web app can't do on iPhone

These need a native iOS app or a server, and are **not** pretended:

- **Haptics** — Safari doesn't expose the Taptic Engine to web pages.
- **Notifications** — possible for installed web apps since iOS 16.4, but they need a push server; none is included.
- **Widgets, Siri, Shortcuts, Apple Health** — native-only.
- **Sync between devices** — needs a backend (see `docs/SUPABASE.md`).

## For developers

- Hosting under a sub-path (e.g. GitHub Pages `/life-board/`): the iPhone app reads `import.meta.env.BASE_URL` for its links, service worker and icons, and its manifest uses relative URLs, so it installs from `…/m/` wherever the site is served.
- Entry: `m/index.html` → `src/mobile/main.tsx`. Code: `src/mobile/` (shell, navigator, UI kit, screens). Shared with desktop: `src/data`, `src/lib`, `src/selectors`, `src/store`, `src/storage`, `src/forms`.
- `npm run dev` serves both: desktop at `/`, iPhone at `/m/`. Use your browser's device toolbar (iPhone 15 Pro, touch on) to work on it.
- Offline support: `vite.config.ts` generates `/m/sw.js` at build time, precaching every file the iPhone app can load (screens are lazy-loaded, then cached). It only runs in production builds.
- Tests: `npx playwright test --project=iphone-se --project=iphone-15-pro --project=iphone-16-pro-max` runs `e2e/ios.spec.ts` on three iPhone sizes, light and dark, with simulated notch / home-indicator insets.
- Design and progress notes: [`MOBILE_PROGRESS.md`](../MOBILE_PROGRESS.md).
