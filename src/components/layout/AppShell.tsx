import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys'
import { useApp, useSettings } from '@/store/store'
import { Skeleton } from '@/components/ui/display'
import { CommandPalette } from '@/components/command/CommandPalette'
import { QuickAdd } from '@/components/command/QuickAdd'
import { ShortcutsHelp } from '@/components/command/ShortcutsHelp'
import { EditorHost } from '@/components/editor/EditorHost'
import { BackgroundFX } from './BackgroundFX'
import { MobileBanner } from './MobileBanner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const settings = useSettings()
  const storageWarning = useApp((s) => s.storage?.warning)
  useGlobalHotkeys()
  return (
    <div className="flex min-h-dvh">
      <BackgroundFX enabled={settings.effects} />
      <a href="#main" className="sr-only z-[100] rounded-md bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <MobileBanner />
        {storageWarning && (
          <div role="status" className="no-print border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-[12.5px] text-warn sm:px-6">
            {storageWarning}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-7 lg:px-8">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <EditorHost />
      <QuickAdd />
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  )
}
