import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// Fonts are bundled so they work offline and no font service sees her using the app.
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import './styles.css'
import App from './App.tsx'
import { listenForInstall } from './lib/install'
import { followPhoneTheme } from './lib/theme'

// Chrome's install prompt fires early, so listen before the app draws.
listenForInstall()
followPhoneTheme()

// An installed app can stay open in the background for days, so look for a new version
// whenever it comes back to the front. autoUpdate reloads once the new version takes over.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
