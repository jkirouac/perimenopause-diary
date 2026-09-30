import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
