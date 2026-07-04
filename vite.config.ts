import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

// Versió AAAAMMDD.N: data del commit de HEAD + número de seqüència del commit
// dins d'aquell dia (el tercer commit del 4/7/2026 → 20260704.3).
const version = (() => {
  try {
    const dates = execSync('git log --format=%cd --date=format:%Y%m%d')
      .toString()
      .trim()
      .split('\n')
    return `${dates[0]}.${dates.filter((d) => d === dates[0]).length}`
  } catch {
    return 'dev'
  }
})()

// base: './' perquè funcioni servida des de qualsevol subcarpeta (GitHub Pages, etc.)
export default defineConfig({
  base: './',
  define: {
    __COMMIT__: JSON.stringify(commit),
    __VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'For Gear',
        short_name: 'For Gear',
        description: 'Inventari de material de muntanya i preparació de motxilles',
        lang: 'ca',
        display: 'standalone',
        start_url: '.',
        theme_color: '#1f261e',
        background_color: '#eef0ea',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
