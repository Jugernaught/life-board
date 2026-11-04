import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { WIDGET_META, defaultDashboard } from '@/data/defaults'
import type { WidgetPref, WidgetSize } from '@/data/types'
import { actions, useSettings } from '@/store/store'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/inputs'
import { Modal } from '@/components/ui/Modal'

const SIZES: { value: WidgetSize; label: string; title: string }[] = [
  { value: 's', label: 'S', title: 'Small — a third of the row' },
  { value: 'm', label: 'M', title: 'Medium — half of the row' },
  { value: 'l', label: 'L', title: 'Large — two thirds of the row' },
  { value: 'xl', label: 'XL', title: 'Full width' },
]

export function DashboardLayoutEditor() {
  const { dashboard } = useSettings()
  const set = (next: WidgetPref[]) => actions.updateSettings({ dashboard: next })
  const move = (i: number, d: -1 | 1) => {
    const next = [...dashboard]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }
  return (
    <div>
      <Reorder.Group axis="y" values={dashboard} onReorder={set} className="space-y-1.5">
        {dashboard.map((w, i) => (
          <Row key={w.id} pref={w} index={i} count={dashboard.length} onChange={(p) => set(dashboard.map((x) => (x.id === w.id ? { ...x, ...p } : x)))} onMove={(d) => move(i, d)} />
        ))}
      </Reorder.Group>
      <div className="mt-4 flex justify-between gap-2">
        <p className="text-[12px] text-ink-subtle">Drag rows (or use the arrows) to reorder. Changes apply immediately.</p>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => set(defaultDashboard())}>
          Reset
        </Button>
      </div>
    </div>
  )
}

function Row({ pref, index, count, onChange, onMove }: { pref: WidgetPref; index: number; count: number; onChange: (p: Partial<WidgetPref>) => void; onMove: (d: -1 | 1) => void }) {
  const controls = useDragControls()
  const meta = WIDGET_META[pref.id]
  return (
    <Reorder.Item value={pref} dragListener={false} dragControls={controls} className={cn('flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-2 py-2 sm:flex-nowrap', !pref.visible && 'opacity-60')}>
      <button type="button" aria-label={`Drag ${meta.title}`} onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none rounded p-1 text-ink-subtle hover:text-ink">
        <GripVertical size={15} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ink">{meta.title}</p>
        <p className="truncate text-[11.5px] text-ink-subtle">{meta.description}</p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton icon={ArrowUp} label={`Move ${meta.title} up`} size="xs" disabled={index === 0} onClick={() => onMove(-1)} />
        <IconButton icon={ArrowDown} label={`Move ${meta.title} down`} size="xs" disabled={index === count - 1} onClick={() => onMove(1)} />
        <Segmented value={pref.size} onChange={(size) => onChange({ size })} options={SIZES} size="sm" ariaLabel={`${meta.title} size`} />
        <IconButton icon={pref.visible ? Eye : EyeOff} label={pref.visible ? `Hide ${meta.title}` : `Show ${meta.title}`} active={pref.visible} onClick={() => onChange({ visible: !pref.visible })} />
      </div>
    </Reorder.Item>
  )
}

export function CustomiseDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Customise Command Centre" description="Show, hide, resize and reorder widgets." size="lg" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <DashboardLayoutEditor />
    </Modal>
  )
}
