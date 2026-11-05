/**
 * Logging a recurring item (rent, a subscription, salary) creates its
 * transaction and moves the next due date on — as ONE change, so Undo
 * (notification or Ctrl/Cmd+Z) reverses both. Shared by desktop and iPhone.
 */
import type { RecurringItem } from '@/data/types'
import { advanceDate } from '@/selectors/finance'
import { actions, appStore } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { undoWithNotice } from './useChangeToasts'

export function logRecurring(r: RecurringItem, today: string, formatDate: (d: string) => string) {
  const next = advanceDate(r.nextDate, r.frequency)
  const tx = actions.create('transactions', { kind: r.kind, amount: r.amount, date: r.nextDate <= today ? r.nextDate : today, category: r.category, description: r.name, recurringId: r.id }, { linked: true })
  actions.update('recurring', r.id, { nextDate: next }, { action: 'logged', detail: 'Logged as a transaction', spawned: { key: 'transactions', id: tx.id } })
  const changeId = appStore.getState().history.at(-1)?.id
  toast({
    title: `${r.name} logged`,
    description: `Next due ${formatDate(next)}`,
    tone: 'success',
    action: changeId ? { label: 'Undo', onClick: () => undoWithNotice(changeId) } : undefined,
  })
  return tx
}
