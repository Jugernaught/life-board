import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Ellipsis, Eye, PenLine, Smile } from 'lucide-react'
import { REFLECTION_PROMPTS, type PromptKey } from '@/data/constants'
import type { JournalEntry } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { addDaysISO, formatDate, formatMonthKey, monthKey } from '@/lib/dates'
import { cn, groupBy, normalise, truncate } from '@/lib/utils'
import { useCollection, useRecord, useSettings } from '@/store/store'
import { TagInput } from '@/components/ui/pickers'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { useJournalDraft } from '@/features/journal/useJournalDraft'
import { CheckInCard } from '../../components/CheckInCard'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { Chips, SearchField } from '../../ui/controls'
import { Cell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'

const preview = (e: JournalEntry) => e.body || Object.values(e.prompts ?? {}).filter(Boolean).join(' · ') || e.achievements || e.lessons || ''

function streak(entries: JournalEntry[], today: string) {
  const days = new Set(entries.map((e) => e.date))
  let d = days.has(today) ? today : addDaysISO(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}

function EntryCell({ e, blur }: { e: JournalEntry; blur: boolean }) {
  const text = preview(e)
  return (
    <Cell
      title={e.title || formatDate(e.date, 'EEEE d MMMM')}
      subtitle={blur ? 'Preview hidden' : text ? truncate(text, 140) : 'Empty entry'}
      detail={<span className="ios-footnote">{formatDate(e.date, 'd MMM')}</span>}
      chevron
      multiline={!blur}
      onClick={() => nav.push(`journal/entry/${e.id}`)}
      testId="m-journal-row"
    />
  )
}

export function JournalScreen() {
  const entries = useCollection('journal')
  const settings = useSettings()
  const today = useToday()
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)), [entries])
  const todays = sorted.filter((e) => e.date === today)
  return (
    <Screen
      title="Journal"
      large
      testId="screen-journal"
      subtitle={`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ${streak(entries, today)} day streak`}
      trailing={
        <NavButton label="Write" testId="journal-write" onClick={() => nav.push(`journal/write/${today}`)}>
          <PenLine size={23} />
        </NavButton>
      }
    >
      <Section header="Today" footer="Private: stored only on this device. Saves as you type.">
        {todays.length === 0 ? <Cell title="Write today’s entry" tint chevron onClick={() => nav.push(`journal/write/${today}`)} testId="journal-today" /> : todays.map((e) => <EntryCell key={e.id} e={e} blur={settings.journalBlur} />)}
      </Section>
      <CheckInCard today={today} />
      <Section header="Recent">
        {sorted.filter((e) => e.date !== today).length === 0 && <EmptyRow>Past entries appear here.</EmptyRow>}
        {sorted
          .filter((e) => e.date !== today)
          .slice(0, 5)
          .map((e) => (
            <EntryCell key={e.id} e={e} blur={settings.journalBlur} />
          ))}
      </Section>
      <Section>
        <Cell icon={Eye} iconTone="violet" title="All Entries" detail={entries.length} chevron onClick={() => nav.push('journal/history')} testId="journal-all" />
        <Cell icon={Smile} iconTone="amber" title="Mood & Energy" chevron onClick={() => nav.push('journal/checkins')} />
        <Cell icon={PenLine} iconTone="cyan" title="Weekly Reflection" chevron onClick={() => nav.push('habits/review')} />
      </Section>
    </Screen>
  )
}

