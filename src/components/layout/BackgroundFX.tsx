import type { UiStyle } from '@/app/themes'

/**
 * The wallpaper behind the interface, one per theme. Purely decorative.
 * `effects` adds ambient motion and detail (drifting light, grid, grain).
 * `contained` renders inside a preview box instead of the whole window.
 */
export function Wallpaper({ style, effects, contained }: { style: UiStyle; effects: boolean; contained?: boolean }) {
  const pos = contained ? 'absolute' : 'fixed'
  return (
    <div aria-hidden className={`pointer-events-none ${pos} inset-0 -z-10 overflow-hidden wallpaper-${style}`}>
      {style === 'glass' && effects && !contained && (
        <>
          <div className="wallpaper-orb -top-[16vh] left-[22vw] h-[46vh] w-[40vw] animate-drift" style={{ background: 'var(--color-accent)' }} />
          <div className="wallpaper-orb top-[30vh] -right-[10vw] h-[46vh] w-[40vw] animate-drift-slow" style={{ background: 'var(--color-accent-2)' }} />
        </>
      )}
      {style === 'cyber' && effects && (
        <>
          <div className="bg-grid absolute inset-0" />
          <div
            className="absolute -top-[18vh] -left-[12vw] h-[55vh] w-[55vw] animate-drift rounded-full opacity-[0.16] blur-[110px]"
            style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 65%)' }}
          />
          <div
            className="absolute -right-[15vw] -bottom-[25vh] h-[60vh] w-[60vw] animate-drift-slow rounded-full opacity-[0.13] blur-[120px]"
            style={{ background: 'radial-gradient(circle, var(--color-accent-2), transparent 60%)' }}
          />
          <div
            className="absolute top-[40vh] left-[45vw] h-[30vh] w-[30vw] animate-drift rounded-full opacity-[0.06] blur-[100px]"
            style={{ background: 'radial-gradient(circle, var(--color-accent-3), transparent 60%)' }}
          />
          <div className="bg-noise absolute inset-0" />
          <div className="bg-scanlines absolute inset-0 opacity-40" />
        </>
      )}
      {style === 'glass' && effects && <div className="bg-noise absolute inset-0 opacity-[0.025]" />}
    </div>
  )
}

const documentStyle = (): UiStyle => (typeof document !== 'undefined' ? (document.documentElement.dataset.style as UiStyle | undefined) : undefined) ?? 'glass'

/** The app's wallpaper for the current theme (before settings load, the last applied one). */
export function BackgroundFX({ style, enabled }: { style?: UiStyle; enabled: boolean }) {
  return <Wallpaper style={style ?? documentStyle()} effects={enabled} />
}
