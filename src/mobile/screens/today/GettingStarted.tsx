import { useMemo, useState } from 'react'
import { Check, LayoutTemplate, Repeat } from 'lucide-react'
import { HABIT_PACKS, ROUTINE_PACKS } from '@/data/templates'
import { useToday } from '@/hooks/useNow'
import { describeRepeat } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import { lastExportedAt } from '@/store/backups'
import { actions, useDatabase } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { useUI } from '@/components/command/uiStore'
import { planDay } from '@/features/planday/model'
import { type StartStepId, addTemplates, existingTemplateIds, showGettingStarted, startSteps, templates, useTemplates } from '@/features/start/model'
import { nav } from '../../nav/navigator'
import { Cell, Section } from '../../ui/List'
import { NavButton } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'

/** "Get Started" on Today: ticks itself off from real data; hide it any time. */
export function GettingStartedSection() {
  const db = useDatabase()
  const { showQuickAdd } = useUI()
  const steps = startSteps(db, !!lastExportedAt())
  if (!showGettingStarted(steps, db.settings.gettingStartedDismissed)) return null
  const done = steps.filter((s) => s.done).length
  const run: Record<StartStepId, () => void> = {
    task: () => showQuickAdd('tasks'),
    priority: () => planDay.show(),
    habit: () => templates.show(),
    checkin: () => showQuickAdd('checkIns'),
    plan: () => planDay.show(),
    backup: () => nav.push('more/settings/data'),
  }
  return (
    <Section
      header={`Get Started · ${done} of ${steps.length}`}
      headerAction={
        <button type="button" onClick={() => actions.updateSettings({ gettingStartedDismissed: true })} className="ios-subhead -mx-2 -my-3 flex min-h-11 items-center px-2 text-accent active:opacity-50">
          Hide
        </button>
      }
    >
      {steps
        // Plan Your Day has its own row on Today until it's done, so it isn't listed twice.
        .filter((s) => !s.done && s.id !== 'plan')
        .slice(0, 3)
        .map((s) => (
          <Cell key={s.id} title={s.label} subtitle={s.hint} leading={<span className="size-[22px] shrink-0 rounded-full border-[1.5px] border-[var(--color-line-strong)]" aria-hidden />} chevron onClick={run[s.id]} testId={`m-gs-${s.id}`} />
        ))}
      <Cell icon={LayoutTemplate} iconTone="violet" title="Starter Templates" subtitle="Ready-made habits and routines" chevron onClick={() => templates.show()} testId="m-gs-templates" />
    </Section>
  )
}

/** Pick ready-made habits and repeating tasks. Mounted once in the iPhone app. */
export function TemplatesSheet() {
  const { open, hide, session } = useTemplates()
  return open ? <TemplatesFlow key={session} onClose={hide} /> : null
}

function TemplatesFlow({ onClose }: { onClose: () => void }) {
  const db = useDatabase()
  const today = useToday()
  const [sheetOpen, setSheetOpen] = useState(true)
  const existing = useMemo(() => existingTemplateIds(db), [db])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const close = () => {
    setSheetOpen(false)
    setTimeout(onClose, 300)
  }
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const add = () => {
    if (!picked.size) return close()
    const r = addTemplates(picked, today)
    const parts = [r.habits && `${r.habits} habit${r.habits === 1 ? '' : 's'}`, r.tasks && `${r.tasks} repeating task${r.tasks === 1 ? '' : 's'}`].filter(Boolean)
    toast({ title: `Added ${parts.join(' and ')}`, tone: 'success' })
    close()
  }
  const row = (id: string, title: string, sub: string, repeat?: boolean) => {
    const has = existing.has(id)
    const on = picked.has(id) || has
    return (
      <button key={id} type="button" role="checkbox" aria-checked={on} disabled={has} onClick={() => toggle(id)} className="ios-press flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-60" data-testid={`m-tpl-${id}`}>
        <span className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]', on ? 'border-transparent bg-accent-fill text-on-accent' : 'border-[var(--color-line-strong)]')}>{on && <Check size={14} strokeWidth={3} />}</span>
        <span className="min-w-0 flex-1">
          <span className="ios-body block text-ink">{title}</span>
          <span className="ios-footnote flex items-center gap-1 text-ink-subtle">
            {repeat && <Repeat size={11} aria-hidden />}
            {has ? 'Already added' : sub}
          </span>
        </span>
      </button>
    )
  }
  return (
    <Sheet
      open={sheetOpen}
      onClose={close}
      title="Templates"
      testId="templates-sheet"
      leading={<NavButton onClick={close}>Cancel</NavButton>}
      trailing={
        <button type="button" onClick={add} disabled={!picked.size} className="ios-headline flex h-11 items-center px-3 text-accent active:opacity-50 disabled:opacity-40" data-testid="m-tpl-add">
          {picked.size ? `Add ${picked.size}` : 'Add'}
        </button>
      }
    >
      <p className="ios-footnote px-8 pb-2 text-ink-subtle">Tick what fits your life. Nothing is added until you choose it.</p>
      {HABIT_PACKS.map((p) => (
        <Section key={p.id} header={`Habits · ${p.title}`} footer={p.description}>
          {p.items.map((h) => row(h.id, h.name, h.schedule === 'weekly' ? `${h.timesPerWeek}× a week · ${h.description}` : h.description))}
        </Section>
      ))}
      {ROUTINE_PACKS.map((p) => (
        <Section key={p.id} header={`Repeating · ${p.title}`} footer={p.description}>
          {p.items.map((r) => row(r.id, r.title, `${describeRepeat(r.repeat)}${r.checklist?.length ? ` · ${r.checklist.length} steps` : ''}`, true))}
        </Section>
      ))}
    </Sheet>
  )
}
