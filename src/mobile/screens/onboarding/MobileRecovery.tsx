import { AlertOctagon } from 'lucide-react'
import { todayISO } from '@/lib/dates'
import { useApp } from '@/store/store'
import { shareJsonFile } from '../../components/share'

/** Stored data couldn't be read. Nothing is overwritten; offer to save the raw data. */
export function MobileRecovery() {
  const error = useApp((s) => s.loadError)
  return (
    <main className="absolute inset-0 flex flex-col justify-center bg-[var(--ios-grouped)] px-6" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <AlertOctagon size={44} className="text-bad" />
      <h1 className="ios-title2 mt-4 text-ink">Your data couldn’t be loaded</h1>
      <p className="ios-body mt-2 text-ink-subtle">To protect it, nothing has been changed or overwritten.</p>
      <p className="ios-footnote mt-4 rounded-[12px] bg-[var(--ios-cell)] p-3 font-mono text-bad" data-selectable>
        {error?.message}
      </p>
      {error?.raw !== undefined && (
        <button type="button" className="ios-headline mt-6 h-[50px] rounded-[14px] bg-accent text-on-accent" onClick={() => void shareJsonFile(`life-os-raw-data-${todayISO()}.json`, error.raw)}>
          Save Raw Data
        </button>
      )}
      <button type="button" className="ios-body mt-2 h-11 text-accent" onClick={() => window.location.reload()}>
        Try Again
      </button>
    </main>
  )
}
