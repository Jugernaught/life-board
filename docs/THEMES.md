# Themes and the design system

Atlas has four complete, interchangeable visual styles. They apply to every section on desktop and on the iPhone version, switch instantly without a reload, and are saved with your settings.

| Theme | Character | Light / dark |
| --- | --- | --- |
| **Liquid Glass** *(default)* | Floating translucent navigation and toolbars over a soft accent wallpaper, with light catching the edges. | Both |
| **Apple Clean** | Neutral backgrounds, refined type, quiet cards, native-looking controls. Classic iOS tab bar on iPhone. | Both |
| **Cyberpunk** | The original cyberpunk identity — neon on near-black, HUD corners, chamfered buttons, monospaced captions. | Dark |
| **Minimal Dark** | Deep charcoal, muted surfaces, restrained accents, almost no borders. | Dark |

**Where to change it:** Settings → **Appearance** (desktop) shows a live preview of each theme before you apply it, with light/dark preview, accent colour, motion, ambient effects and *Reduce transparency*. The palette icon in the toolbar and the command palette (Ctrl K → "Appearance: …") switch instantly. On iPhone: More → Settings → **Theme**.

---

## How it works

Everything visual is a **CSS token**. Components never hard-code a theme colour; they use Tailwind utilities that read tokens (`bg-panel`, `text-ink`, `border-line`…) and a few shared material utilities.

```
<html data-style="glass" data-theme="dark" data-accent="blue"
      data-motion="system" data-transparency="full" data-effects="on">
```

| File | Role |
| --- | --- |
| `src/app/themes.ts` | Theme registry (name, description, supported modes, accent names) and `resolveAppearance()` / `applyAppearance()`. |
| `src/styles/themes.css` | All tokens for every theme × mode, plus accent presets. |
| `src/styles/index.css` | Shared utilities built on the tokens (`panel`, `chrome`, `float`, `glass-button`, `eyebrow`, `title`, `hud`, `chamfer`, `cyber-only`, `not-cyber`) and the per-theme wallpapers. |
| `src/mobile/ios.css` | iPhone shell tokens per theme (grouped backgrounds, cells, bars, tab bar, glass capsules). |
| `src/app/ThemeController.tsx`, `src/mobile/MobileApp.tsx` | Apply the resolved appearance to `<html>` and remember it, so the next launch paints the right theme before any script loads (inline script in `index.html` / `m/index.html`). |

Token selectors never use `:root`, so **any element** carrying the attributes gets that theme's full token set. That is how the Appearance page renders genuine live previews of other themes (`ThemePreview`, `PhoneThemePreview`) using the real materials.

### Token groups

- **Palette** — `--color-canvas`, `--color-panel(-2/-3)`, `--color-line(-strong)`, `--color-ink(-muted/-subtle)`, accents (`--color-blue/cyan/violet/magenta/lime/amber`), `--color-accent`, `--color-accent-fill` (filled buttons), `--color-on-accent`, semantic `ok/warn/bad/info`, validated chart series `--color-chart-1…6`.
- **Type** — `--font-sans`, `--font-display`, `--font-mono` (Cyberpunk only; others use tabular figures), `--font-code`, `--display-tracking`, `--title-tracking`, `--label-*` (eyebrows).
- **Shape** — `--radius-panel`, `--radius-control`, `--radius-btn`, `--radius-btn-primary`, `--radius-window`, `--radius-badge`, `--sidebar-radius`, `--toolbar-radius`.
- **Materials** — three layers, each with background, sheen gradient, backdrop filter, border, rim highlight, shadow and a solid fallback:
  - `--surface-*` — cards and widgets (`panel`)
  - `--chrome-*` — sidebar, toolbar, tab bars (`chrome`) — the most transparent layer in Liquid Glass
  - `--float-*` — menus, dialogs, the command palette, notifications (`float`)
- **Effects** — `--glow-sm/md`, `--hud-opacity`, `--chamfer(-sm)`, `--dot-glow`, `--text-gradient`.
- **Layout** — `--shell-gap` (Liquid Glass floats the sidebar and toolbar 10 px in from the window edge), `--sidebar-border`, `--toolbar-border`.
- **Navigation & controls** — `--nav-active-bg`, `--nav-indicator`, `--tab-*`, `--seg-*`, `--switch-*`.
- **Motion** — `--dur-fast`, `--dur-base`, `--ease-out`; `data-motion` + `prefers-reduced-motion` disable animation everywhere.

### Liquid Glass, specifically

Glass is used **selectively**: navigation chrome, toolbars, the iPhone tab bar and nav buttons, and floating layers. Cards use a denser frosted material; iPhone list cells stay solid so swipe actions and text never compete with what's behind. Each glass layer combines a translucent tint, `backdrop-filter: blur() saturate() brightness()`, a diagonal sheen gradient (the refraction cue), an inset rim highlight along the top edge, and a soft drop shadow. The wallpaper is pure CSS gradients (no blur filters), with optional slowly drifting light when *Ambient effects* is on.

**Fallbacks:** without `backdrop-filter` support, and with *Reduce transparency* on, every material switches to its solid token — same colours, same contrast, no blur.

> Build note: Lightning CSS (used by the production build) collapses hand-written `-webkit-backdrop-filter` + `backdrop-filter` pairs into only the prefixed one, which Chrome ignores. Write only `backdrop-filter`; the build adds the prefix for Safari.

---

## Adding a theme

1. Add an entry to `THEMES` in `src/app/themes.ts` (id, name, description, `modes`, accent names, chrome colours) and the id to `uiStyle` in `src/data/schema.ts`.
2. Add a `[data-style='<id>']` block (and `[data-theme]` variants) to `src/styles/themes.css`, overriding only the tokens that differ from the defaults at the top of the file.
3. Add the iPhone block to `src/mobile/ios.css` (`--ios-grouped`, `--ios-cell`, `--ios-bar`, tab bar look).
4. Run the checks below. No component changes are needed.

---

## Accessibility and testing

- **Contrast is measured on rendered pixels**, not from CSS: translucent glass, blur and gradients defeat automated checkers such as axe (they report "incomplete"). The audit hides all text, screenshots what is really behind each text run (wallpaper, blur and all), and compares it with the text colour. Every visible text run meets **WCAG AA** in every theme and mode — 5,859 on desktop and 1,632 on iPhone in the last run.
- axe-core reports no other violations on any desktop section or iPhone screen in any theme.
- `e2e/themes.spec.ts` — Appearance preview vs apply, persistence, toolbar switcher, dark-only themes, accents, Reduce transparency, command palette, and **every section rendering in every theme and mode** with no errors or sideways scrolling.
- `e2e/ios.spec.ts` — iPhone theme picker, floating vs classic tab bar, contextual tab-bar button, desktop/iPhone sharing the theme, Reduce transparency.
