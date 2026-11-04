import { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CalendarHeart, HandHeart, HeartHandshake, NotebookPen, PartyPopper, Plus, Target, Users } from 'lucide-react'
import { CIRCLES, OCCASION_KINDS } from '@/data/constants'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { nextOccurrence, reconnectStatus, upcomingOccasions } from '@/selectors/social'
import { sortTasks } from '@/selectors/tasks'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection, useDatabase } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { AgendaList } from '@/components/shared/AgendaList'
import { NotesPanel } from '@/components/shared/NotesPanel'
import { RecordActions } from '@/components/shared/RecordActions'
import { TaskItem } from '@/components/shared/TaskItem'
import { editor } from '@/components/editor/editorStore'
import { GoalCard } from '@/features/goals/GoalCard'
import { InlineAdd } from '@/features/command-centre/widgets/Widget'

const TABS = [
  { id: 'upcoming', label: 'Upcoming', icon: CalendarHeart },
  { id: 'people', label: 'Reconnect', icon: Users },
  { id: 'dates', label: 'Important dates', icon: PartyPopper },
  { id: 'commitments', label: 'Commitments', icon: HandHeart },
  { id: 'goals', label: 'Social goals', icon: Target },
  { id: 'reflections', label: 'Reflections', icon: NotebookPen },
] as const

const logContact = (id: string, today: string) =>
  actions.update('people', id, (p) => ({ lastContact: today, contactLog: [...p.contactLog.filter((d) => d !== today), today].sort() }), { action: 'logged', detail: 'Got in touch' })

