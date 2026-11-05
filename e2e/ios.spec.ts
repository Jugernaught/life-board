/**
 * The iPhone version (/m/), on iPhone SE, 15 Pro and 16 Pro Max screen
 * sizes in light and dark mode. Safe-area insets can't be emulated by the
 * browser, so each device's notch / home-indicator insets are injected
 * through the same CSS variables the app reads.
 */
import { type Page, expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { ROUTE_PATTERNS } from '../src/mobile/nav/paths'
import { buildSampleBackup } from './fixtures/sampleData'
import { trackErrors } from './helpers'

const INSETS: Record<string, { top: number; bottom: number }> = {
  'iphone-se': { top: 20, bottom: 0 },
  'iphone-15-pro': { top: 59, bottom: 34 },
  'iphone-16-pro-max': { top: 62, bottom: 34 },
}
const STATIC_SCREENS = ROUTE_PATTERNS.filter((p) => !p.includes(':'))

let errors: string[] = []

test.beforeEach(async ({ page }, info) => {
  const inset = INSETS[info.project.name] ?? { top: 0, bottom: 0 }
  await page.addInitScript(({ top, bottom }) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = `:root[data-shell="ios"]{--safe-top:${top}px !important;--safe-bottom:${bottom}px !important}`
      document.head.appendChild(s)
    })
  }, inset)
  errors = trackErrors(page)
})

test.afterEach(() => {
  expect(errors, 'console errors').toEqual([])
})

async function start(page: Page) {
  await page.goto('/m/')
  await page.getByTestId('m-onboarding-skip').click()
  await expect(page.getByTestId('tab-today')).toBeVisible()
}

/** Open a screen directly (the app restores the screen from the URL hash). */
async function open(page: Page, path: string) {
  await page.goto(`/m/#/${path}`)
  await page.reload()
  await expect(page.getByTestId('tab-today')).toBeVisible()
}

/** Import the test fixture through the iPhone Data screen (the real import flow). */
async function importSample(page: Page, file: string) {
  writeFileSync(file, JSON.stringify(buildSampleBackup()))
  await open(page, 'more/settings/data')
  await page.getByTestId('data-import-file').setInputFiles(file)
  await expect(page.getByTestId('import-sheet')).toBeVisible()
  await page.getByRole('radio', { name: 'Replace All' }).click()
  await page.getByTestId('import-apply').click()
  await page.getByTestId('confirm-button').click()
  await expect(page.getByText('Import complete')).toBeVisible()
}

/** The visible (top) screen of the active tab. */
const top = (page: Page) => page.locator('[data-stack-role="top"]:visible').last()

async function swipeLeft(page: Page, locator: ReturnType<Page['locator']>, distance = 180) {
  // Scroll it clear of the bars first, as a person would before swiping.
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(150)
  const box = (await locator.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width - 20, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width - 20 - (distance * i) / 8, y)
  await page.mouse.up()
}

test('first run: onboarding saves the name and opens Today', async ({ page }) => {
  await page.goto('/m/')
  await expect(page.getByTestId('m-onboarding')).toBeVisible()
  await page.getByTestId('m-onboarding-next').click()
  await page.getByTestId('m-onboarding-name').fill('Alex')
  await page.getByTestId('m-onboarding-next').click()
  await page.getByTestId('m-onboarding-next').click()
  await expect(page.getByTestId('screen-today')).toContainText('Alex')
  await page.reload()
  await expect(page.getByTestId('screen-today')).toContainText('Alex')
  await expect(page.getByTestId('m-onboarding')).toHaveCount(0)
})

