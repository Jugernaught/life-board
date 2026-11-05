// Generates every app icon from one vector mark, so the brand stays in sync.
//
//   npm run icons
//
// Writes public/favicon.svg plus the PNGs used by the iPhone app (public/m/)
// and the Windows installer (build/icon.png). Rendering uses the Chromium that
// ships with Playwright (already a dev dependency).
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The ATLAS mark on a 36-unit grid: chamfered frame, "A" monogram, signal dot. */
const MARK = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19e6ff"/><stop offset="1" stop-color="#9b7bff"/></linearGradient></defs>
  <path d="M8 2h20l6 6v20l-6 6H8l-6-6V8z" fill="none" stroke="url(#g)" stroke-width="1.5"/>
  <path d="M11.5 27 18 9.5 24.5 27" fill="none" stroke="#19e6ff" stroke-width="2.6" stroke-linejoin="miter" stroke-miterlimit="10"/>
  <path d="M13.7 21.2h8.6" fill="none" stroke="#19e6ff" stroke-width="2.6"/>
  <circle cx="25.5" cy="10.5" r="2.4" fill="#ff3ea8"/>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="#05060a"/>${MARK.replace(/\n\s*/g, '')}</svg>\n`

/** A full-bleed square icon; `frame` is the mark's width as a share of the canvas. */
function appIcon(size, frame) {
  const scale = (size * frame) / 32 // the frame spans 32 of the 36 grid units
  const offset = size / 2 - 18 * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><radialGradient id="bg" cx="0.22" cy="0.18" r="1"><stop offset="0" stop-color="#0b2a33"/><stop offset="0.55" stop-color="#05090d"/><stop offset="1" stop-color="#030406"/></radialGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g>
</svg>`
}

const PNGS = [
  // Maskable icons must keep the mark inside the central 80% safe zone.
  { file: 'public/m/icon-maskable-512.png', size: 512, frame: 0.42 },
  { file: 'public/m/icon-512.png', size: 512, frame: 0.6 },
  { file: 'public/m/icon-192.png', size: 192, frame: 0.6 },
  { file: 'public/m/apple-touch-icon.png', size: 180, frame: 0.6 },
  { file: 'build/icon.png', size: 512, frame: 0.6 },
]

await writeFile(path.join(root, 'public/favicon.svg'), favicon)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const { file, size, frame } of PNGS) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0">${appIcon(size, frame)}</body></html>`)
    await page.locator('svg').screenshot({ path: path.join(root, file), omitBackground: false })
    console.log(`wrote ${file} (${size}×${size})`)
  }
} finally {
  await browser.close()
}
