import { type Page, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { buildSampleBackup } from './fixtures/sampleData'

/** Collect console errors and uncaught exceptions so tests can assert there are none. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

export async function skipOnboarding(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
}

/** Import the test fixture through the real Settings → Data import flow. */
export async function importSample(page: Page, path: string) {
  writeFileSync(path, JSON.stringify(buildSampleBackup()))
  await page.goto('/settings?tab=data')
  await page.getByTestId('import-file').setInputFiles(path)
  await page.getByRole('radio', { name: 'Replace everything' }).click()
  await page.getByTestId('apply-import').click()
  await page.getByTestId('confirm-button').click()
  await expect(page.getByText('Import complete')).toBeVisible()
}

/** Wait until the latest change has been written to storage. */
export async function waitForSave(page: Page) {
  await expect(page.getByTestId('save-status').first()).toHaveAttribute('data-status', 'saved')
}
