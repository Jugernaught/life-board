import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarDays, Check, CheckCircle2, Sparkles, Star } from 'lucide-react'
import { PRIORITIES } from '@/data/constants'
import { useToday } from '@/hooks/useNow'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { buildAgenda } from '@/selectors/agenda'
import { todaysHabits } from '@/selectors/habits'
import { actions, useDatabase } from '@/store/store'
import { quickCreateTask } from '@/app/taskCommands'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState } from '@/components/ui/display'
import { Input } from '@/components/ui/inputs'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import { AgendaRow } from '@/components/shared/AgendaList'
import { STEP_TITLES, SUGGESTED_PRIORITIES, finishPlan, overdueTasks, planSteps, priorityCandidates, usePlanDay } from './model'

/** Desktop "Plan my day": a short guided dialog from the Command Centre or the palette. */
export function PlanDayDialog() {
  const { open, hide, session } = usePlanDay()
  // Keyed per opening: each plan starts from what's true right now.
  return <PlanDayModal key={session} open={open} onDone={hide} />
}

function PlanDayModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const db = useDatabase()
  const today = useToday()
  // Steps are fixed when the dialog opens, so clearing the last overdue task doesn't skip ahead.
  const [steps] = useState(() => planSteps(overdueTasks(db.tasks, today).length > 0))
  const [i, setI] = useState(0)
  const step = steps[i]
  const overdue = overdueTasks(db.tasks, today)
  const candidates = useMemo(() => priorityCandidates(db.tasks, today), [db.tasks, today])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(db.tasks.filter((t) => t.focusDate === today && t.status !== 'done').map((t) => t.id)))
  const [intention, setIntention] = useState(() => (db.settings.intention?.date === today ? db.settings.intention.text : ''))
  const agenda = useMemo(() => buildAgenda(db, today, today, today).filter((a) => !a.done), [db, today])
  const habits = todaysHabits(db.habits, today, db.settings.weekStartsOn)
  const [newTitle, setNewTitle] = useState('')

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const finish = () => {
    finishPlan(db.tasks, selected, today, intention)
    toast({ title: 'You’re set for today', description: selected.size ? `${selected.size} priorit${selected.size === 1 ? 'y' : 'ies'} on your Command Centre.` : undefined, tone: 'success' })
    onDone()
  }

  return (
    <Modal
      open={open}
      onClose={onDone}
      title="Plan my day"
      description="Two minutes to decide what today is for."
      size="md"
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => (i === 0 ? onDone() : setI(i - 1))}>
            {i === 0 ? 'Not now' : 'Back'}
          </Button>
          {i < steps.length - 1 ? (
            <Button variant="primary" onClick={() => setI(i + 1)} data-testid="pd-next">
              Next: {STEP_TITLES[steps[i + 1]]}
            </Button>
          ) : (
            <Button variant="primary" icon={Sparkles} onClick={finish} data-testid="pd-finish">
              Start my day
            </Button>
          )}
        </>
      }
    >
      <div data-testid="plan-day">
        <ol className="mb-5 flex items-center gap-2" aria-label="Steps">
          {steps.map((s, n) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5" aria-current={n === i ? 'step' : undefined}>
              <span className={cn('h-1 rounded-full transition-colors', n <= i ? 'bg-accent' : 'bg-ink/10')} />
              <span className={cn('text-[11.5px] font-medium', n === i ? 'text-ink' : 'text-ink-subtle')}>{STEP_TITLES[s]}</span>
            </li>
          ))}
        </ol>

        {step === 'overdue' && (
          <section aria-labelledby="pd-overdue">
            <h3 id="pd-overdue" className="text-[15px] font-semibold text-ink">
              {overdue.length ? `${overdue.length} task${overdue.length === 1 ? '' : 's'} slipped` : 'All caught up'}
            </h3>
            <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">Bring each one to today, push it back, take the date off — or tick it if it’s done.</p>
            {overdue.length === 0 ? (
              <EmptyState compact icon={CheckCircle2} title="Nothing overdue" description="Nice. On to today’s priorities." />
            ) : (
              <>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {overdue.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2/40 px-3 py-2" data-testid="pd-overdue-row">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] text-ink">{t.title}</p>
                        <p className="text-[12px] text-bad">Due {relativeDay(t.dueDate!, today).toLowerCase()}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="xs" variant="secondary" onClick={() => actions.update('tasks', t.id, { dueDate: today })}>
                          Today
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => actions.update('tasks', t.id, { dueDate: addDaysISO(today, 1) })}>
                          Tomorrow
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => actions.update('tasks', t.id, { dueDate: undefined, dueTime: undefined })}>
                          No date
                        </Button>
                        <Button size="xs" variant="ghost" icon={Check} aria-label={`Mark done: ${t.title}`} onClick={() => actions.update('tasks', t.id, { status: 'done' })} />
                      </div>
                    </li>
                  ))}
                </ul>
                {overdue.length > 1 && (
                  <Button size="sm" variant="ghost" icon={CalendarDays} className="mt-2" onClick={() => overdue.forEach((t) => actions.update('tasks', t.id, { dueDate: today }))}>
                    Move all to today
                  </Button>
                )}
              </>
            )}
          </section>
        )}

        {step === 'priorities' && (
          <section aria-labelledby="pd-pri">
            <h3 id="pd-pri" className="text-[15px] font-semibold text-ink">
              What matters most today?
            </h3>
            <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">
              Pick about {SUGGESTED_PRIORITIES}. They’ll sit at the top of your Command Centre.{' '}
              <span className={cn('font-medium', selected.size > SUGGESTED_PRIORITIES ? 'text-warn' : 'text-ink')}>{selected.size} picked</span>
              {selected.size > SUGGESTED_PRIORITIES && ' — that’s a full day.'}
            </p>
            {candidates.length === 0 && <p className="mb-2 text-[13px] text-ink-subtle">No tasks due or marked important yet — add today’s first priority below.</p>}
            <ul className="max-h-64 space-y-1 overflow-y-auto" role="group" aria-label="Priority candidates">
              {candidates.map((t) => {
                const on = selected.has(t.id)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(t.id)}
                      data-testid="pd-candidate"
                      className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors', on ? 'border-amber/50 bg-amber/10' : 'border-line bg-panel-2/40 hover:border-line-strong')}
                    >
                      <Star size={16} className={on ? 'fill-amber text-amber' : 'text-ink-subtle'} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{t.title}</span>
                      {t.dueDate && <span className={cn('text-[12px]', t.dueDate < today ? 'text-bad' : 'text-ink-subtle')}>{relativeDay(t.dueDate, today)}</span>}
                      {(t.priority === 'high' || t.priority === 'urgent') && <Badge tone={PRIORITIES.tone(t.priority)}>{PRIORITIES.label(t.priority)}</Badge>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newTitle.trim()) return
                const t = quickCreateTask(newTitle, { dueDate: today, priority: 'high' })
                setSelected((prev) => new Set([...prev, t.id]))
                setNewTitle('')
              }}
            >
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Add a new priority…" aria-label="Add a new priority" />
              <Button type="submit" size="md">
                Add
              </Button>
            </form>
          </section>
        )}

        {step === 'day' && (
          <section aria-labelledby="pd-day">
            <h3 id="pd-day" className="text-[15px] font-semibold text-ink">
              Today at a glance
            </h3>
            <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">
              {agenda.length ? `${agenda.length} thing${agenda.length === 1 ? '' : 's'} on the calendar` : 'Nothing on the calendar'}
              {habits.total ? ` · ${habits.total - habits.done} habit${habits.total - habits.done === 1 ? '' : 's'} to do` : ''}.
            </p>
            {agenda.length === 0 ? (
              <EmptyState compact icon={CalendarCheck} title="A clear day" description="Room for deep work — consider blocking time for your priorities." />
            ) : (
              <div className="-mx-2 max-h-72 overflow-y-auto">
                {agenda.map((a) => (
                  <AgendaRow key={a.key} item={a} />
                ))}
              </div>
            )}
          </section>
        )}

        {step === 'intention' && (
          <section aria-labelledby="pd-int">
            <h3 id="pd-int" className="text-[15px] font-semibold text-ink">
              One line for today <span className="font-normal text-ink-subtle">(optional)</span>
            </h3>
            <p className="mt-0.5 mb-3 text-[13px] text-ink-muted">How do you want today to go? It’s shown in your greeting until tomorrow.</p>
            <Input
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="e.g. Finish the proposal before lunch, then be present tonight"
              aria-label="Intention for today"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finish()
                }
              }}
            />
          </section>
        )}
      </div>
    </Modal>
  )
}
