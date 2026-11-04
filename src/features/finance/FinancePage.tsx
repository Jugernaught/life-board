import { useState } from 'react'
import { ChevronLeft, ChevronRight, Goal, LayoutDashboard, PiggyBank, Plus, Receipt, Repeat, Target } from 'lucide-react'
import { useToday } from '@/hooks/useNow'
import { addMonthsISO, formatMonthKey, monthKey } from '@/lib/dates'
import { useCollection } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { editor } from '@/components/editor/editorStore'
import { FinanceOverview } from './FinanceOverview'
import { BudgetsTab, RecurringTab, SavingsTab, TargetsTab } from './PlanningTabs'
import { TransactionsTab } from './TransactionsTab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: Goal },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'targets', label: 'Targets', icon: Target },
] as const

export default function FinancePage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'overview')
  const [month, setMonth] = useState(monthKey(today))
  const transactions = useCollection('transactions')
  const monthPicker = (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-panel-2/50 p-0.5">
      <IconButton icon={ChevronLeft} label="Previous month" size="xs" onClick={() => setMonth(monthKey(addMonthsISO(`${month}-01`, -1)))} />
      <button type="button" className="min-w-28 px-1 text-center font-mono text-[12.5px] text-ink" onClick={() => setMonth(monthKey(today))} title="Jump to this month">
        {formatMonthKey(month, 'MMMM yyyy')}
      </button>
      <IconButton icon={ChevronRight} label="Next month" size="xs" onClick={() => setMonth(monthKey(addMonthsISO(`${month}-01`, 1)))} />
    </div>
  )
  return (
    <div>
      <PageHeader
        section="finance"
        description="Track income and spending, set budgets and savings goals, and see where your money goes. Amounts are entered manually and stay on this device."
        actions={
          <>
            {(tab === 'overview' || tab === 'budgets' || tab === 'targets') && monthPicker}
            <Button variant="primary" icon={Plus} onClick={() => editor.create('transactions')}>
              Transaction
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'transactions' ? transactions.length : undefined }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'overview' && <FinanceOverview month={month} />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'budgets' && <BudgetsTab month={month} />}
      {tab === 'savings' && <SavingsTab today={today} />}
      {tab === 'recurring' && <RecurringTab today={today} />}
      {tab === 'targets' && <TargetsTab month={month} />}
    </div>
  )
}
