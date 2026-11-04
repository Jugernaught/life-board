import { AlertOctagon, Download, RefreshCw } from 'lucide-react'
import { useApp } from '@/store/store'
import { downloadJson } from '@/store/backups'
import { todayISO } from '@/lib/dates'
import { Button } from '@/components/ui/Button'
import { BackgroundFX } from '@/components/layout/BackgroundFX'

/**
 * Shown when stored data can't be read. Nothing is overwritten while this is
 * on screen — you can download the raw data to keep it safe.
 */
export function RecoveryScreen() {
  const error = useApp((s) => s.loadError)
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <BackgroundFX enabled={false} />
      <div className="panel hud w-full max-w-lg p-6">
        <div className="flex items-center gap-3">
          <AlertOctagon className="text-bad" />
          <h1 className="font-display text-xl font-semibold">Your data couldn’t be loaded</h1>
        </div>
        <p className="mt-3 text-sm text-ink-muted">LIFE OS found saved data but couldn’t read it. To protect it, nothing has been changed or overwritten.</p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-[12px] whitespace-pre-wrap text-bad">{error?.message}</pre>
        <div className="mt-5 flex flex-wrap gap-2">
          {error?.raw !== undefined && (
            <Button variant="primary" icon={Download} onClick={() => downloadJson(`life-os-raw-data-${todayISO()}.json`, error.raw)}>
              Download raw data
            </Button>
          )}
          <Button icon={RefreshCw} onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-subtle">
          If this keeps happening, download the raw data, then you can import it once the problem is fixed (Settings → Data → Import), which validates every record before applying it.
        </p>
      </div>
    </div>
  )
}
