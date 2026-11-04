import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { ENERGY_SCALE, MOOD_SCALE, REFLECTION_PROMPTS, type PromptKey } from '@/data/constants'
import type { JournalEntry } from '@/data/types'
import { addDaysISO, formatDate } from '@/lib/dates'
import { cn, debounce } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { ScaleInput, TagInput } from '@/components/ui/pickers'
import { toast } from '@/components/ui/toast'
import { deleteRecord } from '@/components/editor/useDeleteRecord'

type Draft = Pick<JournalEntry, 'title' | 'body' | 'prompts' | 'lessons' | 'challenges' | 'achievements' | 'tags'>
const emptyDraft = (): Draft => ({ title: '', body: '', prompts: {}, lessons: '', challenges: '', achievements: '', tags: [] })
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

/**
 * The writing surface. Text is saved automatically a moment after you stop
 * typing (and immediately when you switch day or leave), so nothing you
 * write is lost.
 */
export function JournalEditor({ date, setDate, today, entryId, setEntryId }: { date: string; setDate: (d: string) => void; today: string; entryId?: string; setEntryId: (id?: string) => void }) {
  const entries = useCollection('journal')
  const checkIns = useCollection('checkIns')
  const settings = useSettings()
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)), [entries, date])
  const current = dayEntries.find((e) => e.id === entryId) ?? (entryId === 'new' ? undefined : dayEntries[0])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved'>('idle')
  const [showExtra, setShowExtra] = useState(false)
  const idRef = useRef<string | undefined>(current?.id)
  const dateRef = useRef(date)

  // Load the entry when the day/entry changes. When the change is just this
  // editor's own draft becoming a saved entry, keep the text on screen as is.
  useEffect(() => {
    if (current && current.id === idRef.current && date === dateRef.current && status !== 'idle') return
    idRef.current = current?.id
    dateRef.current = date
    setDraft(current ? { title: current.title ?? '', body: current.body, prompts: current.prompts ?? {}, lessons: current.lessons ?? '', challenges: current.challenges ?? '', achievements: current.achievements ?? '', tags: current.tags } : emptyDraft())
    setShowExtra(!!(current?.lessons || current?.challenges || current?.achievements))
    setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, date])

  const persist = useMemo(
    () =>
      debounce((d: Draft) => {
        const clean = {
          title: d.title?.trim() || undefined,
          body: d.body,
          prompts: Object.fromEntries(Object.entries(d.prompts ?? {}).filter(([, v]) => v && String(v).trim())),
          lessons: d.lessons?.trim() || undefined,
          challenges: d.challenges?.trim() || undefined,
          achievements: d.achievements?.trim() || undefined,
          tags: d.tags,
        }
        const hasContent = clean.body.trim() || clean.title || Object.keys(clean.prompts).length || clean.lessons || clean.challenges || clean.achievements
        try {
          if (idRef.current) actions.update('journal', idRef.current, clean)
          else if (hasContent) {
            const created = actions.create('journal', { ...clean, date: dateRef.current })
            idRef.current = created.id
            setEntryId(created.id)
          }
          setStatus('saved')
        } catch (e) {
          toast({ title: 'Could not save entry', description: String((e as Error).message), tone: 'error' })
        }
      }, 700),
    [setEntryId],
  )
  // Flush pending writes when switching entry/day or leaving the page.
  useEffect(() => () => persist.flush(), [persist, date, entryId])

  const change = (patch: Partial<Draft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch }
      setStatus('pending')
      persist(next)
      return next
    })
  }

  const dayCheckIns = checkIns.filter((c) => c.date === date).sort((a, b) => (a.at < b.at ? 1 : -1))
  const [mood, setMood] = useState<number | undefined>()
  const [energy, setEnergy] = useState<number | undefined>()
  const total = words(draft.body) + Object.values(draft.prompts ?? {}).reduce<number>((n, v) => n + words(String(v ?? '')), 0)

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
