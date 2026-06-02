# 今天吃什麼？ What To Eat

隨機挑選附近餐廳的 Web App。一個人抽店，也能跟朋友一起決定。在日本可搭配食べログ查評分。

🔗 **線上版**：[what-to-eat-pi-two.vercel.app](https://what-to-eat-pi-two.vercel.app)

## 主要功能

### 一個人抽店
- 📍 GPS 定位，搜尋附近餐廳（200m ~ 2km）
- 🎲 隨機挑選 + 卡片揭曉動畫
- 😋 **心情濾鏡** — 6 種心情（隨便 / 餓 / 清爽 / 甜點 / 喝點什麼 / 想吃肉）
- 🎯 **驚喜程度** — 4 級難度：安全牌、普通、挑戰、黑暗料理
- 🏷️ **稀有度** — 神店 / 好店 / 中等 / 一般，命中 SSR 有紙花 + 音效 + 震動
- 🚫 暫時黑名單（30 天）+ 永久黑名單
- 📖 吃過記錄（含星等、心得、稀有度收藏）
- 🔧 排除連鎖店 + 只看營業中（預設 ON）

### 群組共同決定
- 🔗 邀請連結 `?r=CODE` 自動進房，朋友零輸入加入
- 👆 Tinder 式滑卡 NO / OK
- 🏆 房主：開抽 / 接受 / 否決 / 全部重選
- ⚡ Supabase Realtime + 4 秒 polling 雙保險
- 🔒 鎖定機制（按完成後不能改）

### PWA / 分享
- 📱 加到手機主畫面當原生 app 用
- 🌐 Service Worker offline cache（離線可看歷史紀錄）
- 🔗 navigator.share 一鍵分享單店 / 群組房間

### 鍵盤快捷鍵
- **Space** — 抽店
- **G** — 開群組
- **Esc** — 關 modal

## 技術棧

- **Frontend**: React 18 + Vite 6（vanilla CSS-in-JS）
- **動畫**: framer-motion（Tinder 滑卡）
- **Icon**: @phosphor-icons/react（duotone）
- **字型**: Fraunces（標題）+ Inter（內文）+ Noto Serif/Sans TC（中文 fallback）
- **後端**:
  - Google Places API (New) — `api/*.js` Vercel Serverless proxy
  - Supabase — 群組房間 `rooms` / `members` / `vetoes` table + Realtime
- **3D 黏土插圖**: Codex CLI 用 GPT image_gen 生（`public/illustrations/`）
- **Hosting**: Vercel

## 開發

```bash
npm install
npm run dev
npm run build      # 編譯 + PWA service worker
npm run preview    # 跑 build 結果
```

## 環境變數

`.env`（本機開發）：

```
GOOGLE_MAPS_KEY=...                    # Google Places API key（server-side proxy 用）
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...             # Supabase anon key（前端可公開，靠 RLS 保護）
```

> ⚠️ **API key 絕對不能進前端 bundle** — Google key 走 `api/places.js` proxy。Supabase anon key 用 `VITE_` 前綴是設計上允許的，靠 RLS 保護。

## 部署

從本機推到 Vercel production：

```bash
vercel --prod
```

Vercel Project Settings → Environment Variables 設定：
- `GOOGLE_MAPS_KEY`（server-side）
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（client-side）

## 目錄結構

```
src/
├── App.jsx              # 主畫面（抽店流程 + 篩選 pipeline + UI）
├── main.jsx             # React entry
├── FoodIcon.jsx         # Phosphor 料理 icon mapping
├── Modals.jsx           # Rating / History / Blacklist / Settings modal
├── GroupModal.jsx       # 群組決定整個流程
├── SwipeDeck.jsx        # Tinder 式滑卡
├── RarityBadge.jsx      # 稀有度徽章
├── storage.js           # localStorage 資料層
├── group.js             # Supabase CRUD + Realtime
├── supabase.js          # Supabase client + 匿名 device ID
├── rarity.js            # 神店/好店/中等/一般 判定
├── moods.js             # 6 心情 + 二次 keyword 過濾
├── chains.js            # 連鎖店白名單
└── sound.js             # Web Audio 命中音

api/
├── places.js            # Google Places API (New) proxy
└── photo.js             # Place Photos proxy（302 redirect）

supabase/migrations/     # 群組功能的 schema + RLS
public/illustrations/    # 6 個心情 + cover 3D 黏土插圖
```

## License

個人專案，無 License。
