# AGENTS.md — Project Context

> Last updated: 2026-05-04

## Project Overview

「今天吃什麼？」是一個隨機挑選附近餐廳的 Web App。GPS 定位 → 撈附近餐廳 → 老虎機動畫隨機選一間。Lulu 個人專案，部署在 Vercel。

## Tech Stack

- **Frontend**: React 18 + Vite 6（vanilla，沒上 Tailwind / shadcn）
- **Backend**: Vercel Serverless Functions（`api/*.js`，Node runtime）
- **Data source**: Google **Places API (New)** — `places.googleapis.com/v1/places:searchNearby`（**不是** legacy `maps.googleapis.com/maps/api/place/nearbysearch`）
- **Geolocation**: 瀏覽器原生 `navigator.geolocation`
- **Hosting**: Vercel（已 link，project ID 在 `.vercel/project.json`）
- **Domain**: https://what-to-eat-pi-two.vercel.app

## Directory Structure

```
.
├── api/                  ← Vercel serverless functions（key 待在這裡）
│   ├── places.js         ← proxy Nearby Search (New)，normalize 成舊 shape 回前端
│   └── photo.js          ← proxy Place Photos (New)，用 302 redirect 把 lh3 URL 丟給瀏覽器
├── src/
│   ├── App.jsx           ← 整個 App 在這一個檔案
│   └── main.jsx          ← React entry
├── .env                  ← GOOGLE_MAPS_KEY=...（在 .gitignore 內，不會 commit）
└── vite.config.js
```

## Conventions

- **API key 絕對不能進前端 bundle**。所有 Google API 呼叫一律走 `api/*.js` proxy。
- **環境變數命名**：`GOOGLE_MAPS_KEY`（**無** `VITE_` 前綴）。Vite 的 `VITE_` 前綴會把變數寫死進 build 輸出，等於公開。
- **後端做 shape normalization**：`api/places.js` 把 New API 的 response（`places[].displayName.text`、`location.latitude`、`priceLevel: "PRICE_LEVEL_*"` 等）轉回舊 Places API shape（`results[].name`、`geometry.location.lat`、`price_level: 1-4`），讓 `App.jsx` 不用知道 API 版本變更。未來再升級 API 也只改後端。
- **photo reference 不透明處理**：前端把 `photo.name`（形式 `places/X/photos/Y`）當不透明字串塞進 `/api/photo?ref=...`，後端負責組真實 URL。

## Current Status

### ✅ Completed

- 安全架構翻修：key 從前端 bundle 移到 server-only env var
- `api/places.js` + `api/photo.js` 兩個 serverless function 上線
- 切換到 Places API (New)
- GCP 新 API key 建好、Application restrictions = None、API restrictions 只勾 Places API (New)
- GCP Budget alert $5/月（保險）
- Vercel env var `GOOGLE_MAPS_KEY` 設定完成（All Environments）

### ⚠️ Pending / Known Issues

- **舊 key `AIzaSyAr1DXgt5SpzJtMDG8gs3P33NeJm55FukA` 還沒在 GCP DELETE** — 確認線上一切正常後就刪掉。
- **專案還沒做第一個 git commit**（master branch 0 commits）。一旦要 commit，務必先 `git status` 確認 `.env` 沒被 stage。
- **README.md 過時** — 還寫 `VITE_GOOGLE_MAPS_KEY`，要改成 `GOOGLE_MAPS_KEY` + 補一段「serverless function 架構」說明。

## Deployment

```bash
cd "/Users/lulu/AI Project/what-to-eat-project"
vercel --prod
```

不走 git push 觸發 — 直接用 Vercel CLI 從本機部署（`.vercel/project.json` 已 link）。

驗收網址：`https://what-to-eat-pi-two.vercel.app`

直接戳後端確認：
```bash
curl "https://what-to-eat-pi-two.vercel.app/api/places?location=25.0698,121.6325&radius=2000&type=restaurant&language=zh-TW"
```
應該回 `{"status":"OK","results":[...]}`。

## Common Pitfalls

每條都是這次踩過的坑，下次別再撞。

1. **`VITE_` 前綴 = key 進 bundle 公開**
   Vite 規則：`VITE_*` 環境變數會在 build 時直接寫進前端 JS。`.env` 在 `.gitignore` 沒救，因為 Vercel build 時讀進去就烘進 bundle 了。**任何 secret 都不要用 `VITE_` 前綴。**

2. **直接從前端打 `maps.googleapis.com&key=...`**
   即使 env var 拿掉了，只要 `App.jsx` 還在組這種 URL，key 就會出現在每個 Network request 上。一律走 `/api/*` proxy。

3. **GCP key 的 Application restrictions 不能設 HTTP referrers**
   serverless function 從 Vercel server 打去 Google，server-to-server 沒有 referrer header，會被擋。設 **None**，靠 **API restrictions**（只開 Places API New）+ **Budget alert** 限制爆刷風險。

4. **Places API (New) ≠ legacy Places API**
   - Endpoint 不同：`places.googleapis.com/v1/places:searchNearby`（POST）vs `maps.googleapis.com/maps/api/place/nearbysearch/json`（GET）
   - 認證 header：`X-Goog-Api-Key`（不是 querystring `key=`）
   - 必須帶 `X-Goog-FieldMask` 指定要回什麼欄位，否則 400
   - Response 結構完全不同（`places[]` vs `results[]`、`displayName.text` vs `name`、`location.latitude` vs `geometry.location.lat`）
   - GCP 啟用兩個是不同的 API — 勾錯版本 Google 會回 `REQUEST_DENIED` 說 `legacy API not enabled`。

5. **Field Mask 收費分層**
   `rating`、`userRatingCount`、`priceLevel`、`currentOpeningHours` 屬於 Enterprise tier，會吃比較多免費額度。個人專案沒事但要知道。

6. **Vercel env var 改完一定要 Redeploy 且取消 Build Cache**
   env var 不會自動套到既有部署。改完要 `vercel --prod` 重 deploy；如果走 Dashboard Redeploy 要記得**取消勾** "Use existing Build Cache"，不然拿到舊 bundle。

7. **驗收時搜 `AIzaSy` 不是 `googleapis`**
   F12 → Sources → Cmd+Opt+F 搜 `AIzaSy`（Google API key 統一前綴）才是真的找 key。搜 `googleapis` 會撞到 Google Fonts、Chrome extension 之類的雜訊。
