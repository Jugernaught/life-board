import { useMemo } from 'react'
import { CalendarHeart, HandHeart, PartyPopper, Plus, Target, Trash2, Users } from 'lucide-react'
import { CIRCLES, OCCASION_KINDS } from '@/data/constants'
import type { Person } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useToday } from '@/hooks/useNow'
import { buildAgenda } from '@/selectors/agenda'
import { nextOccurrence, reconnectStatus, upcomingOccasions } from '@/selectors/social'
import { isOpen, sortTasks } from '@/selectors/tasks'
import { addDaysISO, relativeDay } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { goalProgressOf } from '@/store/lifecycle'
import { actions, useCollection, useDatabase } from '@/store/store'
import { editor } from '@/components/editor/editorStore'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { AgendaDayRow } from '../../components/AgendaRow'
import { InlineAdd } from '../../components/InlineAdd'
import { NotesSection } from '../../components/NotesSection'
import { RecordScreen } from '../../components/RecordScreen'
import { ProgressLine, StatGrid, StatTile } from '../../components/Stats'
import { TaskRow } from '../../components/TaskRow'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { ActionCell, Cell, EmptyRow, Section, SeeAll } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { SwipeRow } from '../../ui/SwipeRow'

/** Record that you got in touch today (kept as a dated history). */
export const logContact = (id: string, today: string) =>
  actions.update('people', id, (p) => ({ lastContact: today, contactLog: [...p.contactLog.filter((d) => d !== today), today].sort() }), { action: 'logged', detail: 'Got in touch' })

function PersonRow({ person, today }: { person: Person; today: string }) {
  const { due, dueDate, daysSince } = reconnectStatus(person, today)
  const fmt = useFormatters()
  const touched = person.lastContact === today
  return (
    <SwipeRow actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('people', person.id) }]}>
      <div className="flex items-center gap-3 pl-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold" style={{ background: toneTint(CIRCLES.tone(person.circle), 22), color: toneColor(CIRCLES.tone(person.circle)) }} aria-hidden>
          {person.name.slice(0, 1).toUpperCase()}
        </span>
        <button type="button" onClick={() => editor.edit('people', person.id)} className="ios-press min-w-0 flex-1 py-2.5 text-left" data-testid="m-person-row">
          <span className="ios-body block truncate text-ink">{person.name}</span>
          <span className={cn('ios-footnote block truncate', due ? 'text-warn' : 'text-ink-subtle')}>
            {daysSince === null ? 'Not logged yet' : daysSince === 0 ? 'In touch today' : `${daysSince} days ago`}
            {dueDate && !touched ? due ? <span className="sr-only"> · reconnect now</span> : ` · next ${relativeDay(dueDate, today)}` : ''}
            {person.contactLog.length > 1 ? ` · ${person.contactLog.length}× since ${fmt.shortDate(person.contactLog[0])}` : ''}
          </span>
        </button>
        <button
          type="button"
          onClick={() => logContact(person.id, today)}
          disabled={touched}
          className={cn('ios-footnote mr-3 flex h-8 shrink-0 items-center rounded-full px-3 font-semibold', touched ? 'text-ink-subtle' : due ? 'bg-accent text-[var(--color-on-accent)]' : 'bg-[var(--ios-fill)] text-accent')}
          aria-label={touched ? `In touch with ${person.name} today` : `Got in touch with ${person.name}`}
          data-testid="got-in-touch"
        >
          {touched ? 'Done' : 'Got in Touch'}
        </button>
      </div>
    </SwipeRow>
  )
}

