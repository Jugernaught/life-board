import { useState } from 'react'
import { Check, Moon, Palette, Sparkles, Sun } from 'lucide-react'
import { type Mode, type ThemeMeta, type UiStyle, THEMES, appearanceAttrs, resolveAppearance, supportsLight, themeMeta } from '@/app/themes'
import { useSystemDark } from '@/app/ThemeController'
import type { Settings } from '@/data/types'
import { cn } from '@/lib/utils'
import { actions, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Segmented, Switch } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { Wallpaper } from '@/components/layout/BackgroundFX'

const set = (patch: Partial<Settings>) => actions.updateSettings(patch)

/**
 * A miniature of the real interface rendered in another theme. The container
 * carries that theme's data attributes, so everything inside uses its tokens —
 * the same utilities and materials as the app itself, not a picture.
 */
export function ThemePreview({ style, mode, accent, large }: { style: UiStyle; mode: Mode; accent: Settings['accent']; large?: boolean }) {
  const s = useSettings()
  const attrs = appearanceAttrs(resolveAppearance({ ...s, uiStyle: style, accent }, mode, mode === 'dark'))
  const r = (px: number) => (large ? px : Math.round(px * 0.62))
  return (
    <div {...attrs} className="relative isolate overflow-hidden text-ink" style={{ fontFamily: 'var(--font-sans)', height: large ? 260 : 150, borderRadius: 'inherit' }} aria-hidden>
      <Wallpaper style={style} effects={s.effects} contained />
      <div className="absolute inset-0 flex" style={{ padding: `calc(var(--shell-gap) * ${large ? 1 : 0.6})`, gap: `calc(var(--shell-gap) * ${large ? 1 : 0.6})` }}>
        {/* sidebar */}
        <div className="chrome flex shrink-0 flex-col gap-1.5" style={{ width: r(120), padding: r(10), borderRadius: 'calc(var(--sidebar-radius) * 0.7)', borderWidth: 'var(--sidebar-border)' }}>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="block rounded-[30%]" style={{ width: r(16), height: r(16), background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-2))' }} />
            <span className="block h-1.5 flex-1 rounded-full bg-ink/40" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('flex items-center gap-1.5 rounded-[calc(var(--radius-control)*0.6)]', i === 0 && 'bg-[var(--nav-active-bg)]')} style={{ height: r(18), padding: `0 ${r(5)}px` }}>
              <span className={cn('block size-2 rounded-sm', i === 0 ? 'bg-accent' : 'bg-ink-subtle/60')} />
              <span className={cn('block h-1 rounded-full', i === 0 ? 'bg-ink/70' : 'bg-ink-subtle/40')} style={{ width: `${70 - i * 10}%` }} />
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: `calc(var(--shell-gap) * ${large ? 1 : 0.6} + 4px)` }}>
          {/* toolbar */}
          <div className="chrome flex shrink-0 items-center gap-2" style={{ height: r(30), padding: `0 ${r(10)}px`, borderRadius: 'calc(var(--toolbar-radius) * 0.7)', borderWidth: 'var(--toolbar-border)' }}>
            <span className="block h-1.5 w-1/4 rounded-full bg-ink/60" />
            <span className="flex-1" />
            <span className="block rounded-[var(--radius-btn-primary)] bg-accent-fill" style={{ width: r(34), height: r(14), clipPath: 'var(--chamfer-sm)' }} />
          </div>
          {/* cards */}
          <div className="grid min-h-0 flex-1 grid-cols-2" style={{ gap: r(10) }}>
            <div className="panel hud flex flex-col justify-between" style={{ padding: r(12), borderRadius: 'calc(var(--radius-panel) * 0.7)' }}>
              <span className="title block truncate font-semibold" style={{ fontSize: r(14) }}>
                Today
              </span>
              <span className="eyebrow block truncate" style={{ fontSize: r(10) }}>
                3 tasks due
              </span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-ink/10">
                <span className="block h-full w-2/3 rounded-full bg-accent" />
              </span>
            </div>
            <div className="panel flex flex-col justify-between" style={{ padding: r(12), borderRadius: 'calc(var(--radius-panel) * 0.7)' }}>
              <span className="flex items-end gap-1" style={{ height: r(40) }}>
                {[40, 70, 55, 90, 65].map((h, i) => (
                  <span key={i} className="block flex-1 rounded-t-sm" style={{ height: `${h}%`, background: `var(--color-chart-${(i % 4) + 1})` }} />
                ))}
              </span>
              <span className="flex items-center justify-between">
                <span className="block h-1 w-1/2 rounded-full bg-ink-subtle/50" />
                <span className="relative block rounded-full" style={{ width: r(26), height: r(15), background: 'var(--switch-on-track)' }}>
                  <span className="absolute top-1/2 right-[2px] block -translate-y-1/2 rounded-full" style={{ width: r(11), height: r(11), background: 'var(--switch-on-knob)' }} />
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ t, selected, current, mode, accent, onSelect }: { t: ThemeMeta; selected: boolean; current: boolean; mode: Mode; accent: Settings['accent']; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`theme-card-${t.id}`}
      className={cn(
        'group overflow-hidden rounded-[calc(var(--radius-panel)+2px)] border-2 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-offset-4',
        selected ? 'border-accent' : 'border-transparent hover:border-line-strong',
      )}
    >
      <div className="overflow-hidden rounded-[var(--radius-panel)]">
        <ThemePreview style={t.id} mode={supportsLight(t.id) ? mode : 'dark'} accent={t.accents.some((a) => a.id === accent) ? accent : t.accents[0].id} />
      </div>
      <div className="flex items-start gap-2 px-1.5 pt-2.5 pb-1">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            {t.name}
            {t.id === 'glass' && <Sparkles size={13} className="text-accent" aria-label="Recommended" />}
          </p>
          <p className="truncate text-[12.5px] text-ink-subtle">{t.tagline}</p>
        </div>
        {current && <span className="mt-0.5 shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">In use</span>}
      </div>
    </button>
  )
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-subtle">{description}</p>}
      </div>
      <div className="shrink-0 sm:min-w-64">{children}</div>
    </div>
  )
}

