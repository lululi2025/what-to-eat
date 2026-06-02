# CLAUDE.md — Project Context

> Last updated: 2026-06-02

## Project Overview

「今天吃什麼」是隨機挑選附近餐廳的 Web App。GPS 定位 → 撈附近餐廳 → 抽店。Lulu 個人專案，部署在 Vercel。

**重點演進**：從純單人抽店升級成有 **群組共同決定 + 稀有度收藏 + 心情濾鏡 + PWA offline + 桌面快捷鍵 + 任務卡 + 朋友圈秘密推薦 + 完整視覺重設計（晨光廚房）** 的小型完整 product。首頁 IA 重整過：CTA 進首屏、篩選器輕量化、群組功能升級成 secondary CTA。

## Tech Stack

- **Frontend**: React 18 + Vite 6（vanilla CSS-in-JS，沒上 Tailwind / shadcn）
- **動畫**: framer-motion（Tinder 式滑卡）
- **Icon**: @phosphor-icons/react（duotone）
- **字型**（瘦身後）: Fraunces（襯線標題）+ Inter（內文）+ Noto Serif/Sans TC（中文 fallback）
  - 已砍掉 JetBrains Mono / Fredoka / DM Sans（沒人用，純占載入時間）
- **Backend (Google)**: Vercel Serverless Functions `api/*.js`，proxy Google Places API (New)
- **Backend (群組模式 + 朋友圈)**: **Supabase** — Project ref `khhszoogshvpddczieql`（Tokyo）
  - Tables: `rooms` / `members` / `vetoes` / `friendships` / `recommendations`
  - Realtime postgres_changes + 4s polling fallback
  - 朋友圈不用 OAuth，靠 `localStorage wte_device_id` 互信
- **PWA**: `vite-plugin-pwa` Workbox SW（precache build + 字型 + 照片 cache）
- **3D 黏土插圖**: Codex CLI（`codex exec`）生成，存 `public/illustrations/`
- **Hosting**: Vercel — https://what-to-eat-pi-two.vercel.app

## Directory Structure

```
src/
├── App.jsx              ← 主元件（首頁 IA、抽店流程、篩選 pipeline、快捷鍵）
├── main.jsx             ← React entry
├── FoodIcon.jsx         ← Phosphor 料理 icon mapping + categoryKey()
├── Modals.jsx           ← RatingModal / HistoryModal / BlacklistModal / SettingsModal
├── GroupModal.jsx       ← 群組決定整 flow（entry/joining/invited/room）+ 結算頁加朋友 prompt + Google Maps link
├── SwipeDeck.jsx        ← Tinder 滑卡（framer-motion）+ photo onError fallback emoji
├── FriendsModal.jsx     ← 朋友圈 modal（朋友 / 收到推薦 / ack 通知 三 tab）
├── RecommendModal.jsx   ← 推薦店給朋友的 picker（多選 + 留言 + 月配額 5）
├── RarityBadge.jsx      ← 稀有度徽章（神店/好店/中等/一般）
├── tasks.js             ← 任務卡庫（40 張、6 類別 order/social/record/explore/pace/taste）
├── storage.js           ← localStorage 資料層（rejects / history / prefs）
├── group.js             ← Supabase CRUD + Realtime（群組房）
├── friends.js           ← Supabase CRUD（朋友 + 秘密推薦）
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
├── 20260531150000_replica_identity_full.sql ← UPDATE 事件正確 emit
└── 20260602100000_friends_and_recs.sql      ← friendships + recommendations + RLS + Realtime

public/illustrations/    ← 3D 黏土插圖（6 mood + cover）
favicon-src/             ← favicon 1024 原檔（slot-v5-burger.png 漢堡老虎機）
docs/superpowers/specs/  ← 視覺重設計 spec
```

## Conventions

- **API key 絕對不能進前端**。Google key 走 `api/*.js` proxy。Supabase anon key 可進 bundle（`VITE_SUPABASE_*` prefix，設計上是公開的，RLS 提供安全）。
- **後端 shape normalization**：`api/places.js` 把 New API response 轉成舊 shape，前端不用知道版本。
- **UI 上不用 emoji** — 一律 Phosphor icon 或文字。例外：分享訊息（chat 場景）跟 ★ ✓ ✗ 等 typographic 字元 OK。
- **Group mode device ID**：用 `localStorage.getItem('wte_device_id')` 識別匿名使用者，不做帳號登入。
- **資料保存**：所有單人功能（黑名單、歷史、prefs）存 localStorage；群組房間存 Supabase（6 小時過期）。
- **稀有度 label** 用白話「神店 / 好店 / 中等 / 一般」（內部 key 仍是 SSR/SR/R/N）。

## Current Status

### ✅ Completed（截至 2026-06-02）

#### 任務卡（2026-06-02 新增）
- 40 張卡片庫，6 類（點餐 / 社交 / 紀錄 / 探索 / 速度 / 味覺）
- 「驚喜程度」標題行右側紫色 🎲 挑戰 toggle（預設 OFF）
- 抽店時若 ON 順手抽一張，卡片下方顯示 + 「✓ 完成挑戰」/「🎲 換一張」
- 完成挑戰存進歷史紀錄（h.task 欄位）
- HistoryModal 顯示任務徽章

