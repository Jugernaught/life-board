import { expect, test } from '@playwright/test'
import { importSample, skipOnboarding, trackErrors, waitForSave } from './helpers'

test.describe('with sample data', () => {
  test.beforeEach(async ({ page }, info) => {
    await skipOnboarding(page)
    await importSample(page, info.outputPath('sample.json'))
  })

  test('command centre widgets reflect stored data', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('widget-priorities')).toContainText('Draft investor one-pager')
    await expect(page.getByTestId('widget-today')).toContainText('Renew passport')
    await expect(page.getByTestId('widget-today')).toContainText('Overdue')
    await expect(page.getByTestId('widget-upcoming')).toContainText('Deep work: pitch deck')
    await expect(page.getByTestId('widget-projects')).toContainText('Habit coaching app')
    await expect(page.getByTestId('widget-goals')).toContainText('Run a 10k')
  })

  test('habits can be checked off and update the count', async ({ page }) => {
    await page.goto('/')
    const habits = page.getByTestId('widget-habits')
    await expect(habits).toContainText('1/3')
    await habits.getByRole('listitem').filter({ hasText: 'Read 20 minutes' }).locator('label').first().click()
    await expect(habits).toContainText('2/3')
    await page.goto('/goals?tab=habits')
    await expect(page.getByText('Check-ins · last 7 days')).toBeVisible()
  })

  test('dashboard widgets can be hidden, resized and reordered', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Customise' }).click()
    const dialog = page.getByRole('dialog', { name: 'Customise Command Centre' })
    await dialog.getByRole('button', { name: "Hide Today's priorities" }).click()
    await dialog.getByRole('button', { name: 'Move Due today up' }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByTestId('widget-priorities')).toHaveCount(0)
    await waitForSave(page)
    await page.reload()
    await expect(page.getByTestId('widget-priorities')).toHaveCount(0)
    await expect(page.getByTestId('widget-today')).toBeVisible()
  })

  test('finance: add a transaction and see totals update; budgets and savings', async ({ page }) => {
    await page.goto('/finance?tab=transactions')
    await expect(page.getByText('36 of 36 shown').or(page.getByText('36 shown'))).toBeVisible()
    await page.getByRole('button', { name: 'Transaction' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'New transaction' })
    await dialog.getByLabel('Amount').fill('42.10')
    await dialog.getByLabel('Category').fill('Books')
    await dialog.getByLabel('Description').fill('Programming book')
    await dialog.getByRole('button', { name: 'Add transaction' }).click()
    await expect(page.getByRole('cell', { name: /Programming book/ })).toBeVisible()
    await expect(page.getByRole('cell', { name: '−£42.10' })).toBeVisible()

    await page.getByLabel('Filter by Categories').selectOption('Books')
    await expect(page.getByText('1 of 37 shown')).toBeVisible()

    await page.goto('/finance?tab=savings')
    await expect(page.getByText('£1,600')).toBeVisible()
    await page.getByLabel('Contribution amount').fill('100')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('£1,700')).toBeVisible()

    await page.goto('/finance?tab=budgets')
    await expect(page.getByText('All spending')).toBeVisible()
  })

  test('projects: board view drag changes status; detail page manages tasks', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('radio', { name: 'Board by status' }).click()
    const card = page.getByTestId('project-card').filter({ hasText: 'Kitchen garden' })
    await card.dragTo(page.getByLabel('Active column'))
    await expect(page.getByLabel('Active column')).toContainText('Kitchen garden')

    await page.getByTestId('project-card').filter({ hasText: 'Habit coaching app' }).click()
    await expect(page.getByRole('heading', { name: 'Habit coaching app' })).toBeVisible()
    await page.getByPlaceholder('Add a task to this project…').fill('Recruit beta testers')
    await page.getByPlaceholder('Add a task to this project…').press('Enter')
    await expect(page.getByTestId('task-item').filter({ hasText: 'Recruit beta testers' })).toBeVisible()
    await page.getByPlaceholder('Add a milestone…').fill('Public launch')
    await page.getByPlaceholder('Add a milestone…').press('Enter')
    await expect(page.getByText('Public launch', { exact: true })).toBeVisible()
    await expect(page.getByText('Project history')).toBeVisible()
  })

  test('schedule: drag an event to a new time in the day view', async ({ page }) => {
    await page.goto('/schedule')
    await page.getByRole('radio', { name: 'Day' }).click()
    const block = page.getByTestId('timed-block').filter({ hasText: 'Gym' })
    await block.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const box = (await block.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + 52, { steps: 8 }) // one hour
    await page.mouse.up()
    await expect(page.getByTestId('timed-block').filter({ hasText: 'Gym' })).toContainText('19:00–20:00')
  })

  test('schedule: month view and task scopes', async ({ page }) => {
    await page.goto('/schedule')
    await page.getByRole('radio', { name: 'Month' }).click()
    await expect(page.getByRole('gridcell').first()).toBeVisible()
    await page.goto('/schedule?tab=tasks')
    await page.getByRole('radio', { name: /Overdue/ }).click()
    await expect(page.getByTestId('task-item')).toHaveCount(1)
    await expect(page.getByTestId('task-item')).toContainText('Renew passport')
  })

  test('journal autosaves entries and supports search', async ({ page }) => {
    await page.goto('/journal')
    await page.getByTestId('journal-body').fill('Today I tested Atlas end to end.')
    await expect(page.getByTestId('journal-status')).toContainText('Saved ✓')
    await page.reload()
    await expect(page.getByTestId('journal-body')).toHaveValue('Today I tested Atlas end to end.')
    await page.getByRole('tab', { name: /History/ }).click()
    await page.getByPlaceholder("Search everything you've written…").fill('customer call')
    await expect(page.getByText('Momentum')).toBeVisible()
    await expect(page.getByText('1 of 3 shown')).toBeVisible()
  })

  test('career: pipeline, grades and comparison', async ({ page }) => {
    await page.goto('/career?tab=applications')
    await expect(page.getByTestId('application-card')).toHaveCount(3)
    await page.getByLabel('Status for Graduate PM at Ocado').selectOption('rejected')
    await page.goto('/career?tab=education')
    await expect(page.getByText('BSc Business Management')).toBeVisible()
    await expect(page.getByText('68.0%').first()).toBeVisible()
    await page.goto('/career?tab=paths')
    await page.getByRole('radio', { name: 'Compare paths' }).click()
    await expect(page.getByRole('heading', { name: 'Side by side' })).toBeVisible()
  })

  test('library: filter by type and update status', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('radio', { name: /Podcast/ }).click()
    await expect(page.getByTestId('media-card')).toHaveCount(1)
    await page.getByLabel('Status of Hardcore History').selectOption('in_progress')
    await page.getByRole('radio', { name: /^All/ }).click()
    await page.getByLabel('Filter by Statuses').selectOption('in_progress')
    await expect(page.getByTestId('media-card')).toHaveCount(2)
  })

  test('analytics and reports are computed from the data', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/analytics')
    await expect(page.getByText('This period vs previous')).toBeVisible()
    await expect(page.getByText('Progress against targets')).toBeVisible()
    await page.getByLabel('Date range').selectOption('this_year')
    await expect(page.getByText('Task completion')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Goal completion' })).toBeVisible()
    await page.getByRole('tab', { name: 'Reports' }).click()
    await expect(page.getByRole('heading', { name: /Weekly report/ })).toBeVisible()
    await page.getByRole('radio', { name: 'Monthly' }).click()
    await expect(page.getByRole('heading', { name: /Monthly report/ })).toBeVisible()
    await expect(page.getByText('Historical comparison')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('data: export, backup and restore', async ({ page }, info) => {
  await skipOnboarding(page)
  await importSample(page, info.outputPath('sample.json'))
  const download = page.waitForEvent('download')
  await page.getByTestId('export-json').click()
  const file = await download
  const path = info.outputPath('export.json')
  await file.saveAs(path)
  const json = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(path, 'utf8')))
  expect(json.app).toBe('life-os')
  expect(json.data.tasks.length).toBeGreaterThan(5)

  await page.getByTestId('create-backup').click()
  await expect(page.getByText('Backup created')).toBeVisible()
  // Erase, then restore from the safety backup
  await page.getByRole('button', { name: 'Erase records' }).click()
  await page.getByLabel('Type ERASE to confirm').fill('ERASE')
  await page.getByTestId('confirm-button').click()
  await expect(page.getByText('All records erased — backup saved')).toBeVisible()
  await page.goto('/projects')
  await expect(page.getByText('No projects yet')).toBeVisible()
  await page.goto('/settings?tab=data')
  const preReset = page.getByTestId('backup-list').getByRole('listitem').filter({ hasText: 'Before reset' })
  await preReset.getByRole('button', { name: 'Restore' }).click()
  await page.getByTestId('confirm-button').click()
  await expect(page.getByText('Backup restored')).toBeVisible()
  await page.goto('/projects')
  await expect(page.getByTestId('project-card')).toHaveCount(3)
})

test('import rejects files that are not Atlas backups', async ({ page }, info) => {
  await skipOnboarding(page)
  const path = info.outputPath('bad.json')
  await import('node:fs').then((fs) => fs.writeFileSync(path, JSON.stringify({ hello: 'world' })))
  await page.goto('/settings?tab=data')
  await page.getByTestId('import-file').setInputFiles(path)
  await expect(page.getByText('This file can’t be imported.')).toBeVisible()
  await expect(page.getByTestId('apply-import')).toHaveCount(0)
})
