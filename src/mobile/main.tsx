import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ios.css'
import { migrateLegacyLocalStorage } from '@/storage/brand'
import { initPersistence } from '@/store/persistence'
import { MobileApp } from './MobileApp'
import { registerServiceWorker } from './sw-register'

// Carry over settings saved before the LIFE OS → ATLAS rename, before anything reads them.
migrateLegacyLocalStorage()
// Same local database as the desktop app (shared on the same browser).
void initPersistence()
registerServiceWorker()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
)
