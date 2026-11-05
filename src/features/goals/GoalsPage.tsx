import { useMemo, useState } from 'react'
import { ClipboardCheck, Plus, Repeat, Target } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GOAL_HORIZONS, GOAL_STATUSES, GOAL_TERMS, LIFE_AREAS, type GoalHorizon } from '@/data/constants'
import type { Goal } from '@/data/types'
import { useListControls } from '@/hooks/useListControls'
import { useToday } from '@/hooks/useNow'
import { dateOfTimestamp } from '@/lib/dates'
import { average } from '@/lib/utils'
import { goalProgressOf } from '@/store/lifecycle'
import { useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState, Stat } from '@/components/ui/display'
import { Segmented } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { WeeklyReviewPanel } from '@/components/shared/WeeklyReviewPanel'
import { editor } from '@/components/editor/editorStore'
import { GoalCard } from './GoalCard'
import { HabitsTab } from './HabitsTab'

const TABS = [
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'review', label: 'Weekly review', icon: ClipboardCheck },
] as const

function GoalsTab({ today }: { today: string }) {
  const goals = useCollection('goals')
  const [horizon, setHorizon] = useState<'all' | GoalHorizon>('all')
  const scoped = horizon === 'all' ? goals : goals.filter((g) => g.horizon === horizon)
  const controls = useListControls<Goal>(scoped, {
    search: (g) => `${g.title} ${g.description ?? ''} ${g.milestones.map((m) => m.title).join(' ')}`,
    filters: [
      { key: 'status', label: 'Statuses', options: GOAL_STATUSES.list, get: (g) => g.status },
      { key: 'term', label: 'Terms', options: GOAL_TERMS.list, get: (g) => g.term },
      { key: 'area', label: 'Categories', options: LIFE_AREAS.list, get: (g) => g.area },
    ],
    initialFilters: { status: 'active' },
    sorts: [
      { value: 'target', label: 'Target date', get: (g) => g.targetDate },
      { value: 'progress', label: 'Progress', get: (g) => goalProgressOf(g), dir: 'desc' },
      { value: 'updated', label: 'Last updated', get: (g) => g.updatedAt, dir: 'desc' },
      { value: 'title', label: 'Title', get: (g) => g.title },
    ],
  })
  const active = goals.filter((g) => g.status === 'active')
  const year = today.slice(0, 4)
  const byArea = useMemo(
    () =>
      LIFE_AREAS.list
        .map((a) => {
          const list = active.filter((g) => g.area === a.value)
          return { area: a.label, count: list.length, avg: list.length ? Math.round(average(list.map(goalProgressOf))) : 0 }
        })
        .filter((r) => r.count > 0),
    [active],
  )

  if (!goals.length) {
    return (
      <Panel>
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set daily, weekly, monthly or yearly goals in any area of life. Track them with a percentage, milestones or a numeric target."
          action={
            <Button variant="primary" icon={Plus} onClick={() => editor.create('goals')}>
              Set your first goal
            </Button>
          }
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active goals" value={active.length} tone="cyan" />
        <Stat label={`Completed in ${year}`} value={goals.filter((g) => g.status === 'completed' && g.completedAt && dateOfTimestamp(g.completedAt).startsWith(year)).length} tone="ok" />
        <Stat label="Average progress" value={active.length ? `${Math.round(average(active.map(goalProgressOf)))}%` : '—'} tone="violet" sub="Across active goals" />
        <Stat label="Past target date" value={active.filter((g) => g.targetDate && g.targetDate < today).length} tone="bad" sub="Active goals overdue" />
      </div>
      <ChartCard
        title="Average progress by life category"
        description="Active goals only"
        rows={byArea}
        columns={[
          { label: 'Category', value: (r) => r.area },
          { label: 'Active goals', value: (r) => r.count, align: 'right' },
          { label: 'Avg progress', value: (r) => `${r.avg}%`, align: 'right' },
        ]}
        empty={byArea.length === 0}
        height={Math.max(120, byArea.length * 32)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byArea} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} />
            <YAxis type="category" dataKey="area" width={160} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}%`} />} />
            <Bar dataKey="avg" name="Avg progress" fill={series(0)} radius={[0, 4, 4, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="no-scrollbar overflow-x-auto">
        <Segmented value={horizon} onChange={setHorizon} ariaLabel="Timeframe" options={[{ value: 'all', label: 'All timeframes' }, ...GOAL_HORIZONS.list]} />
      </div>
      <ListToolbar controls={controls} placeholder="Search goals…" total={scoped.length}>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('goals', horizon === 'all' ? {} : { horizon })}>
          Goal
        </Button>
      </ListToolbar>
      {controls.results.length === 0 ? (
        <Panel>
          <EmptyState compact title="No goals match" description="Clear filters to see everything (completed goals are hidden by default)." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {controls.results.map((g) => (
            <GoalCard key={g.id} goal={g} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function GoalsPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'goals')
  const goals = useCollection('goals')
  const habits = useCollection('habits')
  return (
    <div>
      <PageHeader
        section="goals"
        description="Set goals across every area of life, build habits with streaks, and review each week against what you actually recorded."
        actions={
          <>
            <Button icon={Plus} onClick={() => editor.create('habits')}>
              Habit
            </Button>
            {/* On the Goals tab, its own "Goal" button prefills the chosen timeframe. */}
            {tab !== 'goals' && (
              <Button variant="primary" icon={Plus} onClick={() => editor.create('goals')}>
                Goal
              </Button>
            )}
          </>
        }
      />
      <Tabs
        tabs={TABS.map((t) => ({ ...t, count: t.id === 'goals' ? goals.filter((g) => g.status === 'active').length : t.id === 'habits' ? habits.filter((h) => !h.archived).length : undefined }))}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      {tab === 'goals' && <GoalsTab today={today} />}
      {tab === 'habits' && <HabitsTab today={today} />}
      {tab === 'review' && <WeeklyReviewPanel today={today} />}
    </div>
  )
}
