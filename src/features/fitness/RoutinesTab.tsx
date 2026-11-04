import { Plus, Sunrise } from 'lucide-react'
import { TIMES_OF_DAY, WEEKDAYS } from '@/data/constants'
import type { Routine } from '@/data/types'
import { routineCompletion, routineConsistency, routineScheduledOn } from '@/selectors/fitness'
import { addDaysISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressRing } from '@/components/ui/display'
import { Checkbox } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { Heatmap } from '@/components/charts/Heatmap'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'
import { formatDate } from '@/lib/dates'

export function toggleStep(r: Routine, date: string, stepId: string) {
  actions.update(
    'routines',
    r.id,
    (cur) => {
      const done = cur.log[date] ?? []
      const next = done.includes(stepId) ? done.filter((s) => s !== stepId) : [...done, stepId]
      const log = { ...cur.log }
      if (next.length) log[date] = next
      else delete log[date]
      return { log }
    },
    { action: 'logged' },
  )
}

export function RoutineChecklist({ routine, date }: { routine: Routine; date: string }) {
  const c = routineCompletion(routine, date)
  const done = routine.log[date] ?? []
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <ProgressRing value={c.total ? c.ratio * 100 : null} size={44} stroke={4} tone={c.complete ? 'ok' : undefined}>
          <span className="font-mono text-[10.5px] tabular">
            {c.done}/{c.total}
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{routine.name}</p>
          <p className="text-[11.5px] text-ink-subtle">{c.complete ? 'Complete for today ✓' : `${c.total - c.done} step${c.total - c.done === 1 ? '' : 's'} left`}</p>
        </div>
      </div>
      <ul className="space-y-0.5">
        {routine.steps.map((s) => (
          <li key={s.id} className="rounded-md px-1 py-1 hover:bg-panel-3/40">
            <Checkbox checked={done.includes(s.id)} onChange={() => toggleStep(routine, date, s.id)} label={<span className={cn('text-[13.5px]', done.includes(s.id) && 'text-ink-subtle line-through')}>{s.title}</span>} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RoutinesTab({ today }: { today: string }) {
  const routines = useCollection('routines')
  const settings = useSettings()
  const todays = routines.filter((r) => routineScheduledOn(r, today))
  if (!routines.length) {
    return (
      <Panel>
        <EmptyState icon={Sunrise} title="No routines yet" description="Build a morning, evening or workout routine as a checklist of steps, scheduled on the days you choose." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('routines')}>Create routine</Button>} />
      </Panel>
    )
  }
  return (
    <div className="space-y-4">
      <Panel title="Today's routines" icon={Sunrise} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('routines')}>Routine</Button>}>
        {todays.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">No routines scheduled for today.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {TIMES_OF_DAY.list.flatMap((t) => todays.filter((r) => r.timeOfDay === t.value)).map((r) => (
              <RoutineChecklist key={r.id} routine={r} date={today} />
            ))}
          </div>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {routines.map((r) => {
          const cons = routineConsistency([r], addDaysISO(today, -29), today, today)
          return (
            <Panel
              key={r.id}
              title={r.name}
              eyebrow={`${TIMES_OF_DAY.label(r.timeOfDay)} · ${r.days.length === 7 ? 'Every day' : WEEKDAYS.filter((d) => r.days.includes(d.value)).map((d) => d.short).join(', ')}`}
              actions={<RecordActions collection="routines" id={r.id} duplicate />}
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {!r.active && <Badge tone="warn">Paused</Badge>}
                <Badge tone="lime">{cons.rate === null ? 'No scheduled days yet' : `${Math.round(cons.rate * 100)}% fully completed · 30 days`}</Badge>
                <Badge>{r.steps.length} steps</Badge>
              </div>
              <Heatmap
                end={today}
                weeks={18}
                weekStartsOn={settings.weekStartsOn}
                value={(d) => routineCompletion(r, d).ratio}
                isActive={(d) => routineScheduledOn(r, d)}
                label={(d, v) => `${formatDate(d, 'EEE d MMM')}: ${Math.round(v * 100)}% of steps`}
              />
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
