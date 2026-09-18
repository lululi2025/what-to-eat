# 已完成功能（截至 2026-06-02）

> 2026-09-18 從 `CLAUDE.md` 原文搬過來，一字未改。原「Current Status → ✅ Completed」。09-12 另有兩個 commit（首次載入 5.1MB→817KB、換心情不再重複打 Places API），細節看 `git log`。
> 現況看主檔 `CLAUDE.md`。

---

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

#### Clay-toy 美學重塑（2026-06-02 晚間，commit 5ae4c8e）
**Design intent**：UI 跟 favicon / 心情插圖的「3D 黏土玩具感」對齊，從 flat web design 變物理厚實感
- 全頁 SVG turbulence grain noise overlay（0.18 opacity, mix-blend multiply）= 紙質印刷感
- H1 48px + 「？」傾斜 -14deg + scale 56 + textShadow = 標題變雕塑
- Section headers 加雜誌編號 01 / 02 / 03（橘色 Fraunces italic）
- 心情卡 ON 狀態 `translateY(-4px)` + 多層厚陰影 + inset highlight
- Spin Zone 卡片 borderRadius 22 + chunky 多層陰影（baseChunky 永遠在）
- 「給我好店」主 CTA 改 3D push 按鈕（底層 6px 暗影模擬厚度，`:active` translateY(4px)）
- 餐廳列表 row 去 border、加多層柔陰影 + inner highlight，`.resto-row:hover` lift -3px

#### UX 閉環回饋（2026-06-02 晚間，commit eff4635）
- 完成挑戰 → 14 顆紫/綠/黃小煙火爆炸 + 三段震動 [30,40,50] + 完成狀態加綠虛線提示「↓ 順手按下方『我去吃了』一起記下這餐」
- 評分送出 → 主畫面跳綠色 toast「✓ 已加入吃過的店」+ 「看紀錄 →」按鈕一鍵開 HistoryModal
- 任務 + 評分都完成 → toast 升級「🎉 完美的一餐！」
- 加新 keyframe `taskBurst`（用 `--angle` CSS variable 讓 14 個粒子各自方向飛）

#### Nav 結構大調（2026-06-02 晚間，commit 77e3070）
**底部三個 link 全砍**：吃過的店 / 黑名單 / 朋友圈搬進 SettingsModal「我的資料」section
- 右上 ⚙️ 設定 icon 加紫色紅點 badge（顯示 pending recs + acks 未讀總數）
- SettingsModal 接 props `onOpenHistory` / `onOpenBlacklist` / `onOpenFriends` / `friendsBadge`
- 點 nav item 自動關設定 modal 並打開對應 modal（不套娃 modal）
- 移動原因：底部 link 太沉、user 反饋「scroll 才看到、根本不會發現」

#### Code 品質
- 抽出 `resetPick()` helper（9 處重複歸一）
- `console.log` 用 `import.meta.env?.DEV` gate（prod 不污染 console）
- distance slider 拖動只改值，放開（mouseup/touchend）才 resetPick
