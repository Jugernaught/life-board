import { useMemo, useState } from 'react'
import { Award, BookOpenCheck, CalendarClock, ChevronDown, GraduationCap, Plus } from 'lucide-react'
import { ASSESSMENT_KINDS, ASSESSMENT_STATUSES, MODULE_STATUSES, PROGRESS_STATUSES, QUALIFICATION_KINDS } from '@/data/constants'
import type { Assessment } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { courseGrade, moduleGrade } from '@/selectors/career'
import { relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar } from '@/components/ui/display'
import { Select } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

function GradeChip({ grade, target }: { grade: number | null; target?: number }) {
  if (grade === null) return <span className="font-mono text-[12px] text-ink-subtle">No grades yet</span>
  const onTrack = target === undefined || grade >= target
  return (
    <span className={cn('font-mono text-[13px] tabular', onTrack ? 'text-ok' : 'text-warn')} title={target !== undefined ? `Target ${target}%` : undefined}>
      {grade.toFixed(1)}%{target !== undefined && <span className="text-ink-subtle"> / {target}%</span>}
    </span>
  )
}

export function AssessmentRow({ a, today, showModule }: { a: Assessment; today: string; showModule?: boolean }) {
  const fmt = useFormatters()
  const modules = useCollection('modules')
  const mod = modules.find((m) => m.id === a.moduleId)
  const done = a.status === 'submitted' || a.status === 'graded'
  const overdue = !done && a.dueDate < today
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap">
      <button type="button" onClick={() => editor.edit('assessments', a.id)} className="min-w-0 flex-1 text-left">
        <p className={cn('truncate text-[13.5px]', done ? 'text-ink-muted' : 'text-ink')}>{a.title}</p>
        <p className="text-[11.5px] text-ink-subtle">
          {ASSESSMENT_KINDS.label(a.kind)}
          {showModule && mod ? ` · ${mod.code || mod.name}` : ''}
          {a.weight !== undefined ? ` · ${a.weight}% weight` : ''}
        </p>
      </button>
      <span className={cn('inline-flex items-center gap-1 font-mono text-[11.5px]', overdue ? 'text-bad' : 'text-ink-subtle')}>
        <CalendarClock size={11} />
        {fmt.shortDate(a.dueDate)}
        {a.dueTime ? ` ${fmt.time(a.dueTime)}` : ''} · {relativeDay(a.dueDate, today)}
      </span>
      {a.status === 'graded' && a.score !== undefined ? (
        <Badge tone="ok">{a.score}%</Badge>
      ) : (
        <Select
          size="sm"
          value={a.status}
          onChange={(e) => {
            const status = e.target.value as Assessment['status']
            if (status === 'graded') editor.edit('assessments', a.id)
            else actions.update('assessments', a.id, { status })
          }}
          aria-label={`Status of ${a.title}`}
          className="w-32"
        >
          {ASSESSMENT_STATUSES.list.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      )}
      <RecordActions collection="assessments" id={a.id} duplicate />
    </li>
  )
}

