import { type Mode, type UiStyle, appearanceAttrs, resolveAppearance } from '@/app/themes'
import type { Settings } from '@/data/types'
import { useSettings } from '@/store/store'

/**
 * A tiny live iPhone screen in another theme. The container carries the
 * theme's attributes (and data-shell="ios"), so it is drawn with that theme's
 * real tokens: backdrop, list cells, bars and the tab bar.
 */
export function PhoneThemePreview({ style, mode, accent }: { style: UiStyle; mode: Mode; accent: Settings['accent'] }) {
  const s = useSettings()
  const attrs = appearanceAttrs(resolveAppearance({ ...s, uiStyle: style, accent }, mode, mode === 'dark'))
  const floating = style !== 'clean'
  return (
    <div data-shell="ios" {...attrs} className="relative isolate h-[132px] w-full overflow-hidden rounded-[18px] [background:var(--ios-backdrop)]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-line)' }} aria-hidden>
      <div className="px-2.5 pt-3">
        <span className="block h-2.5 w-1/2 rounded-full bg-[var(--color-ink)] opacity-85" />
        <div className="mt-2.5 overflow-hidden rounded-[7px] bg-[var(--ios-cell)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-[5px]" style={{ borderTop: i ? '0.5px solid var(--color-line)' : undefined }}>
              <span className="block size-2.5 rounded-full border" style={{ borderColor: i === 0 ? 'var(--color-accent)' : 'var(--color-ink-subtle)', background: i === 0 ? 'var(--color-accent)' : 'transparent' }} />
              <span className="block h-1.5 flex-1 rounded-full bg-[var(--color-ink-subtle)] opacity-60" style={{ maxWidth: `${80 - i * 15}%` }} />
            </div>
          ))}
        </div>
      </div>
      {floating ? (
        <div className="absolute inset-x-2 bottom-2 flex gap-1.5">
          <div className="ios-glass flex h-6 flex-1 items-center justify-around rounded-full px-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block size-2 rounded-full" style={{ background: i === 0 ? 'var(--color-accent)' : 'var(--color-ink-subtle)', opacity: i === 0 ? 1 : 0.6 }} />
            ))}
          </div>
          <span className="ios-glass flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-accent">+</span>
        </div>
      ) : (
        <div className="ios-bar ios-hairline-t absolute inset-x-0 bottom-0 flex h-7 items-center justify-around">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="block size-2 rounded-full" style={{ background: i === 0 ? 'var(--color-accent)' : 'var(--color-ink-subtle)', opacity: i === 0 ? 1 : 0.6 }} />
          ))}
        </div>
      )}
    </div>
  )
}
