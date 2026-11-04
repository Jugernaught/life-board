import { useMemo, useState } from 'react'
import { Award, BookHeart, ClipboardCheck, Eye, History, Lightbulb, Mountain, PenLine, Smile } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ENERGY_SCALE, MOOD_SCALE, REFLECTION_PROMPTS } from '@/data/constants'
import type { JournalEntry } from '@/data/types'
import { useListControls } from '@/hooks/useListControls'
import { useToday } from '@/hooks/useNow'
import { addDaysISO, diffDays, eachDay, eachMonth, formatDate, formatMonthKey, monthKey } from '@/lib/dates'
import { average, cn, truncate } from '@/lib/utils'
import { useCollection, useSettings } from '@/store/store'
import { Badge, EmptyState, Stat } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { WeeklyReviewPanel } from '@/components/shared/WeeklyReviewPanel'
import { JournalEditor } from './JournalEditor'

const TABS = [
  { id: 'write', label: 'Write', icon: PenLine },
  { id: 'history', label: 'History', icon: History },
  { id: 'checkins', label: 'Mood & energy', icon: Smile },
  { id: 'highlights', label: 'Highlights', icon: Award },
  { id: 'weekly', label: 'Weekly reflection', icon: ClipboardCheck },
] as const

const fullText = (e: JournalEntry) => [e.title, e.body, ...Object.values(e.prompts ?? {}), e.lessons, e.challenges, e.achievements, ...e.tags].filter(Boolean).join(' ')