export function EducationTab({ today }: { today: string }) {
  const courses = useCollection('academicCourses')
  const modules = useCollection('modules')
  const assessments = useCollection('assessments')
  const qualifications = useCollection('qualifications')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const upcoming = useMemo(() => assessments.filter((a) => a.status !== 'graded' && a.status !== 'submitted').sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assessments])
  const standalone = modules.filter((m) => !m.courseId || !courses.some((c) => c.id === m.courseId))

  const moduleBlock = (mId: string) => {
    const m = modules.find((x) => x.id === mId)!
    const g = moduleGrade(m.id, assessments)
    const list = assessments.filter((a) => a.moduleId === m.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const isOpen = open[m.id] ?? list.some((a) => a.status !== 'graded')
    return (
      <div key={m.id} className="rounded-lg border border-line bg-panel-2/30">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
            <ChevronDown size={14} className={cn('shrink-0 text-ink-subtle transition-transform', !isOpen && '-rotate-90')} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-ink">
                {m.code && <span className="mr-1.5 font-mono text-[12px] text-accent">{m.code}</span>}
                {m.name}
              </span>
              <span className="block text-[11.5px] text-ink-subtle">
                {[m.term, m.credits !== undefined ? `${m.credits} credits` : null, `${g.graded}/${g.total} graded`].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
          <Badge tone={MODULE_STATUSES.tone(m.status)}>{MODULE_STATUSES.label(m.status)}</Badge>
          <GradeChip grade={g.grade} target={m.targetGrade} />
          <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('assessments', { moduleId: m.id })}>
            Assessment
          </Button>
          <RecordActions collection="modules" id={m.id} />
        </div>
        {isOpen && (
          <div className="border-t border-line px-3">
            {g.gradedWeight > 0 && (
              <div className="pt-2.5">
                <div className="mb-1 flex justify-between text-[11.5px] text-ink-subtle">
                  <span>Weight graded so far</span>
                  <span className="font-mono">{g.gradedWeight}%</span>
                </div>
                <ProgressBar value={g.gradedWeight} size="xs" label="Weight graded" />
              </div>
            )}
            {list.length === 0 ? <p className="py-3 text-[12.5px] text-ink-subtle">No assignments or exams yet.</p> : <ul className="divide-y divide-line/60">{list.map((a) => <AssessmentRow key={a.id} a={a} today={today} />)}</ul>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" icon={Plus} onClick={() => editor.create('modules')}>
            Module
          </Button>
          <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('academicCourses')}>
            Course
          </Button>
        </div>
        {courses.length === 0 && modules.length === 0 ? (
          <Panel>
            <EmptyState icon={GraduationCap} title="No courses or modules yet" description="Add your university course, then its modules. Log assignments and exams with weights to track your grades automatically." />
          </Panel>
        ) : (
          <>
            {courses.map((c) => {
              const grade = courseGrade(c.id, modules, assessments)
              const mods = modules.filter((m) => m.courseId === c.id)
              return (
                <Panel key={c.id} title={c.name} icon={GraduationCap} eyebrow={[c.institution, c.level].filter(Boolean).join(' · ') || undefined} actions={<RecordActions collection="academicCourses" id={c.id} />}>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <Badge tone={PROGRESS_STATUSES.tone(c.status)}>{PROGRESS_STATUSES.label(c.status)}</Badge>
                    <span className="text-[12.5px] text-ink-muted">
                      Average: <GradeChip grade={grade} target={c.targetGrade} />
                    </span>
                    <span className="text-[12px] text-ink-subtle">{mods.length} modules</span>
                    <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('modules', { courseId: c.id })}>
                      Module
                    </Button>
                  </div>
                  <div className="space-y-2">{mods.length ? mods.map((m) => moduleBlock(m.id)) : <p className="text-[12.5px] text-ink-subtle">No modules yet.</p>}</div>
                </Panel>
              )
            })}
            {standalone.length > 0 && (
              <Panel title="Other modules & subjects" icon={BookOpenCheck}>
                <div className="space-y-2">{standalone.map((m) => moduleBlock(m.id))}</div>
              </Panel>
            )}
          </>
        )}
      </div>
      <div className="space-y-4">
        <Panel title="Assignment & exam deadlines" icon={CalendarClock}>
          {upcoming.length === 0 ? (
            <p className="text-[12.5px] text-ink-subtle">No outstanding assignments or exams.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {upcoming.slice(0, 12).map((a) => (
                <AssessmentRow key={a.id} a={a} today={today} showModule />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Qualifications" icon={Award} actions={<Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('qualifications')}>Add</Button>}>
          {qualifications.length === 0 ? (
            <p className="text-[12.5px] text-ink-subtle">Degrees, certificates and licences you hold or are working towards.</p>
          ) : (
            <ul className="space-y-2">
              {[...qualifications]
                .sort((a, b) => (b.completionDate ?? '9999').localeCompare(a.completionDate ?? '9999'))
                .map((q) => (
                  <li key={q.id} className="flex items-start gap-2 rounded-lg border border-line bg-panel-2/30 px-3 py-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => editor.edit('qualifications', q.id)}>
                      <p className="truncate text-[13.5px] text-ink">{q.title}</p>
                      <p className="text-[11.5px] text-ink-subtle">{[QUALIFICATION_KINDS.label(q.kind), q.institution, q.grade, q.completionDate?.slice(0, 4)].filter(Boolean).join(' · ')}</p>
                    </button>
                    <Badge tone={PROGRESS_STATUSES.tone(q.status)}>{PROGRESS_STATUSES.label(q.status)}</Badge>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
