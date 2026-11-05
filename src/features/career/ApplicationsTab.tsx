import { useMemo, useState } from 'react'
import { Briefcase, Building2, CalendarClock, ExternalLink, LayoutList, Plus, Columns3 } from 'lucide-react'
import { APPLICATION_STATUSES, OPEN_APPLICATION_STATUSES, type ApplicationStatus } from '@/data/constants'
import type { JobApplication } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState } from '@/components/ui/display'
import { Segmented, Select } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

function ApplicationCard({ a, today }: { a: JobApplication; today: string }) {
  const fmt = useFormatters()
  const companies = useCollection('companies')
  const research = companies.find((c) => c.name.trim().toLowerCase() === a.company.trim().toLowerCase())
  return (
    <article className="panel p-3.5" data-testid="application-card">
      <div className="flex items-start gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => editor.edit('applications', a.id)}>
          <p className="truncate text-[14px] font-medium text-ink">{a.role}</p>
          <p className="truncate text-[12.5px] text-ink-muted">
            {a.company}
            {a.location ? ` · ${a.location}` : ''}
          </p>
        </button>
        <RecordActions collection="applications" id={a.id} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Select size="sm" value={a.status} onChange={(e) => actions.update('applications', a.id, { status: e.target.value as ApplicationStatus, appliedDate: a.appliedDate ?? (e.target.value !== 'wishlist' ? today : undefined) })} aria-label={`Status for ${a.role} at ${a.company}`} className="w-36">
          {APPLICATION_STATUSES.list.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {a.salary && <Badge>{a.salary}</Badge>}
        {research && (
          <Badge tone="violet" title="Company research saved">
            <Building2 size={10} className="mr-0.5 inline" /> Researched
          </Badge>
        )}
      </div>
      {(a.nextStep || a.nextStepDate) && (
        <p className={cn('mt-2 inline-flex items-center gap-1 text-[12px]', a.nextStepDate && a.nextStepDate < today ? 'text-bad' : 'text-ink-muted')}>
          <CalendarClock size={12} />
          {a.nextStep ?? 'Next step'}
          {a.nextStepDate ? ` · ${relativeDay(a.nextStepDate, today)}` : ''}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-subtle">
        <span>{a.appliedDate ? `Applied ${fmt.date(a.appliedDate)}` : 'Not applied yet'}</span>
        {a.url && (
          <a href={a.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline">
            Listing <ExternalLink size={10} />
          </a>
        )}
      </div>
      {a.statusHistory.length > 1 && (
        <ol className="mt-2 flex flex-wrap items-center gap-1 text-[10.5px] text-ink-subtle" aria-label="Status history">
          {a.statusHistory.map((h, i) => (
            <li key={`${h.status}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>→</span>}
              <span title={new Date(h.at).toLocaleDateString()}>{APPLICATION_STATUSES.label(h.status)}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

export function ApplicationsTab({ today }: { today: string }) {
  const applications = useCollection('applications')
  const paths = useCollection('careerPaths')
  const [view, setView] = useState<'board' | 'list'>('board')
  const controls = useListControls<JobApplication>(applications, {
    search: (a) => `${a.company} ${a.role} ${a.location ?? ''} ${a.notes ?? ''}`,
    filters: [
      { key: 'status', label: 'Statuses', options: APPLICATION_STATUSES.list, get: (a) => a.status },
      { key: 'path', label: 'Career paths', options: paths.map((p) => ({ value: p.id, label: p.name })), get: (a) => a.careerPathId },
    ],
    sorts: [
      { value: 'updated', label: 'Last updated', get: (a) => a.updatedAt, dir: 'desc' },
      { value: 'applied', label: 'Applied date', get: (a) => a.appliedDate, dir: 'desc' },
      { value: 'next', label: 'Next step date', get: (a) => a.nextStepDate },
      { value: 'company', label: 'Company', get: (a) => a.company },
    ],
  })
  const columns = useMemo(() => {
    const closed: ApplicationStatus[] = ['accepted', 'rejected', 'withdrawn']
    return [...OPEN_APPLICATION_STATUSES.map((s) => ({ id: s, statuses: [s] })), { id: 'closed', statuses: closed }]
  }, [])

  if (!applications.length) {
    return (
      <Panel>
        <EmptyState
          icon={Briefcase}
          title="No job applications yet"
          description="Track roles from wishlist to offer. Status changes are recorded automatically so you can see your history and pipeline."
          action={
            <Button variant="primary" icon={Plus} onClick={() => editor.create('applications')}>
              Add an application
            </Button>
          }
        />
      </Panel>
    )
  }

  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search company or role…" total={applications.length}>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          ariaLabel="Layout"
          options={[
            { value: 'board', label: <Columns3 size={14} aria-label="Pipeline" />, title: 'Pipeline' },
            { value: 'list', label: <LayoutList size={14} aria-label="List" />, title: 'List' },
          ]}
        />
      </ListToolbar>
      {view === 'board' ? (
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {/* Six stages: all in a row on wide screens, wrapping into rows on laptops and tablets — never sideways scrolling. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {columns.map((col) => {
              const list = controls.results.filter((a) => col.statuses.includes(a.status))
              const label = col.id === 'closed' ? 'Closed' : APPLICATION_STATUSES.label(col.id as ApplicationStatus)
              return (
                <div key={col.id} className="min-w-0">
                  <p className="eyebrow mb-2 flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: toneColor(col.id === 'closed' ? 'muted' : APPLICATION_STATUSES.tone(col.id as ApplicationStatus)) }} />
                      {label}
                    </span>
                    <span>{list.length}</span>
                  </p>
                  <div className="space-y-2.5">
                    {list.map((a) => (
                      <ApplicationCard key={a.id} a={a} today={today} />
                    ))}
                    {list.length === 0 && <p className="rounded-lg border border-dashed border-line px-2 py-6 text-center text-[11.5px] text-ink-subtle">None</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {applications.length > 0 && controls.results.length === 0 && <EmptyState compact icon={Briefcase} title="No applications match your search or filters" description="Try clearing the search or filters." />}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {controls.results.map((a) => (
              <ApplicationCard key={a.id} a={a} today={today} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
