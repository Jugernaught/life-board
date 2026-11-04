/**
 * Journal autosave, shared by the desktop and iPhone editors.
 *
 * Text is saved a moment after typing stops, and immediately when the day or
 * entry changes or the editor unmounts, so nothing written is lost. A new
 * entry is only created once there is some content.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { JournalEntry } from '@/data/types'
import { debounce } from '@/lib/utils'
import { actions, useCollection } from '@/store/store'
import { toast } from '@/components/ui/toast'

export type JournalDraft = Pick<JournalEntry, 'title' | 'body' | 'prompts' | 'lessons' | 'challenges' | 'achievements' | 'tags'>
export type DraftStatus = 'idle' | 'pending' | 'saved'

export const emptyJournalDraft = (): JournalDraft => ({ title: '', body: '', prompts: {}, lessons: '', challenges: '', achievements: '', tags: [] })
export const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

const toDraft = (e: JournalEntry): JournalDraft => ({
  title: e.title ?? '',
  body: e.body,
  prompts: e.prompts ?? {},
  lessons: e.lessons ?? '',
  challenges: e.challenges ?? '',
  achievements: e.achievements ?? '',
  tags: e.tags,
})

/**
 * @param entryId a specific entry, `'new'` for an additional entry on the
 *   same day, or undefined for the day's first entry.
 */
export function useJournalDraft({ date, entryId, setEntryId }: { date: string; entryId?: string; setEntryId: (id?: string) => void }) {
  const entries = useCollection('journal')
  const dayEntries = useMemo(() => entries.filter((e) => e.date === date).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)), [entries, date])
  const current = dayEntries.find((e) => e.id === entryId) ?? (entryId === 'new' ? undefined : dayEntries[0])
  const [draft, setDraft] = useState<JournalDraft>(() => (current ? toDraft(current) : emptyJournalDraft()))
  const [status, setStatus] = useState<DraftStatus>('idle')
  const idRef = useRef<string | undefined>(current?.id)
  const dateRef = useRef(date)
  const draftRef = useRef(draft)
  const setEntryIdRef = useRef(setEntryId)
  useEffect(() => {
    setEntryIdRef.current = setEntryId
  }, [setEntryId])

  // Load the entry when the day/entry changes. When the change is just this
  // editor's own draft becoming a saved entry, keep the text on screen as is.
  useEffect(() => {
    if (current && current.id === idRef.current && date === dateRef.current && status !== 'idle') return
    idRef.current = current?.id
    dateRef.current = date
    const next = current ? toDraft(current) : emptyJournalDraft()
    draftRef.current = next
    setDraft(next)
    setStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, date])

  const persist = useMemo(
    () =>
      debounce((d: JournalDraft) => {
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
            setEntryIdRef.current(created.id)
          }
          setStatus('saved')
        } catch (e) {
          toast({ title: 'Could not save entry', description: String((e as Error).message), tone: 'error' })
        }
      }, 700),
    [],
  )
  // Flush pending writes when switching entry/day or leaving.
  useEffect(() => () => persist.flush(), [persist, date, entryId])

  const change = (patch: Partial<JournalDraft>) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    setStatus('pending')
    persist(next)
  }

  const wordCount = countWords(draft.body) + Object.values(draft.prompts ?? {}).reduce<number>((n, v) => n + countWords(String(v ?? '')), 0)

  return { draft, change, status, current, dayEntries, flush: persist.flush, wordCount }
}
