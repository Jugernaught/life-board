import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { ENERGY_SCALE, MOOD_SCALE, REFLECTION_PROMPTS, type PromptKey } from '@/data/constants'
import { addDaysISO, formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ScaleInput, TagInput } from '@/components/ui/pickers'
import { toast } from '@/components/ui/toast'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { useJournalDraft } from './useJournalDraft'

/**
 * The writing surface. Text is saved automatically a moment after you stop
 * typing (and immediately when you switch day or leave), so nothing you
 * write is lost.
 */
export function JournalEditor({ date, setDate, today, entryId, setEntryId }: { date: string; setDate: (d: string) => void; today: string; entryId?: string; setEntryId: (id?: string) => void }) {
  const entries = useCollection('journal')
  const checkIns = useCollection('checkIns')
  const settings = useSettings()
  const { draft, change, status, current, dayEntries, flush, wordCount: total } = useJournalDraft({ date, entryId, setEntryId })
  const [showExtra, setShowExtra] = useState(false)
  useEffect(() => {
    setShowExtra(!!(current?.lessons || current?.challenges || current?.achievements))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, date])
  const persist = { flush }

  const dayCheckIns = checkIns.filter((c) => c.date === date).sort((a, b) => (a.at < b.at ? 1 : -1))
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel hud p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setDate(addDaysISO(date, -1))} />
          <label className="relative flex items-center gap-2">
            <CalendarDays size={15} className="text-accent" />
            <span className="font-display text-[17px] font-semibold text-ink">{formatDate(date, 'EEEE d MMMM yyyy')}</span>
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Choose journal date" />
          </label>
          <IconButton icon={ChevronRight} label="Next day" onClick={() => setDate(addDaysISO(date, 1))} disabled={date >= today} />
          {date !== today && (
            <Button size="xs" variant="ghost" onClick={() => setDate(today)}>
              Today
            </Button>
          )}
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-ink-subtle" aria-live="polite" data-testid="journal-status">
            {status === 'pending' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : current ? 'Saved' : 'Not started'} · {total} words
          </span>
        </div>
        {dayEntries.length > 1 || entryId === 'new' ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {dayEntries.map((e, i) => (
              <button key={e.id} type="button" onClick={() => setEntryId(e.id)} className={cn('rounded-md border px-2.5 py-1 text-[12px]', e.id === current?.id ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-ink-muted')}>
                {e.title || `Entry ${i + 1}`}
              </button>
            ))}
            {entryId === 'new' && <span className="rounded-md border border-dashed border-accent/50 px-2.5 py-1 text-[12px] text-accent">New entry</span>}
          </div>
        ) : null}
        <Input value={draft.title ?? ''} onChange={(e) => change({ title: e.target.value })} placeholder="Title (optional)" aria-label="Entry title" className="mb-3 border-transparent bg-transparent px-0 font-display text-[20px] hover:border-transparent focus:border-transparent focus:ring-0" />
        <Textarea
          value={draft.body}
          onChange={(e) => change({ body: e.target.value })}
          placeholder="Write freely. This stays on your device."
          aria-label="Journal entry"
          rows={10}
          className="min-h-64 border-transparent bg-transparent px-0 text-[15.5px] leading-[1.75] hover:border-transparent focus:border-transparent focus:ring-0"
          data-testid="journal-body"
        />
        {settings.journalPrompts && (
          <div className="mt-5 space-y-4 border-t border-line pt-5">
            <p className="eyebrow">Reflection prompts · optional</p>
            {REFLECTION_PROMPTS.map((p) => (
              <div key={p.key}>
                <label htmlFor={`prompt-${p.key}`} className="mb-1.5 block text-[13px] font-medium text-accent/90">
                  {p.label}
                </label>
                <Textarea id={`prompt-${p.key}`} rows={2} value={draft.prompts?.[p.key as PromptKey] ?? ''} onChange={(e) => change({ prompts: { ...draft.prompts, [p.key]: e.target.value } })} />
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" onClick={() => setShowExtra((v) => !v)} className="flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink" aria-expanded={showExtra}>
            <ChevronDown size={14} className={cn('transition-transform', !showExtra && '-rotate-90')} />
            Achievements, challenges & lessons
          </button>
          {showExtra && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(['achievements', 'challenges', 'lessons'] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`extra-${k}`} className="mb-1.5 block text-[12px] font-medium text-ink-muted capitalize">
                    {k === 'lessons' ? 'Lessons learned' : k}
                  </label>
                  <Textarea id={`extra-${k}`} rows={3} value={draft[k] ?? ''} onChange={(e) => change({ [k]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          <TagInput value={draft.tags ?? []} onChange={(tags) => change({ tags })} placeholder="Add tags (Enter)" suggestions={[...new Set(entries.flatMap((e) => e.tags))]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
            <Lock size={11} /> Stored only in this browser. Not synced or shared.
          </p>
          <div className="flex gap-2">
            {current && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="text-bad hover:text-bad"
                onClick={async () => {
                  persist.flush()
                  if (await deleteRecord('journal', current.id)) setEntryId(undefined)
                }}
              >
                Delete
              </Button>
            )}
            {current && (
              <Button
                size="sm"
                icon={Plus}
                onClick={() => {
                  persist.flush()
                  setEntryId('new')
                }}
              >
                Another entry today
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Panel title="Mood & energy check-in" eyebrow={formatDate(date, 'EEE d MMM')}>
          <p className="mb-1.5 text-[12px] text-ink-muted">Mood</p>
          <ScaleInput value={mood} onChange={setMood} options={MOOD_SCALE} label="Mood" />
          <p className="mt-3 mb-1.5 text-[12px] text-ink-muted">Energy</p>
          <ScaleInput value={energy} onChange={setEnergy} options={ENERGY_SCALE} label="Energy" />
          <Button
            variant="primary"
            size="sm"
            className="mt-3 w-full"
            disabled={!mood || !energy}
            onClick={() => {
              actions.create('checkIns', { date, at: date === today ? new Date().toISOString() : `${date}T12:00:00.000Z`, mood: mood as number, energy: energy as number })
              setMood(undefined)
              setEnergy(undefined)
              toast({ title: 'Check-in saved' })
            }}
          >
            Save check-in
          </Button>
          {dayCheckIns.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
              {dayCheckIns.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-ink-muted">
                  <span className="font-mono text-[11px] text-ink-subtle">{new Date(c.at).toTimeString().slice(0, 5)}</span>
                  <span>
                    {MOOD_SCALE[c.mood - 1]?.emoji} {MOOD_SCALE[c.mood - 1]?.label} · {ENERGY_SCALE[c.energy - 1]?.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
