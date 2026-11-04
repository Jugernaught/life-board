/**
 * The multi-theme UI system on desktop: Appearance page previews, applying,
 * persistence, the toolbar switcher, dark-only themes, Reduce Transparency,
 * and every section rendering in every theme.
 */
import { type Page, expect, test } from '@playwright/test'
import { importSample, skipOnboarding, trackErrors, waitForSave } from './helpers'

const THEMES = [
  { id: 'glass', name: 'Liquid Glass', light: true },
  { id: 'clean', name: 'Apple Clean', light: true },
  { id: 'cyber', name: 'Cyberpunk', light: false },
  { id: 'minimal', name: 'Minimal Dark', light: false },
] as const

const SECTIONS = ['/', '/career', '/projects', '/finance', '/fitness', '/goals', '/learning', '/journal', '/schedule', '/library', '/social', '/analytics', '/settings']

const style = (page: Page) => page.locator('html')

test('Appearance: preview a theme without applying it, then apply and persist', async ({ page }) => {
  const errors = trackErrors(page)
  await skipOnboarding(page)
  await expect(style(page)).toHaveAttribute('data-style', 'glass')
  await page.goto('/settings?tab=appearance')

  for (const t of THEMES) await expect(page.getByTestId(`theme-card-${t.id}`)).toBeVisible()

  // Selecting a card only changes the preview.
  await page.getByTestId('theme-card-clean').click()
  await expect(page.getByTestId('theme-preview')).toContainText('Apple Clean')
  await expect(style(page)).toHaveAttribute('data-style', 'glass')
  // The preview is drawn with the theme's own tokens.
  await expect(page.getByTestId('theme-preview').locator('[data-style="clean"]').first()).toBeVisible()

  // Applying changes the whole app instantly — no reload.
  await page.getByTestId('apply-theme').click()
  await expect(style(page)).toHaveAttribute('data-style', 'clean')
  await expect(page.getByTestId('apply-theme')).toHaveText(/Applied/)
  await waitForSave(page)
  await page.reload()
  await expect(style(page)).toHaveAttribute('data-style', 'clean')
  expect(errors).toEqual([])
})

test('toolbar switcher, dark-only themes, accents and Reduce Transparency', async ({ page }) => {
  await skipOnboarding(page)
  // Light mode in Liquid Glass.
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(style(page)).toHaveAttribute('data-theme', 'light')

  // Cyberpunk is dark-only: the light/dark toggle disappears and it stays dark.
  await page.getByTestId('appearance-menu').click()
  await page.getByRole('menuitem', { name: 'Cyberpunk' }).click()
  await expect(style(page)).toHaveAttribute('data-style', 'cyber')
  await expect(style(page)).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).toHaveCount(0)

  // Back to Liquid Glass: the light preference is remembered.
  await page.getByTestId('appearance-menu').click()
  await page.getByRole('menuitem', { name: 'Liquid Glass' }).click()
  await expect(style(page)).toHaveAttribute('data-theme', 'light')

  // Glass chrome really is glass; Reduce Transparency makes it solid.
  const filter = () => page.getByTestId('toolbar').evaluate((el) => getComputedStyle(el).backdropFilter)
  expect(await filter()).toContain('blur')
  await page.goto('/settings?tab=appearance')
  await page.getByRole('switch', { name: 'Reduce transparency' }).click()
  await expect(style(page)).toHaveAttribute('data-transparency', 'reduced')
  expect(await filter()).toBe('none')

  // Accent colours change the accent everywhere.
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim())
  const before = await accent()
  await page.getByTestId('accent-violet').click()
  await expect(style(page)).toHaveAttribute('data-accent', 'violet')
  expect(await accent()).not.toBe(before)

  // Command palette can switch themes too.
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/search/i).first().fill('Appearance: Minimal')
  await page.keyboard.press('Enter')
  await expect(style(page)).toHaveAttribute('data-style', 'minimal')
})

for (const t of THEMES) {
  test(`every section renders in ${t.name}`, async ({ page }, info) => {
    const errors = trackErrors(page)
    await skipOnboarding(page)
    await importSample(page, info.outputPath('sample.json'))
    await page.getByTestId('appearance-menu').click()
    await page.getByRole('menuitem', { name: t.name }).click()
    await expect(style(page)).toHaveAttribute('data-style', t.id)
    for (const mode of t.light ? (['light', 'dark'] as const) : (['dark'] as const)) {
      if ((await style(page).getAttribute('data-theme')) !== mode) await page.getByRole('button', { name: `Switch to ${mode} theme` }).click()
      await expect(style(page)).toHaveAttribute('data-theme', mode)
      for (const path of SECTIONS) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(style(page)).toHaveAttribute('data-style', t.id)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `horizontal overflow on ${path} (${t.id}/${mode})`).toBeLessThanOrEqual(0)
      }
    }
    expect(errors).toEqual([])
  })
}
