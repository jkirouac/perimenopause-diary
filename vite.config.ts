import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages at /perimenopause-diary/.
const base = '/perimenopause-diary/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Daily Perimenopause Diary',
        short_name: 'Diary',
        description: 'An evening diary of perimenopause symptoms, based on the CeMCOR Daily Perimenopause Diary.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f3f4f7',
        theme_color: '#2c3f66',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
})
