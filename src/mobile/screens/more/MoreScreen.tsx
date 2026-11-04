import { useMemo, useState } from 'react'
import { BarChart3, BookOpen, Briefcase, Dumbbell, FolderKanban, GraduationCap, Laptop, Settings, StickyNote, Users, Wallet } from 'lucide-react'
import { COLLECTIONS } from '@/data/registry'
import { useToday } from '@/hooks/useNow'
import { monthTotals } from '@/selectors/finance'
import { searchDatabase } from '@/selectors/search'
import { peopleToReconnect } from '@/selectors/social'
import { monthKey } from '@/lib/dates'
import { useFormatters } from '@/hooks/useFormatters'
import { groupBy } from '@/lib/utils'
import { useDatabase } from '@/store/store'
import { openRecord } from '../../editor/openRecord'
import { nav } from '../../nav/navigator'
import { SearchField } from '../../ui/controls'
import { Cell, EmptyRow, Section } from '../../ui/List'
import { Screen } from '../../ui/Screen'

/** Search everything, and every other section, Settings-app style. */
export function MoreScreen() {
  const db = useDatabase()
  const today = useToday()
  const fmt = useFormatters()
  const [query, setQuery] = useState('')
  const results = useMemo(() => (query.trim() ? searchDatabase(db, query, 60) : []), [db, query])
  const grouped = groupBy(results, (r) => r.key)
  const month = monthTotals(db.transactions, monthKey(today))
  const reconnect = peopleToReconnect(db.people, today).length
  return (
    <Screen title="More" large testId="screen-more" header={<SearchField value={query} onChange={setQuery} placeholder="Search everything" testId="more-search" />}>
      {query.trim() ? (
        Object.keys(grouped).length === 0 ? (
          <Section>
            <EmptyRow>No results for “{query}”.</EmptyRow>
          </Section>
        ) : (
          Object.entries(grouped).map(([key, rows]) => (
            <Section key={key} header={COLLECTIONS[key as keyof typeof COLLECTIONS].plural}>
              {rows.map((r) => (
                <Cell key={r.id} title={r.title} subtitle={r.snippet} chevron onClick={() => openRecord(r.key, r.id)} testId="search-result" />
              ))}
            </Section>
          ))
        )
      ) : (
        <>
          <Section>
            <Cell icon={FolderKanban} iconTone="violet" title="Projects" detail={db.projects.filter((p) => p.status === 'active').length || undefined} chevron onClick={() => nav.push('more/projects')} testId="more-projects" />
            <Cell icon={Briefcase} iconTone="info" title="Career & Education" chevron onClick={() => nav.push('more/career')} testId="more-career" />
            <Cell icon={Wallet} iconTone="ok" title="Finances" detail={month.count ? fmt.money(month.expenses, { showPence: false }) : undefined} chevron onClick={() => nav.push('more/finance')} testId="more-finance" />
            <Cell icon={Dumbbell} iconTone="magenta" title="Fitness & Routines" chevron onClick={() => nav.push('more/fitness')} testId="more-fitness" />
            <Cell icon={GraduationCap} iconTone="cyan" title="Learning & Skills" chevron onClick={() => nav.push('more/learning')} testId="more-learning" />
            <Cell icon={BookOpen} iconTone="amber" title="Reading & Media" detail={db.media.filter((m) => m.status === 'in_progress').length || undefined} chevron onClick={() => nav.push('more/library')} testId="more-library" />
            <Cell icon={Users} iconTone="bad" title="Social" detail={reconnect ? `${reconnect} to reconnect` : undefined} chevron onClick={() => nav.push('more/social')} testId="more-social" />
            <Cell icon={StickyNote} iconTone="warn" title="Notes" detail={db.notes.length || undefined} chevron onClick={() => nav.push('more/notes')} testId="more-notes" />
          </Section>
          <Section>
            <Cell icon={BarChart3} iconTone="info" title="Analytics & Reports" chevron onClick={() => nav.push('more/analytics')} testId="more-analytics" />
          </Section>
          <Section footer="The full desktop version shows the same data when used in the same browser.">
            <Cell icon={Settings} iconTone="muted" title="Settings" chevron onClick={() => nav.push('more/settings')} testId="more-settings" />
            <Cell icon={Laptop} iconTone="muted" title="Open Desktop Version" chevron onClick={() => window.location.assign(import.meta.env.BASE_URL)} />
          </Section>
        </>
      )}
    </Screen>
  )
}
