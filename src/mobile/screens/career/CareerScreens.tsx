import { useMemo, useState } from 'react'
import { Award, Briefcase, Building2, CheckCircle2, Compass, ExternalLink, Eye, Flag, GraduationCap, MessagesSquare, Plus, Send, Shuffle, Trash2 } from 'lucide-react'
import {
  APPLICATION_STATUSES,
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  CAREER_CRITERIA,
  CAREER_MILESTONE_KINDS,
  CAREER_PATH_STATUSES,
  MODULE_STATUSES,
  OPEN_APPLICATION_STATUSES,
  PROGRESS_STATUSES,
  QUALIFICATION_KINDS,
  QUESTION_CATEGORIES,
  type ApplicationStatus,
  type CareerMilestoneKind,
  type ProgressStatus,
  type QuestionCategory,
} from '@/data/constants'
import type { Assessment, CareerMilestone, CareerPath, InterviewQuestion } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { applicationFunnel, averageScore, careerPathProgress, courseGrade, moduleGrade } from '@/selectors/career'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useCollection, useDatabase, useRecord } from '@/store/store'
import { ProgressRing } from '@/components/ui/display'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { AgendaDayRow } from '../../components/AgendaRow'
import { checklistAdd, checklistRows } from '../../components/Checklist'
import { NotesSection } from '../../components/NotesSection'
import { RecordScreen } from '../../components/RecordScreen'
import { ProgressLine, StatGrid, StatTile } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { CheckCircle, Chips, StarRating } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { SwipeRow } from '../../ui/SwipeRow'
import { MissingScreen } from '../habits/HabitsScreens'

const pct = (n: number) => `${n.toFixed(1)}%`

function GradeText({ grade, target }: { grade: number | null; target?: number }) {
  if (grade === null) return <span className="text-ink-subtle">No grades yet</span>
  const ok = target === undefined || grade >= target
  return (
    <span className="tabular-nums" style={{ color: ok ? 'var(--color-ok)' : 'var(--color-warn)' }}>
      {pct(grade)}
      {target !== undefined && <span className="text-ink-subtle"> / {target}%</span>}
    </span>
  )
}

const addCareerRecord = () =>
  actionSheet({
    title: 'Add',
    options: [
      { label: 'Career Path', onSelect: () => editor.create('careerPaths') },
      { label: 'Job Application', onSelect: () => editor.create('applications') },
      { label: 'Assessment', onSelect: () => editor.create('assessments') },
      { label: 'Course', onSelect: () => editor.create('academicCourses') },
      { label: 'Module', onSelect: () => editor.create('modules') },
      { label: 'CV / Portfolio Milestone', onSelect: () => editor.create('careerMilestones') },
      { label: 'Interview Question', onSelect: () => editor.create('interviewQuestions') },
      { label: 'Company', onSelect: () => editor.create('companies') },
      { label: 'Qualification', onSelect: () => editor.create('qualifications') },
    ],
  })

// ------------------------------------------------------------- overview

