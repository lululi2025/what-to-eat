import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// G1: PWA service worker — 靜態資源 + 動態資源 offline cache
// 策略：
//   - SW 自動更新（registerType: 'autoUpdate'），重新整理就拿到新版
//   - precache build artifact（JS/CSS/HTML/font manifest 等）
//   - runtime cache：
//     1) Google Fonts → CacheFirst（字型很少改）
//     2) /api/photo 餐廳照片 → StaleWhileRevalidate（離線可看歷史照片）
//   - /api/places 不快取（要新鮮的搜尋結果）
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png',
        'icon-192.png', 'icon-512.png', 'og-cover.png',
        'illustrations/*.png',
      ],
      manifest: false, // 自己維護 public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gfonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gfonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/api\/photo/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'place-photos',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
