import { Pin, Plus, StickyNote } from 'lucide-react'
import type { LifeArea } from '@/data/constants'
import type { Note } from '@/data/types'
import { truncate } from '@/lib/utils'
import { useCollection } from '@/store/store'
import { editor } from '@/components/editor/editorStore'
import { ActionCell, Cell, Section } from '../ui/List'

/** Notes for one context (a life area, a project or a skill) as a grouped section with "Add Note". */
export function NotesSection({ header = 'Notes', filter, defaults, limit = 5, footer }: { header?: string; filter: (n: Note) => boolean; defaults: { area?: LifeArea; projectId?: string; skillId?: string }; limit?: number; footer?: string }) {
  const notes = useCollection('notes')
  const list = notes.filter(filter).sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1))
  return (
    <Section header={header} footer={footer ?? (list.length > limit ? `${list.length - limit} more in Notes.` : undefined)}>
      {list.slice(0, limit).map((n) => (
        <Cell key={n.id} icon={n.pinned ? Pin : StickyNote} iconTone={n.pinned ? 'amber' : 'muted'} title={n.title} subtitle={n.body ? truncate(n.body.replace(/\s+/g, ' '), 90) : undefined} chevron onClick={() => editor.edit('notes', n.id)} testId="m-note-cell" />
      ))}
      <ActionCell icon={Plus} onClick={() => editor.create('notes', defaults)}>
        Add Note
      </ActionCell>
    </Section>
  )
}
