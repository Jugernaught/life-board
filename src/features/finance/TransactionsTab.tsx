import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Receipt } from 'lucide-react'
import { TRANSACTION_KINDS } from '@/data/constants'
import type { Transaction } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { eachMonth, formatMonthKey, monthKey } from '@/lib/dates'
import { cn, sum } from '@/lib/utils'
import { useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

export function TransactionsTab() {
  const transactions = useCollection('transactions')
  const fmt = useFormatters()
  const months = useMemo(() => {
    if (!transactions.length) return []
    const dates = transactions.map((t) => t.date).sort()
    return eachMonth(dates[0], dates[dates.length - 1]).reverse()
  }, [transactions])
  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions])
  const controls = useListControls<Transaction>(transactions, {
    search: (t) => `${t.description ?? ''} ${t.category} ${t.notes ?? ''}`,
    filters: [
      { key: 'kind', label: 'Types', options: TRANSACTION_KINDS.list, get: (t) => t.kind },
      { key: 'category', label: 'Categories', options: categories.map((c) => ({ value: c, label: c })), get: (t) => t.category },
      { key: 'month', label: 'Months', options: months.map((m) => ({ value: m, label: formatMonthKey(m) })), get: (t) => monthKey(t.date) },
    ],
    sorts: [
      { value: 'date', label: 'Date', get: (t) => `${t.date}${t.createdAt}`, dir: 'desc' },
      { value: 'amount', label: 'Amount', get: (t) => t.amount, dir: 'desc' },
      { value: 'category', label: 'Category', get: (t) => t.category },
    ],
  })
  const income = sum(controls.results.filter((t) => t.kind === 'income').map((t) => t.amount))
  const expenses = sum(controls.results.filter((t) => t.kind === 'expense').map((t) => t.amount))

  if (!transactions.length) {
    return (
      <Panel>
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Log income and spending manually. Everything in Finances is calculated from these entries."
          action={
            <Button variant="primary" icon={Plus} onClick={() => editor.create('transactions')}>
              Log a transaction
            </Button>
          }
        />
      </Panel>
    )
  }

  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search description, category…" total={transactions.length} />
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink-muted tabular">
        <span>
          In <span className="text-ok">{fmt.money(income)}</span>
        </span>
        <span>
          Out <span className="text-bad">{fmt.money(expenses)}</span>
        </span>
        <span>
          Net <span className="text-ink">{fmt.money(income - expenses, { signed: true })}</span>
        </span>
      </div>
      <Panel padded={false}>
        {controls.results.length === 0 ? (
          <EmptyState compact title="No transactions match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-subtle uppercase">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-2 py-2.5 font-medium">Description</th>
                  <th className="px-2 py-2.5 font-medium">Category</th>
                  <th className="px-2 py-2.5 text-right font-medium">Amount</th>
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody>
                {controls.results.map((t) => (
                  <tr key={t.id} className="group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-panel-3/40" onClick={() => editor.edit('transactions', t.id)}>
                    <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap text-ink-muted tabular">{fmt.date(t.date)}</td>
                    <td className="max-w-64 px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        {t.kind === 'income' ? <ArrowDownLeft size={14} className="shrink-0 text-ok" /> : <ArrowUpRight size={14} className="shrink-0 text-bad" />}
                        <span className="truncate text-ink">{t.description || <span className="text-ink-subtle">{t.category}</span>}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-ink-muted">{t.category}</td>
                    <td className={cn('px-2 py-2.5 text-right font-mono whitespace-nowrap tabular', t.kind === 'income' ? 'text-ok' : 'text-ink')}>
                      {t.kind === 'income' ? '+' : '−'}
                      {fmt.money(t.amount)}
                    </td>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <RecordActions collection="transactions" id={t.id} duplicate />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
