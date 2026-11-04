import { useMemo, useState } from 'react'
import { Flame, Plus, Repeat, Trophy } from 'lucide-react'
import { HABIT_SCHEDULES, LIFE_AREAS, WEEKDAYS } from '@/data/constants'
import type { Habit } from '@/data/types'
import { completionRate, currentStreak, isDoneOn, isScheduledOn, longestStreak, toggleLog } from '@/selectors/habits'
import { addDaysISO, eachDay, formatDate } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Heatmap } from '@/components/charts/Heatmap'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

function scheduleText(h: Habit) {
  if (h.schedule === 'daily') return 'Every day'
  if (h.schedule === 'weekly') return `${h.timesPerWeek}× per week`
  return WEEKDAYS.filter((d) => h.days.includes(d.value))
    .map((d) => d.short)
    .join(', ')
}

const toggle = (h: Habit, date: string) => actions.update('habits', h.id, (cur) => ({ log: toggleLog(cur.log, date) }), { action: 'logged' })

export function HabitsTab({ today }: { today: string }) {
  const habits = useCollection('habits')
  const settings = useSettings()
  const ws = settings.weekStartsOn
  const [showArchived, setShowArchived] = useState(false)
  const list = habits.filter((h) => showArchived || !h.archived)
  const last7 = eachDay(addDaysISO(today, -6), today)
  const stats = useMemo(() => {
    const active = habits.filter((h) => !h.archived)
    const rates = active.map((h) => completionRate(h, addDaysISO(today, -29), today, today, ws)).filter((r) => r.expected > 0)
    const best = active.map((h) => ({ h, s: currentStreak(h, today, ws) })).sort((a, b) => b.s - a.s)[0]
    const doneToday = active.filter((h) => isScheduledOn(h, today) && isDoneOn(h, today)).length
    const dueToday = active.filter((h) => isScheduledOn(h, today)).length
    return {
      rate: rates.length ? rates.reduce((n, r) => n + r.done, 0) / rates.reduce((n, r) => n + r.expected, 0) : null,
      best,
      doneToday,
      dueToday,
      active: active.length,
    }
  }, [habits, today, ws])

  if (!habits.length) {
    return (
      <Panel>
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Track something you want to do regularly — daily, on certain days, or a number of times per week. Streaks and completion calendars build as you check in."
          action={
            <Button variant="primary" icon={Plus} onClick={() => editor.create('habits')}>
              Add a habit
            </Button>
          }
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Done today" value={`${stats.doneToday}/${stats.dueToday}`} tone="cyan" sub="Scheduled habits" />
        <Stat label="30-day consistency" value={stats.rate === null ? '—' : `${Math.round(stats.rate * 100)}%`} tone="lime" sub="Completed vs scheduled" />
        <Stat label="Best current streak" value={stats.best?.s ?? 0} icon={Flame} tone="amber" sub={stats.best?.s ? stats.best.h.name : 'No streak yet'} />
        <Stat label="Active habits" value={stats.active} tone="violet" />
      </div>

      <Panel
        title="Check-ins · last 7 days"
        eyebrow="Tap a cell to tick off or back-fill a day"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-ink-subtle">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--color-accent)]" />
              Archived
            </label>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('habits')}>
              Habit
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="pb-2 text-left text-[11.5px] font-normal text-ink-subtle">Habit</th>
                {last7.map((d) => (
                  <th key={d} className={cn('w-11 pb-2 text-center font-mono text-[10.5px] font-normal', d === today ? 'text-accent' : 'text-ink-subtle')}>
                    {formatDate(d, 'EEEEE')}
                    <br />
                    {formatDate(d, 'd')}
                  </th>
                ))}
                <th className="w-16 pb-2 text-right text-[11.5px] font-normal text-ink-subtle">Streak</th>
              </tr>
            </thead>
            <tbody>
              {list.map((h) => {
                const streak = currentStreak(h, today, ws)
                return (
                  <tr key={h.id} className={cn('border-t border-line/60', h.archived && 'opacity-50')}>
                    <td className="py-2 pr-3">
                      <p className="flex items-center gap-2 text-[13.5px] text-ink">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: toneColor(h.color) }} />
                        <span className="truncate">{h.name}</span>
                      </p>
                      <p className="pl-4 text-[11px] text-ink-subtle">{scheduleText(h)}</p>
                    </td>
                    {last7.map((d) => {
                      const scheduled = isScheduledOn(h, d)
                      const done = isDoneOn(h, d)
                      const beforeStart = d < h.startDate
                      return (
                        <td key={d} className="text-center">
                          <button
                            type="button"
                            disabled={beforeStart || h.archived}
                            onClick={() => toggle(h, d)}
                            aria-pressed={done}
                            aria-label={`${h.name} on ${formatDate(d, 'EEEE d MMM')}: ${done ? 'done' : 'not done'}`}
                            className={cn(
                              'mx-auto flex size-8 items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed disabled:opacity-30',
                              done ? 'border-transparent' : scheduled ? 'border-line-strong hover:border-accent/60' : 'border-dashed border-line',
                            )}
                            style={done ? { background: toneColor(h.color), boxShadow: `0 0 12px -3px ${toneColor(h.color)}` } : undefined}
                          >
                            {done && <span className="text-[13px] font-bold text-on-accent">✓</span>}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-right font-mono text-[12.5px] text-amber tabular">{streak > 0 ? `${streak}${h.schedule === 'weekly' ? 'w' : 'd'}` : <span className="text-ink-subtle">0</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((h) => {
          const rate30 = completionRate(h, addDaysISO(today, -29), today, today, ws)
          const longest = longestStreak(h, today, ws)
          return (
            <Panel key={h.id} title={h.name} eyebrow={`${scheduleText(h)} · ${LIFE_AREAS.label(h.area)}`} actions={<RecordActions collection="habits" id={h.id} />}>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="amber">
                  <Flame size={11} className="mr-0.5 inline" /> {currentStreak(h, today, ws)} current
                </Badge>
                <Badge tone="violet">
                  <Trophy size={11} className="mr-0.5 inline" /> {longest} best
                </Badge>
                <Badge tone="lime">{rate30.rate === null ? 'No days yet' : `${Math.round(rate30.rate * 100)}% last 30 days`}</Badge>
                <Badge>{h.log.length} total check-ins</Badge>
                {h.archived && <Badge tone="warn">Archived</Badge>}
                {h.schedule !== 'daily' && <Badge>{HABIT_SCHEDULES.label(h.schedule)}</Badge>}
              </div>
              <Heatmap
                end={today}
                weeks={22}
                weekStartsOn={ws}
                value={(d) => (isDoneOn(h, d) ? 1 : 0)}
                isActive={(d) => isScheduledOn(h, d)}
                color={toneColor(h.color)}
                onToggle={h.archived ? undefined : (d) => d >= h.startDate && toggle(h, d)}
                label={(d, v) => `${formatDate(d, 'EEE d MMM yyyy')}: ${v ? 'done' : isScheduledOn(h, d) ? 'not done' : 'not scheduled'}`}
              />
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
