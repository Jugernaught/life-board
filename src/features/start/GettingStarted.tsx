import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, LayoutTemplate, Repeat, Rocket, X } from 'lucide-react'
import { HABIT_PACKS, ROUTINE_PACKS } from '@/data/templates'
import { useToday } from '@/hooks/useNow'
import { describeRepeat } from '@/lib/recurrence'
import { cn } from '@/lib/utils'
import { lastExportedAt } from '@/store/backups'
import { actions, useDatabase } from '@/store/store'
import { Button, IconButton } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/display'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import { useUI } from '@/components/command/uiStore'
import { planDay } from '@/features/planday/model'
import { type StartStepId, addTemplates, existingTemplateIds, showGettingStarted, startSteps, templates, useTemplates } from './model'

/** Command Centre card that guides a new person through the essentials. */
export function GettingStartedCard() {
  const db = useDatabase()
  const navigate = useNavigate()
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
    backup: () => navigate('/settings?tab=data'),
  }
  return (
    <section className="panel mb-5 p-5" aria-labelledby="gs-title" data-testid="getting-started">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
          <Rocket size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="gs-title" className="title text-[16px] font-semibold">
            Get started with LIFE OS
          </h2>
          <p className="text-[13px] text-ink-muted">
            {done} of {steps.length} done — each step ticks itself off as you go.
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={LayoutTemplate} onClick={() => templates.show()}>
          Starter templates
        </Button>
        <IconButton icon={X} label="Hide the getting-started guide" size="sm" onClick={() => actions.updateSettings({ gettingStartedDismissed: true })} />
      </div>
      <ProgressBar value={(done / steps.length) * 100} size="sm" className="mt-4" label="Getting started progress" />
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={run[s.id]}
              disabled={s.done}
              data-testid={`gs-${s.id}`}
              data-done={s.done || undefined}
              className={cn('flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors', s.done ? 'border-transparent' : 'border-line bg-panel-2/40 hover:border-accent/40')}
            >
              <span className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border', s.done ? 'border-ok bg-ok text-white' : 'border-line-strong')}>
                {s.done && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[13.5px]', s.done ? 'text-ink-subtle line-through' : 'text-ink')}>{s.label}</span>
                {!s.done && <span className="block text-[12px] text-ink-muted">{s.hint}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Pick ready-made habits and repeating tasks; only what you tick is added. */
export function TemplatesDialog() {
  const { open, hide, session } = useTemplates()
  // A fresh picker every time it opens.
  return <TemplatesModal key={session} open={open} onClose={hide} />
}

function TemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDatabase()
  const today = useToday()
  const existing = useMemo(() => existingTemplateIds(db), [db])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const add = () => {
    const r = addTemplates(picked, today)
    const parts = [r.habits && `${r.habits} habit${r.habits === 1 ? '' : 's'}`, r.tasks && `${r.tasks} repeating task${r.tasks === 1 ? '' : 's'}`].filter(Boolean)
    toast({ title: `Added ${parts.join(' and ')}`, description: 'Edit or remove them any time.', tone: 'success' })
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Starter templates"
      description="Tick what fits your life. Nothing is added until you choose it."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!picked.size} onClick={add} data-testid="tpl-add">
            {picked.size ? `Add ${picked.size}` : 'Pick some to add'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <p className="eyebrow">Habits</p>
          {HABIT_PACKS.map((p) => (
            <div key={p.id}>
              <p className="text-[13.5px] font-semibold text-ink">{p.title}</p>
              <p className="mb-2 text-[12.5px] text-ink-muted">{p.description}</p>
              <div className="space-y-1.5">
                {p.items.map((h) => (
                  <TemplateItem
                    key={h.id}
                    id={h.id}
                    has={existing.has(h.id)}
                    on={picked.has(h.id)}
                    onToggle={toggle}
                    title={h.name}
                    sub={h.schedule === 'weekly' ? `${h.timesPerWeek}× a week · ${h.description}` : h.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <p className="eyebrow">Repeating tasks</p>
          {ROUTINE_PACKS.map((p) => (
            <div key={p.id}>
              <p className="text-[13.5px] font-semibold text-ink">{p.title}</p>
              <p className="mb-2 text-[12.5px] text-ink-muted">{p.description}</p>
              <div className="space-y-1.5">
                {p.items.map((r) => (
                  <TemplateItem
                    key={r.id}
                    id={r.id}
                    has={existing.has(r.id)}
                    on={picked.has(r.id)}
                    onToggle={toggle}
                    title={r.title}
                    icon
                    sub={`${describeRepeat(r.repeat)}${r.checklist?.length ? ` · ${r.checklist.length} steps` : ''}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function TemplateItem({ id, title, sub, icon, has, on, onToggle }: { id: string; title: string; sub: string; icon?: boolean; has: boolean; on: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={has || on}
      disabled={has}
      onClick={() => onToggle(id)}
      data-testid={`tpl-${id}`}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60',
        on ? 'border-accent/50 bg-accent/10' : 'border-line bg-panel-2/40 hover:border-line-strong',
      )}
    >
      <span className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border', on || has ? 'border-accent bg-accent-fill text-on-accent' : 'border-line-strong')}>
        {(on || has) && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ink">{title}</span>
        <span className="flex items-center gap-1 text-[12px] text-ink-muted">
          {icon && <Repeat size={11} aria-hidden />}
          {has ? 'Already added' : sub}
        </span>
      </span>
    </button>
  )
}
