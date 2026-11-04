/**
 * Loads YOUR seed (private/life-os-seed.json, git-ignored) through the real
 * Settings → Data & backups → Import flow in Merge mode, applies the seed's
 * settings through the Settings screen (Merge keeps existing settings), and
 * saves screenshots to private/screenshots/.
 *
 * Skipped automatically when there is no private seed, so it never runs in CI
 * or for anyone who has not made one.
 *
 *   npm run seed:build && npx playwright test e2e/private-seed.spec.ts --project=desktop
 */
import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { skipOnboarding, trackErrors, waitForSave } from './helpers'

const SEED = resolve(process.env.LIFE_OS_SEED ?? 'private/life-os-seed.json')
const SHOTS = resolve('private/screenshots')

test.skip(!existsSync(SEED), `No private seed at ${SEED} — run npm run seed:build first`)
test.use({ deviceScaleFactor: 2 })
test.setTimeout(180_000) // visits every seeded section

test('private seed imports cleanly with Merge and shows up across the app', async ({ page }) => {
  const backup = JSON.parse(readFileSync(SEED, 'utf8'))
  const data = backup.data as Record<string, unknown>
  const total = Object.entries(data)
    .filter(([k, v]) => k !== 'activity' && Array.isArray(v))
    .reduce((n, [, v]) => n + (v as unknown[]).length, 0)
  const settings = (data.settings ?? {}) as { displayName?: string; currency?: string; dateFormat?: string; weekStartsOn?: 0 | 1 }
  mkdirSync(SHOTS, { recursive: true })
  const errors = trackErrors(page)

  await skipOnboarding(page)

  // --- import (Merge) ---
  await page.goto('/settings?tab=data')
  await page.getByTestId('import-file').setInputFiles(SEED)
  await expect(page.getByText(`Validated ${total} records`)).toBeVisible()
  await expect(page.getByText(/invalid and will be skipped/)).toHaveCount(0)
  await page.getByRole('radio', { name: 'Merge (keep both)' }).click()
  await page.getByTestId('apply-import').click()
  await expect(page.getByText('Import complete')).toBeVisible()
  await expect(page.getByText(`${total} added, 0 updated`)).toBeVisible()
  await waitForSave(page)

  // --- settings (Merge keeps current settings, so set them like a person would) ---
  await page.goto('/settings')
  if (settings.displayName) await page.getByLabel('Display name').fill(settings.displayName)
  if (settings.currency) await page.getByLabel('Currency').selectOption(settings.currency)
  if (settings.dateFormat) await page.getByLabel('Date format').selectOption(settings.dateFormat)
  if (settings.weekStartsOn !== undefined) await page.getByRole('radio', { name: settings.weekStartsOn === 1 ? 'Monday' : 'Sunday' }).click()
  await waitForSave(page)

  // --- dashboard ---
  await page.goto('/')
  if (settings.displayName) await expect(page.getByRole('heading', { level: 1 })).toContainText(settings.displayName)
  await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true })

  // --- finance ---
  const budget = ((data.budgets ?? []) as { category: string; limit: number }[]).find((b) => b.category === '*')
  // The budgets tab shows whole units (e.g. £12 for 1234 pence).
  const wholeMoney = (minor: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: settings.currency ?? 'GBP', maximumFractionDigits: 0 }).format(Math.round(minor / 100))
  await page.goto('/finance')
  await page.screenshot({ path: `${SHOTS}/finance.png`, fullPage: true })
  await page.goto('/finance?tab=budgets')
  if (budget) {
    await expect(page.getByText('All spending').first()).toBeVisible()
    await expect(page.getByText(`/ ${wholeMoney(budget.limit)}`).first()).toBeVisible()
  }
  await page.screenshot({ path: `${SHOTS}/finance-budgets.png`, fullPage: true })
  await page.goto('/finance?tab=recurring')
  for (const r of ((data.recurring ?? []) as { name: string }[]).slice(0, 3)) await expect(page.getByText(r.name).first()).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/finance-recurring.png`, fullPage: true })

  // --- every other section that has seeded records: check a title shows up, then screenshot ---
  const sections: { path: string; shot: string; collection: string; field: string }[] = [
    { path: '/schedule', shot: 'schedule', collection: 'events', field: 'title' },
    { path: '/goals', shot: 'goals', collection: 'goals', field: 'title' },
    { path: '/goals?tab=habits', shot: 'habits', collection: 'habits', field: 'name' },
    { path: '/fitness?tab=routines', shot: 'routines', collection: 'routines', field: 'name' },
    { path: '/projects', shot: 'projects', collection: 'projects', field: 'name' },
    { path: '/career?tab=paths', shot: 'career-paths', collection: 'careerPaths', field: 'name' },
    { path: '/career?tab=education', shot: 'education', collection: 'modules', field: 'name' },
  ]
  for (const s of sections) {
    const rows = (data[s.collection] ?? []) as Record<string, string>[]
    if (!rows.length) continue
    await page.goto(s.path)
    if (s.collection !== 'events') await expect(page.getByText(rows[0][s.field], { exact: false }).first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${s.shot}.png`, fullPage: true })
  }

  // --- a reload keeps everything (it was really saved) ---
  await page.goto('/finance?tab=recurring')
  await page.reload()
  await expect(page.getByText(((data.recurring ?? []) as { name: string }[])[0]?.name ?? '').first()).toBeVisible()

  expect(errors).toEqual([])
})
