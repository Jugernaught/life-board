import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FINANCIAL_TARGET_METRICS, FREQUENCIES } from '@/data/constants'
import type { SavingsGoal, Transaction } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { advanceDate, budgetStatus, monthTotals, monthlyEquivalent, monthlySeries, recurringSummary, savingsProgress, targetStatus } from '@/selectors/finance'
import { addMonthsISO, formatDate, formatMonthKey, monthKey, relativeDay, todayISO } from '@/lib/dates'
import { parseMoney } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { cn, sum, uid } from '@/lib/utils'
import { actions, useCollection, useDatabase, useSettings } from '@/store/store'
import { ProgressRing } from '@/components/ui/display'
import { toast } from '@/components/ui/toast'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { confirmAction } from '@/components/ui/confirm'
import { RecordScreen } from '../../components/RecordScreen'
import { ProgressLine } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { Chips, Segmented } from '../../ui/controls'
import { Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { SwipeRow } from '../../ui/SwipeRow'

function useMoney() {
  const fmt = useFormatters()
  return { fmt, money: (n: number) => fmt.money(n, { showPence: false }), exact: (n: number) => fmt.money(n) }
}

function TxCell({ t }: { t: Transaction }) {
  const { exact } = useMoney()
  const income = t.kind === 'income'
  return (
    <SwipeRow actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('transactions', t.id) }]}>
      <Cell
        leading={
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', income ? 'bg-[var(--color-ok)]/15 text-ok' : 'bg-[var(--ios-fill)] text-ink-muted')}>
            {income ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </span>
        }
        title={t.description || t.category}
        subtitle={t.description ? t.category : formatDate(t.date, 'd MMM')}
        detail={<span className={cn('tabular-nums', income ? 'text-ok' : 'text-ink')}>{`${income ? '+' : '−'}${exact(t.amount)}`}</span>}
        onClick={() => editor.edit('transactions', t.id)}
        testId="m-tx-row"
      />
    </SwipeRow>
  )
}

