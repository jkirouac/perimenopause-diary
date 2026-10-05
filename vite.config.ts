import { createHash } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages at /perimenopause-diary/.
const base = '/perimenopause-diary/'

// GitHub Pages can't send security headers, so the built page carries its own
// Content-Security-Policy: only our own scripts (plus the inline theme script, by hash,
// and Cloudflare's "not a robot" check), and connections only to Supabase. Added at
// build time only, because the dev server injects scripts of its own.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
        )
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${inline.join(' ')} https://challenges.cloudflare.com`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
          'frame-src https://challenges.cloudflare.com',
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        )
      },
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in main.tsx, which also checks for a new version each time the app is opened.
      injectRegister: false,
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