test('tabs keep their own stacks; back button and edge swipe pop', async ({ page }) => {
  await start(page)
  await page.getByTestId('tab-more').click()
  await page.getByTestId('more-finance').click()
  await expect(top(page).getByTestId('screen-finance')).toBeVisible()
  await top(page).getByRole('group', { name: 'Budgets' }).getByRole('button', { name: 'See All' }).click()
  await expect(top(page).getByTestId('screen-budgets')).toBeVisible()
  expect(page.url()).toContain('#/more/finance/budgets')

  // Switching tabs and back keeps the stack.
  await page.getByTestId('tab-habits').click()
  await expect(page.getByTestId('screen-habits')).toBeVisible()
  await page.getByTestId('tab-more').click()
  await expect(top(page).getByTestId('screen-budgets')).toBeVisible()

  // Back button.
  await top(page).getByTestId('nav-back').click()
  await expect(top(page).getByTestId('screen-finance')).toBeVisible()

  // Left-edge swipe, like iOS.
  await page.mouse.move(4, 400)
  await page.mouse.down()
  for (let x = 20; x <= 300; x += 35) await page.mouse.move(x, 402)
  await page.mouse.up()
  await expect(top(page).getByTestId('screen-more')).toBeVisible()

  // Re-tapping the active tab pops to its root.
  await page.getByTestId('more-projects').click()
  await expect(top(page).getByTestId('screen-projects')).toBeVisible()
  await page.getByTestId('tab-more').click()
  await expect(top(page).getByTestId('screen-more')).toBeVisible()
})

test('tasks: add inline, swipe to delete with confirmation and undo, complete', async ({ page }) => {
  await start(page)
  await page.getByTestId('add-today-task').fill('Buy milk')
  await page.getByTestId('add-today-task').press('Enter')
  const row = top(page).getByTestId('m-task-row').filter({ hasText: 'Buy milk' })
  await expect(row).toBeVisible()

  // Swipe left → Delete → confirm in the action sheet → Undo brings it back.
  await swipeLeft(page, row)
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('action-sheet')).toBeVisible()
  await page.getByTestId('confirm-button').click()
  await expect(row).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(row).toBeVisible()

  // Completing it moves it off Today's list and into Completed.
  await row.getByRole('checkbox').click()
  await expect(row).toHaveCount(0)
  await page.getByTestId('tab-plan').click()
  await page.getByRole('radio', { name: 'Tasks' }).click()
  await page.getByRole('radio', { name: /^Completed/ }).click()
  const done = top(page).getByTestId('m-task-row').filter({ hasText: 'Buy milk' })
  await expect(done.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
})

test('quick add sheet creates a task; unsaved edits ask before closing', async ({ page }) => {
  await start(page)
  await page.getByTestId('today-add').click()
  const sheet = page.getByTestId('quick-add-sheet')
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Title').fill('Call the bank')
  await page.getByTestId('quick-add-save').click()
  await expect(sheet).toHaveCount(0)
  await page.getByTestId('tab-plan').click()
  await page.getByRole('radio', { name: 'Tasks' }).click()
  await page.getByRole('radio', { name: /^All/ }).click()
  await expect(top(page).getByTestId('m-task-row').filter({ hasText: 'Call the bank' })).toBeVisible()

  // Edit: change the title, then cancel → "Discard changes?"
  await top(page).getByTestId('m-task-row').filter({ hasText: 'Call the bank' }).getByText('Call the bank').click()
  const editor = page.getByTestId('editor-sheet')
  await expect(editor).toBeVisible()
  await editor.getByLabel('Title').fill('Call the bank today')
  await editor.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByTestId('action-sheet')).toContainText('Discard')
  await page.getByTestId('confirm-button').click()
  await expect(editor).toHaveCount(0)
  await expect(top(page).getByTestId('m-task-row').filter({ hasText: 'Call the bank today' })).toHaveCount(0)
})

test('habits: check in from Today and see it on the Habits tab', async ({ page }, info) => {
  await start(page)
  await importSample(page, info.outputPath('sample.json'))
  await open(page, 'today')
  const habit = page.getByTestId('today-habit').first()
  const before = await habit.getAttribute('aria-checked')
  await habit.click()
  await expect(habit).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
  await page.getByTestId('tab-habits').click()
  await expect(page.getByTestId('m-habit-row').first()).toBeVisible()
  await page.getByTestId('m-habit-row').first().click()
  await expect(top(page).getByTestId('screen-habit')).toBeVisible()
})