function JournalEditor({ date, initialEntryId, testId }: { date: string; initialEntryId?: string; testId: string }) {
  const settings = useSettings()
  const entries = useCollection('journal')
  const [entryId, setEntryId] = useState<string | undefined>(initialEntryId)
  const { draft, change, status, current, flush, wordCount } = useJournalDraft({ date, entryId, setEntryId })
  const [focused, setFocused] = useState(false)
  const [extra, setExtra] = useState(() => !!(current?.lessons || current?.challenges || current?.achievements))
  const root = useRef<HTMLDivElement>(null)

  const menu = () =>
    actionSheet({
      options: [
        {
          label: 'New Entry for This Day',
          onSelect: () => {
            flush()
            setEntryId('new')
          },
        },
        ...(current
          ? [
              {
                label: 'Delete Entry',
                destructive: true,
                onSelect: async () => {
                  flush()
                  if (await deleteRecord('journal', current.id)) nav.pop()
                },
              },
            ]
          : []),
      ],
    })

  return (
    <Screen
      title={formatDate(date, 'EEE d MMM')}
      testId={testId}
      trailing={
        focused ? (
          <NavButton bold onClick={() => (document.activeElement as HTMLElement | null)?.blur()}>
            Done
          </NavButton>
        ) : (
          <NavButton label="Entry options" onClick={menu}>
            <Ellipsis size={24} />
          </NavButton>
        )
      }
    >
      <div
        ref={root}
        className="px-5 pt-2"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!root.current?.contains(e.relatedTarget as Node)) setFocused(false)
        }}
      >
        <p className="ios-footnote text-ink-subtle" aria-live="polite" data-testid="m-journal-status">
          {formatDate(date, 'EEEE d MMMM yyyy')} · {status === 'pending' ? 'Saving…' : status === 'saved' || current ? 'Saved' : 'Not started'} · {wordCount} words
        </p>
        <input
          value={draft.title ?? ''}
          onChange={(e) => change({ title: e.target.value })}
          placeholder="Title"
          aria-label="Entry title"
          className="!min-h-0 mt-2 w-full bg-transparent py-1 text-[26px] leading-tight font-bold text-ink outline-none placeholder:text-ink-subtle/60"
        />
        <AutoTextarea value={draft.body} onChange={(v) => change({ body: v })} placeholder="Write freely…" ariaLabel="Journal entry" minRows={8} testId="m-journal-body" className="ios-body mt-2 leading-[1.6]" />
      </div>
      {settings.journalPrompts && (
        <Section header="Reflection prompts" className="mt-6">
          {REFLECTION_PROMPTS.map((p) => (
            <div key={p.key} className="px-4 pt-3 pb-1">
              <p className="ios-subhead font-medium text-accent">{p.label}</p>
              <AutoTextarea value={draft.prompts?.[p.key as PromptKey] ?? ''} onChange={(v) => change({ prompts: { ...draft.prompts, [p.key]: v } })} ariaLabel={p.label} minRows={1} className="ios-body" />
            </div>
          ))}
        </Section>
      )}
      <Section>
        <button type="button" onClick={() => setExtra((v) => !v)} className="ios-press ios-body flex min-h-11 w-full items-center gap-2 px-4 text-left text-ink" aria-expanded={extra}>
          <span className="flex-1">Achievements, challenges & lessons</span>
          <ChevronDown size={18} className={cn('text-ink-subtle transition-transform', extra && 'rotate-180')} />
        </button>
        {extra &&
          (['achievements', 'challenges', 'lessons'] as const).map((k) => (
            <div key={k} className="px-4 pt-3 pb-1">
              <p className="ios-subhead font-medium text-ink-subtle capitalize">{k === 'lessons' ? 'Lessons learned' : k}</p>
              <AutoTextarea value={draft[k] ?? ''} onChange={(v) => change({ [k]: v })} ariaLabel={k} minRows={2} className="ios-body" />
            </div>
          ))}
      </Section>
      <Section header="Tags">
        <div className="p-2">
          <TagInput value={draft.tags ?? []} onChange={(tags) => change({ tags })} placeholder="Add tag" suggestions={[...new Set(entries.flatMap((e) => e.tags))]} />
        </div>
      </Section>
    </Screen>
  )
}

function AutoTextarea({ value, onChange, placeholder, ariaLabel, minRows, className, testId }: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel: string; minRows: number; className?: string; testId?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = `${e.target.scrollHeight}px`
      }}
      ref={(el) => {
        if (el) {
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }
      }}
      rows={minRows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn('block w-full resize-none bg-transparent py-1 text-ink outline-none placeholder:text-ink-subtle', className)}
    />
  )
}

export function JournalWriteScreen({ params }: { params: Record<string, string> }) {
  return <JournalEditor date={params.date} testId="screen-journal-write" />
}

export function JournalEntryScreen({ params }: { params: Record<string, string> }) {
  const entry = useRecord('journal', params.id)
  if (!entry)
    return (
      <Screen title="Entry">
        <p className="ios-subhead px-8 pt-16 text-center text-ink-subtle">This entry may have been deleted.</p>
      </Screen>
    )
  return <JournalEditor date={entry.date} initialEntryId={entry.id} testId="screen-journal-entry" />
}

type Filter = 'all' | 'achievements' | 'challenges' | 'lessons' | 'grateful'

export function JournalHistoryScreen() {
  const entries = useCollection('journal')
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const q = normalise(query)
  const list = useMemo(
    () =>
      [...entries]
        .filter((e) => (filter === 'all' ? true : filter === 'grateful' ? !!e.prompts?.grateful : !!e[filter]))
        .filter((e) => !q || normalise([e.title, e.body, ...Object.values(e.prompts ?? {}), e.lessons, e.challenges, e.achievements, ...e.tags].filter(Boolean).join(' ')).includes(q))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries, filter, q],
  )
  const months = groupBy(list, (e) => monthKey(e.date))
  return (
    <Screen title="All Entries" testId="screen-journal-history" header={<SearchField value={query} onChange={setQuery} placeholder="Search everything you’ve written" testId="journal-search" />}>
      <div className="mb-4 px-4">
        <Chips
          value={filter}
          onChange={setFilter}
          ariaLabel="Show"
          options={[
            { value: 'all', label: 'All' },
            { value: 'achievements', label: 'Achievements' },
            { value: 'challenges', label: 'Challenges' },
            { value: 'lessons', label: 'Lessons' },
            { value: 'grateful', label: 'Gratitude' },
          ]}
        />
      </div>
      {list.length === 0 && (
        <Section>
          <EmptyRow>{entries.length ? 'Nothing matches.' : 'No entries yet.'}</EmptyRow>
        </Section>
      )}
      {Object.keys(months)
        .sort()
        .reverse()
        .map((m) => (
          <Section key={m} header={formatMonthKey(m, 'MMMM yyyy')}>
            {months[m].map((e) =>
              filter === 'all' ? (
                <EntryCell key={e.id} e={e} blur={settings.journalBlur} />
              ) : (
                <Cell
                  key={e.id}
                  title={formatDate(e.date, 'EEEE d MMMM')}
                  subtitle={settings.journalBlur ? 'Preview hidden' : String((filter === 'grateful' ? e.prompts.grateful : e[filter]) ?? '')}
                  multiline
                  chevron
                  onClick={() => nav.push(`journal/entry/${e.id}`)}
                />
              ),
            )}
          </Section>
        ))}
    </Screen>
  )
}
