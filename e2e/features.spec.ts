/**
 * Everyday features added in the improvement audit: natural-language quick
 * add, repeating tasks, subtasks, reschedule, undo, Plan My Day, getting
 * started + templates, reminders, text size and the command palette.
 * Desktop app; the iPhone versions are covered in ios.spec.ts.
 */
import { type Page, expect, test } from '@playwright/test'
import { skipOnboarding, trackErrors, waitForSave } from './helpers'

let errors: string[] = []
// Every test starts at the same moment — Wednesday 4 November 2026, 09:00 — and
// time then runs normally (so debounced saves and animations behave as usual).
const NOW = new Date('2026-11-04T09:00:00')

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page)
  await page.clock.install({ time: NOW })
})
test.afterEach(() => expect(errors, 'console errors').toEqual([]))

async function quickAddTask(page: Page, text: string) {
  await page.keyboard.press('n')
  const dialog = page.getByRole('dialog', { name: 'Quick add' })
  await dialog.getByLabel('Title').fill(text)
  return dialog
}

const tasksTab = async (page: Page, scope: RegExp) => {
  await page.goto('/schedule?tab=tasks')
  await page.getByRole('radio', { name: scope }).click()
}

test('quick add reads dates, times, repeats, priority and tags from one line', async ({ page }) => {
  await skipOnboarding(page)
  const dialog = await quickAddTask(page, 'Pay rent every month 1 Dec !high #home')
  const chips = dialog.getByTestId('smart-chips')
  await expect(chips).toContainText('Tue 1 Dec')
  await expect(chips).toContainText('Every month')
  await expect(chips).toContainText('High priority')
  await expect(chips).toContainText('#home')
  // The fields preview what will be saved.
  await expect(dialog.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true')
  await expect(dialog.getByLabel('Due date')).toHaveValue('2026-12-01')

  // Switching a piece off keeps those words in the title.
  await chips.locator('[data-kind="tag"]').click()
  await expect(chips).not.toContainText('#home')
  await dialog.getByRole('button', { name: 'Add task' }).click()

  await tasksTab(page, /Upcoming/)
  const item = page.getByTestId('task-item').filter({ hasText: 'Pay rent #home' })
  await expect(item).toBeVisible()
  await expect(item.getByTestId('task-repeat')).toHaveText('Every month')
  await expect(item).toContainText('High')
})

test('completing a repeating task brings the next one back; undo by toast and by Ctrl+Z', async ({ page }) => {
  await skipOnboarding(page)
  const dialog = await quickAddTask(page, 'Water plants every day')
  await dialog.getByRole('button', { name: 'Add task' }).click()
  await tasksTab(page, /All open/)
  const rows = page.getByTestId('task-item').filter({ hasText: 'Water plants' })
  await expect(rows).toHaveCount(1)

  await rows.first().locator('label').first().click()
  const toast = page.getByRole('status').filter({ hasText: 'Done · back tomorrow' })
  await expect(toast).toBeVisible()
  await expect(rows).toHaveCount(1) // the next one, due tomorrow
  await expect(rows.first()).toContainText('Tomorrow')

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Today')
  await page.getByRole('radio', { name: /Completed/ }).click()
  await expect(page.getByTestId('task-item')).toHaveCount(0)

  // Again, undone with the keyboard this time.
  await page.getByRole('radio', { name: /All open/ }).click()
  await rows.first().locator('label').first().click()
  await expect(rows.first()).toContainText('Tomorrow')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('status').filter({ hasText: 'Undid completing' })).toBeVisible()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Today')
})

test('subtasks: add in the task form, see progress on the row, tick them inline', async ({ page }) => {
  await skipOnboarding(page)
  const dialog = await quickAddTask(page, 'Pack for trip today')
  await dialog.getByRole('button', { name: 'All fields' }).click()
  const add = dialog.getByPlaceholder('Add a subtask and press Enter')
  for (const s of ['Passport', 'Charger', 'Tickets']) {
    await add.fill(s)
    await add.press('Enter')
  }
  await dialog.getByRole('button', { name: 'Add task' }).click()
  await tasksTab(page, /Today/)
  const item = page.getByTestId('task-item').filter({ hasText: 'Pack for trip' })
  await expect(item.getByTestId('task-subtasks')).toHaveText('0/3')
  await item.getByTestId('task-subtasks').click()
  await item.getByTestId('task-subtask-list').locator('label').filter({ hasText: 'Mark Passport done' }).click()
  await expect(item.getByTestId('task-subtasks')).toHaveText('1/3')
  await waitForSave(page)
  await page.reload()
  await page.getByRole('radio', { name: /Today/ }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Pack for trip' }).getByTestId('task-subtasks')).toHaveText('1/3')
})

test('reschedule from the task menu, pick a date, and move every overdue task at once', async ({ page }) => {
  await skipOnboarding(page)
  for (const t of ['Old thing 2026-11-01', 'Older thing 2026-10-30', 'Call bank today']) {
    const d = await quickAddTask(page, t)
    await d.getByRole('button', { name: 'Add task' }).click()
    await expect(d).toBeHidden()
  }
  await tasksTab(page, /Today/)
  const call = page.getByTestId('task-item').filter({ hasText: 'Call bank' })
  await call.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Move to tomorrow' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Moved to tomorrow' })).toBeVisible()
  await page.getByRole('radio', { name: /Upcoming/ }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Call bank' })).toContainText('Tomorrow')

  await page.getByTestId('task-item').filter({ hasText: 'Call bank' }).getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Pick a date…' }).click()
  await page.getByTestId('date-prompt-input').fill('2026-11-20')
  await page.getByRole('button', { name: 'Set date' }).click()
  await expect(page.getByTestId('task-item').filter({ hasText: 'Call bank' })).toContainText('In 2 wk')

  await page.getByRole('radio', { name: /Overdue/ }).click()
  await expect(page.getByTestId('task-item')).toHaveCount(2)
  await page.getByTestId('overdue-all-today').click()
  await expect(page.getByTestId('task-item')).toHaveCount(0)
  await page.getByRole('status').filter({ hasText: '2 tasks moved to today' }).getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('task-item')).toHaveCount(2)
})

