import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Dumbbell, GraduationCap, NotebookPen, PencilLine, Repeat, Save, Target, Wallet } from 'lucide-react'
import { useFormatters } from '@/hooks/useFormatters'
import { periodSummary } from '@/selectors/analytics'
import { completedInRange } from '@/selectors/tasks'
import { addDaysISO, dateOfTimestamp, formatDate, isBetween, weekStartISO } from '@/lib/dates'
import { formatMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { actions, useDatabase } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Textarea } from '@/components/ui/inputs'
import { RatingInput } from '@/components/ui/pickers'
import { toast } from '@/components/ui/toast'

const FIELDS = [
  { key: 'wins', label: 'Wins', placeholder: 'What went well? What are you proud of?' },
  { key: 'challenges', label: 'Challenges', placeholder: 'What got in the way?' },
  { key: 'lessons', label: 'Lessons', placeholder: 'What did you learn?' },
  { key: 'focus', label: 'Focus for next week', placeholder: 'The one to three things that matter most.' },
] as const
type FieldKey = (typeof FIELDS)[number]['key']

/**
 * Weekly review: a factual summary of what you recorded during the week,
 * alongside your own written reflection. Used in Goals, Journal and Analytics.
 */
export function WeeklyReviewPanel({ today }: { today: string }) {
  const db = useDatabase()
  const fmt = useFormatters()
  const ws = db.settings.weekStartsOn
  const [weekStart, setWeekStart] = useState(() => weekStartISO(today, ws))
  const weekEnd = addDaysISO(weekStart, 6)
  const existing = db.weeklyReviews.find((r) => r.weekStart === weekStart)
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>> & { rating?: number }>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft({ wins: existing?.wins, challenges: existing?.challenges, lessons: existing?.lessons, focus: existing?.focus, rating: existing?.rating })
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, existing?.id])

  const s = useMemo(() => periodSummary(db, { start: weekStart, end: weekEnd }, today, ws), [db, weekStart, weekEnd, today, ws])
  const tasksDone = useMemo(() => completedInRange(db.tasks, weekStart, weekEnd), [db.tasks, weekStart, weekEnd])
  const goalsDone = db.goals.filter((g) => g.status === 'completed' && g.completedAt && isBetween(dateOfTimestamp(g.completedAt), weekStart, weekEnd))
  const goalsMoved = db.goals.filter((g) => g.status === 'active' && g.history.some((h) => isBetween(dateOfTimestamp(h.at), weekStart, weekEnd)) && g.history.length > 1)
  const mediaDone = db.media.filter((m) => m.status === 'completed' && m.completedDate && isBetween(m.completedDate, weekStart, weekEnd))

  const save = () => {
    const payload = { weekStart, ...draft }
    if (existing) actions.update('weeklyReviews', existing.id, payload)
    else actions.create('weeklyReviews', payload)
    setDirty(false)
    toast({ title: 'Weekly review saved' })
  }

  const facts = [
    { icon: CheckCircle2, label: 'Tasks completed', value: String(s.tasksCompleted) },
    { icon: Repeat, label: 'Habit consistency', value: s.habitRate === null ? '—' : `${Math.round(s.habitRate * 100)}%`, sub: `${s.habitCheckIns} check-ins` },
    { icon: Target, label: 'Goals completed', value: String(s.goalsCompleted), sub: `${s.milestonesDone} milestones` },
    { icon: Dumbbell, label: 'Workouts', value: String(s.workouts), sub: s.workoutMinutes ? formatMinutes(s.workoutMinutes) : undefined },
    { icon: GraduationCap, label: 'Learning', value: formatMinutes(s.learningMinutes), sub: `${s.studySessions} sessions` },
    { icon: NotebookPen, label: 'Journal entries', value: String(s.journalEntries), sub: s.avgMood ? `avg mood ${s.avgMood.toFixed(1)}/5` : undefined },
    { icon: Wallet, label: 'Spent', value: fmt.money(s.expenses, { showPence: false }), sub: `in ${fmt.money(s.income, { showPence: false })}` },
    { icon: BookOpen, label: 'Finished reading/watching', value: String(s.mediaCompleted) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton icon={ChevronLeft} label="Previous week" onClick={() => setWeekStart((w) => addDaysISO(w, -7))} />
        <IconButton icon={ChevronRight} label="Next week" onClick={() => setWeekStart((w) => addDaysISO(w, 7))} disabled={addDaysISO(weekStart, 7) > today} />
        <h2 className="font-display text-[17px] font-semibold">
          Week of {formatDate(weekStart, 'd MMM')} – {formatDate(weekEnd, 'd MMM yyyy')}
        </h2>
        {weekStart !== weekStartISO(today, ws) && (
          <Button size="xs" variant="ghost" onClick={() => setWeekStart(weekStartISO(today, ws))}>
            This week
          </Button>
        )}
        {existing && <span className="text-[12px] text-ok">Review saved</span>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="What you recorded" eyebrow="Calculated from your data">
          <div className="grid grid-cols-2 gap-2">
            {facts.map((f) => (
              <div key={f.label} className="rounded-lg border border-line bg-panel-2/30 p-3">
                <p className="eyebrow flex items-center gap-1.5">
                  <f.icon size={11} />
                  {f.label}
                </p>
                <p className="mt-1.5 font-display text-[18px] font-semibold text-ink tabular">{f.value}</p>
                {f.sub && <p className="text-[11px] text-ink-subtle">{f.sub}</p>}
              </div>
            ))}
          </div>
          {(tasksDone.length > 0 || goalsDone.length > 0 || goalsMoved.length > 0 || mediaDone.length > 0) && (
            <div className="mt-4 space-y-3 text-[13px]">
              {goalsDone.length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Goals completed</p>
                  <ul className="space-y-0.5 text-ink">{goalsDone.map((g) => <li key={g.id}>✓ {g.title}</li>)}</ul>
                </div>
              )}
              {goalsMoved.length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Goals with progress</p>
                  <ul className="space-y-0.5 text-ink-muted">{goalsMoved.map((g) => <li key={g.id}>{g.title}</li>)}</ul>
                </div>
              )}
              {tasksDone.length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Tasks completed</p>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto text-ink-muted">
                    {tasksDone.map((t) => (
                      <li key={t.id}>✓ {t.title}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mediaDone.length > 0 && (
                <div>
                  <p className="eyebrow mb-1">Finished</p>
                  <ul className="space-y-0.5 text-ink-muted">{mediaDone.map((m) => <li key={m.id}>{m.title}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Your reflection"
          icon={PencilLine}
          actions={
            <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon={Save} onClick={save} disabled={!dirty && !!existing}>
              {existing ? 'Save changes' : 'Save review'}
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink-muted">How was the week?</p>
              <RatingInput
                value={draft.rating}
                onChange={(rating) => {
                  setDraft((d) => ({ ...d, rating }))
                  setDirty(true)
                }}
                label="Week rating"
              />
            </div>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`wr-${f.key}`} className="mb-1.5 block text-[12px] font-medium text-ink-muted">
                  {f.label}
                </label>
                <Textarea
                  id={`wr-${f.key}`}
                  rows={2}
                  value={draft[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, [f.key]: e.target.value || undefined }))
                    setDirty(true)
                  }}
                />
              </div>
            ))}
            {dirty && <p className={cn('text-[12px] text-warn')}>Unsaved changes</p>}
          </div>
        </Panel>
      </div>

      {db.weeklyReviews.length > 0 && (
        <Panel title="Past reviews">
          <ul className="divide-y divide-line">
            {[...db.weeklyReviews]
              .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
              .map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setWeekStart(r.weekStart)} className={cn('flex w-full items-center gap-3 py-2.5 text-left', r.weekStart === weekStart && 'text-accent')}>
                    <span className="font-mono text-[12px] text-ink-subtle">{formatDate(r.weekStart, 'd MMM yyyy')}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{r.wins || r.lessons || r.focus || 'No notes'}</span>
                    {r.rating && <span className="font-mono text-[12px] text-amber">{'★'.repeat(r.rating)}</span>}
                  </button>
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