export function CareerScreen() {
  const db = useDatabase()
  const today = useToday()
  const funnel = applicationFunnel(db.applications)
  const deadlines = useMemo(
    () => buildAgenda(db, today, addDaysISO(today, 30), today).filter((i) => ['assessments', 'applications', 'careerMilestones'].includes(i.sourceKey) || (i.sourceKey === 'goals' && i.area === 'career')),
    [db, today],
  )
  const paths = db.careerPaths.filter((p) => p.status !== 'archived')
  const stages = [
    { label: 'Applied', count: funnel.applied },
    { label: 'Interviewing', count: funnel.interviewing },
    { label: 'Offers', count: funnel.offers },
    { label: 'Accepted', count: funnel.accepted },
  ]
  return (
    <Screen
      title="Career"
      large
      testId="screen-career"
      trailing={
        <NavButton label="Add" onClick={addCareerRecord} testId="career-add">
          <Plus size={26} />
        </NavButton>
      }
    >
      <StatGrid>
        <StatTile label="Career paths" value={paths.length} sub={`${db.careerPaths.filter((p) => p.status === 'active').length} being pursued`} tone="cyan" />
        <StatTile label="Open applications" value={funnel.open} sub={`${funnel.total} tracked`} tone="violet" />
        <StatTile label="Deadlines" value={deadlines.length} sub="next 30 days" tone="magenta" />
        <StatTile label="Qualifications" value={db.qualifications.filter((q) => q.status === 'completed').length} sub={`${db.qualifications.filter((q) => q.status === 'in_progress').length} in progress`} tone="lime" />
      </StatGrid>

      <Section header="Deadlines · next 30 days">
        {deadlines.length === 0 && <EmptyRow>No assignment, exam, interview or milestone deadlines in the next 30 days.</EmptyRow>}
        {deadlines.slice(0, 8).map((i) => (
          <AgendaDayRow key={i.key} item={i} today={today} />
        ))}
      </Section>

      <Section>
        <Cell icon={Compass} iconTone="cyan" title="Career Paths" detail={paths.length || undefined} chevron onClick={() => nav.push('more/career/paths')} testId="career-paths" />
        <Cell icon={GraduationCap} iconTone="violet" title="Education" detail={db.academicCourses.length + db.modules.length || undefined} subtitle="Courses, modules, grades" chevron onClick={() => nav.push('more/career/education')} testId="career-education" />
        <Cell icon={Briefcase} iconTone="info" title="Applications" detail={funnel.open || undefined} chevron onClick={() => nav.push('more/career/applications')} testId="career-applications" />
        <Cell icon={MessagesSquare} iconTone="magenta" title="Interview Prep" detail={db.interviewQuestions.length || undefined} chevron onClick={() => nav.push('more/career/interviews')} />
        <Cell icon={Building2} iconTone="amber" title="Companies" detail={db.companies.length || undefined} chevron onClick={() => nav.push('more/career/companies')} />
        <Cell icon={Flag} iconTone="lime" title="CV & Portfolio" detail={db.careerMilestones.filter((m) => !m.done).length || undefined} chevron onClick={() => nav.push('more/career/milestones')} />
        <Cell icon={Award} iconTone="ok" title="Qualifications" detail={db.qualifications.length || undefined} chevron onClick={() => nav.push('more/career/qualifications')} />
      </Section>

      {paths.length > 0 && (
        <Section header="Career paths" headerAction={<SeeAll onClick={() => nav.push('more/career/paths')} />}>
          {paths.slice(0, 4).map((p) => {
            const prog = careerPathProgress(p, db.careerMilestones)
            return <Cell key={p.id} title={p.name} subtitle={<ProgressLine value={prog.pct} tone={p.color} className="mt-1.5" />} detail={prog.pct === null ? CAREER_PATH_STATUSES.label(p.status) : `${Math.round(prog.pct)}%`} chevron onClick={() => nav.push(`more/career/paths/${p.id}`)} />
          })}
        </Section>
      )}

      {funnel.total > 0 && (
        <Section header="Application pipeline" footer="How many applications reached each stage.">
          {stages.map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-2.5">
              <span className="ios-subhead w-24 shrink-0 text-ink">{s.label}</span>
              <ProgressLine value={funnel.total ? (s.count / funnel.total) * 100 : 0} className="flex-1" />
              <span className="ios-subhead w-8 text-right text-ink-muted tabular-nums">{s.count}</span>
            </div>
          ))}
        </Section>
      )}

      <NotesSection header="Career notes" filter={(n) => n.area === 'career'} defaults={{ area: 'career' }} />
    </Screen>
  )
}

// ---------------------------------------------------------------- paths

export function CareerPathsScreen() {
  const paths = useCollection('careerPaths')
  const milestones = useCollection('careerMilestones')
  const ordered = [...paths].sort((a, b) => (averageScore(b) ?? -1) - (averageScore(a) ?? -1))
  return (
    <RecordScreen
      title="Career Paths"
      collection="careerPaths"
      testId="screen-career-paths"
      items={ordered}
      search={(p) => `${p.name} ${p.targetRole ?? ''} ${p.description ?? ''}`}
      group={(p) => (p.status === 'archived' ? 'Archived' : 'Considering')}
      groupOrder={(a) => (a === 'Archived' ? 1 : -1)}
      empty="Add the career paths you’re considering. Score each one against the same criteria to compare them side by side."
      footer="Sorted by average score (your 1–5 ratings)."
      onOpen={(p) => nav.push(`more/career/paths/${p.id}`)}
      row={(p) => {
        const prog = careerPathProgress(p, milestones)
        const avg = averageScore(p)
        return {
          title: p.name,
          subtitle: (
            <>
              {[p.targetRole, CAREER_PATH_STATUSES.label(p.status)].filter(Boolean).join(' · ')}
              {prog.pct !== null && <ProgressLine value={prog.pct} tone={p.color} className="mt-1.5" />}
            </>
          ),
          detail: avg === null ? undefined : <span className="text-[var(--color-amber)]">★ {avg.toFixed(1)}</span>,
        }
      }}
    />
  )
}