export function FinanceScreen() {
  const db = useDatabase()
  const today = useToday()
  const { money } = useMoney()
  const [month, setMonth] = useState(monthKey(today))
  const totals = monthTotals(db.transactions, month)
  const total = db.budgets.find((b) => b.category === '*')
  const totalStatus = total ? budgetStatus(total, db.transactions, month) : null
  const six = useMemo(() => monthlySeries(db.transactions, addMonthsISO(`${month}-01`, -5), `${month}-28`).map((m) => ({ ...m, label: formatMonthKey(m.month, 'MMM') })), [db.transactions, month])
  const recent = [...db.transactions].filter((t) => monthKey(t.date) === month).sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
  const budgets = db.budgets.filter((b) => b.category !== '*').map((b) => budgetStatus(b, db.transactions, month)).sort((a, b) => b.ratio - a.ratio)
  const goals = db.savingsGoals.filter((g) => !g.archived)
  const dueRecurring = db.recurring.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate))

  return (
    <Screen
      title="Finances"
      large
      testId="screen-finance"
      trailing={
        <NavButton label="New transaction" onClick={() => editor.create('transactions')} testId="finance-add">
          <Plus size={26} />
        </NavButton>
      }
    >
      <div className="mx-4 mb-7 rounded-[12px] bg-[var(--ios-cell)] p-4" data-testid="finance-summary">
        <div className="mb-2 flex items-center">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(monthKey(addMonthsISO(`${month}-01`, -1)))} className="-ml-2 flex size-11 items-center justify-center text-accent">
            <ChevronLeft size={22} />
          </button>
          <button type="button" onClick={() => setMonth(monthKey(today))} className="ios-headline min-h-11 flex-1 text-center text-ink" aria-label={`${formatMonthKey(month, 'MMMM yyyy')} — show this month`}>
            {formatMonthKey(month, 'MMMM yyyy')}
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(monthKey(addMonthsISO(`${month}-01`, 1)))} className="-mr-2 flex size-11 items-center justify-center text-accent">
            <ChevronRight size={22} />
          </button>
        </div>
        <p className="ios-footnote text-ink-subtle">Spent</p>
        <p className="text-[34px] leading-tight font-bold text-ink tabular-nums">{money(totals.expenses)}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="ios-footnote text-ink-subtle">Income</p>
            <p className="ios-headline text-ok tabular-nums">{money(totals.income)}</p>
          </div>
          <div>
            <p className="ios-footnote text-ink-subtle">Net</p>
            <p className={cn('ios-headline tabular-nums', totals.net < 0 ? 'text-bad' : 'text-ink')}>{money(totals.net)}</p>
          </div>
        </div>
        {totalStatus && (
          <div className="mt-3">
            <div className="ios-footnote mb-1 flex justify-between text-ink-subtle">
              <span>Monthly budget</span>
              <span className="tabular-nums">
                {money(totalStatus.spent)} of {money(totalStatus.budget.limit)}
              </span>
            </div>
            <ProgressLine value={Math.min(100, totalStatus.ratio * 100)} tone={totalStatus.state === 'over' ? 'bad' : totalStatus.state === 'warn' ? 'warn' : 'ok'} />
          </div>
        )}
      </div>

      <div className="mx-4 mb-7">
        <ChartCard
          title="Income and spending"
          description="Last 6 months"
          legend={[
            { label: 'Income', color: series(0) },
            { label: 'Spending', color: series(1) },
          ]}
          rows={six}
          columns={[
            { label: 'Month', value: (r) => formatMonthKey(r.month) },
            { label: 'In', value: (r) => money(r.income), align: 'right' },
            { label: 'Out', value: (r) => money(r.expenses), align: 'right' },
          ]}
          empty={!six.some((m) => m.count)}
          emptyHint="Add transactions to compare months."
          height={180}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={six} barGap={2} margin={{ top: 4, right: 0, left: -6, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tickFormatter={(v) => money(v).replace(/\.00$/, '')} width={52} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => money(v)} formatLabel={(_l, r) => formatMonthKey(String(r?.month))} />} />
              <Bar dataKey="income" name="Income" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="expenses" name="Spending" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Section header="Transactions" headerAction={<SeeAll onClick={() => nav.push('more/finance/transactions')} />}>
        {recent.length === 0 && <EmptyRow>No transactions in {formatMonthKey(month, 'MMMM')}.</EmptyRow>}
        {recent.slice(0, 5).map((t) => (
          <TxCell key={t.id} t={t} />
        ))}
      </Section>

      <Section header="Budgets" headerAction={<SeeAll onClick={() => nav.push('more/finance/budgets')} />}>
        {budgets.length === 0 && <EmptyRow>No category budgets.</EmptyRow>}
        {budgets.slice(0, 4).map((b) => (
          <button key={b.budget.id} type="button" onClick={() => editor.edit('budgets', b.budget.id)} className="ios-press block w-full px-4 py-2.5 text-left">
            <span className="ios-body flex justify-between gap-2 text-ink">
              <span className="truncate">{b.budget.category}</span>
              <span className="ios-subhead shrink-0 text-ink-subtle tabular-nums">
                {money(b.spent)} / {money(b.budget.limit)}
              </span>
            </span>
            <ProgressLine className="mt-1.5" value={Math.min(100, b.ratio * 100)} tone={b.state === 'over' ? 'bad' : b.state === 'warn' ? 'warn' : 'ok'} />
          </button>
        ))}
      </Section>

      <Section header="Savings" headerAction={<SeeAll onClick={() => nav.push('more/finance/savings')} />}>
        {goals.length === 0 && <EmptyRow>No savings goals.</EmptyRow>}
        {goals.map((g) => {
          const p = savingsProgress(g, today)
          return <Cell key={g.id} leading={<ProgressRing value={p.pct} size={32} stroke={4} tone={g.color}><span /></ProgressRing>} title={g.name} subtitle={`${money(p.saved)} of ${money(g.target)}`} chevron onClick={() => nav.push('more/finance/savings')} />
        })}
      </Section>

      <Section header="Recurring" headerAction={<SeeAll onClick={() => nav.push('more/finance/recurring')} />}>
        {dueRecurring.length === 0 && <EmptyRow>No recurring items.</EmptyRow>}
        {dueRecurring.slice(0, 3).map((r) => (
          <Cell key={r.id} title={r.name} subtitle={relativeDay(r.nextDate, today)} detail={<span className="tabular-nums">{money(r.amount)}</span>} chevron onClick={() => nav.push('more/finance/recurring')} />
        ))}
      </Section>

      <Section footer="Amounts are entered by you. Atlas doesn’t connect to your bank.">
        <Cell title="Financial Targets" detail={db.financialTargets.length || undefined} chevron onClick={() => nav.push('more/finance/targets')} />
      </Section>
    </Screen>
  )
}

