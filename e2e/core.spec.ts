import { expect, test } from '@playwright/test'
import { skipOnboarding, trackErrors, waitForSave } from './helpers'

test('first-time setup configures the app without inventing data', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /command centre/i })).toBeVisible()
  await page.getByTestId('onboarding-next').click()
  await page.getByLabel('Display name').fill('Haroon')
  await page.getByTestId('onboarding-next').click()
  await page.getByLabel('Currency').selectOption('EUR')
  await page.getByTestId('onboarding-next').click()
  await page.getByTestId('onboarding-next').click()
  await page.getByTestId('onboarding-finish').click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Haroon')
  // Empty states, not fabricated content
  await expect(page.getByText('No priorities picked yet')).toBeVisible()
  await expect(page.getByText('No active goals')).toBeVisible()
  await expect(page.getByText('No activity yet')).toBeVisible()

  await waitForSave(page)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Haroon')
  await page.goto('/settings')
  await expect(page.getByLabel('Currency')).toHaveValue('EUR')
  expect(errors).toEqual([])
})

test('every section loads from the sidebar without errors', async ({ page }) => {
  const errors = trackErrors(page)
  await skipOnboarding(page)
  const sections = [
    'Career & Education',
    'Projects & Business',
    'Personal Finances',
    'Fitness & Routines',
    'Goals & Habits',
    'Learning & Skills',
    'Journal & Reflections',
    'Daily Schedule',
    'Reading & Media',
    'Social Life',
    'Analytics & Reports',
    'Settings',
    'Command Centre',
  ]
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const name of sections) {
    await nav.getByRole('link', { name: new RegExp(name.replace('&', '&')) }).click()
    if (name === 'Command Centre') await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
    else await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('tasks: quick add, complete, edit, delete with undo, and persist', async ({ page }) => {
  await skipOnboarding(page)
  await page.keyboard.press('n')
  const dialog = page.getByRole('dialog', { name: 'Quick add' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Title').fill('Buy train tickets')
  await dialog.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Task added')).toBeVisible()

  await page.goto('/schedule?tab=tasks')
  await page.getByRole('radio', { name: /No date/ }).click()
  const item = page.getByTestId('task-item').filter({ hasText: 'Buy train tickets' })
  await expect(item).toBeVisible()

  // Edit
  await item.getByRole('button', { name: 'Buy train tickets' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task' })
  await edit.getByLabel('Title').fill('Buy return train tickets')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' })).toBeVisible()

  // Complete
  await page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' }).locator('label').first().click()
  await page.getByRole('radio', { name: /Completed/ }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' })).toBeVisible()

  // Delete → confirm → undo
  await page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' }).getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog', { name: /Delete task/ })).toBeVisible()
  await page.getByTestId('confirm-button').click()
  await expect(page.getByTestId('task-item')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' })).toBeVisible()

  await waitForSave(page)
  await page.reload()
  await page.getByRole('radio', { name: /Completed/ }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Buy return train tickets' })).toBeVisible()
})

test('global search finds records and opens them', async ({ page }) => {
  await skipOnboarding(page)
  const qa = page.getByTestId('widget-quickadd')
  await qa.getByRole('radio', { name: 'Goal' }).click()
  await qa.getByPlaceholder(/Goal, e.g./).fill('Learn conversational Spanish')
  await qa.getByPlaceholder(/Goal, e.g./).press('Enter')
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search and commands' })
  await palette.getByRole('combobox').fill('spanish')
  await expect(palette.getByRole('option', { name: /Learn conversational Spanish/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/goals/)
  await expect(page.getByRole('dialog', { name: 'Edit goal' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit goal' }).getByRole('textbox').first()).toHaveValue('Learn conversational Spanish')
})

test('a change made right before reloading is not lost', async ({ page }) => {
  await skipOnboarding(page)
  await page.getByTestId('widget-today').getByPlaceholder('Add a task due today…').fill('Last second task')
  await page.getByTestId('widget-today').getByPlaceholder('Add a task due today…').press('Enter')
  await page.reload() // no waiting for the debounced save
  await expect(page.getByTestId('widget-today').getByRole('button', { name: /Last second task/ })).toBeVisible()
})
