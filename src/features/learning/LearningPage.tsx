import { useMemo } from 'react'
import { BookMarked, BrainCircuit, Clock, ExternalLink, GraduationCap, History, LayoutDashboard, Library, Plus, StickyNote } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COURSE_STATUSES, RESOURCE_KINDS, RESOURCE_STATUSES, SKILL_STATUSES, proficiencyLabel } from '@/data/constants'
import type { LearningCourse, LearningResource, StudySession } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { useToday } from '@/hooks/useNow'
import { courseProgress, learningHistory, minutesBySkill, minutesInRange, skillProgress, weeklyStudySeries } from '@/selectors/learning'
import { addDaysISO, formatDate, weekStartISO } from '@/lib/dates'
import { formatHours, formatMinutes } from '@/lib/format'
import { toneColor } from '@/lib/tone'
import { truncate } from '@/lib/utils'
import { actions, useCollection, useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { Checklist } from '@/components/shared/Checklist'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { NotesPanel } from '@/components/shared/NotesPanel'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'
import { StudyTimer } from './StudyTimer'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'skills', label: 'Skills', icon: BrainCircuit },
  { id: 'courses', label: 'Courses', icon: GraduationCap },
  { id: 'sessions', label: 'Study sessions', icon: Clock },
  { id: 'resources', label: 'Resources', icon: Library },
  { id: 'notes', label: 'Notes', icon: StickyNote },
] as const