type Kind = 'all' | 'income' | 'expense'

export function TransactionsScreen() {
  const transactions = useCollection('transactions')
  const today = useToday()
  const { money } = useMoney()
  const [kind, setKind] = useState<Kind>('all')
  const items = useMemo(() => [...transactions].filter((t) => kind === 'all' || t.kind === kind).sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)), [transactions, kind])
  return (
    <RecordScreen
      title="Transactions"
      collection="transactions"
      testId="screen-transactions"
      items={items}
      search={(t) => `${t.description ?? ''} ${t.category} ${t.notes ?? ''}`}
      group={(t) => t.date}
      groupOrder={(a, b) => b.localeCompare(a)}
      empty="No transactions yet. Tap + to log one."
      defaults={kind === 'all' ? undefined : { kind }}
      row={(t) => ({
        title: t.description || t.category,
        subtitle: t.description ? t.category : undefined,
        detail: <span className={cn('tabular-nums', t.kind === 'income' ? 'text-ok' : 'text-ink')}>{`${t.kind === 'income' ? '+' : '−'}${money(t.amount)}`}</span>,
      })}
      top={
        <div className="mb-4 px-4">
          <Segmented
            value={kind}
            onChange={setKind}
            ariaLabel="Type"
            options={[
              { value: 'all', label: 'All' },
              { value: 'expense', label: 'Spending' },
              { value: 'income', label: 'Income' },
            ]}
          />
          <p className="ios-footnote mt-2 px-1 text-ink-subtle">
            {items.length} shown · in {money(sum(items.filter((t) => t.kind === 'income').map((t) => t.amount)))} · out {money(sum(items.filter((t) => t.kind === 'expense').map((t) => t.amount)))}
          </p>
        </div>
      }
      groupLabel={(d) => (['Today', 'Yesterday'].includes(relativeDay(d, today)) ? relativeDay(d, today) : formatDate(d, 'EEEE d MMMM'))}
    />
  )
}

export function BudgetsScreen() {
  const db = useDatabase()
  const today = useToday()
  const { money } = useMoney()
  const month = monthKey(today)
  const rows = db.budgets.map((b) => budgetStatus(b, db.transactions, month)).sort((a, b) => (a.budget.category === '*' ? -1 : b.budget.category === '*' ? 1 : b.ratio - a.ratio))
  return (
    <Screen title="Budgets" trailing={<NavButton label="New budget" onClick={() => editor.create('budgets')}><Plus size={26} /></NavButton>} testId="screen-budgets">
      <Section header={formatMonthKey(month, 'MMMM yyyy')} footer="Budgets reset each month and compare against that month’s spending.">
        {rows.length === 0 && <EmptyRow>No budgets yet. Tap + to set a monthly limit for a category or for total spending.</EmptyRow>}
        {rows.map((s) => (
          <SwipeRow key={s.budget.id} actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('budgets', s.budget.id) }]}>
            <button type="button" onClick={() => editor.edit('budgets', s.budget.id)} className="ios-press block w-full px-4 py-3 text-left">
              <span className="ios-body flex justify-between gap-2 text-ink">
                <span className="truncate">{s.budget.category === '*' ? 'All spending' : s.budget.category}</span>
                <span className="ios-subhead shrink-0 text-ink-subtle tabular-nums">
                  {money(s.spent)} / {money(s.budget.limit)}
                </span>
              </span>
              <ProgressLine className="mt-2" value={Math.min(100, s.ratio * 100)} tone={s.state === 'over' ? 'bad' : s.state === 'warn' ? 'warn' : 'ok'} />
              <span className={cn('ios-footnote mt-1 block', s.state === 'over' ? 'text-bad' : 'text-ink-subtle')}>{s.remaining >= 0 ? `${money(s.remaining)} left` : `${money(-s.remaining)} over`}</span>
            </button>
          </SwipeRow>
        ))}
      </Section>
    </Screen>
  )
}

