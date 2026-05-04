# 🎰 今天吃什麼？ What To Eat

隨機挑選附近餐廳的 Web App，支援全球定位，在日本可搭配食べログ查看評分。

## 功能

- 📍 GPS 自動定位，搜尋附近餐廳
- 🎲 老虎機式隨機挑選動畫
- 🏷️ 餐廳類型篩選（餐廳/咖啡廳/甜點/酒吧）
- 📏 距離範圍滑桿（200m ~ 2km）
- 🗺️ 一鍵開啟 Google Maps 導航
- 🔍 一鍵跳轉食べログ查看評分
- 🛡️ 每日搜尋次數限制（前端保護）

## 技術

- React 18 + Vite
- Google Places API (Nearby Search)
- Geolocation API
- 食べログ 搜尋連結

## 開發

```bash
npm install
npm run dev
```

## 環境變數

在專案根目錄建立 `.env`：

```
VITE_GOOGLE_MAPS_KEY=你的_Google_Maps_API_Key
```

## 部署

本專案可直接部署到 Vercel，記得在 Vercel 的 Environment Variables 設定 `VITE_GOOGLE_MAPS_KEY`。