function Overview({ today }: { today: string }) {
  const db = useDatabase()
  const ws = db.settings.weekStartsOn
  const weekly = useMemo(() => weeklyStudySeries(db.studySessions, today, 12, ws).map((w) => ({ ...w, label: formatDate(w.week, 'd MMM'), hours: Math.round((w.minutes / 60) * 10) / 10 })), [db.studySessions, today, ws])
  const bySkill = useMemo(() => minutesBySkill(db.studySessions, db.skills).map((r) => ({ ...r, hours: Math.round((r.minutes / 60) * 10) / 10, short: truncate(r.name, 18) })), [db.studySessions, db.skills])
  const proficiency = db.skills.filter((s) => s.status !== 'paused').map((s) => ({ name: truncate(s.name, 18), full: s.name, level: s.level, target: s.targetLevel }))
  const history = useMemo(() => learningHistory(db).slice(0, 25), [db])
  const weekStart = weekStartISO(today, ws)
  const thisWeek = minutesInRange(db.studySessions, weekStart, today)
  const target = db.settings.targets.weeklyLearningMinutes
  const total = db.studySessions.reduce((n, s) => n + s.durationMin, 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="This week" value={formatMinutes(thisWeek)} icon={Clock} tone="cyan" sub={target ? `${Math.round((thisWeek / target) * 100)}% of ${formatMinutes(target)} target` : 'Set a weekly target in Settings'}>
          {target ? <ProgressBar value={(thisWeek / target) * 100} size="xs" className="mt-2" label="Weekly learning target" /> : null}
        </Stat>
        <Stat label="Last 30 days" value={formatMinutes(minutesInRange(db.studySessions, addDaysISO(today, -29), today))} tone="violet" />
        <Stat label="Total invested" value={formatHours(total)} tone="lime" sub={`${db.studySessions.length} sessions`} />
        <Stat label="Skills developing" value={db.skills.filter((s) => s.status === 'active').length} icon={BrainCircuit} tone="amber" sub={`${db.skills.filter((s) => s.status === 'achieved').length} achieved`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Time invested per week"
            description="Hours · last 12 weeks"
            rows={weekly}
            columns={[
              { label: 'Week of', value: (r) => formatDate(r.week, 'd MMM yyyy') },
              { label: 'Time', value: (r) => formatMinutes(r.minutes), align: 'right' },
            ]}
            empty={!weekly.some((w) => w.minutes)}
            emptyHint="Log study sessions (or use the timer) to see your learning time."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                <YAxis {...axisProps} />
                <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}h`} formatLabel={(_l, r) => `Week of ${formatDate(String(r?.week), 'd MMM')}`} />} />
                <Bar dataKey="hours" name="Hours" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Time by skill"
            description="All time"
            rows={bySkill}
            columns={[
              { label: 'Skill', value: (r) => r.name },
              { label: 'Time', value: (r) => formatMinutes(r.minutes), align: 'right' },
            ]}
            empty={bySkill.length === 0}
            height={Math.max(160, Math.min(bySkill.length, 8) * 32)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySkill.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="short" width={120} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}h`} formatLabel={(_l, r) => String(r?.name)} />} />
                <Bar dataKey="hours" name="Hours" fill={series(3)} radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Proficiency vs target"
            description="Your self-assessed level (0–5)"
            legend={[
              { label: 'Current', color: series(0) },
              { label: 'Target', color: series(4) },
            ]}
            rows={proficiency}
            columns={[
              { label: 'Skill', value: (r) => r.full },
              { label: 'Current', value: (r) => `${r.level} · ${proficiencyLabel(r.level)}`, align: 'right' },
              { label: 'Target', value: (r) => r.target, align: 'right' },
            ]}
            empty={proficiency.length === 0}
            className="lg:col-span-2"
            height={Math.max(160, proficiency.length * 30)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proficiency} layout="vertical" barGap={2} margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axisProps} />
                <YAxis type="category" dataKey="name" width={130} {...axisProps} tick={{ ...axisProps.tick, fontFamily: 'var(--font-sans)', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatLabel={(_l, r) => String(r?.full)} />} />
                <Bar dataKey="level" name="Current" fill={series(0)} radius={[0, 4, 4, 0]} maxBarSize={10} />
                <Bar dataKey="target" name="Target" fill={series(4)} radius={[0, 4, 4, 0]} maxBarSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="space-y-4">
          <StudyTimer />
          <Panel title="Learning history" icon={History}>
            {history.length === 0 ? (
              <p className="text-[12.5px] text-ink-subtle">Sessions, completed roadmap steps, finished courses and level-ups appear here.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-4">
                {history.map((h, i) => (
                  <li key={`${h.date}-${i}`} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-canvas" style={{ background: h.kind === 'level' ? 'var(--color-amber)' : h.kind === 'course' ? 'var(--color-ok)' : h.kind === 'step' ? 'var(--color-violet)' : 'var(--color-accent)' }} />
                    <p className="text-[13px] text-ink">{h.title}</p>
                    <p className="text-[11px] text-ink-subtle">
                      {formatDate(h.date, 'd MMM yyyy')}
                      {h.detail ? ` · ${h.detail}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function SkillsTab({ today }: { today: string }) {
  const skills = useCollection('skills')
  const sessions = useCollection('studySessions')
  const courses = useCollection('learningCourses')
  if (!skills.length) {
    return (
      <Panel>
        <EmptyState icon={BrainCircuit} title="No skills yet" description="Add a skill you want to develop. Give it a roadmap and objectives, rate your proficiency, and log study time against it." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('skills')}>Add a skill</Button>} />
      </Panel>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {skills.map((s) => {
          const prog = skillProgress(s)
          const minutes = sessions.filter((x) => x.skillId === s.id).reduce((n, x) => n + x.durationMin, 0)
          const skillCourses = courses.filter((c) => c.skillId === s.id)
          return (
            <Panel key={s.id} title={s.name} eyebrow={s.category} actions={<RecordActions collection="skills" id={s.id} />}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone={SKILL_STATUSES.tone(s.status)} dot>
                  {SKILL_STATUSES.label(s.status)}
                </Badge>
                <Badge tone="cyan">{formatMinutes(minutes)} invested</Badge>
                {skillCourses.length > 0 && <Badge>{skillCourses.length} course{skillCourses.length === 1 ? '' : 's'}</Badge>}
              </div>
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-ink-muted">
                    Proficiency: <span className="text-ink">{proficiencyLabel(s.level)}</span> ({s.level}/5) → target {s.targetLevel}/5
                  </span>
                </div>
                <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} proficiency`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={s.level === n}
                      aria-label={`Set level ${n}: ${proficiencyLabel(n)}`}
                      title={`Set level ${n}: ${proficiencyLabel(n)}`}
                      onClick={() => actions.update('skills', s.id, { level: s.level === n ? n - 1 : n })}
                      className="h-2.5 flex-1 rounded-full transition-all hover:scale-y-150"
                      style={{
                        background: n <= s.level ? toneColor(s.color) : n <= s.targetLevel ? 'color-mix(in oklab, var(--color-ink) 14%, transparent)' : 'color-mix(in oklab, var(--color-ink) 6%, transparent)',
                        boxShadow: n <= s.level ? `0 0 8px ${toneColor(s.color)}` : undefined,
                        outline: n === s.targetLevel ? '1px dashed var(--color-ink-subtle)' : undefined,
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-subtle">Click a bar to update your level — changes are kept as history.</p>
              </div>
              {s.objectives && (
                <div className="mb-3">
                  <p className="eyebrow mb-1">Objectives</p>
                  <p className="text-[13px] whitespace-pre-line text-ink-muted">{s.objectives}</p>
                </div>
              )}
              <p className="eyebrow mb-1.5">Roadmap {prog.roadmap !== null && `· ${Math.round(prog.roadmap)}%`}</p>
              <Checklist items={s.roadmap} onChange={(roadmap) => actions.update('skills', s.id, { roadmap })} today={today} placeholder="Add a roadmap step…" emptyText="Plan the steps from where you are to your target." tone={toneColor(s.color)} />
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="xs" variant="subtle" icon={Clock} onClick={() => editor.create('studySessions', { skillId: s.id })}>
                  Log study
                </Button>
                <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('resources', { skillId: s.id })}>
                  Resource
                </Button>
                <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('notes', { skillId: s.id, area: 'learning' })}>
                  Note
                </Button>
              </div>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

function CoursesTab() {
  const courses = useCollection('learningCourses')
  const skills = useCollection('skills')
  const controls = useListControls<LearningCourse>(courses, {
    search: (c) => `${c.title} ${c.provider ?? ''} ${c.notes ?? ''}`,
    filters: [
      { key: 'status', label: 'Statuses', options: COURSE_STATUSES.list, get: (c) => c.status },
      { key: 'skill', label: 'Skills', options: skills.map((s) => ({ value: s.id, label: s.name })), get: (c) => c.skillId },
    ],
    sorts: [
      { value: 'updated', label: 'Last updated', get: (c) => c.updatedAt, dir: 'desc' },
      { value: 'progress', label: 'Progress', get: (c) => courseProgress(c) ?? -1, dir: 'desc' },
      { value: 'title', label: 'Title', get: (c) => c.title },
    ],
  })
  if (!courses.length) {
    return (
      <Panel>
        <EmptyState icon={GraduationCap} title="No courses yet" description="Online courses, bootcamps, books-as-courses — track lessons completed." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('learningCourses')}>Add course</Button>} />
      </Panel>
    )
  }
  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search courses…" total={courses.length}>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('learningCourses')}>
          Course
        </Button>
      </ListToolbar>
      {courses.length > 0 && controls.results.length === 0 && <EmptyState compact icon={GraduationCap} title="No courses match your search or filters" description="Try clearing the search or filters." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {controls.results.map((c) => {
          const p = courseProgress(c)
          const skill = skills.find((s) => s.id === c.skillId)
          return (
            <article key={c.id} className="panel flex flex-col p-4">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => editor.edit('learningCourses', c.id)} className="min-w-0 flex-1 text-left">
                  <p className="text-[14px] font-medium text-ink">{c.title}</p>
                  <p className="text-[12px] text-ink-subtle">{[c.provider, skill?.name].filter(Boolean).join(' · ')}</p>
                </button>
                <RecordActions collection="learningCourses" id={c.id} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={COURSE_STATUSES.tone(c.status)}>{COURSE_STATUSES.label(c.status)}</Badge>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                    Open <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="mt-auto pt-3">
                <ProgressBar value={p} showValue size="sm" label={`${c.title} progress`} />
                {c.totalUnits && c.status !== 'completed' && (
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-subtle">
                    <span>
                      {c.completedUnits ?? 0}/{c.totalUnits} lessons
                    </span>
                    <Button size="xs" variant="subtle" className="ml-auto" disabled={(c.completedUnits ?? 0) >= c.totalUnits} onClick={() => actions.update('learningCourses', c.id, { completedUnits: Math.min(c.totalUnits ?? 0, (c.completedUnits ?? 0) + 1), status: c.status === 'planned' ? 'in_progress' : c.status })}>
                      +1 lesson
                    </Button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function SessionsTab() {
  const sessions = useCollection('studySessions')
  const skills = useCollection('skills')
  const courses = useCollection('learningCourses')
  const fmt = useFormatters()
  const controls = useListControls<StudySession>(sessions, {
    search: (s) => `${s.topic ?? ''} ${s.notes ?? ''}`,
    filters: [{ key: 'skill', label: 'Skills', options: skills.map((s) => ({ value: s.id, label: s.name })), get: (s) => s.skillId }],
    sorts: [
      { value: 'date', label: 'Date', get: (s) => `${s.date}${s.createdAt}`, dir: 'desc' },
      { value: 'duration', label: 'Duration', get: (s) => s.durationMin, dir: 'desc' },
    ],
  })
  const total = controls.results.reduce((n, s) => n + s.durationMin, 0)
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <ListToolbar controls={controls} placeholder="Search topics and notes…" total={sessions.length} />
        {sessions.length > 0 && <p className="mb-2 font-mono text-[12px] text-ink-muted">{formatMinutes(total)} in shown sessions</p>}
        <Panel padded={false}>
          {controls.results.length === 0 ? (
            <EmptyState compact icon={Clock} title={sessions.length ? 'No sessions match' : 'No study sessions yet'} description="Log time spent learning, or use the study timer." />
          ) : (
            <ul className="divide-y divide-line">
              {controls.results.map((s) => {
                const skill = skills.find((k) => k.id === s.skillId)
                const course = courses.find((c) => c.id === s.courseId)
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-24 shrink-0 font-mono text-[12px] text-ink-muted">{fmt.date(s.date)}</span>
                    <button type="button" onClick={() => editor.edit('studySessions', s.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13.5px] text-ink">{s.topic || 'Study session'}</p>
                      <p className="truncate text-[11.5px] text-ink-subtle">{[skill?.name, course?.title].filter(Boolean).join(' · ') || 'No skill'}</p>
                    </button>
                    <span className="font-mono text-[12.5px] text-ink tabular">{formatMinutes(s.durationMin)}</span>
                    <RecordActions collection="studySessions" id={s.id} duplicate />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
      <StudyTimer />
    </div>
  )
}

function ResourcesTab() {
  const resources = useCollection('resources')
  const skills = useCollection('skills')
  const controls = useListControls<LearningResource>(resources, {
    search: (r) => `${r.title} ${r.notes ?? ''} ${r.url ?? ''}`,
    filters: [
      { key: 'status', label: 'Statuses', options: RESOURCE_STATUSES.list, get: (r) => r.status },
      { key: 'kind', label: 'Types', options: RESOURCE_KINDS.list, get: (r) => r.kind },
      { key: 'skill', label: 'Skills', options: skills.map((s) => ({ value: s.id, label: s.name })), get: (r) => r.skillId },
    ],
    sorts: [
      { value: 'updated', label: 'Last updated', get: (r) => r.updatedAt, dir: 'desc' },
      { value: 'title', label: 'Title', get: (r) => r.title },
    ],
  })
  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search resources…" total={resources.length}>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('resources')}>
          Resource
        </Button>
      </ListToolbar>
      <Panel padded={false}>
        {controls.results.length === 0 ? (
          <EmptyState compact icon={BookMarked} title={resources.length ? 'No resources match' : 'No learning resources yet'} description="Save articles, videos, docs and tools to learn from." />
        ) : (
          <ul className="divide-y divide-line">
            {controls.results.map((r) => {
              const skill = skills.find((s) => s.id === r.skillId)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => editor.edit('resources', r.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13.5px] text-ink">{r.title}</p>
                    <p className="truncate text-[11.5px] text-ink-subtle">{[RESOURCE_KINDS.label(r.kind), skill?.name].filter(Boolean).join(' · ')}</p>
                  </button>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-accent" aria-label={`Open ${r.title}`}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => actions.update('resources', r.id, { status: r.status === 'queued' ? 'in_progress' : r.status === 'in_progress' ? 'done' : 'queued' })}
                    title="Click to advance status"
                  >
                    <Badge tone={RESOURCE_STATUSES.tone(r.status)}>{RESOURCE_STATUSES.label(r.status)}</Badge>
                  </button>
                  <RecordActions collection="resources" id={r.id} />
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export default function LearningPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'overview')
  const db = useDatabase()
  return (
    <div>
      <PageHeader
        section="learning"
        description="Skills with their own roadmaps and objectives, courses, study time and resources — with a history of everything you've learned."
        actions={
          <>
            <Button icon={Clock} onClick={() => editor.create('studySessions')}>
              Log study
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => editor.create('skills')}>
              Skill
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'skills' ? db.skills.length : t.id === 'courses' ? db.learningCourses.length : t.id === 'resources' ? db.resources.filter((r) => r.status !== 'done').length : undefined }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'overview' && <Overview today={today} />}
      {tab === 'skills' && <SkillsTab today={today} />}
      {tab === 'courses' && <CoursesTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'resources' && <ResourcesTab />}
      {tab === 'notes' && <NotesPanel title="Learning notes" filter={(n) => n.area === 'learning' || !!n.skillId} defaults={{ area: 'learning' }} emptyText="Notes from courses, books and practice." limit={300} />}
    </div>
  )
}
