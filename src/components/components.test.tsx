import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { EntityForm } from '@/forms/EntityForm'
import { FORMS } from '@/forms/registry'
import { appStore } from '@/store/store'
import { ConfirmHost } from '@/components/ui/confirm'
import { Toaster } from '@/components/ui/toast'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { TaskItem } from '@/components/shared/TaskItem'

const TODAY = '2026-11-04'
const ctx = () => ({ db: appStore.getState().db, settings: appStore.getState().db.settings, today: TODAY })

beforeEach(() => {
  appStore.getState().replaceDatabase(createEmptyDatabase())
})

describe('EntityForm', () => {
  it('shows validation errors and does not submit invalid data', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <EntityForm config={FORMS.transactions as never} initial={{ kind: 'expense', date: TODAY }} ctx={ctx()} formId="f" onSubmit={onSubmit} />
        <button type="submit" form="f">
          Save
        </button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(screen.getByText('Category is required')).toBeInTheDocument()
  })

  it('converts money input to pence and trims blank fields', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <EntityForm config={FORMS.transactions as never} initial={{ kind: 'expense', date: TODAY }} ctx={ctx()} formId="f" onSubmit={onSubmit} />
        <button type="submit" form="f">
          Save
        </button>
      </>,
    )
    await user.type(screen.getByLabelText(/Amount/), '12.50')
    await user.type(screen.getByLabelText(/Category/), 'Groceries')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0]
    expect(data).toMatchObject({ kind: 'expense', amount: 1250, category: 'Groceries', date: TODAY })
    expect(data.description).toBeUndefined()
  })

  it('applies cross-field rules (event end must be after start)', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <EntityForm config={FORMS.events as never} initial={{ title: 'Meet', kind: 'event', date: TODAY, allDay: false, startTime: '10:00', endTime: '09:00', area: 'personal' }} ctx={ctx()} formId="f" onSubmit={onSubmit} />
        <button type="submit" form="f">
          Save
        </button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('End time must be after the start time')).toBeInTheDocument()
  })
})

describe('deleting records', () => {
  it('asks for confirmation, deletes, and can be undone', async () => {
    const user = userEvent.setup()
    const task = appStore.getState().create('tasks', { title: 'Delete me' })
    render(
      <>
        <ConfirmHost />
        <Toaster />
      </>,
    )
    let result: Promise<boolean>
    act(() => {
      result = deleteRecord('tasks', task.id)
    })
    expect(await screen.findByText('Delete task?')).toBeInTheDocument()
    await user.click(screen.getByTestId('confirm-button'))
    expect(await result!).toBe(true)
    expect(appStore.getState().db.tasks).toHaveLength(0)
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(appStore.getState().db.tasks.map((t) => t.title)).toEqual(['Delete me'])
  })

  it('does nothing when cancelled', async () => {
    const user = userEvent.setup()
    const task = appStore.getState().create('tasks', { title: 'Keep me' })
    render(<ConfirmHost />)
    let result: Promise<boolean>
    act(() => {
      result = deleteRecord('tasks', task.id)
    })
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await result!).toBe(false)
    expect(appStore.getState().db.tasks).toHaveLength(1)
  })
})

describe('TaskItem', () => {
  it('completes a task and marks it as a priority', async () => {
    const user = userEvent.setup()
    const task = appStore.getState().create('tasks', { title: 'Write tests', dueDate: TODAY })
    const { rerender } = render(<TaskItem task={task} today={TODAY} />)
    await user.click(screen.getByLabelText(/Mark as done: Write tests/))
    await waitFor(() => expect(appStore.getState().db.tasks[0].status).toBe('done'))
    expect(appStore.getState().db.tasks[0].completedAt).toBeTruthy()
    const t2 = appStore.getState().create('tasks', { title: 'Focus' })
    rerender(<TaskItem task={t2} today={TODAY} />)
    await user.click(screen.getByRole('button', { name: "Add to today's priorities" }))
    expect(appStore.getState().db.tasks.find((t) => t.id === t2.id)?.focusDate).toBe(TODAY)
  })
})

describe('ErrorBoundary', () => {
  it('contains a crash to its own area and recovers on Try again', async () => {
    const { ErrorBoundary } = await import('@/components/ui/ErrorBoundary')
    let broken = true
    function Fragile() {
      if (broken) throw new Error('boom')
      return <p>Widget content</p>
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <p>Rest of the page</p>
        <ErrorBoundary label="This widget" compact>
          <Fragile />
        </ErrorBoundary>
      </div>,
    )
    expect(screen.getByText('Rest of the page')).toBeInTheDocument()
    expect(screen.getByTestId('error-boundary')).toHaveTextContent('This widget couldn’t be shown')
    broken = false
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(screen.getByText('Widget content')).toBeInTheDocument()
    warn.mockRestore()
    error.mockRestore()
  })
})

describe('Smart title in the task form', () => {
  it('shows chips while typing and saves the parsed values', async () => {
    const onSubmit = vi.fn()
    render(<EntityForm config={FORMS.tasks as never} initial={FORMS.tasks.defaults!(ctx())} ctx={ctx()} formId="f" onSubmit={onSubmit} smart />)
    await userEvent.type(screen.getByLabelText(/Title/), 'Dentist tomorrow 3pm !high')
    expect(screen.getByTestId('smart-chips')).toHaveTextContent('Tomorrow')
    expect(screen.getByTestId('smart-chips')).toHaveTextContent('High priority')
    await userEvent.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist', dueDate: '2026-11-05', dueTime: '15:00', priority: 'high' }))
  })
})
