import { FINANCIAL_TARGET_METRICS, FREQUENCIES, TRANSACTION_KINDS } from '@/data/constants'
import { opts, refOptions } from './helpers'
import type { FormConfig, FormContext, Values } from './types'

const categorySuggestions = (ctx: FormContext, v: Values) => {
  const base = v.kind === 'income' ? ctx.settings.incomeCategories : ctx.settings.expenseCategories
  const used = ctx.db.transactions.filter((t) => t.kind === v.kind).map((t) => t.category)
  return [...new Set([...base, ...used])]
}

export const transactionForm: FormConfig<'transactions'> = {
  key: 'transactions',
  fields: [
    { name: 'kind', label: 'Type', type: 'segmented', options: opts(TRANSACTION_KINDS), span: 2, autoFocus: false },
    { name: 'amount', label: 'Amount', type: 'money', required: true, autoFocus: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'category', label: 'Category', type: 'text', required: true, suggestions: categorySuggestions, hint: 'Pick a suggestion or type a new category' },
    { name: 'description', label: 'Description', type: 'text', placeholder: 'e.g. Weekly shop' },
    { name: 'recurringId', label: 'Recurring item', type: 'select', emptyOption: 'None', options: (ctx) => refOptions(ctx.db.recurring, (r) => r.name) },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
  ],
  defaults: (ctx) => ({ kind: 'expense', date: ctx.today }),
  quickFields: ['kind', 'amount', 'date', 'category', 'description'],
}

export const budgetForm: FormConfig<'budgets'> = {
  key: 'budgets',
  fields: [
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: (ctx) => [{ value: '*', label: 'All spending (monthly total)' }, ...[...new Set([...ctx.settings.expenseCategories, ...ctx.db.transactions.filter((t) => t.kind === 'expense').map((t) => t.category)])].map((c) => ({ value: c, label: c }))],
    },
    { name: 'limit', label: 'Monthly limit', type: 'money', required: true },
    { name: 'notes', label: 'Notes', type: 'text', span: 2 },
  ],
  validate: (v, ctx) => (ctx.db.budgets.some((b) => b.category === v.category && b.id !== v.id) ? { category: 'There is already a budget for this category' } : undefined),
}

export const savingsGoalForm: FormConfig<'savingsGoals'> = {
  key: 'savingsGoals',
  fields: [
    { name: 'name', label: 'Goal', type: 'text', required: true, placeholder: 'e.g. Emergency fund', span: 2 },
    { name: 'target', label: 'Target amount', type: 'money', required: true },
    { name: 'targetDate', label: 'Target date', type: 'date' },
    { name: 'color', label: 'Colour', type: 'color', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    { name: 'archived', label: 'Archived', type: 'switch', hint: 'Hide from the main list' },
  ],
  defaults: () => ({ color: 'lime', contributions: [], archived: false }),
}

export const recurringForm: FormConfig<'recurring'> = {
  key: 'recurring',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Rent, Phone contract, Salary', span: 2 },
    { name: 'kind', label: 'Type', type: 'segmented', options: opts(TRANSACTION_KINDS), span: 2 },
    { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'frequency', label: 'Frequency', type: 'select', options: opts(FREQUENCIES) },
    { name: 'category', label: 'Category', type: 'text', required: true, suggestions: categorySuggestions },
    { name: 'nextDate', label: 'Next due', type: 'date', required: true },
    { name: 'active', label: 'Active', type: 'switch' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  defaults: (ctx) => ({ kind: 'expense', frequency: 'monthly', nextDate: ctx.today, active: true }),
}

export const financialTargetForm: FormConfig<'financialTargets'> = {
  key: 'financialTargets',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Save £300 a month', span: 2 },
    { name: 'metric', label: 'Target type', type: 'select', required: true, options: opts(FINANCIAL_TARGET_METRICS), span: 2 },
    { name: 'amount', label: 'Amount', type: 'money', required: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      visible: (v) => v.metric === 'max_category_spending',
      options: (ctx) => [...new Set([...ctx.settings.expenseCategories, ...ctx.db.transactions.filter((t) => t.kind === 'expense').map((t) => t.category)])].map((c) => ({ value: c, label: c })),
    },
  ],
  defaults: () => ({ metric: 'monthly_savings' }),
  prepare: (v) => (v.metric === 'max_category_spending' ? v : { ...v, category: undefined }),
  validate: (v) => (v.metric === 'max_category_spending' && !v.category ? { category: 'Choose the category to limit' } : undefined),
}
