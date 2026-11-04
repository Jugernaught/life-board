import { useEffect, useState } from 'react'
import { toISODate } from '@/lib/dates'

/** Current time, re-rendering every `intervalMs` (default: each minute, aligned to the minute). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const align = intervalMs >= 60_000 ? 60_000 - (Date.now() % 60_000) : intervalMs
    const timeout = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), intervalMs)
    }, align)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [intervalMs])
  return now
}

/** Today's date (yyyy-MM-dd); updates automatically after midnight. */
export function useToday(): string {
  return toISODate(useNow())
}