#### 朋友圈 + 秘密推薦（2026-06-02 新增）
- **無 OAuth**：靠 `wte_device_id` 互信
- 群組房結算頁 AddFriendsSection — 列出其他成員，一鍵 +朋友
- 朋友圈 modal 三 tab：朋友 / 收到 / 通知（ack）
- RecommendModal：picker 多選朋友 + 留言（每位每月 5 家配額）
- 入口：餐廳列表 row 紫 icon + 抽中卡片「推給朋友」按鈕
- **推薦池整合進抽店**：spinPool = filtered + recPlaces
- 抽到推薦時揭曉特效：紫光暈 + 「💜 OO 推薦的」+ 朋友留言 + 震動
- 抽中標 `markRecShown`、「我去吃了」標 `markRecActed`
- 進 App 拉 unseen acks → 主畫面頂部 toast「💌 朋友吃了你推薦的 XX」
- 群組結算頁加 Google Maps 導航按鈕

#### 核心抽店
- Google Places (New) proxy + photo proxy
- 心情濾鏡（6 種，含 name keyword 二次過濾）
- 4 級難度（安全牌 / 普通 / 挑戰 / 黑暗料理）
- 拒連鎖店 toggle（60+ 連鎖白名單）
- **只看營業中 toggle**（預設 ON，避免抽到休息店）
- 暫時黑名單（30 天過期）+ 永久黑名單
- 吃過記錄（含星等、心得、稀有度收藏）
- 設定 Modal（音效預設 ON、拒連鎖、清空資料）

#### 群組共同決定
- 邀請連結 `?r=CODE` 自動進房
- Tinder 式滑卡 NO/OK
- 房主獨有：開抽 / 接受 / 否決 / 全部重選
- Round 2 重投（保留上次 NO 當預設）
- 池子空時自動跳「全部重選」緊急按鈕
- 鎖定機制 + Realtime + 4s polling 雙保險
- 即時成員進度條 + 每人 NO 數
- navigator.share 分享群組連結

#### 首頁 IA 重整（2026-06-01 大改）
- Nav 從 4 icon → 1 icon（只剩 ⚙️ 設定）
- **Spin Zone 上移到 H1 正下方**（CTA 進首屏，不用 scroll）
- 「給我好店」按鈕下方加「── 或 ──」分隔 + **「跟朋友一起決定」secondary CTA**
- 群組 CTA 文案動態：「跟朋友一起從這 12 間挑」+ hint「會帶入篩選條件」
- 抽中後加「換群組決定」inline link
- 心情卡片 84 → 64px、圖 64 → 44px（瘦身）
- 「排除連鎖」「只看營業中」併入難度標題行右側
- 「吃過的店 / 黑名單」從 nav 下放到頁尾
- 「今日剩餘搜尋」conditional 顯示（≤5 才出，≤2 警告色）
- Onboarding 卡片（localStorage `wte_onboarded_v1` 標記）

#### 稀有度視覺
- 命中 SSR/SR 紙花 + 音效（預設 ON）+ **震動**（手機 Vibration API）
- SSR：金黃光暈 + 28 片紙花 + 5 段震動
- SR：紫光 + 18 片紙花 + 3 段震動
- 黑暗料理模式（hell）：暗紅紫漸層 + 暗紅 border + 微紅光暈
- 列表中「休息中」店：opacity 0.55 + grayscale 0.7

#### PWA & 工程
- `vite-plugin-pwa` Workbox SW（precache build artifact 5MB）
- 字型 CacheFirst（一年），照片 StaleWhileRevalidate（7 天）
- `/api/places` 不快取（搜尋要新鮮）
- 4 個 Modal 全部 `React.lazy` + Suspense → bundle 拆 main 263KB + GroupModal 383KB
- `env(safe-area-inset-bottom)` 避免 iOS Home indicator 蓋按鈕

#### 鍵盤快捷鍵
- **Space** → 抽店
- **G** → 開群組
- **Esc** → 關 modal
- 自動避開 input/textarea/contenteditable

#### Error handling 強化
- API 錯誤改成「搜尋失敗 (XXX)」+「↻ 重新搜尋」按鈕
- 定位錯誤區分三型：permission denied / timeout / other
  - permission denied 給 iPhone Safari / Chrome 開定位的 step-by-step 指引

#### 字型瘦身
- 從 7+ 種字型砍到 4 種（Fraunces + Inter + Noto Serif TC + Noto Sans TC）
- JetBrains Mono / Fredoka / DM Sans 全砍
- App.jsx 內重複的 `<link>` 移除

#### 分享 & 視覺
- 抽中卡片 + 列表餐廳 `<img alt={name}>` 補無障礙文字
- 抽中後加「📤 分享」單店 navigator.share 按鈕
- Loading skeleton：搜尋中 list 顯示 5 張灰色卡片 + opacity pulse 動畫
- favicon v5：dusty 烤土司色老虎機 + 漢堡黏土 3D
- manifest theme_color 從黑改奶油白 `#FBF7F0`

