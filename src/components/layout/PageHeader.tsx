import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { navIndex, navItem } from '@/app/navigation'
import type { SectionId } from '@/data/registry'

export function PageHeader({ section, title, description, actions, children }: { section: SectionId; title?: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const item = navItem(section)
  const Icon = item.icon
  return (
    <header className="mb-5 sm:mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="eyebrow cyber-only mb-2 flex items-center gap-2 text-accent">
            <Icon size={12} className="text-accent" />
            <span>{navIndex(section)}</span>
            <span className="text-ink-subtle">//</span>
            <span>{item.label}</span>
          </motion.p>
          <h1 className="title flex items-center gap-3 text-[26px] leading-tight font-bold text-ink sm:text-[32px]">
            <span className="not-cyber flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-fill text-on-accent shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--color-accent)_70%,transparent)] sm:size-10" aria-hidden>
              <Icon size={20} strokeWidth={2} />
            </span>
            {title ?? item.label}
          </h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  )
}
