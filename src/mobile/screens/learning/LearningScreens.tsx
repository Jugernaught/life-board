import { useMemo, useState } from 'react'
import { BookMarked, BrainCircuit, Clock, ExternalLink, GraduationCap, Library, Pause, Play, Plus, Square } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COURSE_STATUSES, PROFICIENCY_LEVELS, RESOURCE_KINDS, RESOURCE_STATUSES, SKILL_STATUSES, proficiencyLabel } from '@/data/constants'
import type { CourseStatus, ResourceStatus, SkillStatus } from '@/data/constants'
import type { Skill } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { courseProgress, learningHistory, minutesInRange, skillProgress, weeklyStudySeries } from '@/selectors/learning'
import { addDaysISO, formatDate, relativeDay, todayISO, weekStartISO } from '@/lib/dates'
import { formatHours, formatMinutes } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useCollection, useDatabase, useRecord } from '@/store/store'
import { ProgressRing } from '@/components/ui/display'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { useStudyTimer } from '@/features/learning/useStudyTimer'
import { checklistAdd, checklistRows } from '../../components/Checklist'
import { NotesSection } from '../../components/NotesSection'
import { RecordScreen } from '../../components/RecordScreen'
import { ProgressLine, StatGrid, StatTile } from '../../components/Stats'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { Chips } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { MissingScreen } from '../habits/HabitsScreens'

/** Focus timer: start, pause, stop → a pre-filled session to confirm. Survives reloads. */
function TimerCard() {
  const skills = useCollection('skills')
  const t = useStudyTimer()
  const skill = skills.find((s) => s.id === t.state.skillId)
  const started = t.elapsed > 0
  const pickSkill = () =>
    actionSheet({
      title: 'Study for',
      options: [
        { label: 'No particular skill', onSelect: () => t.setSkill(undefined) },
        ...skills.filter((s) => s.status !== 'achieved').map((s) => ({ label: s.name, onSelect: () => t.setSkill(s.id) })),
      ],
    })
  return (
    <Section header="Focus timer" footer={started ? 'Stopping opens the session so you can check it before it’s saved.' : 'Keeps running if you close the app.'}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[44px] leading-none font-light tracking-tight text-ink tabular-nums" role="timer" aria-live="off" data-testid="study-timer-time">
            {t.hh}:{t.mm}:{t.ss}
          </p>
          <button type="button" onClick={pickSkill} className="ios-subhead -mb-3 -ml-1 flex min-h-11 max-w-full items-center truncate px-1 text-accent" data-testid="study-timer-skill">
            {skill ? skill.name : 'Choose a skill'}
          </button>
        </div>
        {started && (
          <button type="button" onClick={t.stop} aria-label="Stop and log" className="flex size-12 items-center justify-center rounded-full bg-[var(--ios-fill)] text-bad active:opacity-70" data-testid="study-timer-stop">
            <Square size={18} fill="currentColor" />
          </button>
        )}
        <button
          type="button"
          onClick={t.state.running ? t.pause : t.start}
          aria-label={t.state.running ? 'Pause' : started ? 'Resume' : 'Start'}
          className={cn('flex size-14 items-center justify-center rounded-full active:opacity-70', t.state.running ? 'bg-[var(--color-warn)]/20 text-warn' : 'bg-[var(--color-ok)]/20 text-ok')}
          data-testid="study-timer-toggle"
        >
          {t.state.running ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}
        </button>
      </div>
    </Section>
  )
}

function LevelDots({ level, target, color }: { level: number; target: number; color: string }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="h-1.5 w-4 rounded-full" style={{ background: n <= level ? color : n <= target ? 'var(--ios-fill-2)' : 'var(--ios-fill)' }} />
      ))}
    </span>
  )
}

