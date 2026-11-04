import { useMemo, useState } from 'react'
import { Building2, CheckCircle2, ExternalLink, Eye, Flag, MessagesSquare, Plus, Shuffle } from 'lucide-react'
import { APPLICATION_STATUSES, CAREER_MILESTONE_KINDS, QUESTION_CATEGORIES } from '@/data/constants'
import type { InterviewQuestion } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar } from '@/components/ui/display'
import { Checkbox } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { RatingDisplay } from '@/components/ui/pickers'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

export function CompaniesTab() {
  const companies = useCollection('companies')
  const applications = useCollection('applications')
  const controls = useListControls(companies, {
    search: (c) => `${c.name} ${c.industry ?? ''} ${c.research ?? ''} ${c.pros ?? ''} ${c.cons ?? ''}`,
    sorts: [
      { value: 'interest', label: 'Interest', get: (c) => c.interest, dir: 'desc' },
      { value: 'name', label: 'Name', get: (c) => c.name },
      { value: 'updated', label: 'Last updated', get: (c) => c.updatedAt, dir: 'desc' },
    ],
  })
  if (!companies.length) {
    return (
      <Panel>
        <EmptyState icon={Building2} title="No company research yet" description="Keep notes on companies you're interested in — products, culture, pros and cons. Applications to the same company link up automatically." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('companies')}>Add company</Button>} />
      </Panel>
    )
  }
  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search companies and notes…" total={companies.length}>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('companies')}>
          Company
        </Button>
      </ListToolbar>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {controls.results.map((c) => {
          const apps = applications.filter((a) => a.company.trim().toLowerCase() === c.name.trim().toLowerCase())
          return (
            <Panel key={c.name + c.id} title={c.name} eyebrow={[c.industry, c.location].filter(Boolean).join(' · ') || undefined} actions={<RecordActions collection="companies" id={c.id} />}>
              <div className="mb-2 flex items-center gap-3">
                <RatingDisplay value={c.interest} />
                {c.website && (
                  <a href={c.website} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                    Website <ExternalLink size={11} />
                  </a>
                )}
              </div>
              {c.research ? <p className="line-clamp-4 text-[13px] whitespace-pre-line text-ink-muted">{c.research}</p> : <p className="text-[12.5px] text-ink-subtle">No research notes yet.</p>}
              {(c.pros || c.cons) && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-md border border-ok/20 bg-ok/5 p-2">
                    <p className="eyebrow mb-1 text-ok">Pros</p>
                    <p className="line-clamp-4 whitespace-pre-line text-ink-muted">{c.pros || '—'}</p>
                  </div>
                  <div className="rounded-md border border-bad/20 bg-bad/5 p-2">
                    <p className="eyebrow mb-1 text-bad">Cons</p>
                    <p className="line-clamp-4 whitespace-pre-line text-ink-muted">{c.cons || '—'}</p>
                  </div>
                </div>
              )}
              {apps.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-line pt-3">
                  {apps.map((a) => (
                    <button key={a.id} type="button" onClick={() => editor.edit('applications', a.id)} className="flex w-full items-center gap-2 text-left text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate text-ink">{a.role}</span>
                      <Badge tone={APPLICATION_STATUSES.tone(a.status)}>{APPLICATION_STATUSES.label(a.status)}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

export function InterviewTab({ today }: { today: string }) {
  const questions = useCollection('interviewQuestions')
  const applications = useCollection('applications')
  const fmt = useFormatters()
  const [practice, setPractice] = useState<InterviewQuestion | null>(null)
  const [revealed, setRevealed] = useState(false)
  const controls = useListControls(questions, {
    search: (q) => `${q.question} ${q.answer ?? ''}`,
    filters: [
      { key: 'category', label: 'Categories', options: QUESTION_CATEGORIES.list, get: (q) => q.category },
      { key: 'application', label: 'Applications', options: applications.map((a) => ({ value: a.id, label: `${a.company} — ${a.role}` })), get: (q) => q.applicationId },
    ],
    sorts: [
      { value: 'confidence', label: 'Least confident', get: (q) => q.confidence ?? 0 },
      { value: 'practised', label: 'Least recently practised', get: (q) => q.lastPractised ?? '0000' },
      { value: 'created', label: 'Newest', get: (q) => q.createdAt, dir: 'desc' },
    ],
  })
  const pick = () => {
    const pool = controls.results.length ? controls.results : questions
    if (!pool.length) return
    // Favour questions practised least and with lowest confidence.
    const weighted = pool.flatMap((q) => Array(Math.max(1, 6 - (q.confidence ?? 0) - Math.min(3, q.practiceCount))).fill(q) as InterviewQuestion[])
    setPractice(weighted[Math.floor(Math.random() * weighted.length)])
    setRevealed(false)
  }
  const practised = (q: InterviewQuestion) => actions.update('interviewQuestions', q.id, (c) => ({ lastPractised: today, practiceCount: c.practiceCount + 1 }), { action: 'logged', detail: 'Practised' })
  const confident = questions.filter((q) => (q.confidence ?? 0) >= 4).length
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Practice" icon={Shuffle} actions={<Button size="sm" variant="primary" icon={Shuffle} onClick={pick} disabled={!questions.length}>Random question</Button>}>
          {practice ? (
            <div>
              <Badge tone={QUESTION_CATEGORIES.tone(practice.category)}>{QUESTION_CATEGORIES.label(practice.category)}</Badge>
              <p className="mt-3 font-display text-[18px] leading-snug text-ink">{practice.question}</p>
              <p className="mt-2 text-[12.5px] text-ink-subtle">Answer out loud first, then compare with your notes.</p>
              {revealed ? <p className="mt-3 rounded-lg border border-line bg-panel-2/40 p-3 text-[13px] whitespace-pre-line text-ink-muted">{practice.answer || 'No notes saved for this question yet.'}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {!revealed && (
                  <Button size="sm" icon={Eye} onClick={() => setRevealed(true)}>
                    Reveal notes
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="subtle"
                  icon={CheckCircle2}
                  onClick={() => {
                    practised(practice)
                    pick()
                  }}
                >
                  Practised — next
                </Button>
                <Button size="sm" variant="ghost" onClick={() => editor.edit('interviewQuestions', practice.id)}>
                  Edit notes
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-subtle">{questions.length ? 'Pick a random question to rehearse. Less-practised, lower-confidence questions come up more often.' : 'Add questions to start practising.'}</p>
          )}
        </Panel>
        <Panel title="Preparation" icon={MessagesSquare}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-line bg-panel-2/30 p-3">
              <p className="eyebrow">Questions</p>
              <p className="mt-1 font-display text-[20px] text-ink">{questions.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel-2/30 p-3">
              <p className="eyebrow">Confident</p>
              <p className="mt-1 font-display text-[20px] text-ink">{confident}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel-2/30 p-3">
              <p className="eyebrow">Practised</p>
              <p className="mt-1 font-display text-[20px] text-ink">{questions.filter((q) => q.practiceCount > 0).length}</p>
            </div>
          </div>
          {questions.length > 0 && <ProgressBar value={(confident / questions.length) * 100} className="mt-3" showValue label="Share of questions you feel confident about" />}
          <p className="mt-2 text-[12px] text-ink-subtle">Confidence = rated 4★ or more.</p>
        </Panel>
      </div>
      <ListToolbar controls={controls} placeholder="Search questions and answers…" total={questions.length}>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('interviewQuestions')}>
          Question
        </Button>
      </ListToolbar>
      {controls.results.length === 0 ? (
        <Panel>
          <EmptyState compact icon={MessagesSquare} title={questions.length ? 'No questions match' : 'No interview questions yet'} description="Add likely questions with your prepared answers (STAR works well)." />
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {controls.results.map((q) => {
            const app = applications.find((a) => a.id === q.applicationId)
            return (
              <article key={q.id} className="panel p-4">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => editor.edit('interviewQuestions', q.id)} className="min-w-0 flex-1 text-left text-[14px] font-medium text-ink">
                    {q.question}
                  </button>
                  <RecordActions collection="interviewQuestions" id={q.id} />
                </div>
                {q.answer && <p className="mt-1.5 line-clamp-3 text-[12.5px] whitespace-pre-line text-ink-muted">{q.answer}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-subtle">
                  <Badge tone={QUESTION_CATEGORIES.tone(q.category)}>{QUESTION_CATEGORIES.label(q.category)}</Badge>
                  {app && <Badge>{app.company}</Badge>}
                  <RatingDisplay value={q.confidence} size={11} />
                  <span>{q.practiceCount ? `Practised ${q.practiceCount}× · last ${fmt.shortDate(q.lastPractised)}` : 'Not practised yet'}</span>
                  <Button size="xs" variant="ghost" className="ml-auto" onClick={() => practised(q)}>
                    Mark practised
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MilestonesTab({ today }: { today: string }) {
  const milestones = useCollection('careerMilestones')
  const paths = useCollection('careerPaths')
  const [showDone, setShowDone] = useState(true)
  const groups = useMemo(
    () =>
      CAREER_MILESTONE_KINDS.list
        .map((k) => ({ kind: k, items: milestones.filter((m) => m.kind === k.value && (showDone || !m.done)).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')) }))
        .filter((g) => g.items.length),
    [milestones, showDone],
  )
  const done = milestones.filter((m) => m.done).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <ProgressBar value={milestones.length ? (done / milestones.length) * 100 : 0} showValue label="Career milestones completed" />
          <p className="mt-1 text-[12px] text-ink-subtle">
            {done} of {milestones.length} milestones complete
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--color-accent)]" />
          Show completed
        </label>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('careerMilestones')}>
          Milestone
        </Button>
      </div>
      {groups.length === 0 ? (
        <Panel>
          <EmptyState icon={Flag} title="No CV or portfolio milestones yet" description="e.g. Rewrite CV summary, publish portfolio case study, get a referral, complete a certification." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.kind.value} title={g.kind.label} icon={Flag}>
              <ul className="-mx-1.5">
                {g.items.map((m) => {
                  const path = paths.find((p) => p.id === m.careerPathId)
                  const overdue = !m.done && m.dueDate && m.dueDate < today
                  return (
                    <li key={m.id} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-panel-3/40">
                      <Checkbox checked={m.done} onChange={(v) => actions.update('careerMilestones', m.id, { done: v })} label={<span className="sr-only">Mark {m.title} done</span>} />
                      <button type="button" onClick={() => editor.edit('careerMilestones', m.id)} className="min-w-0 flex-1 text-left">
                        <span className={cn('block truncate text-[13.5px]', m.done ? 'text-ink-subtle line-through' : 'text-ink')}>{m.title}</span>
                        {path && <span className="block truncate text-[11px] text-ink-subtle">{path.name}</span>}
                      </button>
                      {m.dueDate && <span className={cn('font-mono text-[11px]', overdue ? 'text-bad' : 'text-ink-subtle')}>{relativeDay(m.dueDate, today)}</span>}
                      <RecordActions collection="careerMilestones" id={m.id} />
                    </li>
                  )
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
