import { useState } from 'react'
import { BookOpen, Clapperboard, FileText, GraduationCap, ListChecks, Mic, Plus, Tv } from 'lucide-react'
import { MEDIA_PROGRESS_UNITS, MEDIA_STATUSES, MEDIA_TYPES, mediaStatusLabel, type MediaStatus, type MediaType } from '@/data/constants'
import type { MediaItem } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { mediaProgress, mediaStats } from '@/selectors/media'
import { actions, useCollection, useSettings } from '@/store/store'
import { RecordScreen } from '../../components/RecordScreen'
import { ProgressLine, StatGrid, StatTile } from '../../components/Stats'
import { actionSheet } from '../../ui/ActionSheet'
import { Chips } from '../../ui/controls'
import { IconTile } from '../../ui/List'

const MEDIA_ICONS: Record<MediaType, typeof BookOpen> = { book: BookOpen, article: FileText, podcast: Mic, film: Clapperboard, documentary: Tv, educational: GraduationCap }
const STATUS_ORDER: MediaStatus[] = ['in_progress', 'want', 'completed', 'abandoned']

/** Changing status fills in start/finish dates the same way as on desktop. */
export function setMediaStatus(item: MediaItem, status: MediaStatus, today: string) {
  actions.update('media', item.id, {
    status,
    startDate: status === 'in_progress' && !item.startDate ? today : item.startDate,
    completedDate: status === 'completed' ? (item.completedDate ?? today) : status === 'want' ? undefined : item.completedDate,
    progress: status === 'completed' && item.total ? item.total : item.progress,
  })
}

const step = (item: MediaItem) => (item.type === 'book' ? 10 : item.type === 'article' ? 10 : 1)

export function LibraryScreen() {
  const media = useCollection('media')
  const today = useToday()
  const target = useSettings().targets.yearlyReading
  const [status, setStatus] = useState<'all' | MediaStatus>('in_progress')
  const [type, setType] = useState<'all' | MediaType>('all')
  const stats = mediaStats(media, today.slice(0, 4))
  const effective = status === 'in_progress' && !stats.inProgress && media.length ? 'all' : status
  const items = media.filter((m) => (effective === 'all' || m.status === effective) && (type === 'all' || m.type === type))

  return (
    <RecordScreen
      title="Library"
      collection="media"
      testId="screen-library"
      items={items}
      defaults={type === 'all' ? undefined : { type }}
      search={(m) => `${m.title} ${m.creator ?? ''} ${m.category ?? ''} ${m.notes ?? ''} ${m.takeaways.join(' ')}`}
      group={effective === 'all' ? (m) => m.status : undefined}
      groupOrder={(a, b) => STATUS_ORDER.indexOf(a as MediaStatus) - STATUS_ORDER.indexOf(b as MediaStatus)}
      groupLabel={(k) => MEDIA_STATUSES.label(k as MediaStatus)}
      empty={media.length ? 'Nothing here.' : 'Books, articles, podcasts, films and courses you want to get through — with progress, ratings and key takeaways.'}
      top={
        <>
          {media.length > 0 && (
            <StatGrid>
              <StatTile label={`Books in ${today.slice(0, 4)}`} value={target ? `${stats.booksThisYear}/${target}` : stats.booksThisYear} sub={target ? `${Math.round((stats.booksThisYear / target) * 100)}% of goal` : 'no yearly goal set'} tone="cyan" />
              <StatTile label="Finished this year" value={stats.completedThisYear} sub={`${stats.inProgress} in progress · ${stats.queued} queued`} tone="lime" />
            </StatGrid>
          )}
          <div className="mb-2 px-4">
            <Chips
              ariaLabel="Status"
              value={effective}
              onChange={setStatus}
              options={[{ value: 'in_progress', label: 'In Progress', count: stats.inProgress }, { value: 'want', label: 'Queue', count: stats.queued }, { value: 'completed', label: 'Finished', count: stats.completed }, { value: 'all', label: 'All', count: media.length }]}
            />
          </div>
          {new Set(media.map((m) => m.type)).size > 1 && (
            <div className="mb-2 px-4">
              <Chips ariaLabel="Type" value={type} onChange={setType} options={[{ value: 'all', label: 'All Types' }, ...MEDIA_TYPES.list.filter((t) => media.some((m) => m.type === t.value)).map((t) => ({ value: t.value, label: t.label }))]} />
            </div>
          )}
        </>
      }
      extraActions={(m) => [
        ...(m.status === 'in_progress' && m.total && (m.progress ?? 0) < m.total
          ? [{ label: `+${step(m)}`, icon: Plus, tone: 'cyan' as const, onAction: () => actions.update('media', m.id, { progress: Math.min(m.total ?? 0, (m.progress ?? 0) + step(m)) }) }]
          : []),
        {
          label: 'Status',
          icon: ListChecks,
          tone: 'violet' as const,
          onAction: () => actionSheet({ title: m.title, options: MEDIA_STATUSES.list.filter((s) => s.value !== m.status).map((s) => ({ label: mediaStatusLabel(s.value, m.type), onSelect: () => setMediaStatus(m, s.value, today) })) }),
        },
      ]}
      row={(m) => {
        const p = mediaProgress(m)
        return {
          leading: <IconTile icon={MEDIA_ICONS[m.type]} tone={MEDIA_TYPES.tone(m.type)} />,
          title: m.title,
          subtitle: (
            <>
              {[m.creator, MEDIA_TYPES.label(m.type), m.status === 'in_progress' && m.total ? `${m.progress ?? 0}/${m.total} ${MEDIA_PROGRESS_UNITS[m.type]}` : effective === 'all' ? undefined : mediaStatusLabel(m.status, m.type)].filter(Boolean).join(' · ')}
              {m.status === 'in_progress' && p !== null && <ProgressLine value={p} tone={MEDIA_TYPES.tone(m.type)} className="mt-1.5" />}
            </>
          ),
          detail: m.rating ? <span className="text-[var(--color-amber)]">{'★'.repeat(m.rating)}</span> : undefined,
        }
      }}
      footer={items.some((m) => m.status === 'in_progress') ? 'Swipe left to log progress or change status.' : undefined}
    />
  )
}
