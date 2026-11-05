import { useMemo } from 'react'
import { Dumbbell, Footprints, Medal, Moon, Plus } from 'lucide-react'
import { INTENSITIES, WORKOUT_TYPES } from '@/data/constants'
import type { Workout } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { personalRecords, sleepMinutes } from '@/selectors/fitness'
import { addDaysISO } from '@/lib/dates'
import { formatMinutes, formatNumber } from '@/lib/format'
import { average } from '@/lib/utils'
import { useCollection, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { RatingDisplay } from '@/components/ui/pickers'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

export function WorkoutsTab() {
  const workouts = useCollection('workouts')
  const fmt = useFormatters()
  const records = useMemo(() => personalRecords(workouts), [workouts])
  const controls = useListControls<Workout>(workouts, {
    search: (w) => `${w.title} ${w.notes ?? ''} ${w.exercises.map((e) => e.name).join(' ')}`,
    filters: [
      { key: 'type', label: 'Types', options: WORKOUT_TYPES.list, get: (w) => w.type },
      { key: 'intensity', label: 'Intensities', options: INTENSITIES.list, get: (w) => w.intensity },
    ],
    sorts: [
      { value: 'date', label: 'Date', get: (w) => `${w.date}${w.createdAt}`, dir: 'desc' },
      { value: 'duration', label: 'Duration', get: (w) => w.durationMin, dir: 'desc' },
    ],
  })
  if (!workouts.length) {
    return (
      <Panel>
        <EmptyState icon={Dumbbell} title="No workouts logged" description="Log any session — gym, run, class, walk. Add exercises with sets, reps, weight or distance to build personal records." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('workouts')}>Log a workout</Button>} />
      </Panel>
    )
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <ListToolbar controls={controls} placeholder="Search workouts and exercises…" total={workouts.length} />
        {workouts.length > 0 && controls.results.length === 0 && <EmptyState compact icon={Dumbbell} title="No workouts match your search or filters" description="Try clearing the search or filters." />}
        <div className="space-y-2.5">
          {controls.results.map((w) => (
            <article key={w.id} className="panel flex items-start gap-3 p-3.5">
              <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-line bg-panel-2/50 py-1.5">
                <span className="font-mono text-[10px] text-ink-subtle uppercase">{fmt.shortDate(w.date).split(' ')[1]}</span>
                <span className="font-display text-[18px] leading-none text-ink">{w.date.slice(8)}</span>
              </div>
              <button type="button" onClick={() => editor.edit('workouts', w.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[14px] font-medium text-ink">{w.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={WORKOUT_TYPES.tone(w.type)}>{WORKOUT_TYPES.label(w.type)}</Badge>
                  <Badge tone={INTENSITIES.tone(w.intensity)}>{INTENSITIES.label(w.intensity)}</Badge>
                  <span className="font-mono text-[11.5px] text-ink-muted">{formatMinutes(w.durationMin)}</span>
                </div>
                {w.exercises.length > 0 && (
                  <p className="mt-1.5 truncate text-[12px] text-ink-subtle">
                    {w.exercises
                      .map((e) => [e.name, e.sets && e.reps ? `${e.sets}×${e.reps}` : null, e.weightKg ? `${e.weightKg}kg` : null, e.distanceKm ? `${e.distanceKm}km` : null].filter(Boolean).join(' '))
                      .join(' · ')}
                  </p>
                )}
              </button>
              <RecordActions collection="workouts" id={w.id} duplicate />
            </article>
          ))}
        </div>
      </div>
      <Panel title="Exercise records" icon={Medal} eyebrow="Best efforts from your logs">
        {records.length === 0 ? (
          <p className="text-[12.5px] text-ink-subtle">Add exercises to workouts (e.g. Squat 3×5 @ 60kg) to see personal bests here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {records.slice(0, 30).map((r) => (
              <li key={r.exercise} className="py-2.5">
                <p className="text-[13.5px] text-ink">{r.exercise}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11.5px] text-ink-muted">
                  {r.bestWeightKg && (
                    <span>
                      {r.bestWeightKg.value}kg{r.bestWeightKg.reps ? ` × ${r.bestWeightKg.reps}` : ''}
                    </span>
                  )}
                  {r.bestDistanceKm && <span>{r.bestDistanceKm.value}km</span>}
                  {!r.bestWeightKg && r.mostReps && <span>{r.mostReps.value} reps</span>}
                  {r.longestMin && <span>{r.longestMin.value} min</span>}
                  <span className="text-ink-subtle">
                    {r.sessions}× · last {fmt.shortDate(r.lastDate)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export function ActivityTab({ today }: { today: string }) {
  const logs = useCollection('dailyActivity')
  const settings = useSettings()
  const fmt = useFormatters()
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1))
  const todayLog = logs.find((l) => l.date === today)
  const steps = logs.map((l) => l.steps).filter((s): s is number => typeof s === 'number')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's steps" value={todayLog?.steps !== undefined ? formatNumber(todayLog.steps) : '—'} icon={Footprints} tone="cyan" sub={settings.targets.dailySteps ? `Target ${formatNumber(settings.targets.dailySteps)}` : 'Set a target in Settings'} />
        <Stat label="Average steps" value={steps.length ? formatNumber(Math.round(average(steps))) : '—'} tone="violet" sub={`${steps.length} days logged`} />
        <Stat label="Active minutes (all)" value={formatMinutes(logs.reduce((n, l) => n + (l.activeMinutes ?? 0), 0))} tone="lime" />
        <Stat label="Distance (all)" value={`${logs.reduce((n, l) => n + (l.distanceKm ?? 0), 0).toFixed(1)} km`} tone="amber" />
      </div>
      <Panel
        title="Daily activity"
        icon={Footprints}
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => (todayLog ? editor.edit('dailyActivity', todayLog.id) : editor.create('dailyActivity'))}>
            {todayLog ? "Edit today's log" : 'Log today'}
          </Button>
        }
      >
        {sorted.length === 0 ? (
          <EmptyState compact icon={Footprints} title="No activity logged" description="Record steps, active minutes or distance from your phone or watch, by hand." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] tracking-wide text-ink-subtle uppercase">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Steps</th>
                  <th className="py-2 text-right font-medium">Active</th>
                  <th className="py-2 text-right font-medium">Distance</th>
                  <th className="py-2 pl-3 font-medium">Notes</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => (
                  <tr key={l.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2 font-mono text-[12px] text-ink-muted">{fmt.date(l.date)}</td>
                    <td className="py-2 text-right font-mono text-ink tabular">
                      {l.steps !== undefined ? formatNumber(l.steps) : '—'}
                      {settings.targets.dailySteps && l.steps !== undefined && l.steps >= settings.targets.dailySteps && <span className="ml-1 text-ok">✓</span>}
                    </td>
                    <td className="py-2 text-right font-mono text-ink-muted tabular">{l.activeMinutes !== undefined ? `${l.activeMinutes}m` : '—'}</td>
                    <td className="py-2 text-right font-mono text-ink-muted tabular">{l.distanceKm !== undefined ? `${l.distanceKm}km` : '—'}</td>
                    <td className="max-w-48 truncate py-2 pl-3 text-ink-subtle">{l.notes}</td>
                    <td>
                      <RecordActions collection="dailyActivity" id={l.id} />
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

export function SleepTab({ today }: { today: string }) {
  const sleep = useCollection('sleep')
  const settings = useSettings()
  const fmt = useFormatters()
  const sorted = [...sleep].sort((a, b) => (a.date < b.date ? 1 : -1))
  const last7 = sorted.filter((s) => s.date > addDaysISO(today, -7))
  const target = settings.targets.sleepHours
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Last night" value={sorted[0] && sorted[0].date === today ? formatMinutes(sleepMinutes(sorted[0])) : '—'} icon={Moon} tone="violet" sub={sorted[0]?.date === today ? `${fmt.time(sorted[0].bedTime)} → ${fmt.time(sorted[0].wakeTime)}` : 'Not logged yet today'} />
        <Stat label="7-night average" value={last7.length ? formatMinutes(average(last7.map(sleepMinutes))) : '—'} tone="cyan" sub={target ? `Target ${target}h` : 'Set a target in Settings'} />
        <Stat label="Average quality" value={sleep.some((s) => s.quality) ? `${average(sleep.filter((s) => s.quality).map((s) => s.quality as number)).toFixed(1)}/5` : '—'} tone="amber" />
        <Stat label="Nights logged" value={sleep.length} tone="lime" />
      </div>
      <Panel title="Sleep log" icon={Moon}>
        {sorted.length === 0 ? (
          <EmptyState compact icon={Moon} title="No sleep logged" description="Record when you went to bed and woke up. Duration is calculated for you, including past midnight." />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((s) => {
              const mins = sleepMinutes(s)
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="w-28 font-mono text-[12px] text-ink-muted">{fmt.date(s.date)}</span>
                  <span className="font-mono text-[12px] text-ink-subtle">
                    {fmt.time(s.bedTime)} → {fmt.time(s.wakeTime)}
                  </span>
                  <span className={`font-mono text-[13px] tabular ${target && mins < target * 60 ? 'text-warn' : 'text-ink'}`}>{formatMinutes(mins)}</span>
                  <RatingDisplay value={s.quality} size={12} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-subtle">{s.notes}</span>
                  <RecordActions collection="sleep" id={s.id} />
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
