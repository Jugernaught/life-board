/** Custom form controls used by specific record types. */
import { Plus, Star, Trash2 } from 'lucide-react'
import { CAREER_CRITERIA, REFLECTION_PROMPTS } from '@/data/constants'
import type { ExerciseEntry, ResourceLink } from '@/data/types'
import { cn, uid } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, NumberInput, Switch, Textarea } from '@/components/ui/inputs'
import type { CustomFieldProps } from './types'

export function FocusToggle({ value, onChange, ctx }: CustomFieldProps) {
  const on = value === ctx.today
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2.5">
      <Switch checked={on} onChange={(v) => onChange(v ? ctx.today : undefined)} label="Make this one of today's priorities" description="Shows in Today's priorities on the Command Centre" />
    </div>
  )
}

export function ProgressSlider({ value, onChange, id }: CustomFieldProps) {
  const v = typeof value === 'number' ? value : 0
  return (
    <div className="flex items-center gap-4">
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 flex-1 cursor-pointer accent-[var(--color-accent)]"
        aria-label="Progress percent"
      />
      <span className="w-12 text-right font-mono text-sm text-ink tabular">{v}%</span>
    </div>
  )
}

export function ResourcesEditor({ value, onChange }: CustomFieldProps) {
  const items = (value as ResourceLink[]) ?? []
  const patch = (id: string, p: Partial<ResourceLink>) => onChange(items.map((r) => (r.id === id ? { ...r, ...p } : r)))
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line bg-panel-2/40 p-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input value={r.title} placeholder="Title" aria-label="Resource title" onChange={(e) => patch(r.id, { title: e.target.value })} />
          <Input className="order-3 col-span-2 sm:order-none sm:col-span-1" value={r.url ?? ''} placeholder="https://…" aria-label="Resource link" onChange={(e) => patch(r.id, { url: e.target.value || undefined })} />
          <IconButton icon={Trash2} label="Remove resource" variant="danger" onClick={() => onChange(items.filter((x) => x.id !== r.id))} className="self-center" />
        </div>
      ))}
      <Button size="sm" icon={Plus} onClick={() => onChange([...items, { id: uid(), title: '' }])}>
        Add resource
      </Button>
    </div>
  )
}

export function ScoresEditor({ value, onChange }: CustomFieldProps) {
  const scores = (value as Record<string, number>) ?? {}
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-ink-subtle">Rate each factor 1–5 for this path. Used in Career → Compare. Leave blank if unsure.</p>
      {CAREER_CRITERIA.list.map((c) => (
        <div key={c.value} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/30 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[13.5px] text-ink">{c.label}</p>
            <p className="text-[11.5px] text-ink-subtle">{c.description}</p>
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={c.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={scores[c.value] === n}
                aria-label={`${c.label} ${n} of 5`}
                onClick={() => {
                  const next = { ...scores }
                  if (next[c.value] === n) delete next[c.value]
                  else next[c.value] = n
                  onChange(next)
                }}
                className="p-0.5"
              >
                <Star size={17} className={n <= (scores[c.value] ?? 0) ? 'fill-accent text-accent' : 'text-ink-subtle/50'} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ExercisesEditor({ value, onChange }: CustomFieldProps) {
  const rows = (value as ExerciseEntry[]) ?? []
  const patch = (id: string, p: Partial<ExerciseEntry>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const num = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? undefined : n)
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="hidden grid-cols-[1.6fr_repeat(5,minmax(0,1fr))_auto] gap-2 px-1 text-[11px] tracking-wide text-ink-subtle uppercase md:grid">
          <span>Exercise</span>
          <span>Sets</span>
          <span>Reps</span>
          <span>kg</span>
          <span>km</span>
          <span>min</span>
          <span className="w-8" />
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-panel-2/30 p-2 md:grid-cols-[1.6fr_repeat(5,minmax(0,1fr))_auto] md:border-0 md:bg-transparent md:p-0">
          <Input className="col-span-3 md:col-span-1" value={r.name} placeholder="e.g. Squat" aria-label="Exercise name" onChange={(e) => patch(r.id, { name: e.target.value })} />
          <NumberInput value={r.sets} onChange={(v) => patch(r.id, { sets: num(v) })} placeholder="Sets" aria-label="Sets" />
          <NumberInput value={r.reps} onChange={(v) => patch(r.id, { reps: num(v) })} placeholder="Reps" aria-label="Reps" />
          <NumberInput value={r.weightKg} onChange={(v) => patch(r.id, { weightKg: num(v) })} placeholder="kg" aria-label="Weight in kilograms" />
          <NumberInput value={r.distanceKm} onChange={(v) => patch(r.id, { distanceKm: num(v) })} placeholder="km" aria-label="Distance in kilometres" />
          <NumberInput value={r.durationMin} onChange={(v) => patch(r.id, { durationMin: num(v) })} placeholder="min" aria-label="Duration in minutes" />
          <IconButton icon={Trash2} label="Remove exercise" variant="danger" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="justify-self-end" />
        </div>
      ))}
      <Button size="sm" icon={Plus} onClick={() => onChange([...rows, { id: uid(), name: '' }])}>
        Add exercise
      </Button>
    </div>
  )
}

export function StepsEditor({ value, onChange }: CustomFieldProps) {
  const steps = (value as { id: string; title: string }[]) ?? []
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="w-6 text-center font-mono text-[11px] text-ink-subtle">{String(i + 1).padStart(2, '0')}</span>
          <Input value={s.title} placeholder="Step" aria-label={`Step ${i + 1}`} onChange={(e) => onChange(steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
          <IconButton icon={Trash2} label="Remove step" variant="danger" onClick={() => onChange(steps.filter((x) => x.id !== s.id))} />
        </div>
      ))}
      <Button size="sm" icon={Plus} onClick={() => onChange([...steps, { id: uid(), title: '' }])}>
        Add step
      </Button>
    </div>
  )
}

export function PromptsEditor({ value, onChange }: CustomFieldProps) {
  const prompts = (value as Record<string, string | undefined>) ?? {}
  return (
    <div className="space-y-3">
      {REFLECTION_PROMPTS.map((p) => (
        <div key={p.key}>
          <label className="mb-1 block text-[12.5px] text-ink-muted">{p.label}</label>
          <Textarea
            rows={2}
            value={prompts[p.key] ?? ''}
            aria-label={p.label}
            onChange={(e) => onChange({ ...prompts, [p.key]: e.target.value || undefined })}
          />
        </div>
      ))}
    </div>
  )
}

export function Hint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[12px] text-ink-subtle', className)}>{children}</p>
}
