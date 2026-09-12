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
        'icon-192.png',
        // icon-512.png 不列在這裡：它只在「加到主畫面」用到，那時必定有網路。
        // 注意 includeAssets 不受 globIgnores 影響，要排除就得從這份清單移掉。
        'illustrations/*.webp',
      ],
      manifest: false, // 自己維護 public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2}'],
        // 這幾個不放進 precache：
        //   og-cover.png (1MB) 只有 FB/Twitter 爬蟲會抓，使用者不需要下載
        //   qr-share.png / favicon-preview.html 是離線用不到的輔助檔
        //   icon-512.png (365KB) 只在「加到主畫面」那一刻用到，那時必定有網路
        globIgnores: ['og-cover.png', 'qr-share.png', 'favicon-preview.html', 'icon-512.png'],
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
