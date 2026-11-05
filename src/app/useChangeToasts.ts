import { useEffect } from 'react'
import { relativeDay, todayISO } from '@/lib/dates'
import { type Change, actions, appStore } from '@/store/store'
import { toast } from '@/components/ui/toast'

const CHANGED_SINCE = { title: 'Can’t undo — it’s been changed since', description: 'Undoing now would overwrite the newer change.', tone: 'warning' as const }

/** Show what was undone (Ctrl/Cmd+Z), or why it couldn't be. */
export function announceUndo(result: { change: Change; undone: boolean } | undefined) {
  if (!result) {
    toast({ title: 'Nothing to undo', tone: 'info' })
    return
  }
  const { change, undone } = result
  if (!undone) {
    toast({ ...CHANGED_SINCE, description: `${change.label}. ${CHANGED_SINCE.description}` })
    return
  }
  const what = change.kind === 'create' ? 'adding' : change.kind === 'delete' ? 'deleting' : change.action === 'completed' ? 'completing' : 'editing'
  toast({ title: `Undid ${what}`, description: change.label, tone: 'info' })
}

/** Undo one change from its notification; says so if the record changed since (nothing is overwritten). */
export function undoWithNotice(changeId: string): boolean {
  const ok = actions.undoChange(changeId)
  if (!ok) toast(CHANGED_SINCE)
  return ok
}

/**
 * Completing a task shows a notification with Undo — and, for a repeating
 * task, when it comes back. Listens to the store, so it works for every place
 * a task can be ticked off without touching each one.
 */
export function useChangeToasts() {
  useEffect(() => {
    let seen = appStore.getState().history.at(-1)?.id
    return appStore.subscribe((state) => {
      const last = state.history.at(-1)
      if (!last || last.id === seen) return
      seen = last.id
      if (last.kind !== 'update' || last.key !== 'tasks' || last.action !== 'completed') return
      const next = last.spawned ? state.db.tasks.find((t) => t.id === last.spawned!.id)?.dueDate : undefined
      toast({
        title: next ? `Done · back ${relativeDay(next, todayISO()).toLowerCase()}` : 'Task completed',
        description: last.label,
        tone: 'success',
        action: { label: 'Undo', onClick: () => undoWithNotice(last.id) },
      })
    })
  }, [])
}
