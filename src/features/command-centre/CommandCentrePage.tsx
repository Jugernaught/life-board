import { type ComponentType, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { LayoutGrid, Plus, Settings2 } from 'lucide-react'
import type { WidgetId, WidgetSize } from '@/data/types'
import { useNow, useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { todaysHabits } from '@/selectors/habits'
import { tasksDueToday, todaysPriorities } from '@/selectors/tasks'
import { formatTime, greetingFor } from '@/lib/dates'
import { pluralise } from '@/lib/utils'
import { useDatabase, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { useUI } from '@/components/command/uiStore'
import { CustomiseDashboard } from './CustomiseDashboard'
import { ActivityWidget, CheckInWidget, FinanceWidget, HabitsWidget, NotesWidget, ReadingWidget, SocialWidget, WeeklyWidget } from './widgets/LifeWidgets'
import { GoalsWidget, ProjectsWidget, QuickAddWidget, UpcomingWidget } from './widgets/OverviewWidgets'
import { PrioritiesWidget, TodayWidget } from './widgets/TaskWidgets'

const WIDGETS: Record<WidgetId, ComponentType<{ today: string; size: WidgetSize }>> = {
  priorities: PrioritiesWidget,
  today: TodayWidget,
  upcoming: UpcomingWidget,
  habits: HabitsWidget,
  weekly: WeeklyWidget,
  goals: GoalsWidget,
  projects: ProjectsWidget,
  quickadd: QuickAddWidget,
  activity: ActivityWidget,
  notes: NotesWidget,
  finance: FinanceWidget,
  checkin: CheckInWidget,
  reading: ReadingWidget,
  social: SocialWidget,
}

function Clock() {
  const now = useNow(1000)
  const settings = useSettings()
  return (
    <div className="text-right" aria-label={`Current time ${format(now, 'HH:mm')}`}>
      <p className="font-mono text-[34px] leading-none font-medium tracking-tight text-ink tabular sm:text-[42px]">
        {settings.timeFormat === '12h' ? formatTime(format(now, 'HH:mm'), '12h') : format(now, 'HH:mm')}
        {settings.timeFormat === '24h' && <span className="text-[0.55em] text-ink-subtle">:{format(now, 'ss')}</span>}
      </p>
      <p className="cyber-only mt-1.5 font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase">{format(now, 'EEEE · d MMMM yyyy')}</p>
      <p className="not-cyber mt-1.5 text-[13px] font-medium text-ink-muted">{format(now, 'EEEE d MMMM')}</p>
    </div>
  )
}

function Hero({ today }: { today: string }) {
  const db = useDatabase()
  const now = useNow()
  const name = db.settings.displayName
  const summary = useMemo(() => {
    const { overdue, today: due } = tasksDueToday(db.tasks, today)
    const events = buildAgenda(db, today, today, today).filter((i) => i.sourceKey === 'events')
    const habits = todaysHabits(db.habits, today, db.settings.weekStartsOn)
    const priorities = todaysPriorities(db.tasks, today)
    const parts: { label: string; tone?: string }[] = []
    if (priorities.length) parts.push({ label: `${priorities.filter((p) => p.status === 'done').length}/${priorities.length} priorities done` })
    if (due.length) parts.push({ label: `${pluralise(due.length, 'task')} due today` })
    if (overdue.length) parts.push({ label: `${overdue.length} overdue`, tone: 'text-[color-mix(in_oklab,var(--color-bad)_85%,var(--color-ink))]' })
    if (events.length) parts.push({ label: pluralise(events.length, 'event') + ' today' })
    if (habits.total) parts.push({ label: `${habits.done}/${habits.total} habits` })
    return parts
  }, [db, today])
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel hud relative mb-5 overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-60 rounded-full bg-accent-2/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow cyber-only flex items-center gap-2 text-accent">
            <span className="size-1.5 animate-pulse-soft rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]" />
            01 // Command Centre · System online
          </p>
          <p className="not-cyber text-[13px] font-medium text-ink-muted">Command Centre</p>
          <h1 className="title mt-2 text-[28px] leading-tight font-bold sm:text-[36px]">
            {greetingFor(now)}
            {name ? (
              <>
                , <span className="text-gradient">{name}</span>
              </>
            ) : null}
            .
          </h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            {summary.length ? (
              summary.map((p, i) => (
                <span key={p.label} className={p.tone}>
                  {i > 0 && <span className="mx-2 text-ink-subtle/50">·</span>}
                  {p.label}
                </span>
              ))
            ) : (
              <span>Nothing scheduled yet — add a task, event or habit to get your day going.</span>
            )}
          </p>
        </div>
        <Clock />
      </div>
    </motion.section>
  )
}

export default function CommandCentrePage() {
  const today = useToday()
  const settings = useSettings()
  const { showQuickAdd } = useUI()
  const [customising, setCustomising] = useState(false)
  const visible = settings.dashboard.filter((w) => w.visible)
  return (
    <div>
      <Hero today={today} />
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="eyebrow">Widgets · {visible.length} shown</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={Settings2} onClick={() => setCustomising(true)}>
            Customise
          </Button>
          <Button size="sm" icon={Plus} onClick={() => showQuickAdd()}>
            Quick add
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="All widgets are hidden" action={<Button onClick={() => setCustomising(true)}>Choose widgets</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {visible.map((w) => {
            const Component = WIDGETS[w.id]
            return <Component key={w.id} today={today} size={w.size} />
          })}
        </div>
      )}
      <CustomiseDashboard open={customising} onClose={() => setCustomising(false)} />
    </div>
  )
}
