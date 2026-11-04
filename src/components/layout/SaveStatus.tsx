import { Link } from 'react-router'
import { AlertTriangle, CloudOff, HardDrive, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useApp } from '@/store/store'
import { cn } from '@/lib/utils'

/** Honest indicator of where data lives and whether the latest change is saved. */
export function SaveStatus({ compact }: { compact?: boolean }) {
  const save = useApp((s) => s.save)
  const storage = useApp((s) => s.storage)
  if (storage?.kind === 'memory') {
    return (
      <Link to="/settings?tab=data" className="flex items-center gap-2 rounded-md px-2 py-1 text-[11.5px] text-warn hover:bg-warn/10" title={storage.warning}>
        <CloudOff size={13} />
        {!compact && <span>Not saved — storage blocked</span>}
      </Link>
    )
  }
  const label =
    save.status === 'saving' ? 'Saving…' : save.status === 'error' ? 'Save failed' : save.lastSavedAt ? `Saved locally · ${format(new Date(save.lastSavedAt), 'HH:mm')}` : 'Stored locally'
  const Icon = save.status === 'saving' ? Loader2 : save.status === 'error' ? AlertTriangle : HardDrive
  return (
    <Link
      to="/settings?tab=data"
      title={save.status === 'error' ? save.error : `Your data is stored in ${storage?.label ?? 'this browser'}. Nothing is sent to a server.`}
      className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-[11.5px] transition-colors hover:bg-panel-3/60', save.status === 'error' ? 'text-bad' : 'text-ink-subtle hover:text-ink-muted')}
      data-testid="save-status"
      data-status={save.status}
    >
      <Icon size={13} className={cn(save.status === 'saving' && 'animate-spin', save.status === 'saved' && 'text-ok')} />
      {!compact && <span className="truncate font-mono">{label}</span>}
    </Link>
  )
}
