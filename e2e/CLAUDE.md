# Browser tests (Playwright) — working notes

Tests run against a **production build** (`npm run build && vite preview --port 4173`, started by `playwright.config.ts`; an already-running preview is reused locally). Every test gets a fresh browser context, so storage starts empty.

## Projects
| Project | Device | Specs |
| --- | --- | --- |
| `desktop` | Chrome 1440×900 | `core`, `sections`, `features`, `themes` |
| `mobile` | Pixel 7 (the desktop app on a phone) | `mobile.spec.ts` |
| `iphone-se`, `iphone-15-pro`, `iphone-16-pro-max` | iPhone sizes, rendered by Chromium (no WebKit here) | `ios.spec.ts` |

Focused runs: `npx playwright test --project=desktop`, or `-g "test name"`. The full run takes about 6–8 minutes.

## Helpers
- `helpers.ts`:
  - `trackErrors(page)` — every spec asserts there are no console errors in `afterEach`.
  - `skipOnboarding`
  - `importSample(page, path)` — loads `fixtures/sampleData.ts` through the real Settings → Data import.
  - `waitForSave`
- `ios.spec.ts` has its own `start`, `open(page, path)` (opens a screen through the URL hash and reloads), `importSample` (the iPhone Data screen), `swipeLeft`, `longPress` and `top(page)` (the visible screen). It injects safe-area insets per device in `beforeEach`.
- `fixtures/sampleData.ts` is **test-only** data and is never bundled into the app.

## Pitfalls (each one has bitten before)
- **Fixed time:** use `page.clock.install({ time })`, not `setFixedTime`. A frozen clock stops the 250 ms debounced save, so changes never persist.
- **Waiting on async state:** `page.waitForFunction(() => promise)` resolves at once, because a Promise is truthy. Use `await expect.poll(() => page.evaluate(...)).toBe(...)`.
- **iPhone taps:** the floating tab bar and accessory can cover the bottom of the screen. Scroll a low element to the centre first: `locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))`.
- Prefer `getByRole` / `getByTestId`. Field labels include a required marker ("Goal *"), so use the placeholder or an exact role name.
- Before reloading to check that a change persisted, wait for the save: use `waitForSave` on desktop (the save-status badge). The iPhone app has no badge, so poll the visible result after reloading.

## Accessibility and contrast
Axe and pixel-contrast sweeps were run as ad-hoc scripts during refinement passes. They aren't part of this suite. The method and the latest totals are in `docs/THEMES.md` ("Accessibility and testing"). Run them again after visual changes.
