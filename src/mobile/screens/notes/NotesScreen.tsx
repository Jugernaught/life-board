import { useState } from 'react'
import { Pin, PinOff } from 'lucide-react'
import { LIFE_AREAS, type LifeArea } from '@/data/constants'
import { dateOfTimestamp, relativeDay } from '@/lib/dates'
import { truncate } from '@/lib/utils'
import { useToday } from '@/hooks/useNow'
import { actions, useCollection } from '@/store/store'
import { RecordScreen } from '../../components/RecordScreen'
import { Chips } from '../../ui/controls'

export function NotesScreen() {
  const notes = useCollection('notes')
  const projects = useCollection('projects')
  const skills = useCollection('skills')
  const today = useToday()
  const [area, setArea] = useState<'all' | LifeArea>('all')
  const items = notes.filter((n) => area === 'all' || n.area === area).sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1))
  const areas = LIFE_AREAS.list.filter((a) => notes.some((n) => n.area === a.value))
  return (
    <RecordScreen
      title="Notes"
      collection="notes"
      testId="screen-notes"
      items={items}
      defaults={area === 'all' ? undefined : { area }}
      search={(n) => `${n.title} ${n.body} ${n.tags.join(' ')}`}
      group={(n) => (n.pinned ? 'Pinned' : 'Notes')}
      groupOrder={(a) => (a === 'Pinned' ? -1 : 1)}
      empty="Ideas, references and anything worth keeping. Notes can belong to a project, a skill or an area of life."
      top={
        areas.length > 1 ? (
          <div className="mb-3 px-4">
            <Chips ariaLabel="Area" value={area} onChange={setArea} options={[{ value: 'all', label: 'All', count: notes.length }, ...areas.map((a) => ({ value: a.value, label: a.label }))]} />
          </div>
        ) : undefined
      }
      extraActions={(n) => [{ label: n.pinned ? 'Unpin' : 'Pin', icon: n.pinned ? PinOff : Pin, tone: 'amber' as const, onAction: () => actions.update('notes', n.id, { pinned: !n.pinned }) }]}
      row={(n) => ({
        title: n.title,
        multiline: true,
        subtitle: (
          <>
            {n.body && <span className="block">{truncate(n.body.replace(/\s+/g, ' '), 110)}</span>}
            <span className="block">
              {[relativeDay(dateOfTimestamp(n.updatedAt), today), LIFE_AREAS.label(n.area), projects.find((p) => p.id === n.projectId)?.name, skills.find((s) => s.id === n.skillId)?.name, ...n.tags.map((t) => `#${t}`)].filter(Boolean).join(' · ')}
            </span>
          </>
        ),
      })}
    />
  )
}