function MilestoneRow({ m, today, showKind }: { m: CareerMilestone; today: string; showKind?: boolean }) {
  return (
    <SwipeRow actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('careerMilestones', m.id) }]}>
      <div className="flex items-center gap-3 pl-4">
        <CheckCircle checked={m.done} size={22} label={`${m.done ? 'Mark not done' : 'Complete'}: ${m.title}`} onToggle={() => actions.update('careerMilestones', m.id, { done: !m.done })} testId="m-milestone-check" />
        <button type="button" onClick={() => editor.edit('careerMilestones', m.id)} className="ios-press flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 text-left">
          <span className="min-w-0 flex-1">
            <span className={cn('ios-body block truncate', m.done ? 'text-ink-subtle line-through' : 'text-ink')}>{m.title}</span>
            {showKind && <span className="ios-footnote block text-ink-subtle">{CAREER_MILESTONE_KINDS.label(m.kind)}</span>}
          </span>
          {m.dueDate && <span className={cn('ios-footnote shrink-0', !m.done && m.dueDate < today ? 'text-bad' : 'text-ink-subtle')}>{relativeDay(m.dueDate, today)}</span>}
        </button>
      </div>
    </SwipeRow>
  )
}

export function CareerPathScreen({ params }: { params: Record<string, string> }) {
  const path = useRecord('careerPaths', params.id)
  const db = useDatabase()
  const today = useToday()
  if (!path) return <MissingScreen title="Career Path" />
  const prog = careerPathProgress(path, db.careerMilestones)
  const avg = averageScore(path)
  const linked = db.careerMilestones.filter((m) => m.careerPathId === path.id)
  const apps = db.applications.filter((a) => a.careerPathId === path.id)
  const update = (patch: Partial<CareerPath>) => actions.update('careerPaths', path.id, patch)
  const color = toneColor(path.color)
  return (
    <Screen title={path.name} testId="screen-career-path" trailing={<NavButton onClick={() => editor.edit('careerPaths', path.id)}>Edit</NavButton>}>
      <div className="flex items-center gap-4 px-4 pt-2 pb-5">
        <ProgressRing value={prog.pct ?? 0} size={84} stroke={8} tone={path.color} label={prog.pct === null ? 'No roadmap yet' : `${Math.round(prog.pct)}% of roadmap done`}>
          <span className="ios-headline text-ink tabular-nums">{prog.pct === null ? '—' : `${Math.round(prog.pct)}%`}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="ios-title2 text-ink">{path.name}</p>
          <p className="ios-subhead text-ink-subtle">{[path.targetRole, path.targetDate ? `by ${relativeDay(path.targetDate, today)}` : undefined].filter(Boolean).join(' · ') || 'No target role set'}</p>
        </div>
      </div>
      <Section>
        <Cell
          title="Status"
          detail={CAREER_PATH_STATUSES.label(path.status)}
          chevron
          testId="career-path-status"
          onClick={() => actionSheet({ title: 'Status', options: CAREER_PATH_STATUSES.list.map((s) => ({ label: s.label, onSelect: () => update({ status: s.value }) })) })}
        />
      </Section>
      <Section header="How it scores" footer={avg === null ? 'Rate 1–5 to compare paths. Tap a star again to clear it.' : `Average ${avg.toFixed(1)} of 5 across ${Object.values(path.scores).filter((v) => typeof v === 'number').length} criteria.`}>
        {CAREER_CRITERIA.list.map((c) => (
          <div key={c.value} className="px-4 pt-2.5 pb-1">
            <span className="ios-body block text-ink">{c.label}</span>
            <span className="ios-footnote block text-ink-subtle">{c.description}</span>
            <StarRating
              value={path.scores[c.value]}
              label={c.label}
              testId="career-score"
              onChange={(v) => {
                const scores = { ...path.scores }
                if (v === undefined) delete scores[c.value]
                else scores[c.value] = v
                update({ scores })
              }}
            />
          </div>
        ))}
      </Section>
      <Section header={`Roadmap${path.roadmap.length ? ` · ${path.roadmap.filter((s) => s.done).length}/${path.roadmap.length}` : ''}`}>
        {checklistRows(path.roadmap, (roadmap) => update({ roadmap }), today, color)}
        {checklistAdd(path.roadmap, (roadmap) => update({ roadmap }), 'Add a step')}
      </Section>
      <Section header="Milestones" footer="CV, portfolio and certification milestones linked to this path count towards its progress.">
        {linked.map((m) => (
          <MilestoneRow key={m.id} m={m} today={today} showKind />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('careerMilestones', { careerPathId: path.id })}>
          Add Milestone
        </ActionCell>
      </Section>
      {apps.length > 0 && (
        <Section header="Applications">
          {apps.map((a) => (
            <Cell key={a.id} title={`${a.role} · ${a.company}`} detail={APPLICATION_STATUSES.label(a.status)} chevron onClick={() => editor.edit('applications', a.id)} />
          ))}
        </Section>
      )}
      {(path.description || path.notes) && (
        <Section header="Notes">
          <p className="ios-body whitespace-pre-wrap px-4 py-3 text-ink" data-selectable>
            {[path.description, path.notes].filter(Boolean).join('\n\n')}
          </p>
        </Section>
      )}
      <Section>
        <ActionCell onClick={() => update({ status: path.status === 'archived' ? 'exploring' : 'archived' })}>{path.status === 'archived' ? 'Restore Path' : 'Archive Path'}</ActionCell>
        <ActionCell destructive onClick={async () => { if (await deleteRecord('careerPaths', path.id)) nav.pop() }}>
          Delete Career Path
        </ActionCell>
      </Section>
    </Screen>
  )
}

// ------------------------------------------------------------ education

function AssessmentRow({ a, today, showModule }: { a: Assessment; today: string; showModule?: boolean }) {
  const modules = useCollection('modules')
  const fmt = useFormatters()
  const done = a.status === 'submitted' || a.status === 'graded'
  const overdue = !done && a.dueDate < today
  return (
    <SwipeRow
      actions={[
        ...(a.status !== 'graded' && a.status !== 'submitted' ? [{ label: 'Submitted', icon: Send, tone: 'violet' as const, onAction: () => actions.update('assessments', a.id, { status: 'submitted' }) }] : []),
        ...(a.status !== 'graded' ? [{ label: 'Grade', icon: CheckCircle2, tone: 'ok' as const, onAction: () => editor.edit('assessments', a.id) }] : []),
        { label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('assessments', a.id) },
      ]}
    >
      <Cell
        title={a.title}
        testId="m-assessment-row"
        subtitle={[ASSESSMENT_KINDS.label(a.kind), showModule ? modules.find((m) => m.id === a.moduleId)?.name : undefined, a.weight !== undefined ? `${a.weight}%` : undefined, a.status !== 'graded' ? ASSESSMENT_STATUSES.label(a.status) : undefined].filter(Boolean).join(' · ')}
        detail={
          a.status === 'graded' && a.score !== undefined ? (
            <span className="text-ok tabular-nums">{a.score}%</span>
          ) : (
            <span className={cn(overdue ? 'text-bad' : undefined)}>
              {relativeDay(a.dueDate, today)}
              {a.dueTime ? ` ${fmt.time(a.dueTime)}` : ''}
            </span>
          )
        }
        chevron
        onClick={() => editor.edit('assessments', a.id)}
      />
    </SwipeRow>
  )
}

export function EducationScreen() {
  const db = useDatabase()
  const today = useToday()
  const upcoming = db.assessments.filter((a) => a.status !== 'graded' && a.status !== 'submitted').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const loose = db.modules.filter((m) => !m.courseId || !db.academicCourses.some((c) => c.id === m.courseId))
  return (
    <Screen
      title="Education"
      testId="screen-education"
      trailing={
        <NavButton
          label="Add"
          testId="education-add"
          onClick={() =>
            actionSheet({
              title: 'Add',
              options: [
                { label: 'Assessment', onSelect: () => editor.create('assessments') },
                { label: 'Module', onSelect: () => editor.create('modules') },
                { label: 'Course', onSelect: () => editor.create('academicCourses') },
              ],
            })
          }
        >
          <Plus size={26} />
        </NavButton>
      }
    >
      <Section header="Upcoming assessments" footer={upcoming.length ? 'Swipe left to mark as submitted or add a grade.' : undefined}>
        {upcoming.length === 0 && <EmptyRow>Nothing due. Add assignments and exams with their weights to track your grades.</EmptyRow>}
        {upcoming.slice(0, 10).map((a) => (
          <AssessmentRow key={a.id} a={a} today={today} showModule />
        ))}
      </Section>
      <Section header="Courses">
        {db.academicCourses.length === 0 && <EmptyRow>Add your course (e.g. a degree), then its modules.</EmptyRow>}
        {db.academicCourses.map((c) => (
          <Cell
            key={c.id}
            title={c.name}
            subtitle={[c.institution, c.level, PROGRESS_STATUSES.label(c.status)].filter(Boolean).join(' · ')}
            detail={<GradeText grade={courseGrade(c.id, db.modules, db.assessments)} target={c.targetGrade} />}
            chevron
            onClick={() => nav.push(`more/career/education/course/${c.id}`)}
            testId="m-course-row"
          />
        ))}
        {/* The "+" above offers Course too; this prompt only shows while there are none. */}
        {db.academicCourses.length === 0 && (
          <ActionCell icon={Plus} onClick={() => editor.create('academicCourses')}>
            Add Course
          </ActionCell>
        )}
      </Section>
      {loose.length > 0 && (
        <Section header="Other modules">
          {loose.map((m) => (
            <Cell key={m.id} title={m.name} subtitle={[m.code, m.term, MODULE_STATUSES.label(m.status)].filter(Boolean).join(' · ')} detail={<GradeText grade={moduleGrade(m.id, db.assessments).grade} target={m.targetGrade} />} chevron onClick={() => nav.push(`more/career/education/module/${m.id}`)} />
          ))}
        </Section>
      )}
      <Section>
        <Cell icon={Award} iconTone="ok" title="Qualifications" detail={db.qualifications.length || undefined} chevron onClick={() => nav.push('more/career/qualifications')} />
      </Section>
    </Screen>
  )
}

export function AcademicCourseScreen({ params }: { params: Record<string, string> }) {
  const course = useRecord('academicCourses', params.id)
  const db = useDatabase()
  if (!course) return <MissingScreen title="Course" />
  const modules = db.modules.filter((m) => m.courseId === course.id)
  const grade = courseGrade(course.id, db.modules, db.assessments)
  const credits = modules.reduce((n, m) => n + (m.credits ?? 0), 0)
  return (
    <Screen title={course.name} testId="screen-academic-course" trailing={<NavButton onClick={() => editor.edit('academicCourses', course.id)}>Edit</NavButton>}>
      <div className="px-4 pt-2 pb-5">
        <p className="ios-title2 text-ink">{course.name}</p>
        <p className="ios-subhead text-ink-subtle">{[course.institution, course.level, PROGRESS_STATUSES.label(course.status)].filter(Boolean).join(' · ')}</p>
      </div>
      <StatGrid>
        <StatTile label="Average" value={grade === null ? '—' : pct(grade)} sub={course.targetGrade !== undefined ? `target ${course.targetGrade}%` : 'weighted by credits'} tone={grade !== null && course.targetGrade !== undefined && grade < course.targetGrade ? 'warn' : 'ok'} />
        <StatTile label="Modules" value={modules.length} sub={credits ? `${credits} credits` : `${modules.filter((m) => m.status === 'completed').length} completed`} tone="violet" />
      </StatGrid>
      <Section header="Modules">
        {modules.length === 0 && <EmptyRow>No modules yet.</EmptyRow>}
        {modules.map((m) => {
          const g = moduleGrade(m.id, db.assessments)
          return <Cell key={m.id} title={m.name} subtitle={[m.code, m.term, m.credits !== undefined ? `${m.credits} credits` : undefined, `${g.graded}/${g.total} graded`].filter(Boolean).join(' · ')} detail={<GradeText grade={g.grade} target={m.targetGrade} />} chevron onClick={() => nav.push(`more/career/education/module/${m.id}`)} testId="m-module-row" />
        })}
        <ActionCell icon={Plus} onClick={() => editor.create('modules', { courseId: course.id })}>
          Add Module
        </ActionCell>
      </Section>
      {course.notes && (
        <Section header="Notes">
          <p className="ios-body whitespace-pre-wrap px-4 py-3 text-ink" data-selectable>
            {course.notes}
          </p>
        </Section>
      )}
      <Section footer="Deleting a course keeps its modules and assessments.">
        <ActionCell destructive onClick={async () => { if (await deleteRecord('academicCourses', course.id)) nav.pop() }}>
          Delete Course
        </ActionCell>
      </Section>
    </Screen>
  )
}

export function ModuleScreen({ params }: { params: Record<string, string> }) {
  const mod = useRecord('modules', params.id)
  const db = useDatabase()
  const today = useToday()
  if (!mod) return <MissingScreen title="Module" />
  const g = moduleGrade(mod.id, db.assessments)
  const list = db.assessments.filter((a) => a.moduleId === mod.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const totalWeight = list.reduce((n, a) => n + (a.weight ?? 0), 0)
  return (
    <Screen title={mod.name} testId="screen-module" trailing={<NavButton onClick={() => editor.edit('modules', mod.id)}>Edit</NavButton>}>
      <div className="px-4 pt-2 pb-5">
        <p className="ios-title2 text-ink">{mod.name}</p>
        <p className="ios-subhead text-ink-subtle">{[mod.code, mod.term, mod.credits !== undefined ? `${mod.credits} credits` : undefined, MODULE_STATUSES.label(mod.status)].filter(Boolean).join(' · ')}</p>
      </div>
      <StatGrid>
        <StatTile label="Grade so far" value={g.grade === null ? '—' : pct(g.grade)} sub={mod.targetGrade !== undefined ? `target ${mod.targetGrade}%` : `${g.graded}/${g.total} graded`} tone={g.grade !== null && mod.targetGrade !== undefined && g.grade < mod.targetGrade ? 'warn' : 'ok'} />
        <StatTile label="Weight graded" value={g.gradedWeight ? `${g.gradedWeight}%` : '—'} sub={totalWeight ? `of ${totalWeight}% set` : 'add weights for a weighted grade'} tone="violet" />
      </StatGrid>
      <Section header="Assessments" footer="The grade uses weights when every graded assessment has one; otherwise it’s a plain average.">
        {list.length === 0 && <EmptyRow>No assessments yet.</EmptyRow>}
        {list.map((a) => (
          <AssessmentRow key={a.id} a={a} today={today} />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('assessments', { moduleId: mod.id })} testId="module-add-assessment">
          Add Assessment
        </ActionCell>
      </Section>
      <Section footer="Deleting a module keeps its assessments.">
        <ActionCell destructive onClick={async () => { if (await deleteRecord('modules', mod.id)) nav.pop() }}>
          Delete Module
        </ActionCell>
      </Section>
    </Screen>
  )
}

// --------------------------------------------------------- applications

const APP_ORDER = APPLICATION_STATUSES.values as readonly ApplicationStatus[]

export function ApplicationsScreen() {
  const apps = useCollection('applications')
  const today = useToday()
  const [scope, setScope] = useState<'open' | 'closed' | 'all'>('open')
  const isOpen = (s: ApplicationStatus) => OPEN_APPLICATION_STATUSES.includes(s)
  const items = apps.filter((a) => scope === 'all' || (scope === 'open' ? isOpen(a.status) : !isOpen(a.status)))
  const funnel = applicationFunnel(apps)
  return (
    <RecordScreen
      title="Applications"
      collection="applications"
      testId="screen-applications"
      items={items}
      search={(a) => `${a.company} ${a.role} ${a.location ?? ''} ${a.notes ?? ''}`}
      group={(a) => a.status}
      groupOrder={(a, b) => APP_ORDER.indexOf(a as ApplicationStatus) - APP_ORDER.indexOf(b as ApplicationStatus)}
      groupLabel={(k) => APPLICATION_STATUSES.label(k as ApplicationStatus)}
      empty={apps.length ? 'No applications here.' : 'Track roles you want, have applied for, or are interviewing for. Status changes are recorded with dates.'}
      top={
        <>
          {apps.length > 0 && (
            <StatGrid>
              <StatTile label="Open" value={funnel.open} sub={`${funnel.total} total`} tone="violet" />
              <StatTile label="Interview rate" value={funnel.applied ? `${Math.round((funnel.interviewing / funnel.applied) * 100)}%` : '—'} sub={`${funnel.interviewing} of ${funnel.applied} applied`} tone="cyan" />
            </StatGrid>
          )}
          <div className="mb-3 px-4">
            <Chips ariaLabel="Show applications" value={scope} onChange={setScope} options={[{ value: 'open', label: 'Open', count: apps.filter((a) => isOpen(a.status)).length }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
          </div>
        </>
      }
      extraActions={(a) => [
        {
          label: 'Status',
          icon: Briefcase,
          tone: 'info' as const,
          onAction: () => actionSheet({ title: `${a.role} · ${a.company}`, message: 'Move to', options: APPLICATION_STATUSES.list.filter((s) => s.value !== a.status).map((s) => ({ label: s.label, onSelect: () => actions.update('applications', a.id, { status: s.value, ...(s.value === 'applied' && !a.appliedDate ? { appliedDate: today } : {}) }) })) }),
        },
      ]}
      row={(a) => ({
        title: `${a.role}`,
        subtitle: [a.company, a.nextStep ? `Next: ${a.nextStep}${a.nextStepDate ? ` (${relativeDay(a.nextStepDate, today)})` : ''}` : a.appliedDate ? `Applied ${relativeDay(a.appliedDate, today)}` : a.location].filter(Boolean).join(' · '),
        detail: a.nextStepDate && isOpen(a.status) ? <span className={cn(a.nextStepDate < today && 'text-bad')}>{relativeDay(a.nextStepDate, today)}</span> : undefined,
      })}
    />
  )
}

// ------------------------------------------------------------ interview

function pickQuestion(pool: InterviewQuestion[], not?: string) {
  const candidates = pool.length > 1 ? pool.filter((q) => q.id !== not) : pool
  // Favour questions practised least and with lowest confidence.
  const weighted = candidates.flatMap((q) => Array(Math.max(1, 6 - (q.confidence ?? 0) - Math.min(3, q.practiceCount))).fill(q) as InterviewQuestion[])
  return weighted[Math.floor(Math.random() * weighted.length)]
}

export function InterviewScreen() {
  const questions = useCollection('interviewQuestions')
  const today = useToday()
  const [category, setCategory] = useState<'all' | QuestionCategory>('all')
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const pool = questions.filter((q) => category === 'all' || q.category === category)
  const practice = questions.find((q) => q.id === practiceId)
  const next = () => {
    const q = pickQuestion(pool, practiceId ?? undefined)
    setPracticeId(q?.id ?? null)
    setRevealed(false)
  }
  const practised = (q: InterviewQuestion) => actions.update('interviewQuestions', q.id, (c) => ({ lastPractised: today, practiceCount: c.practiceCount + 1 }), { action: 'logged', detail: 'Practised' })

  return (
    <RecordScreen
      title="Interview Prep"
      collection="interviewQuestions"
      testId="screen-interviews"
      items={pool}
      defaults={category === 'all' ? undefined : { category }}
      search={(q) => `${q.question} ${q.answer ?? ''}`}
      group={(q) => q.category}
      groupOrder={(a, b) => QUESTION_CATEGORIES.values.indexOf(a as QuestionCategory) - QUESTION_CATEGORIES.values.indexOf(b as QuestionCategory)}
      groupLabel={(k) => QUESTION_CATEGORIES.label(k as QuestionCategory)}
      empty="Save questions you expect, with notes for your answers. Then practise them at random."
      top={
        <>
          {questions.length > 0 && (
            <Section header="Practice" footer={practice ? 'Answer out loud first, then compare with your notes.' : 'Picks questions you’ve practised least and feel least confident about.'}>
              {practice ? (
                <div className="px-4 py-3" data-testid="practice-card">
                  <p className="ios-footnote text-ink-subtle">{QUESTION_CATEGORIES.label(practice.category)}</p>
                  <p className="ios-headline mt-1 text-ink" data-selectable>
                    {practice.question}
                  </p>
                  {revealed && (
                    <p className="ios-subhead mt-3 rounded-[10px] bg-[var(--ios-fill)] p-3 whitespace-pre-line text-ink-muted" data-selectable>
                      {practice.answer || 'No notes saved for this question yet.'}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {!revealed && (
                      <button type="button" onClick={() => setRevealed(true)} className="ios-subhead flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--ios-fill)] font-medium text-accent active:opacity-70">
                        <Eye size={17} /> Reveal Notes
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        practised(practice)
                        next()
                      }}
                      className="ios-subhead flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-accent font-semibold text-[var(--color-on-accent)] active:opacity-80"
                      data-testid="practice-done"
                    >
                      <CheckCircle2 size={17} /> Practised
                    </button>
                  </div>
                </div>
              ) : null}
              <ActionCell icon={Shuffle} onClick={next} disabled={!pool.length} testId="practice-next">
                {practice ? 'Skip to Another' : 'Practise a Random Question'}
              </ActionCell>
            </Section>
          )}
          <div className="mb-3 px-4">
            <Chips ariaLabel="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All', count: questions.length }, ...QUESTION_CATEGORIES.list.filter((c) => questions.some((q) => q.category === c.value)).map((c) => ({ value: c.value, label: c.label }))]} />
          </div>
        </>
      }
      row={(q) => ({
        title: q.question,
        multiline: true,
        subtitle: [q.confidence ? `Confidence ${'★'.repeat(q.confidence)}` : 'Confidence not rated', q.practiceCount ? `practised ${q.practiceCount}×` : 'not practised', q.lastPractised ? relativeDay(q.lastPractised, today) : undefined].filter(Boolean).join(' · '),
      })}
    />
  )
}

// ------------------------------------------------------------- the rest

export function CompaniesScreen() {
  const companies = useCollection('companies')
  return (
    <RecordScreen
      title="Companies"
      collection="companies"
      testId="screen-companies"
      items={[...companies].sort((a, b) => (b.interest ?? 0) - (a.interest ?? 0) || a.name.localeCompare(b.name))}
      search={(c) => `${c.name} ${c.industry ?? ''} ${c.location ?? ''} ${c.research ?? ''}`}
      empty="Research companies you’d like to work for: what they do, pros and cons, and how interested you are."
      row={(c) => ({
        title: c.name,
        subtitle: [c.industry, c.location].filter(Boolean).join(' · ') || undefined,
        detail: c.interest ? <span className="text-[var(--color-amber)]">{'★'.repeat(c.interest)}</span> : undefined,
        trailing: c.website ? (
          <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open ${c.name} website`} className="flex size-11 items-center justify-center text-accent">
            <ExternalLink size={18} />
          </a>
        ) : undefined,
      })}
    />
  )
}

const MILESTONE_ORDER = CAREER_MILESTONE_KINDS.values as readonly CareerMilestoneKind[]

export function CareerMilestonesScreen() {
  const milestones = useCollection('careerMilestones')
  const today = useToday()
  const [showDone, setShowDone] = useState(false)
  const shown = milestones.filter((m) => showDone || !m.done).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  const kinds = MILESTONE_ORDER.filter((k) => shown.some((m) => m.kind === k))
  const doneCount = milestones.filter((m) => m.done).length
  return (
    <Screen
      title="CV & Portfolio"
      testId="screen-career-milestones"
      trailing={
        <NavButton label="Add milestone" onClick={() => editor.create('careerMilestones')} testId="record-add">
          <Plus size={26} />
        </NavButton>
      }
    >
      {shown.length === 0 && (
        <Section>
          <EmptyRow>{milestones.length ? 'All done.' : 'Plan CV updates, portfolio pieces, certifications and networking — with dates if you like.'}</EmptyRow>
        </Section>
      )}
      {kinds.map((k) => (
        <Section key={k} header={CAREER_MILESTONE_KINDS.label(k)}>
          {shown
            .filter((m) => m.kind === k)
            .map((m) => (
              <MilestoneRow key={m.id} m={m} today={today} />
            ))}
        </Section>
      ))}
      {doneCount > 0 && (
        <Section>
          <ActionCell onClick={() => setShowDone((v) => !v)}>{showDone ? 'Hide Completed' : `Show Completed (${doneCount})`}</ActionCell>
        </Section>
      )}
    </Screen>
  )
}

const QUAL_ORDER: ProgressStatus[] = ['in_progress', 'planned', 'completed', 'paused']

export function QualificationsScreen() {
  const quals = useCollection('qualifications')
  return (
    <RecordScreen
      title="Qualifications"
      collection="qualifications"
      testId="screen-qualifications"
      items={quals}
      search={(q) => `${q.title} ${q.institution ?? ''} ${q.grade ?? ''}`}
      group={(q) => q.status}
      groupOrder={(a, b) => QUAL_ORDER.indexOf(a as ProgressStatus) - QUAL_ORDER.indexOf(b as ProgressStatus)}
      groupLabel={(k) => PROGRESS_STATUSES.label(k as ProgressStatus)}
      empty="Degrees, certificates, licences and awards — earned or planned."
      row={(q) => ({
        title: q.title,
        subtitle: [QUALIFICATION_KINDS.label(q.kind), q.institution, q.grade, q.completionDate?.slice(0, 4)].filter(Boolean).join(' · '),
        trailing: q.credentialUrl ? (
          <a href={q.credentialUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open credential for ${q.title}`} className="flex size-11 items-center justify-center text-accent">
            <ExternalLink size={18} />
          </a>
        ) : undefined,
      })}
    />
  )
}
