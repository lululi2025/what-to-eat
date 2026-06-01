# CLAUDE.md — Project Context

> Last updated: 2026-06-01

## Project Overview

「今天吃什麼」是隨機挑選附近餐廳的 Web App。GPS 定位 → 撈附近餐廳 → 老虎機抽店。Lulu 個人專案，部署在 Vercel。

**重點演進**：原本是純單人抽店工具，現在已升級成有 **群組共同決定模式 + 稀有度收藏 + 心情濾鏡 + 完整視覺重設計（晨光廚房）** 的小型完整 product。

## Tech Stack

- **Frontend**: React 18 + Vite 6（vanilla CSS-in-JS，沒上 Tailwind / shadcn）
- **動畫**: framer-motion（給 Tinder 式滑卡 + 卡片堆疊）
- **Icon**: @phosphor-icons/react（duotone weight）
- **字型**: Fraunces（標題）+ Inter（內文）+ Noto Sans/Serif TC + JetBrains Mono（房號）
- **Backend (Google)**: Vercel Serverless Functions `api/*.js`，proxy Google Places API (New)
- **Backend (群組模式)**: **Supabase** — Project ref `khhszoogshvpddczieql`（Tokyo）
  - Tables: `rooms` / `members` / `vetoes`
  - Realtime postgres_changes + 4s polling fallback
- **3D 黏土插圖**: Codex CLI 生成（`codex exec`），存在 `public/illustrations/`
- **Hosting**: Vercel — https://what-to-eat-pi-two.vercel.app

## Directory Structure

```
src/
├── App.jsx              ← 主元件，包整個 app（已不止單檔，但仍為主入口）
├── main.jsx             ← React entry
├── FoodIcon.jsx         ← Phosphor 料理 icon mapping + categoryKey()
├── Modals.jsx           ← RatingModal / HistoryModal / BlacklistModal / SettingsModal / RarityBadge
├── GroupModal.jsx       ← 群組決定模式整個 flow（entry / joining / invited / room stages）
├── SwipeDeck.jsx        ← Tinder 式滑卡組件（framer-motion）
├── storage.js           ← localStorage 資料層（rejects / history / prefs）
├── group.js             ← Supabase 群組房 CRUD + realtime
├── supabase.js          ← Supabase client + 匿名 device ID
├── rarity.js            ← SSR/SR/R/N 判定 + 難度規則
├── moods.js             ← 6 個心情 + name keyword 二次過濾
├── chains.js            ← 連鎖店白名單（60+ 條）
└── sound.js             ← Web Audio 合成 SSR 命中音

api/
├── places.js            ← proxy Places API (New)，normalize 成舊 shape
└── photo.js             ← proxy Place Photos，302 redirect

supabase/migrations/
├── 20260531120000_init_group_mode.sql       ← rooms/members/vetoes + RLS + Realtime
└── 20260531150000_replica_identity_full.sql ← UPDATE 事件正確 emit

public/illustrations/    ← 3D 黏土插圖（6 mood + cover）
docs/superpowers/specs/  ← 視覺重設計 spec
```

## Conventions

- **API key 絕對不能進前端**。Google key 走 `api/*.js` proxy。Supabase anon key 可進 bundle（`VITE_SUPABASE_*` prefix，設計上是公開的，RLS 提供安全）。
- **後端 shape normalization**：`api/places.js` 把 New API response 轉成舊 shape，前端不用知道版本。
- **UI 上不用 emoji** — 一律 Phosphor icon 或文字。例外：分享訊息（chat 場景）跟 ★ ✓ ✗ 等 typographic 字元 OK。
- **Group mode device ID**：用 `localStorage.getItem('wte_device_id')` 識別匿名使用者，不做帳號登入。
- **資料保存**：所有單人功能（黑名單、歷史、prefs）存 localStorage；群組房間存 Supabase（6 小時過期）。

## Current Status

### ✅ Completed

**單人核心**：
- Google Places (New) proxy + photo proxy
- 心情濾鏡（6 種，含 name keyword 二次過濾）
- 難度選擇（驚喜程度：安全牌 / 普通 / 挑戰 / 黑暗料理）
- 拒連鎖店 toggle（60+ 連鎖白名單）
- 暫時黑名單（30 天過期）+ 永久黑名單
- 吃過記錄（含星等、心得、稀有度收藏）
- 設定 Modal（音效、拒連鎖、清空資料）

