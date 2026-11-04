import { describe, expect, it } from 'vitest'
import { normaliseSettings } from '@/data/defaults'
import { THEMES, appearanceAttrs, resolveAppearance, supportsLight, themeMeta } from './themes'

const base = { uiStyle: 'glass', accent: 'blue', motion: 'system', reduceTransparency: false, effects: true } as const

describe('themes', () => {
  it('registers four themes, Liquid Glass first, each with accents', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['glass', 'clean', 'cyber', 'minimal'])
    for (const t of THEMES) expect(t.accents.length).toBeGreaterThanOrEqual(4)
    expect(themeMeta('nope' as never).id).toBe('glass')
  })

  it('resolves light/dark, following the device when automatic', () => {
    expect(resolveAppearance(base, 'light', true).mode).toBe('light')
    expect(resolveAppearance(base, 'system', true).mode).toBe('dark')
    expect(resolveAppearance(base, 'system', false).mode).toBe('light')
  })

  it('keeps dark-only themes dark whatever the preference', () => {
    for (const id of ['cyber', 'minimal'] as const) {
      expect(supportsLight(id)).toBe(false)
      expect(resolveAppearance({ ...base, uiStyle: id }, 'light', false).mode).toBe('dark')
    }
    expect(supportsLight('clean')).toBe(true)
  })

  it('maps settings to the attributes the tokens key off', () => {
    const a = resolveAppearance({ ...base, uiStyle: 'clean', reduceTransparency: true, effects: false, accent: 'violet' }, 'dark', false)
    expect(appearanceAttrs(a)).toEqual({ 'data-style': 'clean', 'data-theme': 'dark', 'data-accent': 'violet', 'data-transparency': 'reduced', 'data-effects': 'off' })
  })

  it('upgrades old settings without the new fields (no data migration needed)', () => {
    const s = normaliseSettings({ theme: 'light', accent: 'cyan' } as never)
    expect(s.uiStyle).toBe('glass')
    expect(s.reduceTransparency).toBe(false)
    expect(s.accent).toBe('cyan')
    expect(normaliseSettings({ uiStyle: 'neon' } as never).uiStyle).toBe('glass')
  })
})