#### Photo API 燒錢防禦（2026-06-02 大事件後新增）
- **5/31 一天扣 $109.90 USD（≈ NT$3,400）** — Place Details Photos 月免費上限**只有 1,000 calls**
- 主畫面餐廳列表 photo **完全移除** — 全部改用 emoji `FoodIcon`，永遠不打 photo API
- SwipeDeck photo 加 `onError` fallback → 載不到自動顯示 emoji + 漸層底色
- 群組房候選店從 20 → 12（降 photo 用量 40%）
- GCP daily quota 設 100/day for Place Details Photos
- Photo 只用在「抽中卡片」（一次抽店 1 張）+「群組滑卡」（一場 12 張）

#### Code 品質
- 抽出 `resetPick()` helper（9 處重複歸一）
- `console.log` 用 `import.meta.env?.DEV` gate（prod 不污染 console）
- distance slider 拖動只改值，放開（mouseup/touchend）才 resetPick

### ⚠️ Pending / Next Session

#### 安全債（要 Lulu 自己動手）
- **舊 Google API key `AIzaSyAr1DXgt5SpzJtMDG8gs3P33NeJm55FukA` 還沒在 GCP 刪**
  - GCP Console → API 和服務 → 憑證 → 找到 key → 刪除
  - 刪前先確認新 key 在 Vercel env var 正常運作

#### 殺手鐧級新功能（可選，按推薦度排）
| 功能 | 推薦度 | 工程量 |
|---|---|---|
| **D1 吃飯回顧卡片**（Spotify Wrapped 模式）★★★ | 殺手鐧、自然傳播 | ⭐⭐ html2canvas |
| **D2 附近征服進度地圖** | 蒐集遊戲化、retention | ⭐⭐ Google Maps JS API |
| **D3 吃飯日記 Letterboxd 化** | 讓資料變資產 | ⭐⭐ UI 重設計 |
| **D4 冷智慧推播** | 主動引流但易煩 | ⭐⭐⭐ 規則引擎 + 通知權限 |

**注意 D1 啟動時機**：等使用者累積 30+ 家紀錄才有故事，現階段先讓任務卡 / 朋友圈玩 1-2 週累積資料。

#### Photo 用量設計取捨（不要破壞）
- **列表永遠不加回 photo** — 已確認決策，emoji 已經夠用
- Photo 只在「抽中卡片」+「群組滑卡」用
- 將來想加照片：應該走「點 row 才 lazy 載 photo」，不是默認載
- Daily quota 100 + Budget alert $5 USD（待設定）

#### 暫時 skip 的優化
- F4 列表收合（等真的 50+ 筆再說）
- F5 GroupModal 再拆 chunk（已 lazy load，再拆 ROI 低）
- G2 unit test（個人專案先靠手測）
- G3 manualChunks（兩個 lazy chunk 已 OK）
- G4 canonical URL（不靠 SEO）
- H3 歷史紀錄搜尋（等真有大量紀錄）

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

5. **Supabase Realtime UPDATE 事件需要 REPLICA IDENTITY FULL**：預設只送 PK，UPDATE 事件可能不 fire 或不完整。所有需要被即時監聽的 table 都要 ALTER 成 FULL。

6. **Realtime 不要單靠 push**：實作 4 秒 polling 後備，使用者體驗才有保障。

7. **Vercel env var 改完要 Redeploy + 取消 Build Cache**：env 不會自動套到既有 deployment。

8. **驗收時搜 `AIzaSy` 不是 `googleapis`**：F12 → Sources → Cmd+Opt+F 搜 `AIzaSy` 才是真的找 key。

9. **UI 上一律不用 emoji**：要圖示用 Phosphor icon（duotone weight）。分享訊息文字 + ★ ✓ ✗ ½ 例外。

10. **3D 黏土插圖風格一致性**：用 Codex CLI image_gen，把第一張 cover 當 `-i` 參考圖傳入。

11. **PWA 改完 Service Worker 需要強制刷新**：使用者重整時 SW 才能更新 (`registerType: 'autoUpdate'`)。改 SW 規則後本機要 unregister + 重 load。

12. **PREFS_DEFAULT 加新欄位要記得同步 `?? fallback`**：避免老使用者升級時新欄位 undefined 出問題。

13. **🚨 Place Details Photos 月免費上限只有 1,000 calls**（不是 5,000，是其他 SKU 的）：超過 $7/1000。一天就可能扣 $109+ USD。**列表千萬別載 photo**。新功能要用 photo 前先算用量。

14. **`replace_all` Edit 要小心 self-reference**：曾把 `setPick(null); setDone(false); setPickRarity(null);` replace_all 成 `resetPick();`，結果 helper 自己內部那行也被替換 → 變成 infinite recursion。改大量重複時要先確認 helper 自身不在 match 範圍。

15. **device_id 跨裝置不能互通**：朋友圈靠 `wte_device_id` 互信，換手機 device_id 重新生，朋友關係會斷。日後若要跨裝置同步必須上 Supabase Auth。

16. **friendships table 約束 `device_a < device_b`**：寫入時要先 orderPair 把兩個 device_id 排序，小的放 a 大的放 b，避免重複條目。
