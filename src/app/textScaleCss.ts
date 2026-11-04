/**
 * Text size setting. At build time every font size (and fixed line height)
 * in the app's CSS is multiplied by `--text-scale`, which the app sets on
 * <html> from Settings → Appearance → Text size. Only text grows: layout,
 * hit areas and pointer coordinates stay exact (unlike CSS zoom, which
 * breaks menu positioning and drag-to-reschedule).
 *
 * Skipped on purpose: relative sizes (em, %, keywords — they already follow
 * their parent) and `!important` sizes (iOS needs inputs at 16px or more or
 * it zooms the page on focus; those are floored with max() instead).
 */
const SIZE = String.raw`(-?\d*\.?\d+(?:px|rem))|(var\(--(?:text|label)[\w-]*\))`
const FONT_SIZE = new RegExp(String.raw`(font-size\s*:\s*)(?:${SIZE})(\s*!important)?(?=\s*[;}])`, 'g')
const LINE_HEIGHT = new RegExp(String.raw`(line-height\s*:\s*)(-?\d*\.?\d+(?:px|rem))(?=\s*[;}])`, 'g')

export const TEXT_SCALES = [90, 100, 110, 125] as const

export function scaleTextInCss(css: string): string {
  return css
    .replace(FONT_SIZE, (m, prop: string, len?: string, cssVar?: string, important?: string) => {
      const v = len ?? cssVar
      if (!v) return m
      if (important) return `${prop}max(${v}, calc(${v} * var(--text-scale, 1)))${important}`
      return `${prop}calc(${v} * var(--text-scale, 1))`
    })
    .replace(LINE_HEIGHT, (_m, prop: string, v: string) => `${prop}calc(${v} * var(--text-scale, 1))`)
}
