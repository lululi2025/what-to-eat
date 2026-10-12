# CLAUDE.md — 今天吃什麼（what-to-eat）

> Last updated: 2026-10-12（舊 key 已刪、已推上 GitHub；上一版 2026-10-11 清理草稿）
> Codex／其他 agent 讀同層 `AGENTS.md`（指回這份）。做完的事寫進 `docs/HISTORY-已完成.md`、功能點子寫 `docs/BACKLOG-功能點子.md`，不要疊回本檔。

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

## Current Status（2026-09-18 核對）

- 功能完成清單（到 06-02）在 `docs/HISTORY-已完成.md`。之後只有 09-12 兩個 commit：心情插圖改 144px WebP（首次載入 5.1MB→817KB）、換心情不再重複打 Places API（配額改計真實呼叫數）。
- 2026-10-11 清理：`favicon-src/` 只留現行原檔 `slot-v5-burger.png`（已比對確認就是 `public/icon-512.png` 的來源）；舊圖示備份、v2–v4 草稿、`clean_Gemini_…png` 已由 Lulu 刪除。`dist/` 是建置產物，可隨時重 build。
- 2026-10-11：舊 Google API key 已在 GCP 刪除；repo 推上 GitHub `lululi2025/what-to-eat`（公開，分支 `main`，覆蓋掉 04 月的舊版）。部署仍是 `vercel --prod`，不靠 push。
- 下一步原則（06-02 定）：先實際用 1–2 週累積 pain point 再加功能，不要憑空疊；候選功能見 `docs/BACKLOG-功能點子.md`。

#### Photo 用量設計取捨（不要破壞）
- **列表永遠不加回 photo** — 已確認決策，emoji 已經夠用
- Photo 只在「抽中卡片」+「群組滑卡」用
- 將來想加照片：應該走「點 row 才 lazy 載 photo」，不是默認載
- Daily quota 100 + Budget alert $5 USD（待設定）

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

17. **SVG inline data URL grain texture**：用 `<rect width='100%' filter='url(%23n)'/>` 時 `#` 要 escape 成 `%23`，不然瀏覽器當成 anchor 失效。

18. **inline keyframe 需要不同方向時用 CSS variable**：例如 `taskBurst` 用 `--angle` 變數讓 14 個粒子各自方向飛，純 keyframe 做不到（keyframe 不能讀 inline transform）。

19. **SettingsModal 變 nav hub 後別忘了 badge 同步**：⚙️ icon 跟 SettingsModal 內的「朋友圈」入口都要顯示 `pendingRecs.length + ackToasts.length`，加新通知類資料時要同步兩處。


21. **vite-plugin-pwa 的 `includeAssets` 不受 `globIgnores` 影響**：要排除 precache 必須從 `includeAssets` 清單移掉，只加 `globIgnores` 會被塞回去（2026-09-12 commit `0fdbedd`）。