**群組共同決定模式（方案 C）**：
- 邀請連結 `?r=CODE` 自動進房（朋友零輸入）
- Tinder 式滑卡 NO/OK（framer-motion）
- 房主獨有：開抽 / 接受 / 否決 / 全部重選
- Round 2 重投（保留上次 NO 當預設、卡上標「上次 NO」）
- 池子空時自動跳「全部重選」緊急按鈕
- 鎖定機制（按完成後不能再改）
- Realtime + 4s polling 雙保險
- 即時成員進度條 + 每人 NO 數

**分享 & PWA**：
- Open Graph + Twitter meta tags
- 新 cover image（3D 黏土食物拼盤）
- QR code asset
- PWA manifest + favicon set
- navigator.share 一鍵分享（fallback clipboard）

**視覺重設計（晨光廚房 A direction）**：
- 全面切 light mode 暖色系（#FBF7F0 米白底 + #E8612C 烤橘）
- Fraunces 襯線標題 + Inter 內文
- 引入 @phosphor-icons/react（duotone）
- 移除所有 UI emoji（替換為 Phosphor 或文字）
- 6 張 3D 黏土心情 icon（Codex 生）
- 稀有度徽章重設計（純文字 + 漸層底）
- Header 拆出獨立 icon bar 跟標題分開
- 難度改成 segmented control

### ⚠️ Pending / Next Session

**Lulu 下一輪要做的是「第二優先」retention 功能（從這 4 個挑）**：

| 功能 | 推薦度 | 工程量 |
|---|---|---|
| **吃飯回顧卡片**（Spotify Wrapped 模式）★★★ | 殺手鐧、自然傳播力強 | ⭐⭐ html2canvas |
| **附近征服進度地圖** | 蒐集遊戲化、retention | ⭐⭐ Google Maps JS API |
| **吃飯日記 Letterboxd 化**（餐廳照片 grid） | 讓資料變資產 | ⭐⭐ UI 重設計 |
| **冷智慧推播** | 主動引流但易煩 | ⭐⭐⭐ 規則引擎 + 通知權限 |

**還沒做完的視覺 polish**（次優先）：
- 跑 `emil-design-eng` skill：微互動 / hover / 動畫節奏
- 抽中結果卡 vignette + SSR fanfare
- SwipeDeck 卡片精細度
- Onboarding 第一次進來說明
- Mood 卡片 thumb tap area 加大

**舊技術債**：
- 舊 Google API key `AIzaSyAr1DXgt5SpzJtMDG8gs3P33NeJm55FukA` 還沒在 GCP 刪
- README.md 過時（要重寫反映現在的功能）

## Deployment

```bash
cd "/Users/lulu/AI Project/what-to-eat-project"
vercel --prod    # 從本機部署，不走 git push
```

驗收：https://what-to-eat-pi-two.vercel.app

Supabase 操作：CLI 已 link，DB password 在 `.env.local` 的 `DB_PASSWORD_FOR_REFERENCE`。

## Common Pitfalls

1. **VITE_ 前綴 = key 進 bundle**：Google key 絕對不能用 VITE_ 前綴。Supabase anon key 用 VITE_ 是 OK 的（設計上可公開）。

2. **前端不能直接打 Google Places API**：一律走 `/api/*` proxy，否則 key 會出現在 Network request。

3. **GCP key Application restrictions 設 None**：serverless function server-to-server 沒 referrer header。靠 API restrictions + Budget alert 限制。

4. **Places API (New) ≠ legacy**：endpoint / 認證 header / Field Mask 全不一樣。GCP 啟用是兩個不同 API。

5. **Supabase Realtime UPDATE 事件需要 REPLICA IDENTITY FULL**：預設 default 只送 PK，UPDATE 事件可能不 fire 或不完整。所有需要被即時監聽的 table 都要 ALTER 成 FULL。

6. **Realtime 不要單靠 push**：實作 4 秒 polling 後備，使用者體驗才有保障。CHANNEL_ERROR 在 console 印出來 debug 用。

7. **Vercel env var 改完要 Redeploy + 取消 Build Cache**：env 不會自動套到既有 deployment。Dashboard 走 Redeploy 要取消勾 "Use existing Build Cache"。

8. **驗收時搜 `AIzaSy` 不是 `googleapis`**：F12 → Sources → Cmd+Opt+F 搜 `AIzaSy` 才是真的找 key。

9. **UI 上一律不用 emoji**：要圖示用 Phosphor icon（`@phosphor-icons/react`，duotone weight）。分享訊息文字 + ★ ✓ ✗ ½ 等 typographic 字元例外。

10. **3D 黏土插圖風格一致性**：用 Codex CLI 的 image_gen 並把第一張 cover 當 `-i` 參考圖傳入。否則風格會跑掉。
