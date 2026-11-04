import { useMemo, useState } from 'react'
import { BookOpen, Clapperboard, FileText, GraduationCap, LayoutGrid, Library, List, Mic, Plus, Star, Tv } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MEDIA_PROGRESS_UNITS, MEDIA_STATUSES, MEDIA_TYPES, mediaStatusLabel, type MediaStatus, type MediaType } from '@/data/constants'
import type { MediaItem } from '@/data/types'
import { useFormatters } from '@/hooks/useFormatters'
import { useListControls } from '@/hooks/useListControls'
import { useToday } from '@/hooks/useNow'
import { mediaProgress, mediaStats } from '@/selectors/media'
import { addMonthsISO, eachMonth, formatMonthKey, monthKey } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { actions, useCollection, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, ProgressBar, Stat } from '@/components/ui/display'
import { Segmented, Select } from '@/components/ui/inputs'
import { RatingDisplay } from '@/components/ui/pickers'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { PageHeader } from '@/components/layout/PageHeader'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { RecordActions } from '@/components/shared/RecordActions'
import { editor } from '@/components/editor/editorStore'

export const MEDIA_ICONS: Record<MediaType, typeof BookOpen> = { book: BookOpen, article: FileText, podcast: Mic, film: Clapperboard, documentary: Tv, educational: GraduationCap }

function MediaCard({ item, list }: { item: MediaItem; list?: boolean }) {
  const fmt = useFormatters()
  const Icon = MEDIA_ICONS[item.type]
  const tone = MEDIA_TYPES.tone(item.type)
  const p = mediaProgress(item)
  const statusSelect = (
    <Select
      size="sm"
      value={item.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const status = e.target.value as MediaStatus
        const today = new Date().toISOString().slice(0, 10)
        actions.update('media', item.id, {
          status,
          startDate: status === 'in_progress' && !item.startDate ? today : item.startDate,
          completedDate: status === 'completed' ? (item.completedDate ?? today) : status === 'want' ? undefined : item.completedDate,
        })
      }}
      aria-label={`Status of ${item.title}`}
      className="w-36"
    >
      {MEDIA_STATUSES.list.map((s) => (
        <option key={s.value} value={s.value}>
          {mediaStatusLabel(s.value, item.type)}
        </option>
      ))}
    </Select>
  )
  if (list) {
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <Icon size={16} style={{ color: toneColor(tone) }} className="shrink-0" />
        <button type="button" onClick={() => editor.edit('media', item.id)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13.5px] text-ink">{item.title}</p>
          <p className="truncate text-[11.5px] text-ink-subtle">{[item.creator, item.category, item.completedDate ? `finished ${fmt.date(item.completedDate)}` : null].filter(Boolean).join(' · ')}</p>
        </button>
        <RatingDisplay value={item.rating} size={12} />
        {statusSelect}
        <RecordActions collection="media" id={item.id} duplicate />
      </li>
    )
  }
  return (
    <article className="panel group flex flex-col overflow-hidden" data-testid="media-card">
      <button type="button" onClick={() => editor.edit('media', item.id)} className="relative flex h-24 items-end justify-between overflow-hidden px-4 pb-3 text-left" style={{ background: `linear-gradient(135deg, ${toneTint(tone, 26)}, ${toneTint(tone, 4)} 70%)` }} aria-label={`Edit ${item.title}`}>
        <Icon size={64} strokeWidth={1} className="absolute -top-2 -right-2 opacity-20 transition-transform duration-500 group-hover:scale-110" style={{ color: toneColor(tone) }} aria-hidden />
        <Badge tone={tone}>{MEDIA_TYPES.label(item.type)}</Badge>
        <RatingDisplay value={item.rating} size={12} />
      </button>
      <div className="flex flex-1 flex-col p-4 pt-3">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => editor.edit('media', item.id)} className="min-w-0 flex-1 text-left">
            <h3 className="line-clamp-2 text-[14.5px] font-medium text-ink">{item.title}</h3>
            {item.creator && <p className="truncate text-[12.5px] text-ink-muted">{item.creator}</p>}
          </button>
          <RecordActions collection="media" id={item.id} duplicate />
        </div>
        {item.category && <p className="mt-1 text-[11.5px] text-ink-subtle">{item.category}</p>}
        <div className="mt-auto space-y-2 pt-3">
          {item.status === 'in_progress' && (
            <div>
              <ProgressBar value={p} size="xs" showValue label={`${item.title} progress`} />
              {item.total !== undefined && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-subtle">
                  <span>
                    {item.progress ?? 0}/{item.total} {MEDIA_PROGRESS_UNITS[item.type]}
                  </span>
                  <button
                    type="button"
                    onClick={() => actions.update('media', item.id, { progress: Math.min(item.total ?? 0, (item.progress ?? 0) + (item.type === 'book' ? 10 : 1)) })}
                    className="rounded px-1.5 py-0.5 text-accent hover:bg-accent/10"
                  >
                    +{item.type === 'book' ? 10 : 1}
                  </button>
                </div>
              )}
            </div>
          )}
          {item.takeaways.length > 0 && <p className="text-[11.5px] text-ink-subtle">{item.takeaways.length} key takeaway{item.takeaways.length === 1 ? '' : 's'}</p>}
          {statusSelect}
        </div>
      </div>
    </article>
  )
}

