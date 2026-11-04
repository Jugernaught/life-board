import { expect, test } from '@playwright/test'
import { importSample, skipOnboarding } from './helpers'

test('mobile: navigation drawer, quick add and no horizontal scrolling', async ({ page }, info) => {
  await skipOnboarding(page)
  await importSample(page, info.outputPath('sample.json'))
  for (const path of ['/', '/career', '/projects', '/finance', '/fitness', '/goals', '/learning', '/journal', '/schedule', '/library', '/social', '/analytics', '/settings']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: /Personal Finances/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Personal Finances' })).toBeVisible()
  await page.getByRole('button', { name: 'Quick add' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Quick add' })).toBeVisible()
})
