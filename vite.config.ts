import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

// BASE_PATH lets the same build run at a domain root (Vercel, Netlify, local)
// or under a sub-path such as GitHub Pages' /<repo-name>/. Defaults to '/'.
const base = process.env.BASE_PATH ?? '/'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * Emits /m/sw.js — the iPhone app's service worker — with the exact list of
 * files the mobile app needs (its entry, every lazily loaded screen, CSS and
 * icons), so the installed app opens offline. The cache name is a hash of
 * that list, so a new deploy replaces the old cache.
 */
function mobileServiceWorker(): Plugin {
  return {
    name: 'life-os-mobile-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && c.name === 'mobile')
      if (!entry || entry.type !== 'chunk') return
      const files = new Set<string>()
      const visit = (fileName: string) => {
        if (files.has(fileName)) return
        const item = bundle[fileName]
        if (!item) return
        files.add(fileName)
        if (item.type === 'chunk') {
          for (const f of [...item.imports, ...item.dynamicImports]) visit(f)
          const meta = (item as unknown as { viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> } }).viteMetadata
          meta?.importedCss.forEach((f) => files.add(f))
          meta?.importedAssets.forEach((f) => files.add(f))
        }
      }
      visit(entry.fileName)
      const precache = [`${base}m/`, `${base}m/manifest.webmanifest`, `${base}m/apple-touch-icon.png`, `${base}m/icon-192.png`, `${base}favicon.svg`, ...[...files].sort().map((f) => `${base}${f}`)]
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'm/sw.js', source: serviceWorkerSource(version, precache, base) })
    },
  }
}

function serviceWorkerSource(version: string, precache: string[], base: string) {
  return `/* LIFE OS for iPhone — service worker (generated at build time) */
const CACHE = 'life-os-m-${version}'
const PRECACHE = ${JSON.stringify(precache)}
const BASE = ${JSON.stringify(base)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('life-os-m-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // The app page: network first (so updates arrive), cached copy when offline or slow.
  if (request.mode === 'navigate') {
    event.respondWith(
      Promise.race([fetch(request), timeout(4000)])
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(BASE + 'm/', response.clone()))
          return response
        })
        .catch(() => caches.match(BASE + 'm/', { ignoreVary: true }).then((hit) => hit || Response.error())),
    )
    return
  }

  // Hashed build files never change: cache first. ignoreVary because module
  // scripts are requested with an Origin header the precache request didn't
  // have, and servers commonly send "Vary: Origin" — without it, lazily loaded
  // screens would miss the cache and fail offline.
  if (url.pathname.startsWith(BASE + 'assets/') || url.pathname.startsWith(BASE + 'm/') || url.pathname === BASE + 'favicon.svg') {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
`
}

// Vite builds and serves both apps: the desktop app at / and the iPhone app at /m/.
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), mobileServiceWorker()],
  resolve: {
    alias: { '@': r('./src') },
  },
  build: {
    rolldownOptions: {
      input: { main: r('./index.html'), mobile: r('./m/index.html') },
      output: {
        // Split large libraries into their own long-lived cached chunks. Each
        // group takes only the modules it names (not their dependencies), so
        // React never lands in the charts chunk and the chart library loads
        // only on screens that draw charts.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 50 },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+|internmap|decimal\.js-light|@reduxjs[\\/]toolkit|redux|redux-thunk|reselect|immer|react-redux|es-toolkit|eventemitter3|tiny-invariant|react-is|use-sync-external-store)[\\/]/,
              priority: 40,
            },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 30 },
            { name: 'router', test: /node_modules[\\/]react-router/, priority: 30 },
            { name: 'vendor', test: /node_modules[\\/](?!@fontsource)/, priority: 10 },
          ],
        },
      },
    },
  },
})
