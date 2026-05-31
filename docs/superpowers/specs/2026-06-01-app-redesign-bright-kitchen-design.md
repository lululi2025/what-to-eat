# 「今天吃什麼」App 視覺重設計 — A 晨光廚房

**Date:** 2026-06-01
**Status:** Approved for implementation
**Owner:** Lulu
**Project root:** `/Users/lulu/AI Project/what-to-eat-project`

---

## Background

現有 App 使用大量 emoji（🎰 🎲 ✨💎⭐🍴 等）作為視覺主導，配色為深色背景 + 橘紅漸層，整體被評為「太 AI 拼盤、像 demo 不像產品」。

需求：建立有個性、有食慾感的視覺體系，不依賴 emoji。

## Goals

1. 全面替換 UI 上的 emoji 為設計過的視覺資產（3D 黏土插畫 + 線條 icon）
2. 建立 light mode 暖色設計系統（晨光廚房調性）
3. 引入襯線標題字體增加編輯感
4. 重畫 cover image（社群分享預覽）
5. 不變動功能 / API / 資料層 — 純視覺 upgrade

## Non-Goals

- 暗色模式（未來考慮）
- 新功能
- 動畫系統升級（保留現有動畫）
- 後端 / Supabase 結構變動
- 分享 LINE 訊息的 emoji（chat 場景，emoji 是表情而非 UI）

---

## Design Tokens

### Colors

```css
/* 背景 */
--bg-app:      #FBF7F0;   /* 奶油白, primary surface */
--bg-surface:  #FFFFFF;   /* cards / modals */
--bg-muted:    #F0E8DC;   /* 細微區隔 */
--border:      #E5DCC9;   /* 邊框 */

/* 文字 */
--text:        #2A1F18;   /* 主文 — 巧克力深棕（非純黑）*/
--text-muted:  #7B6F61;   /* 次文 */
--text-dim:    #B8AC99;   /* placeholder / 細節 */

/* Brand / Action */
--primary:     #E8612C;   /* 烤橘 — 主 CTA */
--primary-h:   #C44E1C;   /* hover/pressed */
--secondary:   #B33B2E;   /* 番茄紅 — alt action */

/* Semantic */
--success:     #3D8B5E;   /* 抹茶綠 — OK / accept */
--danger:      #D14C3F;   /* 蝦紅 — NO / veto */
--warning:     #E8A93D;   /* 蜂蜜黃 */

/* 稀有度 */
--ssr:         #E8B547;   /* 金 — 神級 */
--sr:          #9B72D8;   /* 紫 — 優質 */
--r:           #6B95E8;   /* 藍 — 普通 */
--n:           #A39A8B;   /* 灰棕 — 平凡 */
```

### Typography

| 用途 | Font Stack |
|---|---|
| 標題 | `'Fraunces', 'Noto Serif TC', serif` |
| 內文 | `'Inter', 'Noto Sans TC', sans-serif` |
| 房號 / 程式風 | `'JetBrains Mono', monospace` |

全部 from Google Fonts（CDN 載入維持現狀）。

### Type Scale

| Token | Size | Weight |
|---|---|---|
| Display | 32px | Bold (700) |
| H1 | 24px | Semibold (600) |
| H2 | 18px | Semibold (600) |
| Body | 15px | Regular (400) |
| Small | 13px | Regular (400) |
| Caption | 11px | Regular (400) |

### Spacing

4px 倍數系統：4 / 8 / 12 / 16 / 24 / 32 / 48

### Radii

- 小（btn / chip）：10px
- 中（card）：16px
- 大（modal / hero）：24px

---

## Icon System (兩層)

### Layer 1: 3D 黏土插圖（hero / 情感點）

- **用途**：心情選擇器、稀有度裝飾、空狀態、cover、老虎機主視覺、成功狀態
- **來源**：nano-banana MCP 生成
- **存放**：`public/illustrations/`
- **規格**：透明 PNG，512×512（cover 為 1200×630）

**清單（13 張）**：

| 檔名 | 用途 |
|---|---|
| `mood-random.png` | 心情：隨便（拼盤） |
| `mood-hungry.png` | 心情：餓爆了（漢堡） |
| `mood-chill.png` | 心情：想放鬆（咖啡杯） |
| `mood-sweet.png` | 心情：想吃甜（蛋糕） |
| `mood-fast.png` | 心情：趕時間（便當外帶盒） |
| `mood-drink.png` | 心情：想喝兩杯（啤酒杯） |
| `rarity-ssr.png` | 稀有度 SSR 金色光輝裝飾 |
| `rarity-sr.png` | 稀有度 SR 紫色寶石裝飾 |
| `rarity-r.png` | 稀有度 R 藍色亮點裝飾 |
| `rarity-n.png` | 稀有度 N 灰棕簡單裝飾 |
| `empty-pool.png` | 空狀態（空盤） |
| `success-eaten.png` | 成功狀態（拍掌 / 滿足貓） |
| `cover-og.png` | OG cover image，1200×630 |

