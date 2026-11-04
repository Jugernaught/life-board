import { useState } from 'react'
import { CalendarClock, CheckCircle2, RotateCcw } from 'lucide-react'
import { GOAL_HORIZONS, GOAL_STATUSES, GOAL_TERMS, LIFE_AREAS } from '@/data/constants'
import type { Goal } from '@/data/types'
import { goalProgressOf } from '@/store/lifecycle'
import { actions } from '@/store/store'
import { relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge, ProgressBar } from '@/components/ui/display'
import { NumberInput } from '@/components/ui/inputs'
import { Checklist } from '@/components/shared/Checklist'
import { RecordActions } from '@/components/shared/RecordActions'

export function GoalCard({ goal, today }: { goal: Goal; today: string }) {
  const pct = goalProgressOf(goal)
  const [value, setValue] = useState<number | undefined>(goal.currentValue)
  const overdue = goal.status === 'active' && goal.targetDate && goal.targetDate < today
  const done = goal.status === 'completed'
  return (
    <article className={cn('panel flex flex-col p-4', done && 'opacity-80')} data-testid="goal-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn('font-display text-[15px] font-semibold text-ink', done && 'line-through decoration-ok/60')}>{goal.title}</h3>
          {goal.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-muted">{goal.description}</p>}
        </div>
        <RecordActions collection="goals" id={goal.id} duplicate />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge tone={GOAL_HORIZONS.tone(goal.horizon)}>{GOAL_HORIZONS.label(goal.horizon)}</Badge>
        <Badge>{GOAL_TERMS.label(goal.term)}</Badge>
        <Badge tone={LIFE_AREAS.tone(goal.area)}>{LIFE_AREAS.label(goal.area)}</Badge>
        {goal.status !== 'active' && <Badge tone={GOAL_STATUSES.tone(goal.status)}>{GOAL_STATUSES.label(goal.status)}</Badge>}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
          <span className="text-ink-subtle">
            {goal.progressMode === 'numeric' && goal.targetValue !== undefined
              ? `${goal.currentValue ?? goal.startValue ?? 0} / ${goal.targetValue} ${goal.unit ?? ''}`
              : goal.progressMode === 'milestones'
                ? `${goal.milestones.filter((m) => m.done).length} / ${goal.milestones.length} milestones`
                : 'Progress'}
          </span>
          <span className="font-mono text-ink tabular">{Math.round(pct)}%</span>
        </div>
        <ProgressBar value={pct} tone={done ? 'ok' : undefined} label={`${goal.title} progress`} />
      </div>
      {goal.status === 'active' && (
        <div className="mt-3">
          {goal.progressMode === 'manual' && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={goal.progress}
                onChange={(e) => actions.update('goals', goal.id, { progress: Number(e.target.value) })}
                className="h-2 flex-1 cursor-pointer accent-[var(--color-accent)]"
                aria-label={`Set progress for ${goal.title}`}
              />
            </div>
          )}
          {goal.progressMode === 'numeric' && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (value !== undefined && !Number.isNaN(value)) actions.update('goals', goal.id, { currentValue: value })
              }}
            >
              <NumberInput value={value} onChange={setValue} aria-label={`Current value for ${goal.title}`} className="h-8 text-[13px]" trailing={goal.unit ? <span className="pr-1 text-[11px]">{goal.unit}</span> : undefined} />
              <Button type="submit" size="sm" variant="subtle">
                Update
              </Button>
            </form>
          )}
          {goal.progressMode === 'milestones' && <Checklist items={goal.milestones} onChange={(milestones) => actions.update('goals', goal.id, { milestones })} today={today} placeholder="Add milestone…" />}
          {goal.progressMode !== 'milestones' && goal.milestones.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <Checklist items={goal.milestones} onChange={(milestones) => actions.update('goals', goal.id, { milestones })} today={today} placeholder="Add milestone…" />
            </div>
          )}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className={cn('inline-flex items-center gap-1 text-[12px]', overdue ? 'text-bad' : 'text-ink-subtle')}>
          {goal.targetDate && (
            <>
              <CalendarClock size={12} />
              {relativeDay(goal.targetDate, today)}
            </>
          )}
        </span>
        {goal.status === 'active' ? (
          <Button size="xs" variant="subtle" icon={CheckCircle2} onClick={() => actions.update('goals', goal.id, { status: 'completed' })}>
            Mark complete
          </Button>
        ) : (
          <Button size="xs" variant="ghost" icon={RotateCcw} onClick={() => actions.update('goals', goal.id, { status: 'active' })}>
            Reactivate
          </Button>
        )}
      </div>
    </article>
  )
}
