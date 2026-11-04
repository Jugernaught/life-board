import { Pin, Plus, StickyNote } from 'lucide-react'
import type { LifeArea } from '@/data/constants'
import type { Note } from '@/data/types'
import { formatDistanceToNowStrict } from 'date-fns'
import { useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/display'
import { Panel } from '@/components/ui/Panel'
import { editor } from '@/components/editor/editorStore'

/** Notes for one context (a project, a skill, or a life area), with add. */
export function NotesPanel({
  title = 'Notes',
  filter,
  defaults,
  emptyText = 'No notes yet.',
  className,
  limit = 20,
}: {
  title?: string
  filter: (n: Note) => boolean
  defaults: { area?: LifeArea; projectId?: string; skillId?: string }
  emptyText?: string
  className?: string
  limit?: number
}) {
  const notes = useCollection('notes')
  const list = notes.filter(filter).sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1))
  return (
    <Panel
      title={title}
      icon={StickyNote}
      className={className}
      actions={
        <Button size="xs" variant="ghost" icon={Plus} onClick={() => editor.create('notes', defaults)}>
          Note
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState compact title={emptyText} />
      ) : (
        <ul className="space-y-1.5">
          {list.slice(0, limit).map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => editor.edit('notes', n.id)} className="w-full rounded-lg border border-line bg-panel-2/30 px-3 py-2 text-left transition-colors hover:border-line-strong">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  {n.pinned && <Pin size={11} className="text-accent" />}
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] font-normal text-ink-subtle">{formatDistanceToNowStrict(new Date(n.updatedAt))}</span>
                </span>
                {n.body && <span className="mt-0.5 line-clamp-3 block text-[12.5px] whitespace-pre-line text-ink-muted">{n.body}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