### Layer 2: 線條 icon（功能性）

- **用途**：設定齒輪、關閉、返回、分享、Header 按鈕、編輯、刪除
- **來源**：[Phosphor Icons React](https://phosphoricons.com/) `@phosphor-icons/react`
- **Weight**：Duotone
- **Size**：18–24px

**映射表**：

| 用途 | Phosphor Icon |
|---|---|
| 群組入口 | `UsersThree` |
| 吃過的店 | `BookOpenText` |
| 黑名單 | `Prohibit` |
| 設定 | `GearSix` |
| 關閉 modal | `X` |
| 返回 | `ArrowLeft` |
| 分享 | `ShareNetwork` |
| 複製 | `Copy` |
| 編輯 | `PencilSimple` |
| 刪除 | `Trash` |
| NO 按鈕（卡片下） | `XCircle` (filled, 蝦紅) |
| OK 按鈕（卡片下） | `CheckCircle` (filled, 抹茶綠) |

---

## Component-Level Changes

### Header
- 拿掉 🎰 emoji
- 用 Fraunces 字體 wordmark：「今天吃什麼」，「？」用 `--primary` 色
- 右上 4 顆 icon button：用 Phosphor 替換現有 emoji

### Mood Selector
- 從 emoji chip → 6 張圓形卡（80×100px）
- 每張卡：3D 黏土插圖（上）+ 中文 label（下）
- horizontal scroll 保留

### Difficulty Selector
- 改名：「難度」→「**驚喜程度**」
- 改為 segmented control，4 段純文字：**安全牌 / 普通 / 挑戰 / 黑暗料理**
- 不用 emoji 表情

### Chain Filter Toggle
- 保留現有位置
- 文字改為 Inter weight 500
- 邊框 / 顏色套新 token

### Rarity Badge
- 全面重畫
- 純徽章設計：漸層底 + 字母 + 中文小標（例：SSR / 神級）
- 大 size（pick 卡用）背後加對應 3D 插圖 vignette

### Spin Result / Pick Card
- 拿掉 🎲 / 🎰 emoji
- 主視覺：**優先用 Google Places 餐廳照片，無照片時 fallback 用對應 3D 黏土食物插圖**
- SSR 加金色 glow + 灑彩屑（彩屑顏色依稀有度動）

### SwipeDeck
- 卡片視覺結構保留
- 「上次 ✗ NO」徽章重設計 — 純色塊 + Fraunces 字
- NO / OK overlay 用 Fraunces display 字體

### Modals (Rating / History / Blacklist / Settings / Group)
- 圓角 18px → 24px
- backdrop blur 加重（4px → 8px）
- 內部 emoji 替換為 Phosphor icon
- 標題用 Fraunces，內文 Inter

### Cover Image (OG)
- 重畫
- 奶油白底 + 3D 黏土食物盤組合 + Fraunces wordmark
- 1200×630

---

## Implementation Sequence

5 個 commit / 階段：

1. **基礎建設** — CSS tokens、字型 import、`@phosphor-icons/react` 安裝
2. **資產生成** — nano-banana 生 13 張 3D 黏土插圖到 `public/illustrations/`
3. **Layout components** — Header / Mood / Difficulty / Chain toggle / Settings
4. **Game components** — Rarity badge / Spin result / SwipeDeck / Modals
5. **Cover + Polish** — OG image 重生 + `emil-design-eng` skill 收尾

**Deploy strategy**：Big bang — 整套做完一次部署，避免新舊混雜視覺不一致。

---

## Acceptance Criteria

- [ ] UI 上找不到任何 emoji（除分享訊息文字內容）
- [ ] 配色全面切到 light mode 暖系
- [ ] Fraunces + Inter 字型正確載入
- [ ] 13 張 3D 插圖到位且 size 一致
- [ ] Cover image 重新生成 + OG 預覽卡更新
- [ ] 所有現有功能正常運作（不破壞 group mode / swipe deck / history / blacklist / settings）
- [ ] 部署到 production + Lulu 手動驗收

---

## Open Questions

無 — 所有設計決定已對齊。

---

## References

- Cal AI（3D 黏土食物 icon 風格）
- NYT Cooking（編輯感、襯線標題）
- Headspace（軟性插畫、暖色）
- Phosphor Icons（功能 icon 系統）
- Fraunces（Display font, Google Fonts）
- Inter（Body font, Google Fonts）