export function SocialScreen() {
  const db = useDatabase()
  const today = useToday()
  const upcoming = useMemo(() => buildAgenda(db, today, addDaysISO(today, 60), today).filter((i) => i.area === 'social' && i.sourceKey !== 'importantDates' && i.sourceKey !== 'tasks'), [db, today])
  const due = db.people.map((p) => ({ p, ...reconnectStatus(p, today) })).filter((x) => x.due).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const occasions = upcomingOccasions(db.importantDates, today, 30)
  const commitments = sortTasks(db.tasks.filter((t) => t.area === 'social'))
  const openCommitments = commitments.filter(isOpen)
  const goals = db.goals.filter((g) => g.area === 'social' && g.status !== 'abandoned')
  return (
    <Screen
      title="Social"
      large
      testId="screen-social"
      trailing={
        <NavButton
          label="Add"
          testId="social-add"
          onClick={() =>
            actionSheet({
              title: 'Add',
              options: [
                { label: 'Social Plan', onSelect: () => editor.create('events', { area: 'social', allDay: false }) },
                { label: 'Person', onSelect: () => editor.create('people') },
                { label: 'Important Date', onSelect: () => editor.create('importantDates') },
                { label: 'Commitment', onSelect: () => editor.create('tasks', { area: 'social' }) },
                { label: 'Social Goal', onSelect: () => editor.create('goals', { area: 'social' }) },
              ],
            })
          }
        >
          <Plus size={26} />
        </NavButton>
      }
    >
      <StatGrid>
        <StatTile label="To reconnect" value={due.length} sub={`${db.people.length} people`} tone="amber" onClick={() => nav.push('more/social/people')} />
        <StatTile label="Occasions" value={occasions.length} sub="next 30 days" tone="magenta" onClick={() => nav.push('more/social/dates')} />
        <StatTile label="Plans" value={upcoming.length} sub="next 60 days" tone="cyan" />
        <StatTile label="Commitments" value={openCommitments.length} sub="open" tone="violet" />
      </StatGrid>

      <Section header="Reconnect" headerAction={<SeeAll onClick={() => nav.push('more/social/people')} />} footer={db.people.length ? undefined : 'A first name is enough — ATLAS deliberately avoids storing sensitive details about other people.'}>
        {db.people.length === 0 && <EmptyRow>Add people you want to stay in touch with, and how often.</EmptyRow>}
        {db.people.length > 0 && due.length === 0 && <EmptyRow>You’re up to date with everyone.</EmptyRow>}
        {due.slice(0, 5).map(({ p }) => (
          <PersonRow key={p.id} person={p} today={today} />
        ))}
      </Section>

      <Section header="Coming up" footer="Social events from your calendar, plus anything tagged Social.">
        {upcoming.length === 0 && <EmptyRow>No social plans in the next 60 days.</EmptyRow>}
        {upcoming.slice(0, 6).map((i) => (
          <AgendaDayRow key={i.key} item={i} today={today} />
        ))}
      </Section>

      <Section header="Occasions" headerAction={<SeeAll onClick={() => nav.push('more/social/dates')} />}>
        {occasions.length === 0 && <EmptyRow>No birthdays or occasions in the next 30 days.</EmptyRow>}
        {occasions.map(({ item, next, years }) => (
          <Cell
            key={item.id}
            icon={PartyPopper}
            iconTone={OCCASION_KINDS.tone(item.kind)}
            title={item.title}
            subtitle={[OCCASION_KINDS.label(item.kind), years ? `${years} years` : undefined, db.people.find((p) => p.id === item.personId)?.name].filter(Boolean).join(' · ')}
            detail={<span className={cn(next <= addDaysISO(today, 7) && 'text-[var(--color-magenta)]')}>{relativeDay(next, today)}</span>}
            chevron
            onClick={() => editor.edit('importantDates', item.id)}
          />
        ))}
      </Section>

      <Section header="Commitments" footer="Things you’ve promised people — tasks in the Social area.">
        {commitments.slice(0, 8).map((t) => (
          <TaskRow key={t.id} task={t} today={today} />
        ))}
        <InlineAdd placeholder="Add a commitment" testId="social-add-commitment" onAdd={(title) => actions.create('tasks', { title, area: 'social' })} />
      </Section>

      <Section header="Social goals">
        {goals.length === 0 && <EmptyRow>No social goals yet.</EmptyRow>}
        {goals.map((g) => (
          <Cell key={g.id} icon={Target} iconTone="amber" title={g.title} subtitle={<ProgressLine value={goalProgressOf(g)} className="mt-1.5" />} detail={`${Math.round(goalProgressOf(g))}%`} chevron onClick={() => nav.push(`habits/goal/${g.id}`)} />
        ))}
        <ActionCell icon={Plus} onClick={() => editor.create('goals', { area: 'social' })}>
          Add Social Goal
        </ActionCell>
      </Section>

      <Section>
        <Cell icon={Users} iconTone="cyan" title="People" detail={db.people.length || undefined} chevron onClick={() => nav.push('more/social/people')} />
        <Cell icon={CalendarHeart} iconTone="magenta" title="Important Dates" detail={db.importantDates.length || undefined} chevron onClick={() => nav.push('more/social/dates')} />
      </Section>

      <NotesSection header="Reflections" filter={(n) => n.area === 'social'} defaults={{ area: 'social' }} footer="How time with people felt, what you want more of." />
    </Screen>
  )
}

