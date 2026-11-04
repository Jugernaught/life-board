import { useMemo } from 'react'
import { Award, Briefcase, Building2, CalendarClock, Compass, Flag, GraduationCap, LayoutDashboard, MessagesSquare, Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CAREER_PATH_STATUSES } from '@/data/constants'
import { useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { applicationFunnel, careerPathProgress, courseGrade } from '@/selectors/career'
import { addDaysISO } from '@/lib/dates'
import { useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { AgendaList } from '@/components/shared/AgendaList'
import { editor } from '@/components/editor/editorStore'
import { ApplicationsTab } from './ApplicationsTab'
import { EducationTab } from './EducationTab'
import { PathsTab } from './PathsTab'
import { CompaniesTab, InterviewTab, MilestonesTab } from './PrepTabs'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'paths', label: 'Career paths', icon: Compass },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'applications', label: 'Applications', icon: Briefcase },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'interviews', label: 'Interview prep', icon: MessagesSquare },
  { id: 'milestones', label: 'CV & portfolio', icon: Flag },
] as const

function Overview({ today }: { today: string }) {
  const db = useDatabase()
  const funnel = applicationFunnel(db.applications)
  const deadlines = useMemo(
    () => buildAgenda(db, today, addDaysISO(today, 30), today).filter((i) => ['assessments', 'applications', 'careerMilestones'].includes(i.sourceKey) || (i.sourceKey === 'goals' && i.area === 'career')),
    [db, today],
  )
  const funnelRows = [
    { stage: 'Applied', count: funnel.applied },
    { stage: 'Interviewing', count: funnel.interviewing },
    { stage: 'Offers', count: funnel.offers },
    { stage: 'Accepted', count: funnel.accepted },
  ]
  const nothing = !db.careerPaths.length && !db.applications.length && !db.academicCourses.length && !db.modules.length && !db.qualifications.length && !db.careerMilestones.length
  if (nothing) {
    return (
      <Panel>
        <EmptyState
          icon={Compass}
          title="Start mapping your career & studies"
          description="Add career paths you're considering, your course and modules, job applications, or CV and portfolio milestones."
          action={
            <>
              <Button variant="primary" icon={Plus} onClick={() => editor.create('careerPaths')}>
                Career path
              </Button>
              <Button icon={Plus} onClick={() => editor.create('academicCourses')}>
                Course
              </Button>
              <Button icon={Plus} onClick={() => editor.create('applications')}>
                Application
              </Button>
            </>
          }
        />
      </Panel>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Career paths" value={db.careerPaths.filter((p) => p.status !== 'archived').length} icon={Compass} tone="cyan" sub={`${db.careerPaths.filter((p) => p.status === 'active').length} being pursued`} />
        <Stat label="Open applications" value={funnel.open} icon={Briefcase} tone="violet" sub={`${funnel.total} tracked in total`} />
        <Stat label="Upcoming deadlines" value={deadlines.length} icon={CalendarClock} tone="magenta" sub="Next 30 days" />
        <Stat label="Qualifications" value={db.qualifications.filter((q) => q.status === 'completed').length} icon={Award} tone="lime" sub={`${db.qualifications.filter((q) => q.status === 'in_progress').length} in progress`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Career paths" icon={Compass}>
          {db.careerPaths.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">No career paths yet.</p>
          ) : (
            <ul className="space-y-3">
              {db.careerPaths
                .filter((p) => p.status !== 'archived')
                .map((p) => {
                  const prog = careerPathProgress(p, db.careerMilestones)
                  return (
                    <li key={p.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{p.name}</span>
                        <Badge tone={CAREER_PATH_STATUSES.tone(p.status)}>{CAREER_PATH_STATUSES.label(p.status)}</Badge>
                      </div>
                      <ProgressBar value={prog.pct} tone={p.color} size="sm" showValue label={`${p.name} progress`} />
                    </li>
                  )
                })}
            </ul>
          )}
        </Panel>
        <Panel title="Deadlines · next 30 days" icon={CalendarClock}>
          {deadlines.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">No assignment, exam, interview or milestone deadlines in the next 30 days.</p>
          ) : (
            <div className="-mx-2 max-h-80 overflow-y-auto">
              <AgendaList items={deadlines} today={today} />
            </div>
          )}
        </Panel>
        <ChartCard
          title="Application pipeline"
          description="How many applications reached each stage"
          rows={funnelRows}
          columns={[
            { label: 'Stage', value: (r) => r.stage },
            { label: 'Applications', value: (r) => r.count, align: 'right' },
          ]}
          empty={funnel.total === 0}
          emptyHint="Track job applications to see your pipeline."
          height={200}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelRows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="stage" {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} />} />
              <Bar dataKey="count" name="Applications" fill={series(0)} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Panel title="Grades" icon={GraduationCap}>
          {db.academicCourses.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">Add a course and graded assessments to track your average.</p>
          ) : (
            <ul className="space-y-3">
              {db.academicCourses.map((c) => {
                const g = courseGrade(c.id, db.modules, db.assessments)
                return (
                  <li key={c.id}>
                    <div className="mb-1 flex justify-between gap-2 text-[13.5px]">
                      <span className="truncate text-ink">{c.name}</span>
                      <span className="font-mono text-[12.5px] text-ink-muted tabular">
                        {g === null ? 'No grades yet' : `${g.toFixed(1)}%`}
                        {c.targetGrade !== undefined && <span className="text-ink-subtle"> · target {c.targetGrade}%</span>}
                      </span>
                    </div>
                    <ProgressBar value={g} tone={g !== null && c.targetGrade !== undefined && g < c.targetGrade ? 'warn' : 'ok'} size="sm" label={`${c.name} average`} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default function CareerPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'overview')
  const db = useDatabase()
  const counts: Record<string, number> = {
    paths: db.careerPaths.length,
    applications: db.applications.length,
    companies: db.companies.length,
    interviews: db.interviewQuestions.length,
    milestones: db.careerMilestones.filter((m) => !m.done).length,
  }
  return (
    <div>
      <PageHeader
        section="career"
        description="Career paths and roadmaps, university courses and grades, job applications, company research, interview prep and CV milestones — side by side."
        actions={
          <>
            <Button icon={Plus} onClick={() => editor.create('assessments')}>
              Deadline
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => editor.create('applications')}>
              Application
            </Button>
          </>
        }
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'overview' && <Overview today={today} />}
      {tab === 'paths' && <PathsTab today={today} />}
      {tab === 'education' && <EducationTab today={today} />}
      {tab === 'applications' && <ApplicationsTab today={today} />}
      {tab === 'companies' && <CompaniesTab />}
      {tab === 'interviews' && <InterviewTab today={today} />}
      {tab === 'milestones' && <MilestonesTab today={today} />}
    </div>
  )
}
