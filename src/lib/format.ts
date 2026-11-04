/**
 * Number, money and duration formatting.
 *
 * Money is stored in *minor units* (pence for GBP) as integers. Adding
 * 0.1 + 0.2 in floating point gives 0.30000000000000004; adding 10 + 20
 * pence always gives 30. We only convert to pounds for display and input.
 */

export const CURRENCIES = [
  { code: 'GBP', label: 'British pound (£)', locale: 'en-GB' },
  { code: 'EUR', label: 'Euro (€)', locale: 'en-IE' },
  { code: 'USD', label: 'US dollar ($)', locale: 'en-US' },
  { code: 'CAD', label: 'Canadian dollar ($)', locale: 'en-CA' },
  { code: 'AUD', label: 'Australian dollar ($)', locale: 'en-AU' },
  { code: 'INR', label: 'Indian rupee (₹)', locale: 'en-IN' },
  { code: 'PKR', label: 'Pakistani rupee (₨)', locale: 'en-PK' },
  { code: 'AED', label: 'UAE dirham', locale: 'en-AE' },
  { code: 'JPY', label: 'Japanese yen (¥)', locale: 'ja-JP' },
  { code: 'CHF', label: 'Swiss franc', locale: 'de-CH' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

const formatterCache = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string, compact: boolean, showPence: boolean) {
  const key = `${currency}|${compact}|${showPence}`
  let f = formatterCache.get(key)
  if (!f) {
    const locale = CURRENCIES.find((c) => c.code === currency)?.locale ?? 'en-GB'
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : showPence ? 2 : 0,
      minimumFractionDigits: compact ? 0 : showPence ? 2 : 0,
    })
    formatterCache.set(key, f)
  }
  return f
}

/** Number of minor units in one major unit (100 for GBP, 1 for JPY). */
export function minorUnitFactor(currency: string): number {
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    return 10 ** digits
  } catch {
    return 100
  }
}

export interface MoneyOptions {
  currency?: string
  compact?: boolean
  /** Show pence. Defaults to true unless the amount is a whole number and `compact`. */
  showPence?: boolean
  /** Always prefix + for positive values. */
  signed?: boolean
}

export function formatMoney(minor: number, { currency = 'GBP', compact = false, showPence = true, signed = false }: MoneyOptions = {}): string {
  const major = minor / minorUnitFactor(currency)
  const text = moneyFormatter(currency, compact, showPence).format(major)
  return signed && minor > 0 ? `+${text}` : text
}

/** Parse what a person types ("1,250.50", "£12", "12.5") into minor units. Returns null if invalid. */
export function parseMoney(input: string, currency = 'GBP'): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(/,/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return Math.round(value * minorUnitFactor(currency))
}

/** Minor units → plain editable string ("1250.50"). */
export function moneyToInput(minor: number | undefined, currency = 'GBP'): string {
  if (minor === undefined || minor === null || Number.isNaN(minor)) return ''
  const factor = minorUnitFactor(currency)
  const digits = Math.round(Math.log10(factor))
  return (minor / factor).toFixed(digits)
}

export function currencySymbol(currency = 'GBP'): string {
  const parts = moneyFormatter(currency, false, false).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}

const numberFormatter = new Intl.NumberFormat('en-GB')
const compactFormatter = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })

export const formatNumber = (n: number) => numberFormatter.format(n)
export const formatCompact = (n: number) => compactFormatter.format(n)

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** 95 → "1h 35m", 40 → "40m", 0 → "0m". */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h ${r}m` : `${h}h`
}

/** Hours with one decimal, e.g. 450 minutes → "7.5h". */
export const formatHours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`

/** Signed change between two values for "vs previous period" chips. */
export function delta(current: number, previous: number): { diff: number; pct: number | null; direction: 'up' | 'down' | 'flat' } {
  const diff = current - previous
  const pct = previous === 0 ? null : (diff / Math.abs(previous)) * 100
  return { diff, pct, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}