function SkillCell({ skill }: { skill: Skill }) {
  const color = toneColor(skill.color)
  const prog = skillProgress(skill)
  return (
    <Cell
      title={skill.name}
      testId="m-skill-row"
      ariaLabel={`${skill.name}, ${proficiencyLabel(skill.level)}, level ${skill.level} of 5, target ${skill.targetLevel}`}
      subtitle={
        <span className="mt-1 flex items-center gap-2">
          <LevelDots level={skill.level} target={skill.targetLevel} color={color} />
          <span>
            {proficiencyLabel(skill.level)}
            {prog.roadmap !== null ? ` · ${Math.round(prog.roadmap)}% roadmap` : ''}
          </span>
        </span>
      }
      detail={skill.status !== 'active' ? SKILL_STATUSES.label(skill.status) : undefined}
      chevron
      onClick={() => nav.push(`more/learning/skill/${skill.id}`)}
    />
  )
}

export function LearningScreen() {
  const db = useDatabase()
  const today = useToday()
  const ws = db.settings.weekStartsOn
  const target = db.settings.targets.weeklyLearningMinutes
  const weekStart = weekStartISO(today, ws)
  const thisWeek = minutesInRange(db.studySessions, weekStart, today)
  // Compare with the same days of last week, so a part-way week isn't shown as a drop.
  const lastWeek = minutesInRange(db.studySessions, addDaysISO(weekStart, -7), addDaysISO(today, -7))
  const total = db.studySessions.reduce((n, s) => n + s.durationMin, 0)
  const [filter, setFilter] = useState<'all' | SkillStatus>('all')
  const skills = db.skills.filter((s) => filter === 'all' || s.status === filter)
  const weekly = useMemo(() => weeklyStudySeries(db.studySessions, today, 8, ws).map((w) => ({ ...w, label: formatDate(w.week, 'd MMM'), hours: Math.round((w.minutes / 60) * 10) / 10 })), [db.studySessions, today, ws])
  const history = useMemo(() => learningHistory(db).slice(0, 6), [db])
  const inProgress = db.learningCourses.filter((c) => c.status === 'in_progress')

  return (
    <Screen
      title="Learning"
      large
      testId="screen-learning"
      trailing={
        <NavButton
          label="Add"
          testId="learning-add"
          onClick={() =>
            actionSheet({
              title: 'Add',
              options: [
                { label: 'Skill', onSelect: () => editor.create('skills') },
                { label: 'Study Session', onSelect: () => editor.create('studySessions', { date: todayISO() }) },
                { label: 'Course', onSelect: () => editor.create('learningCourses') },
                { label: 'Resource', onSelect: () => editor.create('resources') },
              ],
            })
          }
        >
          <Plus size={26} />
        </NavButton>
      }
    >
      <TimerCard />
      <StatGrid>
        <StatTile label="This week" value={formatMinutes(thisWeek)} sub={target ? `${Math.round((thisWeek / target) * 100)}% of ${formatMinutes(target)}` : 'vs same days last week'} tone="cyan" current={thisWeek} previous={lastWeek} format={formatMinutes} />
        <StatTile label="Last 30 days" value={formatMinutes(minutesInRange(db.studySessions, addDaysISO(today, -29), today))} tone="violet" />
        <StatTile label="Total invested" value={formatHours(total)} sub={`${db.studySessions.length} sessions`} tone="lime" />
        <StatTile label="Skills developing" value={db.skills.filter((s) => s.status === 'active').length} sub={`${db.skills.filter((s) => s.status === 'achieved').length} achieved`} tone="amber" />
      </StatGrid>

      <div className="mb-3 px-4">
        <Chips<'all' | SkillStatus>
          ariaLabel="Filter skills"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All', count: db.skills.length }, ...SKILL_STATUSES.list.map((s) => ({ value: s.value, label: s.label, count: db.skills.filter((k) => k.status === s.value).length }))]}
        />
      </div>
      <Section header="Skills">
        {skills.length === 0 && <EmptyRow>{db.skills.length ? 'No skills with this status.' : 'Add a skill you want to develop — rate your level, give it a roadmap, and log study time against it.'}</EmptyRow>}
        {skills.map((s) => (
          <SkillCell key={s.id} skill={s} />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('skills')} testId="learning-add-skill">
          Add Skill
        </ActionCell>
      </Section>

      {inProgress.length > 0 && (
        <Section header="Courses in progress" headerAction={<SeeAll onClick={() => nav.push('more/learning/courses')} />}>
          {inProgress.map((c) => {
            const p = courseProgress(c)
            return <Cell key={c.id} title={c.title} subtitle={p === null ? c.provider : <ProgressLine value={p} className="mt-1.5" />} detail={p === null ? undefined : `${Math.round(p)}%`} chevron onClick={() => editor.edit('learningCourses', c.id)} />
          })}
        </Section>
      )}

      <Section>
        <Cell icon={Clock} iconTone="cyan" title="Study Sessions" detail={db.studySessions.length || undefined} chevron onClick={() => nav.push('more/learning/sessions')} />
        <Cell icon={GraduationCap} iconTone="violet" title="Courses" detail={db.learningCourses.length || undefined} chevron onClick={() => nav.push('more/learning/courses')} />
        <Cell icon={Library} iconTone="amber" title="Resources" detail={db.resources.filter((r) => r.status !== 'done').length || undefined} subtitle="Reading and watching queue" chevron onClick={() => nav.push('more/learning/resources')} />
      </Section>

      <div className="mx-4 mb-7">
        <ChartCard
          title="Time per week"
          description="Hours · last 8 weeks"
          rows={weekly}
          columns={[
            { label: 'Week of', value: (r) => formatDate(r.week, 'd MMM yyyy') },
            { label: 'Time', value: (r) => formatMinutes(r.minutes), align: 'right' },
          ]}
          empty={!weekly.some((w) => w.minutes)}
          emptyHint="Log study sessions (or use the timer) to see your learning time."
          height={170}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={8} />
              <YAxis {...axisProps} width={44} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}h`} formatLabel={(_l, r) => `Week of ${formatDate(String(r?.week), 'd MMM')}`} />} />
              <Bar dataKey="hours" name="Hours" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Section header="Recent learning">
        {history.length === 0 && <EmptyRow>Sessions, finished roadmap steps, completed courses and level-ups appear here.</EmptyRow>}
        {history.map((h, i) => (
          <Cell key={`${h.date}-${i}`} title={h.title} subtitle={`${relativeDay(h.date, today)}${h.detail ? ` · ${h.detail}` : ''}`} icon={h.kind === 'session' ? Clock : h.kind === 'course' ? GraduationCap : h.kind === 'level' ? BrainCircuit : BookMarked} iconTone={h.kind === 'level' ? 'amber' : h.kind === 'course' ? 'ok' : h.kind === 'step' ? 'violet' : 'cyan'} />
        ))}
      </Section>

      <NotesSection header="Learning notes" filter={(n) => n.area === 'learning' || !!n.skillId} defaults={{ area: 'learning' }} />
    </Screen>
  )
}

export function SkillScreen({ params }: { params: Record<string, string> }) {
  const skill = useRecord('skills', params.id)
  const db = useDatabase()
  const today = useToday()
  if (!skill) return <MissingScreen title="Skill" />
  const color = toneColor(skill.color)
  const prog = skillProgress(skill)
  const sessions = db.studySessions.filter((s) => s.skillId === skill.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const minutes = sessions.reduce((n, s) => n + s.durationMin, 0)
  const courses = db.learningCourses.filter((c) => c.skillId === skill.id)
  const resources = db.resources.filter((r) => r.skillId === skill.id)
  const update = (patch: Partial<Skill>) => actions.update('skills', skill.id, patch)
  const ring = prog.roadmap ?? prog.level

  return (
    <Screen title={skill.name} testId="screen-skill" trailing={<NavButton onClick={() => editor.edit('skills', skill.id)}>Edit</NavButton>}>
      <div className="flex items-center gap-4 px-4 pt-2 pb-5">
        <ProgressRing value={ring} size={84} stroke={8} tone={skill.color} label={`${Math.round(ring)}% ${prog.roadmap !== null ? 'of roadmap' : 'towards target level'}`}>
          <span className="ios-headline text-ink tabular-nums">{Math.round(ring)}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="ios-title2 text-ink">{skill.name}</p>
          <p className="ios-subhead text-ink-subtle">
            {[skill.category, SKILL_STATUSES.label(skill.status), `${formatMinutes(minutes)} invested`].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <Section header="Proficiency" footer={`Self-assessed. Target: ${skill.targetLevel}/5 · ${proficiencyLabel(skill.targetLevel)}. Changes are recorded in your learning history.`}>
        <div className="px-4 py-3">
          <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={`${skill.name} proficiency`}>
            {PROFICIENCY_LEVELS.map((l) => {
              const on = skill.level === l.value
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${l.value}: ${l.label}`}
                  onClick={() => update({ level: l.value })}
                  className={cn('flex h-11 items-center justify-center rounded-[10px] text-[17px] font-semibold tabular-nums transition-colors', on ? 'text-[var(--color-on-accent)]' : l.value <= skill.targetLevel && l.value > skill.level ? 'bg-[var(--ios-fill-2)] text-ink' : 'bg-[var(--ios-fill)] text-ink-muted')}
                  style={on ? { background: color, color: 'var(--color-canvas)' } : undefined}
                  data-testid="skill-level"
                >
                  {l.value}
                </button>
              )
            })}
          </div>
          <p className="ios-subhead mt-2 text-center text-ink" aria-live="polite">
            {proficiencyLabel(skill.level)}
          </p>
        </div>
        <Cell
          title="Status"
          detail={SKILL_STATUSES.label(skill.status)}
          chevron
          onClick={() => actionSheet({ title: 'Status', options: SKILL_STATUSES.list.map((s) => ({ label: s.label, onSelect: () => update({ status: s.value }) })) })}
        />
      </Section>

      <Section header={`Roadmap${skill.roadmap.length ? ` · ${skill.roadmap.filter((s) => s.done).length}/${skill.roadmap.length}` : ''}`}>
        {checklistRows(skill.roadmap, (roadmap) => update({ roadmap }), today, color)}
        {checklistAdd(skill.roadmap, (roadmap) => update({ roadmap }), 'Add a step')}
      </Section>

      {(skill.objectives || skill.description) && (
        <Section header="Objectives">
          <p className="ios-body whitespace-pre-wrap px-4 py-3 text-ink" data-selectable>
            {skill.objectives || skill.description}
          </p>
        </Section>
      )}

      <Section header="Study sessions" headerAction={<SeeAll label="Log" onClick={() => editor.create('studySessions', { date: todayISO(), skillId: skill.id })} />}>
        {sessions.length === 0 && <EmptyRow>No sessions logged for this skill yet.</EmptyRow>}
        {sessions.slice(0, 5).map((s) => (
          <Cell key={s.id} title={s.topic || 'Study session'} subtitle={relativeDay(s.date, today)} detail={formatMinutes(s.durationMin)} chevron onClick={() => editor.edit('studySessions', s.id)} />
        ))}
      </Section>

      <Section header="Courses">
        {courses.map((c) => {
          const p = courseProgress(c)
          return <Cell key={c.id} title={c.title} subtitle={COURSE_STATUSES.label(c.status)} detail={p === null ? undefined : `${Math.round(p)}%`} chevron onClick={() => editor.edit('learningCourses', c.id)} />
        })}
        <ActionCell icon={Plus} onClick={() => editor.create('learningCourses', { skillId: skill.id })}>
          Add Course
        </ActionCell>
      </Section>

      <Section header="Resources">
        {resources.map((r) => (
          <Cell key={r.id} title={r.title} subtitle={`${RESOURCE_KINDS.label(r.kind)} · ${RESOURCE_STATUSES.label(r.status)}`} chevron onClick={() => editor.edit('resources', r.id)} />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('resources', { skillId: skill.id })}>
          Add Resource
        </ActionCell>
      </Section>

      <NotesSection filter={(n) => n.skillId === skill.id} defaults={{ area: 'learning', skillId: skill.id }} />

      <Section>
        <ActionCell
          destructive
          testId="skill-delete"
          onClick={async () => {
            if (await deleteRecord('skills', skill.id)) nav.pop()
          }}
        >
          Delete Skill
        </ActionCell>
      </Section>
    </Screen>
  )
}

