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
          <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="eyebrow flex items-center gap-2 text-accent/80">
            <Icon size={12} className="text-accent" />
            <span>{navIndex(section)}</span>
            <span className="text-ink-subtle">//</span>
            <span>{item.label}</span>
          </motion.p>
          <h1 className="mt-2 font-display text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[30px]">{title ?? item.label}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  )
}
