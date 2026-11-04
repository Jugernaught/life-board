import type { ComponentType, ReactNode } from 'react'
import type { WidgetSize } from '@/data/types'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'

type IconType = ComponentType<{ className?: string; size?: number; strokeWidth?: number }>

export const SIZE_CLASSES: Record<WidgetSize, string> = {
  s: 'md:col-span-6 xl:col-span-4',
  m: 'md:col-span-6 xl:col-span-6',
  l: 'md:col-span-12 xl:col-span-8',
  xl: 'md:col-span-12',
}

export interface WidgetProps {
  today: string
}

export function Widget({ title, icon, actions, children, size, eyebrow, bodyClassName, testId }: { title: string; icon?: IconType; actions?: ReactNode; children: ReactNode; size: WidgetSize; eyebrow?: string; bodyClassName?: string; testId?: string }) {
  return (
    <div className={cn('col-span-1 min-w-0', SIZE_CLASSES[size])} data-testid={testId}>
      <Panel title={title} icon={icon} actions={actions} eyebrow={eyebrow} className="h-full" bodyClassName={bodyClassName}>
        {children}
      </Panel>
    </div>
  )
}

/** One-line inline input that creates something on Enter. */
export function InlineAdd({ placeholder, onAdd, ariaLabel }: { placeholder: string; onAdd: (text: string) => void; ariaLabel?: string }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const input = e.currentTarget.elements.namedItem('text') as HTMLInputElement
        const v = input.value.trim()
        if (!v) return
        onAdd(v)
        input.value = ''
      }}
      className="mt-2"
    >
      <input
        name="text"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-dashed border-line-strong bg-transparent px-3 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle focus:border-accent/60 focus:bg-panel-2/50"
      />
    </form>
  )
}
