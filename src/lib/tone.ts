import type { Tone } from '@/data/constants'

const VARS: Record<Tone, string> = {
  cyan: 'var(--color-cyan)',
  violet: 'var(--color-violet)',
  magenta: 'var(--color-magenta)',
  lime: 'var(--color-lime)',
  amber: 'var(--color-amber)',
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  info: 'var(--color-info)',
  muted: 'var(--color-ink-subtle)',
}

/** CSS colour for a tone, usable in inline styles and chart props. */
export const toneColor = (tone: Tone | undefined) => VARS[tone ?? 'muted']

/** A translucent version of a tone colour (0–100 strength). */
export const toneTint = (tone: Tone | undefined, strength = 14) => `color-mix(in oklab, ${toneColor(tone)} ${strength}%, transparent)`

/**
 * Tone colour for text sitting on its own tint (badges, chips). Mixed a little
 * towards the theme's ink, so it stays legible on translucent surfaces in
 * every theme while keeping its hue.
 */
export const toneText = (tone: Tone | undefined) => `color-mix(in oklab, ${toneColor(tone)} 72%, var(--color-ink))`

/** Ordered palette for multi-series charts. */
export const SERIES_TONES: Tone[] = ['cyan', 'violet', 'magenta', 'lime', 'amber', 'info', 'ok', 'bad']
export const seriesColor = (i: number) => toneColor(SERIES_TONES[i % SERIES_TONES.length])
