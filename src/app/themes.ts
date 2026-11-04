/**
 * The theme registry: every visual style LIFE OS offers, and how settings
 * resolve to the attributes the CSS tokens key off.
 *
 *   <html data-style="glass" data-theme="light" data-accent="blue"
 *         data-motion="system" data-transparency="full" data-effects="on">
 *
 * All colours, surfaces, radii, typography, blur and motion live as CSS
 * tokens in src/styles/themes.css, keyed by these attributes. Components only
 * ever use the tokens, so adding a theme means adding an entry here and a
 * token block there — no component changes.
 *
 * Tokens are scoped to any element carrying the attributes, not just <html>,
 * which is how the Appearance page renders live previews of other themes.
 */
import type { Settings } from '@/data/types'

export type UiStyle = Settings['uiStyle']
export type Accent = Settings['accent']
export type Mode = 'light' | 'dark'

export interface ThemeMeta {
  id: UiStyle
  name: string
  tagline: string
  description: string
  /** Light/dark support. Dark-only themes ignore the light setting. */
  modes: readonly Mode[]
  /** Accent presets in the order they're offered, with names suited to the theme. */
  accents: readonly { id: Accent; label: string }[]
  /** Browser/OS chrome colour per mode (status bar, title bar). */
  chrome: Partial<Record<Mode, string>>
}

const APPLE_ACCENTS = [
  { id: 'blue', label: 'Blue' },
  { id: 'cyan', label: 'Teal' },
  { id: 'violet', label: 'Purple' },
  { id: 'magenta', label: 'Pink' },
  { id: 'lime', label: 'Green' },
] as const

export const THEMES: readonly ThemeMeta[] = [
  {
    id: 'glass',
    name: 'Liquid Glass',
    tagline: 'Translucent, layered, fluid',
    description: 'Floating glass navigation and toolbars over a soft wallpaper, with light catching the edges. The flagship look.',
    modes: ['light', 'dark'],
    accents: APPLE_ACCENTS,
    chrome: { light: '#e9eef7', dark: '#0b0e17' },
  },
  {
    id: 'clean',
    name: 'Apple Clean',
    tagline: 'Calm, native, precise',
    description: 'Neutral backgrounds, refined type and quiet cards — like the built-in apps on a Mac or iPhone.',
    modes: ['light', 'dark'],
    accents: APPLE_ACCENTS,
    chrome: { light: '#f5f5f7', dark: '#161618' },
  },
  {
    id: 'cyber',
    name: 'Cyberpunk',
    tagline: 'Neon, HUD, after dark',
    description: 'The original LIFE//OS identity: neon cyan, electric violet and magenta over a dark grid.',
    modes: ['dark'],
    accents: [
      { id: 'cyan', label: 'Cyan' },
      { id: 'violet', label: 'Violet' },
      { id: 'magenta', label: 'Magenta' },
      { id: 'lime', label: 'Lime' },
      { id: 'blue', label: 'Blue' },
    ],
    chrome: { dark: '#05060a' },
  },
  {
    id: 'minimal',
    name: 'Minimal Dark',
    tagline: 'Charcoal, quiet, focused',
    description: 'Deep charcoal surfaces, restrained accents and almost no borders. Easy on the eyes at night.',
    modes: ['dark'],
    accents: [
      { id: 'blue', label: 'Slate blue' },
      { id: 'cyan', label: 'Teal' },
      { id: 'violet', label: 'Lavender' },
      { id: 'magenta', label: 'Rose' },
      { id: 'lime', label: 'Sage' },
    ],
    chrome: { dark: '#0e0f11' },
  },
]

export const themeMeta = (id: UiStyle): ThemeMeta => THEMES.find((t) => t.id === id) ?? THEMES[0]

export const supportsLight = (id: UiStyle) => themeMeta(id).modes.includes('light')

export interface Appearance {
  style: UiStyle
  mode: Mode
  accent: Accent
  motion: 'system' | 'full' | 'reduced'
  transparency: 'full' | 'reduced'
  effects: 'on' | 'off'
}

/**
 * Resolve settings to the attributes applied to the document. `modePref` is
 * the desktop `theme` or the iPhone `mobileTheme` setting.
 */
export function resolveAppearance(s: Pick<Settings, 'uiStyle' | 'accent' | 'motion' | 'reduceTransparency' | 'effects'>, modePref: 'light' | 'dark' | 'system', systemDark: boolean): Appearance {
  const style = themeMeta(s.uiStyle).id
  const wanted: Mode = modePref === 'system' ? (systemDark ? 'dark' : 'light') : modePref
  return {
    style,
    mode: supportsLight(style) ? wanted : 'dark',
    accent: s.accent,
    motion: s.motion,
    transparency: s.reduceTransparency ? 'reduced' : 'full',
    effects: s.effects ? 'on' : 'off',
  }
}

/** The data attributes for an appearance — for <html>, or a preview container. */
export function appearanceAttrs(a: Appearance) {
  return {
    'data-style': a.style,
    'data-theme': a.mode,
    'data-accent': a.accent,
    'data-transparency': a.transparency,
    'data-effects': a.effects,
  } as const
}

/**
 * Apply an appearance to the document and remember it, so the next launch can
 * paint the right theme before any script loads (see the inline script in
 * index.html and m/index.html). `themeColorVar` is the CSS variable whose
 * value the browser/OS chrome should match.
 */
export function applyAppearance(root: HTMLElement, a: Appearance, opts: { storageKey: string; modePref: 'light' | 'dark' | 'system'; themeColorVar?: string }) {
  root.dataset.style = a.style
  root.dataset.theme = a.mode
  root.dataset.accent = a.accent
  root.dataset.motion = a.motion
  root.dataset.transparency = a.transparency
  root.dataset.effects = a.effects
  root.style.colorScheme = a.mode
  const fromCss = opts.themeColorVar ? getComputedStyle(root).getPropertyValue(opts.themeColorVar).trim() : ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fromCss || themeMeta(a.style).chrome[a.mode] || '#000000')
  try {
    localStorage.setItem(opts.storageKey, JSON.stringify({ style: a.style, pref: supportsLight(a.style) ? opts.modePref : 'dark', accent: a.accent, transparency: a.transparency, effects: a.effects }))
  } catch {
    // Only affects the colours painted before the app loads next time.
  }
}
