import type { ImportantDate, Person } from '@/data/types'
import { addDaysISO, diffDays, nextYearlyOccurrence } from '@/lib/dates'

export function reconnectStatus(person: Person, today: string) {
  if (!person.cadenceDays) return { due: false, dueDate: undefined as string | undefined, daysSince: person.lastContact ? diffDays(person.lastContact, today) : null }
  const dueDate = person.lastContact ? addDaysISO(person.lastContact, person.cadenceDays) : today
  return { due: dueDate <= today, dueDate, daysSince: person.lastContact ? diffDays(person.lastContact, today) : null }
}

export function peopleToReconnect(people: Person[], today: string) {
  return people
    .map((p) => ({ person: p, ...reconnectStatus(p, today) }))
    .filter((p) => p.due)
    .sort((a, b) => ((a.dueDate ?? '') < (b.dueDate ?? '') ? -1 : 1))
}

/** Next occurrence of an important date; one-off dates in the past return null. */
export function nextOccurrence(d: ImportantDate, today: string): string | null {
  if (d.recurring) return nextYearlyOccurrence(d.date, today)
  return d.date >= today ? d.date : null
}

export function upcomingOccasions(dates: ImportantDate[], today: string, withinDays = 60) {
  const limit = addDaysISO(today, withinDays)
  return dates
    .map((d) => ({ item: d, next: nextOccurrence(d, today) }))
    .filter((x): x is { item: ImportantDate; next: string } => !!x.next && x.next <= limit)
    .map((x) => ({ ...x, inDays: diffDays(today, x.next), years: x.item.recurring && x.item.kind !== 'occasion' ? Number(x.next.slice(0, 4)) - Number(x.item.date.slice(0, 4)) : undefined }))
    .sort((a, b) => (a.next < b.next ? -1 : 1))
}
