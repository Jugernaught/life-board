import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Scale } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useFormatters } from '@/hooks/useFormatters'
import { budgetStatus, categoryBreakdown, monthTotals, monthlySeries, savedSoFar, savingsSeries } from '@/selectors/finance'
import { addMonthsISO, formatDate, formatMonthKey, monthKey } from '@/lib/dates'
import { sum } from '@/lib/utils'
import { useDatabase } from '@/store/store'
import { Delta, ProgressBar, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'

export function FinanceOverview({ month }: { month: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const money = (v: number) => fmt.money(v, { showPence: false })
  const compact = (v: number) => fmt.money(v, { compact: true })
  const cur = monthTotals(db.transactions, month)
  const prevMonth = monthKey(addMonthsISO(`${month}-01`, -1))
  const prev = monthTotals(db.transactions, prevMonth)
  const savingsRate = cur.income > 0 ? (cur.net / cur.income) * 100 : null

  const twelve = useMemo(() => monthlySeries(db.transactions, addMonthsISO(`${month}-01`, -11), `${month}-28`).map((m) => ({ ...m, label: formatMonthKey(m.month, 'MMM') })), [db.transactions, month])
  const cumulative = useMemo(() => {
    let running = 0
    return twelve.map((m) => {
      running += m.net
      return { ...m, cumulative: running }
    })
  }, [twelve])
  const breakdown = useMemo(() => categoryBreakdown(db.transactions, (t) => monthKey(t.date) === month), [db.transactions, month])
  const budgets = db.budgets.map((b) => budgetStatus(b, db.transactions, month)).sort((a, b) => b.ratio - a.ratio)
  const goals = db.savingsGoals.filter((g) => !g.archived)
  const savingsTimeline = useMemo(() => {
    // Combined balance across all goals, by contribution date.
    const all = goals.flatMap((g) => g.contributions).sort((a, b) => (a.date < b.date ? -1 : 1))
    let running = 0
    const out: { date: string; total: number }[] = []
    for (const c of all) {
      running += c.amount
      const last = out[out.length - 1]
      if (last && last.date === c.date) last.total = running
      else out.push({ date: c.date, total: running })
    }
    return out
  }, [goals])
  const hasTwelve = twelve.some((m) => m.count > 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Income" value={money(cur.income)} icon={ArrowDownLeft} tone="ok" sub={<Delta current={cur.income} previous={prev.income} format={money} />} />
        <Stat label="Spending" value={money(cur.expenses)} icon={ArrowUpRight} tone="bad" sub={<Delta current={cur.expenses} previous={prev.expenses} format={money} invert />} />
        <Stat label="Net cash flow" value={<span className={cur.net < 0 ? 'text-bad' : undefined}>{fmt.money(cur.net, { showPence: false, signed: true })}</span>} icon={Scale} tone="cyan" sub={<Delta current={cur.net} previous={prev.net} format={money} />} />
        <Stat label="Savings rate" value={savingsRate === null ? '—' : `${Math.round(savingsRate)}%`} icon={PiggyBank} tone="lime" sub={savingsRate === null ? 'Needs income this month' : 'Net ÷ income'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Monthly income vs spending"
          description="Last 12 months"
          legend={[
            { label: 'Income', color: series(0) },
            { label: 'Spending', color: series(1) },
          ]}
          rows={twelve}
          columns={[
            { label: 'Month', value: (r) => formatMonthKey(r.month) },
            { label: 'Income', value: (r) => money(r.income), align: 'right' },
            { label: 'Spending', value: (r) => money(r.expenses), align: 'right' },
            { label: 'Net', value: (r) => money(r.net), align: 'right' },
          ]}
          empty={!hasTwelve}
          emptyHint="Log income and expenses to compare months."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={twelve} barGap={2} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tickFormatter={compact} width={56} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => money(v)} formatLabel={(_l, r) => formatMonthKey(String(r?.month))} />} />
              <Bar dataKey="income" name="Income" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="expenses" name="Spending" fill={series(1)} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Spending breakdown · ${formatMonthKey(month)}`}
          description={breakdown.length ? `${breakdown.length} categor${breakdown.length === 1 ? "y" : "ies"} · ${money(cur.expenses)} total` : undefined}
          rows={breakdown}
          columns={[
            { label: 'Category', value: (r) => r.category },
            { label: 'Amount', value: (r) => money(r.amount), align: 'right' },
            { label: 'Share', value: (r) => `${Math.round(r.share * 100)}%`, align: 'right' },
          ]}
          empty={breakdown.length === 0}
          emptyHint="No spending recorded this month."
          height={Math.max(180, Math.min(breakdown.length, 10) * 30)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tickFormatter={compact} {...axisProps} />
              <YAxis type="category" dataKey="category" width={120} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => money(v)} />} />
              <Bar dataKey="amount" name="Spent" fill={series(1)} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cash-flow trend"
          description="Net per month and running total over the last 12 months"
          legend={[
            { label: 'Net per month', color: series(0) },
            { label: 'Running total', color: series(3) },
          ]}
          rows={cumulative}
          columns={[
            { label: 'Month', value: (r) => formatMonthKey(r.month) },
            { label: 'Net', value: (r) => money(r.net), align: 'right' },
            { label: 'Running total', value: (r) => money(r.cumulative), align: 'right' },
          ]}
          empty={!hasTwelve}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis tickFormatter={compact} width={56} {...axisProps} />
              <ReferenceLine y={0} stroke="var(--color-line-strong)" />
              <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => money(v)} formatLabel={(_l, r) => formatMonthKey(String(r?.month))} />} />
              <Line type="monotone" dataKey="net" name="Net per month" stroke={series(0)} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: series(0) }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumulative" name="Running total" stroke={series(3)} strokeWidth={2} dot={false} strokeDasharray="5 4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Savings progress"
          description={goals.length ? `${money(sum(goals.map(savedSoFar)))} saved of ${money(sum(goals.map((g) => g.target)))} across ${goals.length} goal${goals.length === 1 ? '' : 's'}` : undefined}
          rows={savingsTimeline}
          columns={[
            { label: 'Date', value: (r) => formatDate(r.date, 'd MMM yyyy') },
            { label: 'Total saved', value: (r) => money(r.total), align: 'right' },
          ]}
          empty={savingsTimeline.length === 0}
          emptyHint="Create a savings goal and add contributions."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsTimeline} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series(2)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={series(2)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'MMM yy')} {...axisProps} minTickGap={30} />
              <YAxis tickFormatter={compact} width={56} {...axisProps} />
              <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => money(v)} formatLabel={(l) => formatDate(String(l), 'd MMM yyyy')} />} />
              <Area type="stepAfter" dataKey="total" name="Total saved" stroke={series(2)} strokeWidth={2} fill="url(#savings-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Budgets · ${formatMonthKey(month)}`}>
          {budgets.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">No budgets yet. Set monthly limits in the Budgets tab.</p>
          ) : (
            <ul className="space-y-3">
              {budgets.slice(0, 6).map((b) => (
                <li key={b.budget.id}>
                  <div className="mb-1 flex justify-between gap-2 text-[13px]">
                    <span className="truncate text-ink">{b.budget.category === '*' ? 'All spending' : b.budget.category}</span>
                    <span className="shrink-0 font-mono text-[12px] text-ink-muted tabular">
                      {money(b.spent)} / {money(b.budget.limit)}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(100, b.ratio * 100)} tone={b.state === 'over' ? 'bad' : b.state === 'warn' ? 'warn' : 'ok'} size="sm" label={`${b.budget.category} budget used`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Savings goals">
          {goals.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">No savings goals yet.</p>
          ) : (
            <ul className="space-y-3">
              {goals.map((g) => {
                const saved = savedSoFar(g)
                const points = savingsSeries(g)
                return (
                  <li key={g.id}>
                    <div className="mb-1 flex justify-between gap-2 text-[13px]">
                      <span className="truncate text-ink">{g.name}</span>
                      <span className="shrink-0 font-mono text-[12px] text-ink-muted tabular">
                        {money(saved)} / {money(g.target)}
                      </span>
                    </div>
                    <ProgressBar value={(saved / g.target) * 100} tone={g.color} size="sm" label={`${g.name} saved`} />
                    <p className="mt-1 text-[11px] text-ink-subtle">{points.length ? `Last contribution ${formatDate(points[points.length - 1].date, 'd MMM')}` : 'No contributions yet'}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-[12px] text-ink-subtle">
        All figures are calculated from transactions you enter manually. ATLAS does not connect to your bank — linking accounts would need a regulated Open Banking provider (e.g. TrueLayer or GoCardless) and a server.
      </p>
    </div>
  )
}