function journalStreak(entries: JournalEntry[], today: string) {
  const days = new Set(entries.map((e) => e.date))
  let d = days.has(today) ? today : addDaysISO(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}

function Private({ text, blur }: { text: string; blur: boolean }) {
  const [shown, setShown] = useState(false)
  if (!blur || shown) return <>{text}</>
  return (
    <span className="relative inline-block">
      <span className="blur-[5px] select-none" aria-hidden>
        {text}
      </span>
      <button type="button" onClick={(e) => { e.stopPropagation(); setShown(true) }} className="absolute inset-0 flex items-center justify-center gap-1 text-[11.5px] text-ink-muted hover:text-ink">
        <Eye size={12} /> Reveal
      </button>
    </span>
  )
}

function HistoryTab({ open }: { open: (e: JournalEntry) => void }) {
  const entries = useCollection('journal')
  const settings = useSettings()
  const months = useMemo(() => {
    if (!entries.length) return []
    const sorted = entries.map((e) => e.date).sort()
    return eachMonth(sorted[0], sorted[sorted.length - 1]).reverse()
  }, [entries])
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort()
  const controls = useListControls<JournalEntry>(entries, {
    search: fullText,
    filters: [
      { key: 'month', label: 'Months', options: months.map((m) => ({ value: m, label: formatMonthKey(m, 'MMMM yyyy') })), get: (e) => monthKey(e.date) },
      { key: 'tag', label: 'Tags', options: tags.map((t) => ({ value: t, label: t })), get: (e) => e.tags },
    ],
    sorts: [
      { value: 'date', label: 'Date', get: (e) => `${e.date}${e.createdAt}`, dir: 'desc' },
      { value: 'length', label: 'Length', get: (e) => fullText(e).length, dir: 'desc' },
    ],
  })
  if (!entries.length) return <Panel><EmptyState icon={BookHeart} title="No entries yet" description="Your journal history will appear here — searchable by any word you wrote." /></Panel>
  return (
    <div>
      <ListToolbar controls={controls} placeholder="Search everything you've written…" total={entries.length} />
      {controls.results.length === 0 ? (
        <Panel><EmptyState compact title="No entries match" /></Panel>
      ) : (
        <div className="space-y-2.5">
          {controls.results.map((e) => {
            const text = e.body || Object.values(e.prompts ?? {}).filter(Boolean).join(' · ')
            return (
              <article key={e.id} className="panel flex gap-4 p-4 transition-colors hover:border-line-strong">
                <div className="w-14 shrink-0 text-center">
                  <p className="font-mono text-[10px] text-ink-subtle uppercase">{formatDate(e.date, 'MMM')}</p>
                  <p className="font-display text-[22px] leading-none text-ink">{formatDate(e.date, 'd')}</p>
                  <p className="font-mono text-[10px] text-ink-subtle">{formatDate(e.date, 'EEE yyyy')}</p>
                </div>
                <button type="button" onClick={() => open(e)} className="min-w-0 flex-1 text-left">
                  <p className="text-[14.5px] font-medium text-ink">{e.title || formatDate(e.date, 'EEEE')}</p>
                  <p className="mt-1 line-clamp-3 text-[13px] text-ink-muted">{text ? <Private text={truncate(text, 400)} blur={settings.journalBlur} /> : <span className="text-ink-subtle">Empty entry</span>}</p>
                  {e.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <Badge key={t} tone="violet">#{t}</Badge>
                      ))}
                    </div>
                  )}
                </button>
                <RecordActions collection="journal" id={e.id} />
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CheckInsTab({ today }: { today: string }) {
  const checkIns = useCollection('checkIns')
  const data = useMemo(
    () =>
      eachDay(addDaysISO(today, -29), today).map((d) => {
        const list = checkIns.filter((c) => c.date === d)
        return { date: d, mood: list.length ? Math.round(average(list.map((c) => c.mood)) * 10) / 10 : null, energy: list.length ? Math.round(average(list.map((c) => c.energy)) * 10) / 10 : null }
      }),
    [checkIns, today],
  )
  const recent = [...checkIns].sort((a, b) => (a.at < b.at ? 1 : -1))
  const last30 = checkIns.filter((c) => c.date > addDaysISO(today, -30))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Check-ins (30 days)" value={last30.length} tone="cyan" />
        <Stat label="Average mood" value={last30.length ? `${average(last30.map((c) => c.mood)).toFixed(1)}/5` : '—'} tone="magenta" />
        <Stat label="Average energy" value={last30.length ? `${average(last30.map((c) => c.energy)).toFixed(1)}/5` : '—'} tone="amber" />
        <Stat label="Days checked in" value={new Set(last30.map((c) => c.date)).size} tone="lime" sub="Last 30 days" />
      </div>
      <ChartCard
        title="Mood & energy"
        description="Daily average · last 30 days · 1 (low) – 5 (high)"
        legend={[
          { label: 'Mood', color: series(1) },
          { label: 'Energy', color: series(4) },
        ]}
        rows={data.filter((d) => d.mood !== null)}
        columns={[
          { label: 'Date', value: (r) => formatDate(r.date, 'EEE d MMM') },
          { label: 'Mood', value: (r) => r.mood, align: 'right' },
          { label: 'Energy', value: (r) => r.energy, align: 'right' },
        ]}
        empty={!data.some((d) => d.mood !== null)}
        emptyHint="Log a check-in from the Write tab or the Command Centre."
        height={260}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'd MMM')} {...axisProps} minTickGap={24} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} />
            <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}/5`} formatLabel={(l) => formatDate(String(l), 'EEE d MMM')} />} />
            <Line type="monotone" dataKey="mood" name="Mood" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls />
            <Line type="monotone" dataKey="energy" name="Energy" stroke={series(4)} strokeWidth={2} dot={{ r: 3, fill: series(4), strokeWidth: 0 }} connectNulls strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <Panel title="All check-ins">
        {recent.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">No check-ins yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.slice(0, 100).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="w-32 shrink-0 font-mono text-[11.5px] text-ink-subtle">{new Date(c.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span className="text-ink">
                  {MOOD_SCALE[c.mood - 1]?.emoji} {MOOD_SCALE[c.mood - 1]?.label}
                </span>
                <span className="text-ink-muted">· {ENERGY_SCALE[c.energy - 1]?.label} energy</span>
                <span className="min-w-0 flex-1 truncate text-ink-subtle">{c.note}</span>
                <RecordActions collection="checkIns" id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function HighlightsTab({ open }: { open: (e: JournalEntry) => void }) {
  const entries = useCollection('journal')
  const settings = useSettings()
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))
  const columns = [
    { key: 'achievements' as const, label: 'Achievements', icon: Award, tone: 'text-ok' },
    { key: 'challenges' as const, label: 'Challenges', icon: Mountain, tone: 'text-warn' },
    { key: 'lessons' as const, label: 'Lessons learned', icon: Lightbulb, tone: 'text-accent' },
  ]
  const gratitude = sorted.filter((e) => e.prompts?.grateful)
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {columns.map((c) => {
        const list = sorted.filter((e) => e[c.key])
        return (
          <Panel key={c.key} title={c.label} icon={c.icon}>
            {list.length === 0 ? (
              <p className="text-[12.5px] text-ink-subtle">Add these in the “Achievements, challenges & lessons” section of an entry.</p>
            ) : (
              <ul className="space-y-3">
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => open(e)} className="text-left">
                      <p className={cn('font-mono text-[10.5px]', c.tone)}>{formatDate(e.date, 'd MMM yyyy')}</p>
                      <p className="text-[13px] whitespace-pre-line text-ink-muted">
                        <Private text={e[c.key] as string} blur={settings.journalBlur} />
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )
      })}
      <Panel title="Gratitude" icon={BookHeart}>
        {gratitude.length === 0 ? (
          <p className="text-[12.5px] text-ink-subtle">Answers to “{REFLECTION_PROMPTS[4].label}” collect here.</p>
        ) : (
          <ul className="space-y-3">
            {gratitude.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => open(e)} className="text-left">
                  <p className="font-mono text-[10.5px] text-magenta">{formatDate(e.date, 'd MMM yyyy')}</p>
                  <p className="text-[13px] whitespace-pre-line text-ink-muted">
                    <Private text={e.prompts.grateful as string} blur={settings.journalBlur} />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export default function JournalPage() {
  const today = useToday()
  const [tab, setTab] = useTabParam(TABS, 'write')
  const [date, setDate] = useState(today)
  const [entryId, setEntryId] = useState<string | undefined>()
  const entries = useCollection('journal')
  const streak = journalStreak(entries, today)
  const open = (e: JournalEntry) => {
    setDate(e.date)
    setEntryId(e.id)
    setTab('write')
  }
  const lastEntry = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return (
    <div>
      <PageHeader
        section="journal"
        description="A private space to write, check in with yourself and reflect. Entries save automatically and never leave this device."
        actions={
          <div className="flex items-center gap-3 font-mono text-[12px] text-ink-muted">
            <span>{entries.length} entries</span>
            <span className="text-ink-subtle/50">·</span>
            <span>{streak} day streak</span>
            {lastEntry && lastEntry.date !== today && (
              <>
                <span className="text-ink-subtle/50">·</span>
                <span>last {diffDays(lastEntry.date, today)}d ago</span>
              </>
            )}
          </div>
        }
      />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'history' ? entries.length : undefined }))} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'write' && (
        <JournalEditor
          date={date}
          setDate={(d) => {
            setDate(d)
            setEntryId(undefined)
          }}
          today={today}
          entryId={entryId}
          setEntryId={setEntryId}
        />
      )}
      {tab === 'history' && <HistoryTab open={open} />}
      {tab === 'checkins' && <CheckInsTab today={today} />}
      {tab === 'highlights' && <HighlightsTab open={open} />}
      {tab === 'weekly' && <WeeklyReviewPanel today={today} />}
    </div>
  )
}