export default function LibraryPage() {
  const items = useCollection('media')
  const settings = useSettings()
  const today = useToday()
  const year = today.slice(0, 4)
  const [type, setType] = useState<'all' | MediaType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const stats = mediaStats(items, year)
  const scoped = type === 'all' ? items : items.filter((i) => i.type === type)
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])].sort()
  const controls = useListControls<MediaItem>(scoped, {
    search: (i) => `${i.title} ${i.creator ?? ''} ${i.category ?? ''} ${i.notes ?? ''} ${i.takeaways.join(' ')}`,
    filters: [
      { key: 'status', label: 'Statuses', options: MEDIA_STATUSES.list, get: (i) => i.status },
      { key: 'category', label: 'Categories', options: categories.map((c) => ({ value: c, label: c })), get: (i) => i.category },
      { key: 'rating', label: 'Ratings', options: [5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r}★` })), get: (i) => (i.rating ? String(i.rating) : undefined) },
    ],
    sorts: [
      { value: 'updated', label: 'Recently updated', get: (i) => i.updatedAt, dir: 'desc' },
      { value: 'completed', label: 'Date finished', get: (i) => i.completedDate, dir: 'desc' },
      { value: 'rating', label: 'Rating', get: (i) => i.rating, dir: 'desc' },
      { value: 'title', label: 'Title', get: (i) => i.title },
      { value: 'creator', label: 'Author / creator', get: (i) => i.creator },
    ],
  })
  const monthly = useMemo(() => {
    const months = eachMonth(addMonthsISO(`${monthKey(today)}-01`, -11), today)
    return months.map((m) => {
      const row: Record<string, string | number> = { month: m, label: formatMonthKey(m, 'MMM') }
      for (const t of MEDIA_TYPES.list) row[t.value] = items.filter((i) => i.status === 'completed' && i.type === t.value && i.completedDate && monthKey(i.completedDate) === m).length
      return row
    })
  }, [items, today])
  const typesWithData = MEDIA_TYPES.list.filter((t) => monthly.some((m) => Number(m[t.value]) > 0))
  const target = settings.targets.yearlyReading

  return (
    <div>
      <PageHeader
        section="library"
        description="Books, articles, podcasts, films, documentaries and courses — what you want to get to, what you're on, and what you took away."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => editor.create('media', type === 'all' ? {} : { type })}>
            Add to library
          </Button>
        }
      />
      {items.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Library} title="Your library is empty" description="Add something you're reading, watching or listening to — or want to. Rate it and note key takeaways when you finish." action={<Button variant="primary" icon={Plus} onClick={() => editor.create('media')}>Add first item</Button>} />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="In progress" value={stats.inProgress} tone="cyan" sub={`${stats.queued} queued`} />
            <Stat label={`Finished in ${year}`} value={target ? `${stats.booksThisYear}/${target}` : stats.completedThisYear} tone="ok" sub={target ? `Books vs your ${year} target · ${stats.completedThisYear} items total` : `${stats.booksThisYear} books`}>
              {target ? <ProgressBar value={(stats.booksThisYear / target) * 100} size="xs" className="mt-2" label="Yearly reading target" /> : null}
            </Stat>
            <Stat label="Average rating" value={stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)} icon={Star} tone="amber" sub="Of rated items" />
            <Stat label="Total in library" value={stats.total} tone="violet" sub={`${stats.completed} completed all-time`} />
          </div>
          <ChartCard
            title="Finished per month"
            description="Last 12 months, by type"
            legend={typesWithData.map((t) => ({ label: t.label, color: series(MEDIA_TYPES.list.indexOf(t)) }))}
            rows={monthly}
            columns={[{ label: 'Month', value: (r) => formatMonthKey(String(r.month)) }, ...MEDIA_TYPES.list.map((t) => ({ label: t.label, value: (r: Record<string, string | number>) => r[t.value], align: 'right' as const }))]}
            empty={typesWithData.length === 0}
            emptyHint="Mark items as Completed to see your reading and watching over time."
            height={200}
            className="mb-5"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: 'var(--color-line)' }} content={(p) => <ChartTooltip {...(p as object)} formatLabel={(_l, r) => formatMonthKey(String(r?.month))} />} />
                {MEDIA_TYPES.list.map((t, i) => (
                  <Bar key={t.value} dataKey={t.value} name={t.label} stackId="m" fill={series(i)} stroke="var(--color-panel)" strokeWidth={1} maxBarSize={26} radius={i === MEDIA_TYPES.list.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="no-scrollbar mb-3 overflow-x-auto">
            <Segmented
              value={type}
              onChange={setType}
              ariaLabel="Media type"
              options={[{ value: 'all', label: `All · ${items.length}` }, ...MEDIA_TYPES.list.map((t) => ({ value: t.value, label: `${t.label} · ${stats.byType[t.value] ?? 0}` }))]}
            />
          </div>
          <ListToolbar controls={controls} placeholder="Search titles, creators, notes, takeaways…" total={scoped.length}>
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              ariaLabel="Layout"
              options={[
                { value: 'grid', label: <LayoutGrid size={14} aria-label="Grid" /> },
                { value: 'list', label: <List size={14} aria-label="List" /> },
              ]}
            />
          </ListToolbar>
          {controls.results.length === 0 ? (
            <div className="panel">
              <EmptyState compact title="Nothing matches" description="Try clearing filters." />
            </div>
          ) : view === 'grid' ? (
            <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4')}>
              {controls.results.map((i) => (
                <MediaCard key={i.id} item={i} />
              ))}
            </div>
          ) : (
            <ul className="panel divide-y divide-line">
              {controls.results.map((i) => (
                <MediaCard key={i.id} item={i} list />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
