import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import './styles/index.css'
import { App } from './app/App'
import { migrateLegacyLocalStorage } from './storage/brand'
import { initPersistence } from './store/persistence'

// Carry over settings saved before the LIFE OS → ATLAS rename, before anything reads them.
migrateLegacyLocalStorage()
// Start loading saved data straight away; the UI shows a splash until ready.
void initPersistence()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