test('plan my day: catch up, pick priorities, set an intention', async ({ page }) => {
  await skipOnboarding(page)
  for (const t of ['Late report 2026-11-02', 'Write proposal !high', 'Gym today']) {
    const d = await quickAddTask(page, t)
    await d.getByRole('button', { name: 'Add task' }).click()
    await expect(d).toBeHidden()
  }
  await page.goto('/')
  await page.getByTestId('plan-day-open').click()
  const plan = page.getByTestId('plan-day')
  await expect(plan.getByTestId('pd-overdue-row')).toHaveCount(1)
  await plan.getByTestId('pd-overdue-row').getByRole('button', { name: 'Today' }).click()
  await expect(plan.getByText('Nothing overdue')).toBeVisible()
  await page.getByTestId('pd-next').click()

  await plan.getByTestId('pd-candidate').filter({ hasText: 'Write proposal' }).click()
  await plan.getByTestId('pd-candidate').filter({ hasText: 'Late report' }).click()
  await expect(plan).toContainText('2 picked')
  await page.getByTestId('pd-next').click()
  await page.getByTestId('pd-next').click()
  await plan.getByLabel('Intention for today').fill('Ship the proposal, then rest')
  await page.getByTestId('pd-finish').click()

  await expect(page.getByTestId('today-intention')).toHaveText('Ship the proposal, then rest')
  await expect(page.getByTestId('plan-day-open')).toHaveCount(0)
  const priorities = page.getByTestId('widget-priorities')
  await expect(priorities.getByTestId('task-item')).toHaveCount(2)
})

test('getting started ticks itself off; templates add only what you pick', async ({ page }) => {
  await skipOnboarding(page)
  const guide = page.getByTestId('getting-started')
  await expect(guide).toContainText('0 of 6 done')
  await guide.getByRole('button', { name: 'Starter templates' }).click()
  const dialog = page.getByRole('dialog', { name: 'Starter templates' })
  await dialog.getByTestId('tpl-read').click()
  await dialog.getByTestId('tpl-weekly-review').click()
  await dialog.getByTestId('tpl-add').click()
  await expect(page.getByRole('status').filter({ hasText: 'Added 1 habit and 1 repeating task' })).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(guide).toContainText('2 of 6 done') // a habit, and a task
  await expect(guide.getByTestId('gs-habit')).toHaveAttribute('data-done', 'true')

  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search' }).fill('starter')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Starter templates' }).getByTestId('tpl-read')).toBeDisabled()
  await expect(page.getByTestId('tpl-add')).toHaveText('Pick some to add')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await guide.getByRole('button', { name: 'Hide the getting-started guide' }).click()
  await expect(guide).toHaveCount(0)
  await page.goto('/goals?tab=habits')
  await expect(page.getByText('Read 20 minutes').first()).toBeVisible()
})

test('reminders: turned on in Settings, a due task shows a reminder', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/settings?tab=notifications')
  await page.locator('#reminders-enabled').click()
  await expect(page.getByText('Tasks with a due time', { exact: true }).first()).toBeVisible()
  const d = await quickAddTask(page, 'Standup 9:05am')
  await d.getByRole('button', { name: 'Add task' }).click()
  // Due 09:05, reminded 10 minutes before — which is now (09:00 is within the grace window).
  const reminder = page.getByRole('status').filter({ hasText: 'Task due in 10 min · 09:05' })
  await expect(reminder).toBeVisible()
  await expect(reminder).toContainText('Standup')
  await reminder.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
})

test('text size scales text everywhere and persists', async ({ page }) => {
  await skipOnboarding(page)
  const h1 = () => page.getByRole('heading', { level: 1 }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const before = await h1()
  await page.goto('/settings?tab=appearance')
  await page.getByRole('radio', { name: 'Text size 125%' }).click()
  await page.goto('/')
  expect(await h1()).toBeCloseTo(before * 1.25, 0)
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale'))).toBe('1.25')
  // Layout stays in the window: no sideways scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('command palette: typo-tolerant search, complete with Ctrl+Enter, recent items', async ({ page }) => {
  await skipOnboarding(page)
  const d = await quickAddTask(page, 'Buy groceries')
  await d.getByRole('button', { name: 'Add task' }).click()
  await page.keyboard.press('Control+k')
  const search = page.getByRole('combobox', { name: 'Search' })
  await search.fill('grocries')
  const option = page.getByRole('option', { name: /Buy groceries/ })
  await expect(option).toBeVisible()
  await expect(page.getByTestId('palette-alt-hint')).toContainText('Complete')
  await page.keyboard.press('Control+Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Task completed' })).toBeVisible()
  await expect(page.getByTestId('palette-alt-hint')).toContainText('Mark not done')

  await page.keyboard.press('Enter') // open it — it becomes a recent item
  await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await expect(page.getByText('Recent', { exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: /Buy groceries/ })).toBeVisible()
})
