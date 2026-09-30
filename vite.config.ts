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
        name: 'Ebb & Flow',
        short_name: 'Ebb & Flow',
        description: "A calm evening check-in for perimenopause, based on CeMCOR's Daily Perimenopause Diary.",
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8f7fb',
        theme_color: '#f6ecff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
