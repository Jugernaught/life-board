/** Live preview of what a smart title will fill in, with a switch-off per piece. */
import { CalendarDays, Clock, Flag, Hash, Layers, Repeat, Sparkles, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LIFE_AREAS, PRIORITIES } from '@/data/constants'
import { addDaysISO, formatDate, formatTime } from '@/lib/dates'
import type { ParsedQuick, TokenKind } from '@/lib/parseQuick'
import { describeRepeat } from '@/lib/recurrence'
import type { FormContext } from './types'

const ICONS: Record<TokenKind, LucideIcon> = { date: CalendarDays, time: Clock, priority: Flag, tag: Hash, area: Layers, repeat: Repeat }

export function chipLabel(kind: TokenKind, p: ParsedQuick, ctx: FormContext): string {
  switch (kind) {
    case 'date': {
      if (!p.dueDate) return ''
      if (p.dueDate === ctx.today) return 'Today'
      if (p.dueDate === addDaysISO(ctx.today, 1)) return 'Tomorrow'
      return formatDate(p.dueDate, 'EEE d MMM')
    }
    case 'time':
      return p.dueTime ? formatTime(p.dueTime, ctx.settings.timeFormat) : ''
    case 'priority':
      return p.priority ? `${PRIORITIES.label(p.priority)} priority` : ''
    case 'tag':
      return p.tags.map((t) => `#${t}`).join(' ')
    case 'area':
      return p.area ? LIFE_AREAS.label(p.area) : ''
    case 'repeat':
      return p.repeat ? describeRepeat(p.repeat) : ''
  }
}

const ORDER: TokenKind[] = ['date', 'time', 'repeat', 'priority', 'area', 'tag']

export function SmartChips({ parsed, ctx, ignored, onToggle, idleHint }: { parsed: ParsedQuick; ctx: FormContext; ignored: ReadonlySet<TokenKind>; onToggle: (k: TokenKind) => void; idleHint: string }) {
  const found = new Set(parsed.tokens.map((t) => t.kind))
  const kinds = ORDER.filter((k) => found.has(k))
  const off = ORDER.filter((k) => ignored.has(k))
  if (!kinds.length && !off.length)
    return (
      <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-ink-subtle sm:col-span-2" data-testid="smart-hint">
        <Sparkles size={12} aria-hidden /> {idleHint}
      </p>
    )
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-1.5 sm:col-span-2" data-testid="smart-chips" aria-live="polite">
      {kinds.map((k) => {
        const Icon = ICONS[k]
        const label = chipLabel(k, parsed, ctx)
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            data-kind={k}
            aria-label={`${label} — read from the title. Remove`}
            title="Keep these words in the title instead"
            className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 pr-1.5 pl-2.5 text-[12.5px] font-medium text-ink transition-colors hover:border-line hover:bg-panel-2"
          >
            <Icon size={13} className="text-accent" aria-hidden />
            {label}
            <X size={12} className="text-ink-subtle group-hover:text-ink" aria-hidden />
          </button>
        )
      })}
      {off.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onToggle(k)}
          data-kind={k}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12px] text-ink-muted hover:text-ink"
        >
          Read {k === 'tag' ? 'tags' : k} again
        </button>
      ))}
    </div>
  )
}