function ContributionSheet({ goal, mode, onClose }: { goal: SavingsGoal | null; mode: 'add' | 'withdraw'; onClose: () => void }) {
  const settings = useSettings()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const save = () => {
    if (!goal) return
    const minor = parseMoney(amount, settings.currency)
    if (!minor || minor <= 0) return toast({ title: 'Enter an amount greater than zero', tone: 'warning' })
    actions.update('savingsGoals', goal.id, (g) => ({ contributions: [...g.contributions, { id: uid(), date: todayISO(), amount: mode === 'withdraw' ? -minor : minor, note: note.trim() || undefined }] }), { action: 'logged', detail: mode === 'withdraw' ? 'Withdrawal' : 'Contribution' })
    toast({ title: mode === 'withdraw' ? 'Withdrawal recorded' : 'Added to savings' })
    setAmount('')
    setNote('')
    onClose()
  }
  return (
    <Sheet open={!!goal} onClose={onClose} size="auto" title={mode === 'withdraw' ? 'Withdraw' : 'Add Money'} leading={<NavButton onClick={onClose}>Cancel</NavButton>} trailing={<NavButton bold onClick={save} testId="contribution-save">Save</NavButton>} testId="contribution-sheet">
      <div className="px-4 pt-2 pb-4">
        <p className="ios-subhead mb-3 text-ink-subtle">{goal?.name}</p>
        <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label="Amount" className="w-full rounded-[10px] bg-[var(--ios-fill)] px-3 text-[22px] font-semibold text-ink outline-none" data-testid="contribution-amount" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className="mt-3 w-full rounded-[10px] bg-[var(--ios-fill)] px-3 text-ink outline-none" />
      </div>
    </Sheet>
  )
}

export function SavingsScreen() {
  const goals = useCollection('savingsGoals')
  const today = useToday()
  const { money, exact } = useMoney()
  const [target, setTarget] = useState<{ goal: SavingsGoal; mode: 'add' | 'withdraw' } | null>(null)
  const [archived, setArchived] = useState(false)
  const list = goals.filter((g) => archived || !g.archived)
  return (
    <Screen title="Savings" trailing={<NavButton label="New savings goal" onClick={() => editor.create('savingsGoals')}><Plus size={26} /></NavButton>} testId="screen-savings">
      {goals.some((g) => g.archived) && (
        <div className="mb-4 px-4">
          <Chips value={archived ? 'all' : 'active'} onChange={(v) => setArchived(v === 'all')} ariaLabel="Show" options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'Include archived' }]} />
        </div>
      )}
      {list.length === 0 && (
        <Section>
          <EmptyRow>No savings goals yet. Tap + to set a target — an emergency fund, a trip, a deposit.</EmptyRow>
        </Section>
      )}
      {list.map((g) => {
        const p = savingsProgress(g, today)
        const recent = [...g.contributions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4)
        return (
          <Section key={g.id} header={g.name} headerAction={<SeeAll label="Edit" onClick={() => editor.edit('savingsGoals', g.id)} />}>
            <div className="flex items-center gap-4 px-4 py-3">
              <ProgressRing value={p.pct} size={58} stroke={6} tone={g.color} />
              <div className="min-w-0">
                <p className="ios-title2 text-ink tabular-nums">{money(p.saved)}</p>
                <p className="ios-footnote text-ink-subtle">
                  of {money(g.target)}
                  {g.targetDate ? ` by ${formatDate(g.targetDate, 'd MMM yyyy')}` : ''}
                </p>
                <p className="ios-footnote text-ink-subtle">{p.remaining === 0 ? 'Target reached' : p.perMonthNeeded ? `${money(p.perMonthNeeded)} a month to hit the date` : `${money(p.remaining)} to go`}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-3">
              <button type="button" onClick={() => setTarget({ goal: g, mode: 'add' })} className="ios-subhead h-11 rounded-[10px] bg-accent font-semibold text-on-accent active:opacity-80" data-testid="savings-add-money">
                Add Money
              </button>
              <button type="button" onClick={() => setTarget({ goal: g, mode: 'withdraw' })} className="ios-subhead h-11 rounded-[10px] bg-[var(--ios-fill)] font-semibold text-accent active:opacity-80">
                Withdraw
              </button>
            </div>
            {recent.map((c) => (
              <SwipeRow
                key={c.id}
                actions={[
                  {
                    label: 'Delete',
                    icon: Trash2,
                    tone: 'bad',
                    onAction: async () => {
                      if (await confirmAction({ title: 'Remove this entry?', message: `${exact(c.amount)} on ${formatDate(c.date, 'd MMM yyyy')}`, confirmLabel: 'Remove' }))
                        actions.update('savingsGoals', g.id, (cur) => ({ contributions: cur.contributions.filter((x) => x.id !== c.id) }))
                    },
                  },
                ]}
              >
                <Cell title={c.note || (c.amount < 0 ? 'Withdrawal' : 'Contribution')} subtitle={formatDate(c.date, 'd MMM yyyy')} detail={<span className={cn('tabular-nums', c.amount < 0 ? 'text-bad' : 'text-ok')}>{exact(c.amount)}</span>} />
              </SwipeRow>
            ))}
          </Section>
        )
      })}
      <ContributionSheet goal={target?.goal ?? null} mode={target?.mode ?? 'add'} onClose={() => setTarget(null)} />
    </Screen>
  )
}