function PeopleTab({ today }: { today: string }) {
  const people = useCollection('people')
  const fmt = useFormatters()
  const rows = useMemo(
    () =>
      people
        .map((p) => ({ person: p, ...reconnectStatus(p, today) }))
        .sort((a, b) => Number(b.due) - Number(a.due) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.person.name.localeCompare(b.person.name)),
    [people, today],
  )
  if (!people.length) {
    return (
      <Panel>
        <EmptyState
          icon={Users}
          title="No one added yet"
          description="Add people you want to stay in touch with and how often. A first name is enough — LIFE OS deliberately avoids storing sensitive details about others."
          action={<Button variant="primary" icon={Plus} onClick={() => editor.create('people')}>Add person</Button>}
        />
      </Panel>
    )
  }
  return (
    <Panel title="People to stay in touch with" icon={Users} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('people')}>Person</Button>}>
      <ul className="divide-y divide-line">
        {rows.map(({ person, due, dueDate, daysSince }) => (
          <li key={person.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel-2 font-display text-[13px] text-ink">{person.name.slice(0, 1).toUpperCase()}</span>
            <button type="button" onClick={() => editor.edit('people', person.id)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[14px] text-ink">{person.name}</p>
              <p className="truncate text-[12px] text-ink-subtle">
                {CIRCLES.label(person.circle)}
                {person.cadenceDays ? ` · every ${person.cadenceDays} days` : ''}
                {person.notes ? ` · ${person.notes}` : ''}
              </p>
            </button>
            <div className="text-right">
              <p className={cn('text-[12.5px]', due ? 'text-warn' : 'text-ink-muted')}>{daysSince === null ? 'Not logged yet' : daysSince === 0 ? 'In touch today' : `${daysSince} days ago`}</p>
              {dueDate && <p className="font-mono text-[11px] text-ink-subtle">{due ? 'Reconnect now' : `Next ${relativeDay(dueDate, today)}`}</p>}
            </div>
            {due && <Badge tone="warn">Due</Badge>}
            <Button size="xs" variant={due ? 'primary' : 'subtle'} onClick={() => logContact(person.id, today)} disabled={person.lastContact === today}>
              Got in touch
            </Button>
            <RecordActions collection="people" id={person.id} />
            {person.contactLog.length > 1 && (
              <p className="w-full pl-12 font-mono text-[10.5px] text-ink-subtle">
                History: {person.contactLog.slice(-6).reverse().map((d) => fmt.shortDate(d)).join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function DatesTab({ today }: { today: string }) {
  const dates = useCollection('importantDates')
  const people = useCollection('people')
  const fmt = useFormatters()
  const sorted = useMemo(() => dates.map((d) => ({ d, next: nextOccurrence(d, today) })).sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999')), [dates, today])
  return (
    <Panel title="Important dates" icon={PartyPopper} actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('importantDates')}>Date</Button>}>
      {sorted.length === 0 ? (
        <EmptyState compact icon={PartyPopper} title="No important dates yet" description="Birthdays, anniversaries and occasions. Yearly dates repeat automatically and appear on your calendar." />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map(({ d, next }) => {
            const person = people.find((p) => p.id === d.personId)
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Badge tone={OCCASION_KINDS.tone(d.kind)}>{OCCASION_KINDS.label(d.kind)}</Badge>
                <button type="button" onClick={() => editor.edit('importantDates', d.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13.5px] text-ink">{d.title}</p>
                  <p className="truncate text-[11.5px] text-ink-subtle">
                    {fmt.date(d.date)}
                    {d.recurring ? ' · yearly' : ''}
                    {person ? ` · ${person.name}` : ''}
                  </p>
                </button>
                <span className={cn('font-mono text-[12px]', next && next <= addDaysISO(today, 7) ? 'text-magenta' : 'text-ink-muted')}>{next ? relativeDay(next, today) : 'Past'}</span>
                <RecordActions collection="importantDates" id={d.id} />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export default function SocialPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'upcoming')
  const db = useDatabase()
  const upcoming = useMemo(() => buildAgenda(db, today, addDaysISO(today, 60), today).filter((i) => i.area === 'social' || i.sourceKey === 'importantDates'), [db, today])
  const due = db.people.filter((p) => reconnectStatus(p, today).due)
  const occasions = upcomingOccasions(db.importantDates, today, 30)
  const commitments = sortTasks(db.tasks.filter((t) => t.area === 'social'))
  const goals = db.goals.filter((g) => g.area === 'social')
  return (
    <div>
      <PageHeader
        section="social"
        description="Plans with friends and family, occasions to remember, and people you mean to reconnect with. Simple and private."
        actions={
          <>
            <Button icon={Plus} onClick={() => editor.create('people')}>
              Person
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => editor.create('events', { area: 'social', allDay: false })}>
              Social event
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming social" value={upcoming.filter((i) => i.sourceKey === 'events').length} icon={CalendarHeart} tone="amber" sub="Events in the next 60 days" />
        <Stat label="Occasions soon" value={occasions.length} icon={PartyPopper} tone="magenta" sub="Next 30 days" />
        <Stat label="Due to reconnect" value={due.length} icon={HeartHandshake} tone="cyan" sub={`${db.people.length} people`} />
        <Stat label="Open commitments" value={commitments.filter((t) => t.status !== 'done').length} icon={HandHeart} tone="violet" />
      </div>
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'people' ? due.length : t.id === 'commitments' ? commitments.filter((c) => c.status !== 'done').length : undefined }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'upcoming' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Social events & occasions" eyebrow="Next 60 days" actions={<Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('events', { area: 'social' })}>Event</Button>}>
            {upcoming.length === 0 ? (
              <EmptyState compact icon={CalendarHeart} title="Nothing planned yet" description="Add a social event (it also appears on your calendar) or an important date." />
            ) : (
              <div className="-mx-2">
                <AgendaList items={upcoming} today={today} />
              </div>
            )}
          </Panel>
          <Panel title="Reconnect" icon={HeartHandshake}>
            {due.length === 0 ? (
              <p className="text-[13px] text-ink-subtle">{db.people.length ? 'You are up to date with everyone.' : 'Add people and a reconnect rhythm in the Reconnect tab.'}</p>
            ) : (
              <ul className="space-y-2">
                {due.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[13.5px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    <Button size="xs" variant="subtle" onClick={() => logContact(p.id, today)}>
                      Got in touch
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      {tab === 'people' && <PeopleTab today={today} />}
      {tab === 'dates' && <DatesTab today={today} />}
      {tab === 'commitments' && (
        <Panel title="Social commitments" icon={HandHeart} eyebrow="Things you've said you'll do for or with others">
          {commitments.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-subtle">e.g. “Help Sam move on Saturday”, “Book the restaurant for Friday”.</p>
          ) : (
            <div className="-mx-2">
              <AnimatePresence initial={false}>
                {commitments.map((t) => (
                  <TaskItem key={t.id} task={t} today={today} />
                ))}
              </AnimatePresence>
            </div>
          )}
          <InlineAdd placeholder="Add a commitment…" onAdd={(title) => actions.create('tasks', { title, area: 'social' })} />
        </Panel>
      )}
      {tab === 'goals' && (
        <div>
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="primary" icon={Plus} onClick={() => editor.create('goals', { area: 'social' })}>
              Social goal
            </Button>
          </div>
          {goals.length === 0 ? (
            <Panel>
              <EmptyState compact icon={Target} title="No social goals yet" description="e.g. “See grandparents once a month”, “Host a dinner each season”." />
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} today={today} />
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'reflections' && <NotesPanel title="Personal reflection notes" filter={(n) => n.area === 'social'} defaults={{ area: 'social' }} emptyText="Reflections on relationships, conversations and connection — private to you." limit={300} />}
    </div>
  )
}