test('journal autosaves and survives a reload', async ({ page }) => {
  await start(page)
  await page.getByTestId('tab-journal').click()
  await page.getByTestId('journal-today').click()
  const body = top(page).getByTestId('m-journal-body')
  await body.fill('A calm, productive day.')
  await expect(top(page).getByTestId('m-journal-status')).toContainText(/Saved/i, { timeout: 5000 })
  await page.reload()
  await expect(top(page).getByTestId('m-journal-body')).toHaveValue('A calm, productive day.')
  await page.getByTestId('tab-journal').click()
  await expect(page.getByTestId('m-journal-row').first()).toBeVisible()
})

test('finance: add a transaction and see the month summary update', async ({ page }) => {
  await start(page)
  await open(page, 'more/finance')
  await page.getByTestId('finance-add').click()
  const editor = page.getByTestId('editor-sheet')
  await expect(editor).toBeVisible()
  await editor.getByLabel('Amount').fill('12.50')
  await editor.getByLabel('Category').fill('Groceries')
  await page.getByTestId('editor-save').click()
  await expect(editor).toHaveCount(0)
  // The summary rounds to whole pounds; the row shows the exact amount.
  await expect(page.getByTestId('finance-summary')).toContainText(/Spent\s*£13/)
  await expect(top(page).getByTestId('m-tx-row').filter({ hasText: 'Groceries' })).toContainText('£12.50')
})