export function AppearanceSettings() {
  const s = useSettings()
  const systemDark = useSystemDark()
  const live = resolveAppearance(s, s.theme, systemDark)
  const [selected, setSelected] = useState<UiStyle>(s.uiStyle)
  const [previewMode, setPreviewMode] = useState<Mode>(live.mode)
  const meta = themeMeta(selected)
  const pick = themeMeta(s.uiStyle)
  const isCurrent = selected === s.uiStyle
  const previewAccent = meta.accents.some((a) => a.id === s.accent) ? s.accent : meta.accents[0].id

  return (
    <div className="space-y-4">
      <Panel title="Theme" icon={Palette}>
        <p className="mb-4 text-[13px] text-ink-muted">Pick a look for the whole of ATLAS — every section, on this computer and the iPhone version. Select one to preview it, then apply.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <ThemeCard key={t.id} t={t} selected={selected === t.id} current={s.uiStyle === t.id} mode={live.mode} accent={s.accent} onSelect={() => setSelected(t.id)} />
          ))}
        </div>

        {/* Larger preview of the selected theme, before applying it. */}
        <div className="mt-5 grid gap-5 rounded-[var(--radius-panel)] border border-line bg-ink/[0.02] p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-testid="theme-preview">
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line">
            <ThemePreview style={selected} mode={supportsLight(selected) ? previewMode : 'dark'} accent={previewAccent} large />
          </div>
          <div className="flex flex-col">
            <p className="eyebrow">{isCurrent ? 'In use' : 'Preview'}</p>
            <h3 className="title mt-1 text-[20px] font-bold text-ink">{meta.name}</h3>
            <p className="mt-1.5 text-[13.5px] text-ink-muted">{meta.description}</p>
            <div className="mt-4">
              {supportsLight(selected) ? (
                <Segmented
                  ariaLabel="Preview in"
                  size="sm"
                  value={previewMode}
                  onChange={setPreviewMode}
                  options={[
                    { value: 'light', label: <><Sun size={13} /> Light</> },
                    { value: 'dark', label: <><Moon size={13} /> Dark</> },
                  ]}
                />
              ) : (
                <p className="text-[12.5px] text-ink-subtle">Designed for dark mode only.</p>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <Button variant="primary" icon={Check} disabled={isCurrent} onClick={() => set({ uiStyle: selected, ...(meta.accents.some((a) => a.id === s.accent) ? {} : { accent: meta.accents[0].id }) })} data-testid="apply-theme">
                {isCurrent ? 'Applied' : `Use ${meta.name}`}
              </Button>
              {!isCurrent && (
                <Button variant="ghost" onClick={() => setSelected(s.uiStyle)}>
                  Back to {pick.name}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Options">
        <Row label="Appearance" description={supportsLight(s.uiStyle) ? 'Light, dark, or follow your device.' : `${pick.name} is always dark.`}>
          <Segmented
            value={s.theme}
            onChange={(theme) => set({ theme })}
            fullWidth
            ariaLabel="Light or dark"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Automatic' },
            ]}
          />
        </Row>
        <Row label="Accent colour" description="Highlights, selection and primary buttons. Each theme tunes the shade for legibility.">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
            {pick.accents.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={s.accent === a.id}
                aria-label={a.label}
                title={a.label}
                onClick={() => set({ accent: a.id })}
                className={cn('flex h-9 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors', s.accent === a.id ? 'border-ink/40 bg-ink/[0.06] text-ink' : 'border-line text-ink-muted hover:border-line-strong')}
                data-testid={`accent-${a.id}`}
              >
                <span className="size-3.5 rounded-full" style={{ background: `var(--color-${a.id === 'blue' ? 'blue' : a.id})` }} />
                {a.label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Motion" description="Automatic follows your device's reduced-motion setting.">
          <Segmented
            value={s.motion}
            onChange={(motion) => set({ motion })}
            fullWidth
            ariaLabel="Motion"
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'full', label: 'Full' },
              { value: 'reduced', label: 'Reduced' },
            ]}
          />
        </Row>
        <Row label="Ambient effects" description="Drifting light behind the glass in Liquid Glass; grid, grain and glow in Cyberpunk.">
          <Switch checked={s.effects} onChange={(effects) => set({ effects })} label={<span className="sr-only">Ambient effects</span>} />
        </Row>
        <Row label="Reduce transparency" description="Solid surfaces instead of glass and blur. Can make text easier to read and saves battery.">
          <Switch checked={s.reduceTransparency} onChange={(reduceTransparency) => set({ reduceTransparency })} label={<span className="sr-only">Reduce transparency</span>} />
        </Row>
        <Row label="Collapsed sidebar" description="Also toggled with the [ key">
          <Switch checked={s.sidebarCollapsed} onChange={(sidebarCollapsed) => set({ sidebarCollapsed })} label={<span className="sr-only">Collapsed sidebar</span>} />
        </Row>
      </Panel>
    </div>
  )
}
