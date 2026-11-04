/** Finance maths. All amounts are integer minor units (pence). */
import { FREQUENCY_PER_MONTH, type Frequency } from '@/data/constants'
import type { Budget, FinancialTarget, RecurringItem, SavingsGoal, Transaction } from '@/data/types'
import { addDaysISO, addMonthsISO, eachMonth, monthKey } from '@/lib/dates'
import { sum } from '@/lib/utils'

export interface MonthTotals {
  month: string
  income: number
  expenses: number
  net: number
  count: number
}

export function monthTotals(transactions: Transaction[], month: string): MonthTotals {
  const inMonth = transactions.filter((t) => monthKey(t.date) === month)
  const income = sum(inMonth.filter((t) => t.kind === 'income').map((t) => t.amount))
  const expenses = sum(inMonth.filter((t) => t.kind === 'expense').map((t) => t.amount))
  return { month, income, expenses, net: income - expenses, count: inMonth.length }
}

/** Totals for each month between two dates (inclusive), including empty months. */
export function monthlySeries(transactions: Transaction[], start: string, end: string): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>()
  for (const m of eachMonth(start, end)) byMonth.set(m, { month: m, income: 0, expenses: 0, net: 0, count: 0 })
  for (const t of transactions) {
    const row = byMonth.get(monthKey(t.date))
    if (!row) continue
    if (t.kind === 'income') row.income += t.amount
    else row.expenses += t.amount
    row.net = row.income - row.expenses
    row.count++
  }
  return [...byMonth.values()]
}

export function categoryBreakdown(transactions: Transaction[], filter: (t: Transaction) => boolean, kind: 'expense' | 'income' = 'expense') {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== kind || !filter(t)) continue
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
  }
  const total = sum([...totals.values()])
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

export interface BudgetStatus {
  budget: Budget
  spent: number
  remaining: number
  ratio: number
  state: 'ok' | 'warn' | 'over'
}

export function budgetStatus(budget: Budget, transactions: Transaction[], month: string): BudgetStatus {
  const spent = sum(
    transactions
      .filter((t) => t.kind === 'expense' && monthKey(t.date) === month && (budget.category === '*' || t.category === budget.category))
      .map((t) => t.amount),
  )
  const ratio = budget.limit ? spent / budget.limit : 0
  return { budget, spent, remaining: budget.limit - spent, ratio, state: ratio > 1 ? 'over' : ratio >= 0.85 ? 'warn' : 'ok' }
}

export const savedSoFar = (goal: SavingsGoal) => sum(goal.contributions.map((c) => c.amount))

export function savingsProgress(goal: SavingsGoal, today: string) {
  const saved = savedSoFar(goal)
  const remaining = Math.max(0, goal.target - saved)
  let perMonthNeeded: number | null = null
  if (goal.targetDate && remaining > 0 && goal.targetDate > today) {
    const months = Math.max(1, eachMonth(today, goal.targetDate).length - 1 || 1)
    perMonthNeeded = Math.ceil(remaining / months)
  }
  return { saved, remaining, pct: goal.target ? Math.min(100, (saved / goal.target) * 100) : 0, perMonthNeeded }
}

/** Running balance of a savings goal over time, one point per contribution date. */
export function savingsSeries(goal: SavingsGoal) {
  const sorted = [...goal.contributions].sort((a, b) => (a.date < b.date ? -1 : 1))
  let running = 0
  const points: { date: string; total: number }[] = []
  for (const c of sorted) {
    running += c.amount
    const last = points[points.length - 1]
    if (last && last.date === c.date) last.total = running
    else points.push({ date: c.date, total: running })
  }
  return points
}

export const monthlyEquivalent = (item: Pick<RecurringItem, 'amount' | 'frequency'>) => Math.round(item.amount * FREQUENCY_PER_MONTH[item.frequency])

export function advanceDate(date: string, frequency: Frequency): string {
  switch (frequency) {
    case 'weekly':
      return addDaysISO(date, 7)
    case 'fortnightly':
      return addDaysISO(date, 14)
    case 'monthly':
      return addMonthsISO(date, 1)
    case 'quarterly':
      return addMonthsISO(date, 3)
    case 'yearly':
      return addMonthsISO(date, 12)
  }
}

export function recurringSummary(items: RecurringItem[]) {
  const active = items.filter((i) => i.active)
  return {
    monthlyOut: sum(active.filter((i) => i.kind === 'expense').map(monthlyEquivalent)),
    monthlyIn: sum(active.filter((i) => i.kind === 'income').map(monthlyEquivalent)),
  }
}

export interface TargetStatus {
  target: FinancialTarget
  actual: number
  met: boolean
  /** 0–1+ share of the target reached (for "at least" targets) or used (for limits). */
  ratio: number
  kind: 'minimum' | 'limit'
}

export function targetStatus(target: FinancialTarget, transactions: Transaction[], month: string): TargetStatus {
  const totals = monthTotals(transactions, month)
  let actual = 0
  let kind: TargetStatus['kind'] = 'minimum'
  switch (target.metric) {
    case 'monthly_savings':
      actual = totals.net
      break
    case 'min_monthly_income':
      actual = totals.income
      break
    case 'max_monthly_spending':
      actual = totals.expenses
      kind = 'limit'
      break
    case 'max_category_spending':
      actual = sum(transactions.filter((t) => t.kind === 'expense' && monthKey(t.date) === month && t.category === target.category).map((t) => t.amount))
      kind = 'limit'
      break
  }
  const ratio = target.amount ? actual / target.amount : 0
  return { target, actual, kind, ratio, met: kind === 'minimum' ? actual >= target.amount : actual <= target.amount }
}

export interface RecurringHistory {
  /** Logged payments, newest first. */
  payments: Transaction[]
  last?: Transaction
  /** Total logged in the calendar year of `today`. */
  thisYear: number
  total: number
}

/** The payments logged for a recurring item (bill, subscription, salary), via their link. */
export function recurringHistory(transactions: readonly Transaction[], recurringId: string, today: string): RecurringHistory {
  const payments = transactions.filter((t) => t.recurringId === recurringId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const year = today.slice(0, 4)
  return {
    payments,
    last: payments[0],
    thisYear: sum(payments.filter((p) => p.date.startsWith(year)).map((p) => p.amount)),
    total: sum(payments.map((p) => p.amount)),
  }
}
