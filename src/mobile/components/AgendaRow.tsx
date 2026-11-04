import type { AgendaItem } from '@/selectors/agenda'
import { AGENDA_KIND_LABEL } from '@/selectors/agenda'
import { useFormatters } from '@/hooks/useFormatters'
import { relativeDay } from '@/lib/dates'
import { toneColor } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { editor } from '@/components/editor/editorStore'
import { openRecord } from '../editor/openRecord'

export function openAgenda(item: AgendaItem) {
  if (item.sourceKey === 'events' || item.sourceKey === 'tasks') editor.edit(item.sourceKey, item.sourceId)
  else openRecord(item.sourceKey, item.sourceId)
}

/** An agenda item in Calendar-app style: time on the left, coloured bar, title. */
export function AgendaRow({ item }: { item: AgendaItem }) {
  const fmt = useFormatters()
  return (
    <button type="button" onClick={() => openAgenda(item)} className="ios-press flex w-full items-stretch gap-3 px-4 py-2.5 text-left" data-testid="m-agenda-row">
      <span className="ios-footnote w-[52px] shrink-0 pt-0.5 text-right text-ink-subtle tabular-nums">
        {item.allDay ? (
          'all-day'
        ) : (
          <>
            <span className="block text-ink">{fmt.time(item.startTime)}</span>
            {item.endTime && <span className="block">{fmt.time(item.endTime)}</span>}
          </>
        )}
      </span>
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: toneColor(item.tone) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('ios-body block truncate text-ink', item.done && 'text-ink-subtle line-through')}>{item.title}</span>
        <span className="ios-footnote block truncate text-ink-subtle">
          {AGENDA_KIND_LABEL[item.kind]}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </span>
      </span>
    </button>
  )
}

/** An agenda item in a list that spans several days: relative date on the left. */
export function AgendaDayRow({ item, today }: { item: AgendaItem; today: string }) {
  const fmt = useFormatters()
  const overdue = !item.done && item.date < today
  return (
    <button type="button" onClick={() => openAgenda(item)} className="ios-press flex w-full items-stretch gap-3 px-4 py-2.5 text-left" data-testid="m-agenda-day-row">
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: toneColor(item.tone) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('ios-body block truncate text-ink', item.done && 'text-ink-subtle line-through')}>{item.title}</span>
        <span className="ios-footnote block truncate text-ink-subtle">
          {AGENDA_KIND_LABEL[item.kind]}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </span>
      </span>
      <span className={cn('ios-footnote shrink-0 self-center text-right tabular-nums', overdue ? 'text-bad' : 'text-ink-subtle')}>
        <span className="block">{relativeDay(item.date, today)}</span>
        {!item.allDay && item.startTime && <span className="block">{fmt.time(item.startTime)}</span>}
      </span>
    </button>
  )
}
