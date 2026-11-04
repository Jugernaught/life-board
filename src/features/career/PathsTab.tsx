import { useState } from 'react'
import { Compass, Plus } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { APPLICATION_STATUSES, CAREER_CRITERIA, CAREER_PATH_STATUSES } from '@/data/constants'
import { averageScore, careerPathProgress } from '@/selectors/career'
import { relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar } from '@/components/ui/display'
import { Segmented } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ChartCard, ChartTooltip, series } from '@/components/charts/ChartKit'
import { Checklist } from '@/components/shared/Checklist'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

export function PathsTab({ today }: { today: string }) {
  const paths = useCollection('careerPaths')
  const milestones = useCollection('careerMilestones')
  const applications = useCollection('applications')
  const [view, setView] = useState<'paths' | 'compare'>('paths')

  if (!paths.length) {
    return (
      <Panel>
        <EmptyState
          icon={Compass}
          title="No career paths yet"
          description="Track one or several directions at once — each with its own roadmap, milestones and applications. Score them to compare side by side."
          action={
            <Button variant="primary" icon={Plus} onClick={() => editor.create('careerPaths')}>
              Add a career path
            </Button>
          }
        />
      </Panel>
    )
  }

  const compared = paths.filter((p) => p.status !== 'archived').slice(0, 6)
  const radar = CAREER_CRITERIA.list.map((c) => ({ criterion: c.label, ...Object.fromEntries(compared.map((p) => [p.id, p.scores[c.value] ?? 0])) }))
  const anyScores = compared.some((p) => Object.keys(p.scores).length > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={view} onChange={setView} ariaLabel="View" options={[{ value: 'paths', label: 'Paths & roadmaps' }, { value: 'compare', label: 'Compare paths' }]} />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => editor.create('careerPaths')}>
          Career path
        </Button>
      </div>
      {view === 'paths' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {paths.map((p) => {
            const prog = careerPathProgress(p, milestones)
            const apps = applications.filter((a) => a.careerPathId === p.id)
            const linked = milestones.filter((m) => m.careerPathId === p.id)
            return (
              <Panel key={p.id} title={p.name} eyebrow={p.targetRole ? `Target: ${p.targetRole}` : undefined} actions={<RecordActions collection="careerPaths" id={p.id} />} hud={p.status === 'active'}>
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={CAREER_PATH_STATUSES.tone(p.status)} dot>
                    {CAREER_PATH_STATUSES.label(p.status)}
                  </Badge>
                  {p.targetDate && <Badge>Target {relativeDay(p.targetDate, today)}</Badge>}
                  {averageScore(p) !== null && <Badge tone="violet">Avg score {averageScore(p)?.toFixed(1)}/5</Badge>}
                  <Badge tone="info">{apps.length} application{apps.length === 1 ? '' : 's'}</Badge>
                </div>
                {p.description && <p className="mb-3 line-clamp-3 text-[13px] text-ink-muted">{p.description}</p>}
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[12px] text-ink-subtle">
                    <span>Roadmap & milestones</span>
                    <span className="font-mono tabular">{prog.total ? `${prog.done}/${prog.total}` : '—'}</span>
                  </div>
                  <ProgressBar value={prog.pct} tone={p.color} size="sm" label={`${p.name} progress`} />
                </div>
                <p className="eyebrow mb-1.5">Roadmap</p>
                <Checklist items={p.roadmap} onChange={(roadmap) => actions.update('careerPaths', p.id, { roadmap })} today={today} placeholder="Add a roadmap step…" emptyText="Break the long-term path into steps." tone={toneColor(p.color)} />
                {linked.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="eyebrow mb-1.5">Linked milestones</p>
                    <ul className="space-y-1 text-[13px]">
                      {linked.map((m) => (
                        <li key={m.id} className={m.done ? 'text-ink-subtle line-through' : 'text-ink'}>
                          {m.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {apps.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="eyebrow mb-1.5">Applications</p>
                    <ul className="space-y-1">
                      {apps.slice(0, 5).map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-[13px]">
                          <span className="min-w-0 flex-1 truncate text-ink">
                            {a.role} — {a.company}
                          </span>
                          <Badge tone={APPLICATION_STATUSES.tone(a.status)}>{APPLICATION_STATUSES.label(a.status)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ChartCard
            title="Career comparison"
            description="Your own 1–5 scores for each factor"
            legend={compared.map((p, i) => ({ label: p.name, color: series(i) }))}
            rows={[...CAREER_CRITERIA.list]}
            columns={[{ label: 'Factor', value: (c) => c.label }, ...compared.map((p) => ({ label: p.name, value: (c: (typeof CAREER_CRITERIA.list)[number]) => p.scores[c.value] ?? '—', align: 'right' as const }))]}
            empty={!anyScores}
            emptyHint="Edit a career path and fill in its comparison scores."
            height={320}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--color-line-strong)" />
                <PolarAngleAxis dataKey="criterion" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 9 }} axisLine={false} />
                <Tooltip content={(props) => <ChartTooltip {...(props as object)} formatValue={(v) => (v ? `${v}/5` : 'not scored')} />} />
                {compared.map((p, i) => (
                  <Radar key={p.id} dataKey={p.id} name={p.name} stroke={series(i)} fill={series(i)} fillOpacity={0.12} strokeWidth={2} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
          <Panel title="Side by side">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-subtle">
                    <th className="py-2 pr-2 font-medium">Factor</th>
                    {compared.map((p) => (
                      <th key={p.id} className="px-2 py-2 text-center font-medium text-ink">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAREER_CRITERIA.list.map((c) => {
                    const best = Math.max(...compared.map((p) => p.scores[c.value] ?? 0))
                    return (
                      <tr key={c.value} className="border-b border-line/60">
                        <td className="py-2 pr-2 text-ink-muted">{c.label}</td>
                        {compared.map((p) => {
                          const v = p.scores[c.value]
                          return (
                            <td key={p.id} className={`px-2 py-2 text-center font-mono tabular ${v && v === best ? 'text-accent' : 'text-ink'}`}>
                              {v ?? <span className="text-ink-subtle">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  <tr>
                    <td className="py-2 pr-2 font-medium text-ink">Average</td>
                    {compared.map((p) => (
                      <td key={p.id} className="px-2 py-2 text-center font-mono font-semibold text-ink tabular">
                        {averageScore(p)?.toFixed(1) ?? '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-ink-muted">Roadmap progress</td>
                    {compared.map((p) => {
                      const prog = careerPathProgress(p, milestones)
                      return (
                        <td key={p.id} className="px-2 py-2 text-center font-mono text-ink tabular">
                          {prog.pct === null ? '—' : `${Math.round(prog.pct)}%`}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-ink-subtle">Highlighted values are the highest for each factor. Scores are your own judgement — edit a path to change them.</p>
          </Panel>
        </div>
      )}
    </div>
  )
}
