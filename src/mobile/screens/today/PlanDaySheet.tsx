import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { useToday } from '@/hooks/useNow'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { buildAgenda } from '@/selectors/agenda'
import { todaysHabits } from '@/selectors/habits'
import { actions, useDatabase } from '@/store/store'
import { quickCreateTask } from '@/app/taskCommands'
import { toast } from '@/components/ui/toast'
import { STEP_TITLES, SUGGESTED_PRIORITIES, finishPlan, overdueTasks, planSteps, priorityCandidates, usePlanDay } from '@/features/planday/model'
import { AgendaRow } from '../../components/AgendaRow'
import { InlineAdd } from '../../components/InlineAdd'
import { actionSheet } from '../../ui/ActionSheet'
import { EmptyRow, Section } from '../../ui/List'
import { NavButton } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

/** iPhone "Plan Your Day": the same four steps as desktop, as a sheet from Today. */
export function PlanDaySheet() {
  const { open, hide, session } = usePlanDay()
  return open ? <PlanDayFlow key={session} onClose={hide} /> : null
}

function PlanDayFlow({ onClose }: { onClose: () => void }) {
  const db = useDatabase()
  const today = useToday()
  const [steps] = useState(() => planSteps(overdueTasks(db.tasks, today).length > 0))
  const [i, setI] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(true)
  const step = steps[i]
  const overdue = overdueTasks(db.tasks, today)
  const candidates = useMemo(() => priorityCandidates(db.tasks, today), [db.tasks, today])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(db.tasks.filter((t) => t.focusDate === today && t.status !== 'done').map((t) => t.id)))
  const [intention, setIntention] = useState(() => (db.settings.intention?.date === today ? db.settings.intention.text : ''))
  const agenda = useMemo(() => buildAgenda(db, today, today, today).filter((a) => !a.done), [db, today])
  const habits = todaysHabits(db.habits, today, db.settings.weekStartsOn)
  const last = i === steps.length - 1

  const close = () => {
    setSheetOpen(false)
    setTimeout(onClose, 300)
  }
  const finish = () => {
    finishPlan(db.tasks, selected, today, intention)
    toast({ title: 'You’re set for today', tone: 'success' })
    close()
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const moveOverdue = (id: string, title: string) =>
    actionSheet({
      title,
      options: [
        { label: 'Today', onSelect: () => actions.update('tasks', id, { dueDate: today }) },
        { label: 'Tomorrow', onSelect: () => actions.update('tasks', id, { dueDate: addDaysISO(today, 1) }) },
        { label: 'Remove Due Date', onSelect: () => actions.update('tasks', id, { dueDate: undefined, dueTime: undefined }) },
        { label: 'Mark as Done', onSelect: () => actions.update('tasks', id, { status: 'done' }) },
      ],
    })

  return (
    <Sheet
      open={sheetOpen}
      onClose={close}
      title={titleCase(STEP_TITLES[step])}
      testId="plan-day-sheet"
      leading={<NavButton onClick={() => (i === 0 ? close() : setI(i - 1))}>{i === 0 ? 'Cancel' : 'Back'}</NavButton>}
      trailing={
        <button type="button" onClick={() => (last ? finish() : setI(i + 1))} className="ios-headline flex h-11 items-center px-3 text-accent active:opacity-50" data-testid={last ? 'm-pd-finish' : 'm-pd-next'}>
          {last ? 'Done' : 'Next'}
        </button>
      }
    >
      <div className="flex gap-1.5 px-4 pt-1 pb-4" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label={`Step ${i + 1} of ${steps.length}`}>
        {steps.map((s, n) => (
          <span key={s} className={cn('h-1 flex-1 rounded-full', n <= i ? 'bg-accent' : 'bg-[var(--ios-fill)]')} />
        ))}
      </div>

      {step === 'overdue' && (
        <Section header={overdue.length ? `${overdue.length} slipped` : undefined} footer="Tap a task to bring it to today, push it back, or mark it done.">
          {overdue.length === 0 && <EmptyRow>All caught up.</EmptyRow>}
          {overdue.map((t) => (
            <button key={t.id} type="button" onClick={() => moveOverdue(t.id, t.title)} className="ios-press flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left" data-testid="m-pd-overdue">
              <span className="min-w-0 flex-1">
                <span className="ios-body block truncate text-ink">{t.title}</span>
                <span className="ios-footnote text-bad">Due {relativeDay(t.dueDate!, today).toLowerCase()}</span>
              </span>
              <span className="ios-subhead text-accent">Move</span>
            </button>
          ))}
          {overdue.length > 1 && (
            <button type="button" onClick={() => overdue.forEach((t) => actions.update('tasks', t.id, { dueDate: today }))} className="ios-press ios-body flex min-h-11 w-full items-center px-4 text-accent">
              Move All to Today
            </button>
          )}
        </Section>
      )}

      {step === 'priorities' && (
        <Section header={`Pick about ${SUGGESTED_PRIORITIES} · ${selected.size} picked`} footer="Your picks appear in Today’s Priorities.">
          {candidates.length === 0 && <EmptyRow>Nothing due or important yet — add today’s first priority.</EmptyRow>}
          {candidates.map((t) => {
            const on = selected.has(t.id)
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)} className="ios-press flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left" data-testid="m-pd-candidate">
                <Star size={20} className={on ? 'fill-[var(--color-amber)] text-[var(--color-amber)]' : 'text-ink-subtle'} aria-hidden />
                <span className="ios-body min-w-0 flex-1 truncate text-ink">{t.title}</span>
                {t.dueDate && <span className={cn('ios-footnote shrink-0', t.dueDate < today ? 'text-bad' : 'text-ink-subtle')}>{relativeDay(t.dueDate, today)}</span>}
              </button>
            )
          })}
          <InlineAdd
            placeholder="Add a priority"
            onAdd={(title) => {
              const t = quickCreateTask(title, { dueDate: today, priority: 'high' })
              setSelected((prev) => new Set([...prev, t.id]))
            }}
          />
        </Section>
      )}

      {step === 'day' && (
        <Section
          header={`${agenda.length ? `${agenda.length} on the calendar` : 'Nothing on the calendar'}${habits.total ? ` · ${habits.total - habits.done} habits to do` : ''}`}
          footer={agenda.length ? undefined : 'A clear day — room for deep work on your priorities.'}
        >
          {agenda.length === 0 ? <EmptyRow>A clear day.</EmptyRow> : agenda.map((a) => <AgendaRow key={a.key} item={a} />)}
        </Section>
      )}

      {step === 'intention' && (
        <Section header="One line for today (optional)" footer="Shown on Today until tomorrow.">
          <div className="px-4 py-1">
            <input
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              maxLength={200}
              enterKeyHint="done"
              placeholder="How do you want today to go?"
              aria-label="Intention for today"
              className="ios-body !min-h-11 w-full bg-transparent text-ink outline-none placeholder:text-ink-subtle"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finish()
                }
              }}
            />
          </div>
        </Section>
      )}
    </Sheet>
  )
}