test('settings: appearance follows the choice and persists', async ({ page }) => {
  await start(page)
  await open(page, 'more/settings')
  await page.getByRole('radio', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('radio', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  // Apple Clean in light mode uses the iOS system grouped background.
  await page.getByTestId('m-theme-clean').click()
  await expect(page.locator('html')).toHaveAttribute('data-style', 'clean')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(242, 242, 247)')
})

test('themes: every theme switches instantly, applies everywhere and persists', async ({ page }) => {
  await start(page)
  // Liquid Glass is the default: a floating glass tab bar with a contextual button.
  await expect(page.locator('html')).toHaveAttribute('data-style', 'glass')
  await expect(page.getByTestId('tab-capsule')).toBeVisible()
  await expect(page.getByTestId('tab-accessory')).toHaveAccessibleName('Quick add')
  await page.getByTestId('tab-journal').click()
  await expect(page.getByTestId('tab-accessory')).toHaveAccessibleName('Write today’s entry')

  await open(page, 'more/settings')
  await page.getByRole('radio', { name: 'Light', exact: true }).click()
  const seen = new Set<string>()
  for (const style of ['clean', 'cyber', 'minimal', 'glass'] as const) {
    await page.getByTestId(`m-theme-${style}`).click()
    await expect(page.locator('html')).toHaveAttribute('data-style', style)
    // Dark-only themes stay dark even when Light is chosen.
    await expect(page.locator('html')).toHaveAttribute('data-theme', style === 'cyber' || style === 'minimal' ? 'dark' : 'light')
    // Apple Clean keeps the classic tab bar; the others float.
    await expect(page.getByTestId('tab-capsule')).toHaveCount(style === 'clean' ? 0 : 1)
    seen.add(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
  }
  expect(seen.size, 'each theme has its own backdrop').toBeGreaterThanOrEqual(3)

  // Persists across a reload, and the desktop version uses the same theme.
  await page.getByTestId('m-theme-cyber').click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-style', 'cyber')
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-style', 'cyber')

  // Reduce Transparency turns glass into solid surfaces.
  await open(page, 'more/settings')
  await page.getByTestId('m-theme-glass').click()
  await page.getByTestId('settings-reduce-transparency').click()
  await expect(page.locator('html')).toHaveAttribute('data-transparency', 'reduced')
  const filter = await page.getByTestId('tab-capsule').evaluate((el) => getComputedStyle(el).backdropFilter)
  expect(filter).toBe('none')
})

test('data: export downloads a backup file; backups can be created', async ({ page }) => {
  await start(page)
  await page.getByTestId('add-today-task').fill('Exported task')
  await page.getByTestId('add-today-task').press('Enter')
  await open(page, 'more/settings/data')
  const download = page.waitForEvent('download')
  await page.getByTestId('data-export').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^atlas-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await page.getByTestId('data-backup-now').click()
  await expect(page.getByTestId('m-backup-row').first()).toBeVisible()
})

test('layout: every screen fits the width, respects safe areas, and uses 16px inputs', async ({ page }, info) => {
  const inset = INSETS[info.project.name]
  await start(page)
  await importSample(page, info.outputPath('sample.json'))
  for (const path of STATIC_SCREENS) {
    await open(page, path)
    const screen = top(page)
    await expect(screen).toBeVisible()
    const report = await page.evaluate(
      ({ insetTop }) => {
        const root = [...document.querySelectorAll<HTMLElement>('[data-stack-role="top"]')].filter((e) => e.offsetParent !== null).pop()!
        const vw = window.innerWidth
        const out = { overflow: [] as string[], smallInputs: [] as string[], smallTargets: [] as string[], underStatusBar: [] as string[] }
        for (const el of root.querySelectorAll<HTMLElement>('*')) {
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height) continue
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.opacity === '0') continue
          // Content may scroll horizontally inside chip rows / charts, but must not push the page wider.
          const scroller = el.closest('[class*="overflow-x-auto"], .recharts-wrapper, [data-swipe-row]')
          if (!scroller && r.right > vw + 1) out.overflow.push(`${el.tagName}.${el.className}`.slice(0, 80))
          if (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select') && parseFloat(style.fontSize) < 16) out.smallInputs.push(el.outerHTML.slice(0, 80))
          // WCAG 2.2 target size (minimum): 24×24 CSS px.
          if (el.matches('button, a[href], [role=switch], [role=checkbox], [role=radio]') && !el.closest('[aria-hidden=true], .recharts-wrapper') && (r.width < 24 || r.height < 24)) out.smallTargets.push(`${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
          if (el.matches('button, a[href]') && r.top < insetTop - 1 && r.bottom > 0 && !el.closest('[data-screen-scroll]')) out.underStatusBar.push(el.outerHTML.slice(0, 80))
        }
        return out
      },
      { insetTop: inset.top },
    )
    expect(report.overflow, `horizontal overflow on ${path}`).toEqual([])
    expect(report.smallInputs, `inputs under 16px on ${path} (iOS zooms them)`).toEqual([])
    expect(report.smallTargets, `touch targets under 24×24 on ${path}`).toEqual([])
    expect(report.underStatusBar, `buttons under the status bar on ${path}`).toEqual([])
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(pageOverflow, `page scrolls sideways on ${path}`).toBeLessThanOrEqual(0)
  }
  // The tab bar sits above the home indicator; the nav bar below the status bar.
  const tabBar = await page.getByTestId('tab-today').evaluate((el) => el.closest('nav')!.getBoundingClientRect())
  const vh = page.viewportSize()!.height
  expect(Math.round(vh - tabBar.bottom)).toBeLessThanOrEqual(1)
  const tabItem = await page.getByTestId('tab-today').boundingBox()
  expect(tabItem!.y + tabItem!.height).toBeLessThanOrEqual(vh - inset.bottom + 1)
  expect(tabItem!.height).toBeGreaterThanOrEqual(44)
  const back = await top(page).getByTestId('nav-back').boundingBox()
  expect(back!.y).toBeGreaterThanOrEqual(inset.top - 1)
  expect(back!.height).toBeGreaterThanOrEqual(44)
})

test('empty state: a brand-new install renders every screen without errors', async ({ page }) => {
  await start(page)
  for (const path of STATIC_SCREENS) {
    await open(page, path)
    await expect(top(page)).toBeVisible()
    await expect(top(page).locator('text=/undefined|NaN/')).toHaveCount(0)
  }
})

test('recovery: unreadable stored data is never overwritten', async ({ page }) => {
  await start(page)
  // Wait until the app's own (debounced) save has landed, so it can't overwrite the corruption.
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open('atlas', 1)
        req.onsuccess = () => {
          const get = req.result.transaction('state').objectStore('state').get('database')
          get.onsuccess = () => resolve((get.result as { settings?: { onboarded?: boolean } } | undefined)?.settings?.onboarded === true)
          get.onerror = () => resolve(false)
        }
        req.onerror = () => resolve(false)
      }),
  )
  // Corrupt storage from a blank page on the same origin, after the app has
  // unloaded. Doing it under the running app races its own saves: a late
  // debounced save, or the page-hide flush and write-ahead slot on reload,
  // would rightly put the newer good data back and the test would flake.
  await page.route('**/__blank', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }))
  await page.goto('/__blank')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        localStorage.removeItem('atlas:pending-save')
        const req = indexedDB.open('atlas', 1)
        req.onsuccess = () => {
          const tx = req.result.transaction('state', 'readwrite')
          tx.objectStore('state').put('this is not an ATLAS database', 'database')
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      }),
  )
  await page.goto('/m/')
  await expect(page.getByRole('heading', { name: /couldn’t be loaded/ })).toBeVisible()
  const stillThere = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('atlas', 1)
        req.onsuccess = () => {
          const get = req.result.transaction('state').objectStore('state').get('database')
          get.onsuccess = () => resolve(get.result)
        }
      }),
  )
  expect(stillThere).toBe('this is not an ATLAS database')
  errors = errors.filter((e) => !/Could not|invalid|Expected/i.test(e))
})

test('performance: Today loads without the chart library, within budget', async ({ page }) => {
  const scripts: { url: string; bytes: number }[] = []
  page.on('response', async (r) => {
    if (r.request().resourceType() === 'script') scripts.push({ url: r.url(), bytes: (await r.body().catch(() => Buffer.alloc(0))).length })
  })
  const t0 = Date.now()
  await start(page)
  const elapsed = Date.now() - t0
  expect(scripts.some((s) => /\/assets\/charts-/.test(s.url)), 'chart library loaded on Today').toBe(false)
  const total = scripts.reduce((n, s) => n + s.bytes, 0)
  // Uncompressed JavaScript for first paint of Today (gzip is roughly a third of this).
  expect(total, `initial JS ${Math.round(total / 1024)} KB`).toBeLessThan(900 * 1024)
  expect(elapsed).toBeLessThan(8000)
  // Charts load on demand when a screen needs them.
  await open(page, 'more/analytics')
  await expect(page.getByTestId('analytics-chart')).toBeVisible()
})

test('offline: after the first visit the app opens without a network', async ({ page, context }) => {
  await start(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Let the service worker finish precaching, then take control on reload.
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('atlas-m')), null, { timeout: 15000 })
  await page.reload()
  await expect(page.getByTestId('tab-today')).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('tab-today')).toBeVisible()
  await page.getByTestId('tab-more').click()
  await page.getByTestId('more-analytics').click()
  await expect(page.getByTestId('screen-analytics')).toBeVisible()
  await context.setOffline(false)
  errors = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to fetch/i.test(e))
})

test('the desktop app is untouched and links to the iPhone version', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
  await expect(page.locator('html')).not.toHaveAttribute('data-shell', 'ios')
  await expect(page.getByTestId('mobile-banner')).toBeVisible()
  await page.getByTestId('mobile-banner-open').click()
  await expect(page).toHaveURL(/\/m\/(#\/today)?$/)
  // Same data on the same device: onboarding was already completed on desktop.
  await expect(page.getByTestId('tab-today')).toBeVisible()
})
