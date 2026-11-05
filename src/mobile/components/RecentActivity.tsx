import { format } from 'date-fns'
import { COLLECTIONS } from '@/data/registry'
import type { CollectionKey } from '@/data/types'
import { useToday } from '@/hooks/useNow'
import { dateOfTimestamp, relativeDay } from '@/lib/dates'
import { truncate } from '@/lib/utils'
import { useDatabase } from '@/store/store'
import { openRecord } from '../editor/openRecord'
import { Cell, EmptyRow, Section } from '../ui/List'

/** The latest entries of the activity log, each with its day and time. */
export function RecentActivity({ limit = 10 }: { limit?: number }) {
  const db = useDatabase()
  const today = useToday()
  return (
    <Section header="Recent activity" footer={db.activity.length > limit ? `The last ${limit} of ${db.activity.length} logged changes.` : undefined}>
      {db.activity.length === 0 && <EmptyRow>Everything you add, complete or change is logged here.</EmptyRow>}
      {db.activity.slice(0, limit).map((a) => {
        const key = a.collection as CollectionKey
        const exists = a.action !== 'deleted' && (db[key] as { id: string }[] | undefined)?.some((r) => r.id === a.entityId)
        const day = dateOfTimestamp(a.at)
        return (
          <Cell
            key={a.id}
            title={truncate(a.label, 48)}
            subtitle={`${a.action[0].toUpperCase()}${a.action.slice(1)} ${COLLECTIONS[key]?.singular.toLowerCase() ?? 'record'}`}
            // A day as well as the time, so older changes don't look like today's.
            detail={<span className="ios-footnote">{`${relativeDay(day, today)} ${format(new Date(a.at), 'HH:mm')}`}</span>}
            onClick={exists ? () => openRecord(key, a.entityId) : undefined}
            testId="m-activity-row"
          />
        )
      })}
    </Section>
  )
}
