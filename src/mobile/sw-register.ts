import { toast } from '@/components/ui/toast'

/**
 * Registers the offline service worker in production builds. When a new
 * version has been installed in the background, offer to reload.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}m/sw.js`, { scope: `${import.meta.env.BASE_URL}m/` }).catch(() => {
      // Offline support is optional; the app works without it.
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    toast({ title: 'ATLAS was updated', description: 'Reload to use the latest version.', tone: 'info', duration: 15000, action: { label: 'Reload', onClick: () => window.location.reload() } })
  })
}