export function SessionsScreen() {
  const sessions = useCollection('studySessions')
  const skills = useCollection('skills')
  const courses = useCollection('learningCourses')
  const today = useToday()
  const name = (id?: string) => skills.find((s) => s.id === id)?.name
  return (
    <RecordScreen
      title="Study Sessions"
      collection="studySessions"
      testId="screen-sessions"
      defaults={{ date: todayISO() }}
      items={[...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))}
      search={(s) => `${s.topic ?? ''} ${s.notes ?? ''} ${name(s.skillId) ?? ''}`}
      group={(s) => s.date.slice(0, 7)}
      groupOrder={(a, b) => (a < b ? 1 : -1)}
      groupLabel={(k) => formatDate(`${k}-01`, 'MMMM yyyy')}
      empty="No study sessions yet. Use the focus timer, or add one with +."
      row={(s) => ({
        title: s.topic || name(s.skillId) || 'Study session',
        subtitle: [relativeDay(s.date, today), s.topic ? name(s.skillId) : undefined, courses.find((c) => c.id === s.courseId)?.title].filter(Boolean).join(' · '),
        detail: formatMinutes(s.durationMin),
      })}
    />
  )
}

const COURSE_ORDER: CourseStatus[] = ['in_progress', 'planned', 'completed', 'dropped']