export function PeopleScreen() {
  const people = useCollection('people')
  const today = useToday()
  const rows = useMemo(
    () => people.map((p) => ({ p, ...reconnectStatus(p, today) })).sort((a, b) => Number(b.due) - Number(a.due) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.p.name.localeCompare(b.p.name)),
    [people, today],
  )
  const due = rows.filter((r) => r.due)
  const rest = rows.filter((r) => !r.due)
  return (
    <Screen
      title="Reconnect"
      testId="screen-people"
      trailing={
        <NavButton label="Add person" onClick={() => editor.create('people')} testId="record-add">
          <Plus size={26} />
        </NavButton>
      }
    >
      {people.length === 0 && (
        <Section footer="A first name is enough — ATLAS deliberately avoids storing sensitive details about other people.">
          <EmptyRow>Add people you want to stay in touch with, and how often (e.g. every 30 days).</EmptyRow>
        </Section>
      )}
      {due.length > 0 && (
        <Section header="Due now">
          {due.map(({ p }) => (
            <PersonRow key={p.id} person={p} today={today} />
          ))}
        </Section>
      )}
      {rest.length > 0 && (
        <Section header={due.length ? 'Everyone else' : 'People'} footer="Tap Got in Touch after a call, message or meet-up. Swipe left to delete.">
          {rest.map(({ p }) => (
            <PersonRow key={p.id} person={p} today={today} />
          ))}
        </Section>
      )}
      <Section>
        <ActionCell icon={HandHeart} onClick={() => editor.create('people')}>
          Add Person
        </ActionCell>
      </Section>
    </Screen>
  )
}

export function DatesScreen() {
  const dates = useCollection('importantDates')
  const people = useCollection('people')
  const today = useToday()
  const fmt = useFormatters()
  const sorted = useMemo(() => dates.map((d) => ({ ...d, next: nextOccurrence(d, today) })).sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999')), [dates, today])
  const soon = addDaysISO(today, 30)
  return (
    <RecordScreen
      title="Important Dates"
      collection="importantDates"
      testId="screen-dates"
      items={sorted}
      search={(d) => `${d.title} ${d.notes ?? ''} ${people.find((p) => p.id === d.personId)?.name ?? ''}`}
      group={(d) => {
        const next = nextOccurrence(d, today)
        return !next ? '3' : next <= soon ? '1' : '2'
      }}
      groupOrder={(a, b) => a.localeCompare(b)}
      groupLabel={(k) => (k === '1' ? 'Next 30 days' : k === '2' ? 'Later' : 'Past')}
      empty="Birthdays, anniversaries and occasions. Yearly dates repeat automatically and appear on your calendar."
      row={(d) => {
        const next = nextOccurrence(d, today)
        return {
          title: d.title,
          subtitle: [OCCASION_KINDS.label(d.kind), fmt.date(d.date), d.recurring ? 'yearly' : undefined, people.find((p) => p.id === d.personId)?.name].filter(Boolean).join(' · '),
          detail: next ? <span className={cn(next <= addDaysISO(today, 7) && 'text-[var(--color-magenta)]')}>{relativeDay(next, today)}</span> : 'Past',
        }
      }}
    />
  )
}
