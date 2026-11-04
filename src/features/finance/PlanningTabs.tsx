import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Goal, Pause, PiggyBank, Play, Plus, Receipt, Repeat, Target, Trash2, XCircle } from 'lucide-react'
import { FINANCIAL_TARGET_METRICS, FREQUENCIES } from '@/data/constants'
import { useFormatters } from '@/hooks/useFormatters'
import { budgetStatus, categoryBreakdown, monthlyEquivalent, recurringHistory, recurringSummary, savingsProgress, targetStatus } from '@/selectors/finance'
import { formatMonthKey, monthKey, relativeDay } from '@/lib/dates'
import { parseMoney } from '@/lib/format'
import { uid } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { logRecurring } from '@/app/financeCommands'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar, ProgressRing, Stat } from '@/components/ui/display'
import { Input } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { RecordActions } from '@/components/shared/RecordActions'
import { toast } from '@/components/ui/toast'
import { editor } from '@/components/editor/editorStore'
import { confirmAction } from '@/components/ui/confirm'

export function BudgetsTab({ month }: { month: string }) {
  const budgets = useCollection('budgets')
  const transactions = useCollection('transactions')
  const fmt = useFormatters()
  const statuses = budgets.map((b) => budgetStatus(b, transactions, month)).sort((a, b) => (a.budget.category === '*' ? -1 : b.budget.category === '*' ? 1 : b.ratio - a.ratio))
  const budgeted = new Set(budgets.map((b) => b.category))
  const unbudgeted = categoryBreakdown(transactions, (t) => monthKey(t.date) === month).filter((c) => !budgeted.has(c.category))
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel title={`Monthly budgets · ${formatMonthKey(month)}`} icon={Goal} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('budgets')}>Budget</Button>}>
        {statuses.length === 0 ? (
          <EmptyState compact icon={Goal} title="No budgets yet" description="Set a monthly limit for a category, or for total spending." />
        ) : (
          <ul className="space-y-4">
            {statuses.map((s) => (
              <li key={s.budget.id} className="group">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{s.budget.category === '*' ? 'All spending' : s.budget.category}</span>
                  {s.state === 'over' && <Badge tone="bad">Over by {fmt.money(-s.remaining, { showPence: false })}</Badge>}
                  {s.state === 'warn' && <Badge tone="warn">Nearly used</Badge>}
                  <span className="font-mono text-[12px] text-ink-muted tabular">
                    {fmt.money(s.spent, { showPence: false })} / {fmt.money(s.budget.limit, { showPence: false })}
                  </span>
                  <RecordActions collection="budgets" id={s.budget.id} />
                </div>
                <ProgressBar value={Math.min(100, s.ratio * 100)} tone={s.state === 'over' ? 'bad' : s.state === 'warn' ? 'warn' : 'ok'} label={`${s.budget.category} budget used`} />
                <p className="mt-1 text-[11.5px] text-ink-subtle">{s.remaining >= 0 ? `${fmt.money(s.remaining, { showPence: false })} left this month` : 'Limit exceeded'}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Spending without a budget" icon={Receipt}>
        {unbudgeted.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">Every category with spending this month has a budget.</p>
        ) : (
          <ul className="space-y-1">
            {unbudgeted.map((c) => (
              <li key={c.category} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{c.category}</span>
                <span className="font-mono text-[12px] text-ink-muted tabular">{fmt.money(c.amount, { showPence: false })}</span>
                <Button size="xs" variant="subtle" onClick={() => editor.create('budgets', { category: c.category, limit: Math.ceil(c.amount / 1000) * 1000 })}>
                  Budget
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function ContributionForm({ goalId }: { goalId: string }) {
  const settings = useSettings()
  const [amount, setAmount] = useState('')
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        // Which button submitted the form decides contribution vs withdrawal.
        const withdraw = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'withdraw'
        const minor = parseMoney(amount, settings.currency)
        if (!minor || minor <= 0) {
          toast({ title: 'Enter an amount greater than zero', tone: 'warning' })
          return
        }
        const today = new Date().toISOString().slice(0, 10)
        actions.update('savingsGoals', goalId, (g) => ({ contributions: [...g.contributions, { id: uid(), date: today, amount: withdraw ? -minor : minor }] }), { action: 'logged', detail: withdraw ? 'Withdrawal' : 'Contribution' })
        setAmount('')
        toast({ title: withdraw ? 'Withdrawal recorded' : 'Contribution added' })
      }}
    >
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal" aria-label="Contribution amount" className="h-8 w-28 text-[13px]" />
      <Button type="submit" size="sm" variant="subtle" value="add">
        Add
      </Button>
      <Button type="submit" size="sm" variant="ghost" value="withdraw">
        Withdraw
      </Button>
    </form>
  )
}

export function SavingsTab({ today }: { today: string }) {
  const goals = useCollection('savingsGoals')
  const fmt = useFormatters()
  const [showArchived, setShowArchived] = useState(false)
  const list = goals.filter((g) => showArchived || !g.archived)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--color-accent)]" />
          Show archived
        </label>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('savingsGoals')}>
          Savings goal
        </Button>
      </div>
      {list.length === 0 ? (
        <Panel>
          <EmptyState icon={PiggyBank} title="No savings goals" description="Set a target — an emergency fund, a trip, a deposit — and record contributions as you save." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const p = savingsProgress(g, today)
            const recent = [...g.contributions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4)
            return (
              <Panel key={g.id} title={g.name} eyebrow={g.archived ? 'Archived' : g.targetDate ? `Target ${fmt.date(g.targetDate)}` : 'No target date'} actions={<RecordActions collection="savingsGoals" id={g.id} />}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={p.pct} tone={g.color} size={68} stroke={6} />
                  <div className="min-w-0">
                    <p className="font-display text-[20px] font-semibold text-ink tabular">{fmt.money(p.saved, { showPence: false })}</p>
                    <p className="text-[12px] text-ink-subtle">of {fmt.money(g.target, { showPence: false })}</p>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {p.remaining === 0 ? 'Target reached 🎉' : p.perMonthNeeded ? `${fmt.money(p.perMonthNeeded, { showPence: false })}/month to hit the date` : `${fmt.money(p.remaining, { showPence: false })} to go`}
                    </p>
                  </div>
                </div>
                <ContributionForm goalId={g.id} />
                {recent.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3">
                    {recent.map((c) => (
                      <li key={c.id} className="group flex items-center gap-2 text-[12.5px]">
                        <span className="font-mono text-ink-subtle">{fmt.shortDate(c.date)}</span>
                        <span className={`flex-1 font-mono tabular ${c.amount < 0 ? 'text-bad' : 'text-ok'}`}>{fmt.money(c.amount, { signed: true })}</span>
                        <IconButton
                          icon={Trash2}
                          label="Remove contribution"
                          size="xs"
                          variant="danger"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={async () => {
                            if (await confirmAction({ title: 'Remove contribution?', message: `${fmt.money(c.amount)} on ${fmt.date(c.date)}`, confirmLabel: 'Remove' }))
                              actions.update('savingsGoals', g.id, (cur) => ({ contributions: cur.contributions.filter((x) => x.id !== c.id) }))
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function RecurringTab({ today }: { today: string }) {
  const items = useCollection('recurring')
  const transactions = useCollection('transactions')
  const fmt = useFormatters()
  const summary = recurringSummary(items)
  const sorted = useMemo(() => [...items].sort((a, b) => (a.active !== b.active ? (a.active ? -1 : 1) : a.nextDate.localeCompare(b.nextDate))), [items])
  const logNow = (id: string) => {
    const r = items.find((x) => x.id === id)
    if (!r) return
    logRecurring(r, today, fmt.date)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Recurring out / month" value={fmt.money(summary.monthlyOut, { showPence: false })} tone="bad" sub="Monthly equivalent of active items" />
        <Stat label="Recurring in / month" value={fmt.money(summary.monthlyIn, { showPence: false })} tone="ok" />
        <Stat label="Active items" value={items.filter((i) => i.active).length} tone="cyan" className="col-span-2 lg:col-span-1" />
      </div>
      <Panel title="Recurring income & expenses" icon={Repeat} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('recurring')}>Recurring item</Button>}>
        {sorted.length === 0 ? (
          <EmptyState compact icon={Repeat} title="No recurring items" description="Add rent, bills, subscriptions or salary. Log each occurrence with one click — nothing is added automatically." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((r) => {
              const due = r.active && r.nextDate <= today
              return (
                <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${r.active ? '' : 'opacity-55'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-ink">{r.name}</p>
                    <p className="text-[12px] text-ink-subtle">
                      {r.category} · {FREQUENCIES.label(r.frequency)} · ≈ {fmt.money(monthlyEquivalent(r), { showPence: false })}/month
                    </p>
                    {(() => {
                      const h = recurringHistory(transactions, r.id, today)
                      return (
                        <p className="text-[12px] text-ink-muted" data-testid="recurring-history">
                          {h.last ? `Last logged ${fmt.date(h.last.date)} · ${fmt.money(h.thisYear, { showPence: false })} this year (${h.payments.length} payment${h.payments.length === 1 ? '' : 's'})` : 'Not logged yet'}
                        </p>
                      )
                    })()}
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-[13.5px] tabular ${r.kind === 'income' ? 'text-ok' : 'text-ink'}`}>
                      {r.kind === 'income' ? '+' : '−'}
                      {fmt.money(r.amount)}
                    </p>
                    <p className={`inline-flex items-center gap-1 text-[11.5px] ${due ? 'text-warn' : 'text-ink-subtle'}`}>
                      <CalendarClock size={11} />
                      {r.active ? relativeDay(r.nextDate, today) : 'Paused'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.active && (
                      <Button size="xs" variant={due ? 'primary' : 'subtle'} onClick={() => logNow(r.id)} title="Create a transaction and move the next due date forward">
                        Log
                      </Button>
                    )}
                    <IconButton icon={r.active ? Pause : Play} label={r.active ? 'Pause' : 'Resume'} size="xs" onClick={() => actions.update('recurring', r.id, { active: !r.active })} />
                    <RecordActions collection="recurring" id={r.id} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export function TargetsTab({ month }: { month: string }) {
  const targets = useCollection('financialTargets')
  const transactions = useCollection('transactions')
  const fmt = useFormatters()
  return (
    <Panel title={`Financial targets · ${formatMonthKey(month)}`} icon={Target} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('financialTargets')}>Target</Button>}>
      {targets.length === 0 ? (
        <EmptyState compact icon={Target} title="No targets yet" description="e.g. save at least £300 a month, or keep eating out under £150." />
      ) : (
        <ul className="space-y-4">
          {targets.map((t) => {
            const s = targetStatus(t, transactions, month)
            const Icon = s.met ? CheckCircle2 : XCircle
            return (
              <li key={t.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon size={16} className={s.met ? 'text-ok' : 'text-warn'} aria-label={s.met ? 'On track' : 'Not met'} />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.name}</span>
                  <span className="font-mono text-[12px] text-ink-muted tabular">
                    {fmt.money(s.actual, { showPence: false })} / {fmt.money(t.amount, { showPence: false })}
                  </span>
                  <RecordActions collection="financialTargets" id={t.id} />
                </div>
                <ProgressBar value={Math.max(0, Math.min(100, s.ratio * 100))} tone={s.met ? 'ok' : 'warn'} size="sm" label={`${t.name} progress`} />
                <p className="mt-1 text-[11.5px] text-ink-subtle">
                  {FINANCIAL_TARGET_METRICS.label(t.metric)}
                  {t.category ? ` · ${t.category}` : ''} · {s.met ? (s.kind === 'limit' ? 'within limit' : 'target met') : s.kind === 'limit' ? 'over the limit' : 'not met yet'}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