export function CoursesScreen() {
  const courses = useCollection('learningCourses')
  const skills = useCollection('skills')
  return (
    <RecordScreen
      title="Courses"
      collection="learningCourses"
      testId="screen-courses"
      items={courses}
      search={(c) => `${c.title} ${c.provider ?? ''} ${c.notes ?? ''}`}
      group={(c) => c.status}
      groupOrder={(a, b) => COURSE_ORDER.indexOf(a as CourseStatus) - COURSE_ORDER.indexOf(b as CourseStatus)}
      groupLabel={(k) => COURSE_STATUSES.label(k as CourseStatus)}
      empty="Track online courses, bootcamps or certificates — with units completed if they have them."
      extraActions={(c) =>
        c.totalUnits && c.status !== 'completed'
          ? [{ label: '+1 Unit', icon: Plus, tone: 'cyan' as const, onAction: () => actions.update('learningCourses', c.id, { completedUnits: Math.min(c.totalUnits ?? 0, (c.completedUnits ?? 0) + 1), status: c.status === 'planned' ? 'in_progress' : c.status }) }]
          : []
      }
      row={(c) => {
        const p = courseProgress(c)
        return {
          title: c.title,
          subtitle: (
            <>
              {[c.provider, skills.find((s) => s.id === c.skillId)?.name, c.totalUnits ? `${c.completedUnits ?? 0}/${c.totalUnits} units` : undefined].filter(Boolean).join(' · ')}
              {p !== null && c.status !== 'completed' && <ProgressLine value={p} className="mt-1.5" />}
            </>
          ),
          detail: p === null ? undefined : `${Math.round(p)}%`,
        }
      }}
    />
  )
}

