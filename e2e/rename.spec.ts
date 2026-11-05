import { expect, test } from '@playwright/test'
import { buildSampleBackup } from './fixtures/sampleData'
import { trackErrors } from './helpers'

/**
 * Upgrading from LIFE OS: someone who used the app before it was renamed
 * opens ATLAS in the same browser and must find everything where they left it.
 */
test('data saved by LIFE OS opens in ATLAS, and the old copy is cleaned up', async ({ page }) => {
  const errors = trackErrors(page)
  const legacy = buildSampleBackup()
  // Seed storage exactly as the pre-rename build wrote it, from a blank page
  // on the same origin so the app can't run first.
  await page.route('**/__seed', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }))
  await page.goto('/__seed')
  await page.evaluate(
    ({ db }) =>
      new Promise<void>((resolve, reject) => {
        localStorage.setItem('life-os:appearance', JSON.stringify({ style: 'cyber', pref: 'dark', accent: 'cyan', transparency: 'full', effects: 'on' }))
        localStorage.setItem('life-os:mobile-banner-dismissed', '1')
        const req = indexedDB.open('life-os', 1)
        req.onupgradeneeded = () => {
          req.result.createObjectStore('state')
          req.result.createObjectStore('backups', { keyPath: 'id' })
        }
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction(['state', 'backups'], 'readwrite')
          tx.objectStore('state').put(db, 'database')
          tx.objectStore('backups').put({ id: 'legacy-backup', createdAt: '2026-01-01T00:00:00.000Z', reason: 'manual', sizeBytes: 10, recordCount: 1, data: db })
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { db: legacy.data },
  )

  await page.goto('/')
  // The saved data loads (no onboarding, no empty dashboard)…
  await expect(page.getByTestId('widget-projects')).toContainText('Habit coaching app')

  const after = await page.evaluate(async () => ({
    databases: (await indexedDB.databases()).map((d) => d.name).sort(),
    keys: Object.keys(localStorage).sort(),
  }))
  // …and only ATLAS storage is left behind.
  expect(after.databases).toEqual(['atlas'])
  expect(after.keys.filter((k) => k.startsWith('life-os'))).toEqual([])
  expect(after.keys).toEqual(expect.arrayContaining(['atlas:appearance', 'atlas:mobile-banner-dismissed']))

  // The pre-rename backup came across too.
  await page.goto('/settings?tab=data')
  await expect(page.getByText('Manual', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('a backup file exported by LIFE OS still imports', async ({ page }, info) => {
  const { writeFileSync } = await import('node:fs')
  const file = info.outputPath('life-os-backup.json')
  writeFileSync(file, JSON.stringify({ ...buildSampleBackup(), app: 'life-os' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await page.goto('/settings?tab=data')
  await page.getByTestId('import-file').setInputFiles(file)
  await page.getByRole('radio', { name: 'Replace everything' }).click()
  await page.getByTestId('apply-import').click()
  await page.getByTestId('confirm-button').click()
  await expect(page.getByText('Import complete')).toBeVisible()
  await page.goto('/')
  await expect(page.getByTestId('widget-projects')).toContainText('Habit coaching app')
})
