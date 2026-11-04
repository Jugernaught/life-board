import { useMemo } from 'react'
import { type DateFormat, formatDate, formatTime } from '@/lib/dates'
import { type MoneyOptions, formatMoney } from '@/lib/format'
import { useSettings } from '@/store/store'

/** Formatting functions bound to the person's settings (currency, date and time format). */
export function useFormatters() {
  const s = useSettings()
  return useMemo(
    () => ({
      currency: s.currency,
      money: (minor: number, opts: Omit<MoneyOptions, 'currency'> = {}) => formatMoney(minor, { currency: s.currency, ...opts }),
      date: (value: string | undefined) => formatDate(value, s.dateFormat as DateFormat),
      shortDate: (value: string | undefined) => formatDate(value, 'd MMM'),
      time: (value: string | undefined) => formatTime(value, s.timeFormat),
      weekStartsOn: s.weekStartsOn,
    }),
    [s.currency, s.dateFormat, s.timeFormat, s.weekStartsOn],
  )
}
