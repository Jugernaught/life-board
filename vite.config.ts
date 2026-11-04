import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'

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
      const precache = ['/m/', '/m/manifest.webmanifest', '/m/apple-touch-icon.png', '/m/icon-192.png', '/favicon.svg', ...[...files].sort().map((f) => `/${f}`)]
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'm/sw.js', source: serviceWorkerSource(version, precache) })
    },
  }
}

function serviceWorkerSource(version: string, precache: string[]) {
  return `/* LIFE OS for iPhone — service worker (generated at build time) */
const CACHE = 'life-os-m-${version}'
const PRECACHE = ${JSON.stringify(precache)}

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
          if (response.ok) caches.open(CACHE).then((cache) => cache.put('/m/', response.clone()))
          return response
        })
        .catch(() => caches.match('/m/').then((hit) => hit || Response.error())),
    )
    return
  }

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/m/') || url.pathname === '/favicon.svg') {
    event.respondWith(
      caches.match(request).then(
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
  plugins: [react(), tailwindcss(), mobileServiceWorker()],
  resolve: {
    alias: { '@': r('./src') },
  },
  build: {
    rollupOptions: {
      input: { main: r('./index.html'), mobile: r('./m/index.html') },
      output: {
        // Split the large charting/animation libraries into their own cached chunks.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('react-router')) return 'router'
          if (id.includes('@fontsource')) return undefined
          return 'vendor'
        },
      },
    },
  },
})
