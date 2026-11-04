/** Subtle ambient background: grid, two slow light blooms, film grain. Purely decorative. */
export function BackgroundFX({ enabled }: { enabled: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-canvas-2),var(--color-canvas)_65%)]" />
      {enabled && (
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
    </div>
  )
}
