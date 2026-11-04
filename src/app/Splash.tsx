import { Suspense, type ReactNode } from 'react'
import { BackgroundFX } from '@/components/layout/BackgroundFX'
import { Logo } from '@/components/layout/Sidebar'

export function Splash({ message = 'Loading your data…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <BackgroundFX enabled />
      <Logo />
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-1/3 animate-[drift_1.2s_ease-in-out_infinite_alternate] rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
      </div>
      <p className="font-mono text-[11px] tracking-widest text-ink-subtle uppercase">{message}</p>
    </div>
  )
}

export function WithSplash({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Splash />}>{children}</Suspense>
}