export function RecurringScreen() {
  const items = useCollection('recurring')
  const today = useToday()
  const { money, fmt } = useMoney()
  const summary = recurringSummary(items)
  const sorted = [...items].sort((a, b) => (a.active !== b.active ? (a.active ? -1 : 1) : a.nextDate.localeCompare(b.nextDate)))
  const log = (id: string) => {
    const r = items.find((x) => x.id === id)
    if (!r) return
    actions.create('transactions', { kind: r.kind, amount: r.amount, date: r.nextDate <= today ? r.nextDate : today, category: r.category, description: r.name, recurringId: r.id })
    actions.update('recurring', r.id, { nextDate: advanceDate(r.nextDate, r.frequency) }, { action: 'logged', detail: 'Logged as a transaction' })
    toast({ title: `${r.name} logged`, description: `Next due ${fmt.date(advanceDate(r.nextDate, r.frequency))}` })
  }
  return (
    <Screen title="Recurring" trailing={<NavButton label="New recurring item" onClick={() => editor.create('recurring')}><Plus size={26} /></NavButton>} testId="screen-recurring">
      <Section footer="“Log” adds a transaction and moves the next due date on. Nothing is added automatically.">
        <Cell title="Out per month" detail={<span className="tabular-nums">{money(summary.monthlyOut)}</span>} />
        <Cell title="In per month" detail={<span className="tabular-nums">{money(summary.monthlyIn)}</span>} />
      </Section>
      <Section>
        {sorted.length === 0 && <EmptyRow>No recurring items. Add rent, bills, subscriptions or salary.</EmptyRow>}
        {sorted.map((r) => {
          const due = r.active && r.nextDate <= today
          return (
            <SwipeRow key={r.id} actions={[{ label: r.active ? 'Pause' : 'Resume', tone: 'warn', onAction: () => actions.update('recurring', r.id, { active: !r.active }) }, { label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('recurring', r.id) }]}>
              <div className={cn('flex items-center gap-3 pr-4', !r.active && 'opacity-55')}>
                <button type="button" onClick={() => editor.edit('recurring', r.id)} className="ios-press min-w-0 flex-1 px-4 py-2.5 text-left">
                  <span className="ios-body block truncate text-ink">{r.name}</span>
                  <span className={cn('ios-footnote block truncate', due ? 'text-warn' : 'text-ink-subtle')}>
                    {money(r.amount)} · {FREQUENCIES.label(r.frequency)} · {r.active ? relativeDay(r.nextDate, today) : 'Paused'} · ≈{money(monthlyEquivalent(r))}/mo
                  </span>
                </button>
                {r.active && (
                  <button type="button" onClick={() => log(r.id)} className={cn('ios-subhead h-8 shrink-0 rounded-full px-3.5 font-semibold', due ? 'bg-accent text-on-accent' : 'bg-[var(--ios-fill)] text-accent')} data-testid="recurring-log">
                    Log
                  </button>
                )}
              </div>
            </SwipeRow>
          )
        })}
      </Section>
    </Screen>
  )
}

export function TargetsScreen() {
  const targets = useCollection('financialTargets')
  const transactions = useCollection('transactions')
  const today = useToday()
  const { money } = useMoney()
  const month = monthKey(today)
  return (
    <RecordScreen
      title="Targets"
      collection="financialTargets"
      testId="screen-fin-targets"
      items={targets}
      empty="No targets yet. e.g. save at least £300 a month, or keep eating out under £150."
      footer={`Progress for ${formatMonthKey(month, 'MMMM yyyy')}.`}
      row={(t) => {
        const s = targetStatus(t, transactions, month)
        return {
          title: t.name,
          subtitle: `${FINANCIAL_TARGET_METRICS.label(t.metric)}${t.category ? ` · ${t.category}` : ''}`,
          detail: <span style={{ color: toneColor(s.met ? 'ok' : 'warn') }} className="tabular-nums">{`${money(s.actual)} / ${money(t.amount)}`}</span>,
        }
      }}
    />
  )
}
