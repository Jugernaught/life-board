import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { recurringHistory } from '@/selectors/finance'
import { actions, appStore } from '@/store/store'
import { logRecurring } from './financeCommands'

describe('logging a recurring item', () => {
  beforeEach(() => appStore.setState({ db: createEmptyDatabase(), ready: true, history: [] }))

  it('creates the payment and moves the due date as one change that undoes together', () => {
    const r = actions.create('recurring', { name: 'Streaming', kind: 'expense', amount: 1099, category: 'Subscriptions', frequency: 'monthly', nextDate: '2026-11-01', active: true })
    const before = appStore.getState().history.length
    logRecurring(r, '2026-11-04', (d) => d)
    const db = actions.getDb()
    expect(db.transactions).toHaveLength(1)
    expect(db.transactions[0]).toMatchObject({ amount: 1099, date: '2026-11-01', recurringId: r.id })
    expect(db.recurring[0].nextDate).toBe('2026-12-01')
    expect(appStore.getState().history.length).toBe(before + 1) // one undo step, not two

    actions.undoLast()
    expect(actions.getDb().transactions).toHaveLength(0)
    expect(actions.getDb().recurring[0].nextDate).toBe('2026-11-01')
  })

  it('summarises the payment history from linked transactions', () => {
    const r = actions.create('recurring', { name: 'Gym', kind: 'expense', amount: 3000, category: 'Health', frequency: 'monthly', nextDate: '2026-09-01', active: true })
    logRecurring(r, '2026-11-04', (d) => d)
    logRecurring(actions.get('recurring', r.id)!, '2026-11-04', (d) => d)
    actions.create('transactions', { kind: 'expense', amount: 500, date: '2026-10-10', category: 'Health', description: 'Unrelated' })
    const h = recurringHistory(actions.getDb().transactions, r.id, '2026-11-04')
    expect(h.payments.map((p) => p.date)).toEqual(['2026-10-01', '2026-09-01'])
    expect(h.last?.date).toBe('2026-10-01')
    expect(h.thisYear).toBe(6000)
  })
})