const RESOURCE_ORDER: ResourceStatus[] = ['in_progress', 'queued', 'done']

export function ResourcesScreen() {
  const resources = useCollection('resources')
  const skills = useCollection('skills')
  return (
    <RecordScreen
      title="Resources"
      collection="resources"
      testId="screen-resources"
      items={resources}
      search={(r) => `${r.title} ${r.notes ?? ''} ${r.url ?? ''}`}
      group={(r) => r.status}
      groupOrder={(a, b) => RESOURCE_ORDER.indexOf(a as ResourceStatus) - RESOURCE_ORDER.indexOf(b as ResourceStatus)}
      groupLabel={(k) => RESOURCE_STATUSES.label(k as ResourceStatus)}
      empty="Save articles, videos, docs and tools to work through."
      extraActions={(r) => [
        r.status === 'done'
          ? { label: 'Reopen', icon: BookMarked, tone: 'muted' as const, onAction: () => actions.update('resources', r.id, { status: 'queued' }) }
          : { label: 'Done', icon: BookMarked, tone: 'ok' as const, onAction: () => actions.update('resources', r.id, { status: 'done' }) },
      ]}
      row={(r) => ({
        title: r.title,
        subtitle: [RESOURCE_KINDS.label(r.kind), skills.find((s) => s.id === r.skillId)?.name].filter(Boolean).join(' · '),
        trailing: r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`Open ${r.title}`} className="flex size-11 items-center justify-center text-accent">
            <ExternalLink size={18} />
          </a>
        ) : undefined,
      })}
    />
  )
}
