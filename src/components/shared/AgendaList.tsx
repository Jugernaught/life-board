import { useNavigate } from 'react-router'
import { Briefcase, CalendarClock, CheckSquare, Flag, GraduationCap, Milestone, PartyPopper, PoundSterling, Target, Timer } from 'lucide-react'
import { AGENDA_KIND_LABEL, type AgendaItem, type AgendaKind } from '@/selectors/agenda'
import { useFormatters } from '@/hooks/useFormatters'
import { formatDate, relativeDay } from '@/lib/dates'
import { toneColor, toneTint } from '@/lib/tone'
import { cn, groupBy } from '@/lib/utils'
import { editor } from '@/components/editor/editorStore'

export const AGENDA_ICONS: Record<AgendaKind, typeof CalendarClock> = {
  event: CalendarClock,
  block: Timer,
  deadline: Flag,
  task: CheckSquare,
  exam: GraduationCap,
  interview: Briefcase,
  milestone: Milestone,
  occasion: PartyPopper,
  payment: PoundSterling,
  goal: Target,
}

export function openAgendaItem(item: AgendaItem, navigate: (href: string) => void) {
  if (item.sourceKey === 'events' || item.sourceKey === 'tasks') editor.edit(item.sourceKey, item.sourceId)
  else navigate(item.href)
}

export function AgendaRow({ item, showDate }: { item: AgendaItem; showDate?: boolean }) {
  const fmt = useFormatters()
  const navigate = useNavigate()
  const Icon = AGENDA_ICONS[item.kind]
  return (
    <button
      type="button"
      onClick={() => openAgendaItem(item, navigate)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel-3/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border" style={{ color: toneColor(item.tone), background: toneTint(item.tone, 10), borderColor: toneTint(item.tone, 25) }}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13.5px] text-ink', item.done && 'text-ink-subtle line-through')}>{item.title}</span>
        <span className="block truncate text-[11.5px] text-ink-subtle">
          {AGENDA_KIND_LABEL[item.kind]}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
          {showDate ? ` · ${formatDate(item.date, 'EEE d MMM')}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right font-mono text-[11.5px] text-ink-muted tabular">
        {item.allDay ? 'All day' : `${fmt.time(item.startTime)}${item.endTime ? `–${fmt.time(item.endTime)}` : ''}`}
      </span>
    </button>
  )
}

/** Agenda items grouped under day headings. */
export function AgendaList({ items, today, maxDays }: { items: AgendaItem[]; today: string; maxDays?: number }) {
  const byDay = groupBy(items, (i) => i.date)
  const days = Object.keys(byDay).sort().slice(0, maxDays)
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <div key={d}>
          <p className="eyebrow mb-1 flex items-center gap-2 px-2">
            <span className={cn(d === today && 'text-accent')}>{relativeDay(d, today)}</span>
            <span className="text-ink-subtle/60">{formatDate(d, 'EEE d MMM')}</span>
          </p>
          <div className="-mx-0">
            {byDay[d].map((item) => (
              <AgendaRow key={item.key} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
