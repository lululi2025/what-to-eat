# 待辦與功能點子（2026-06-02）

> 2026-09-18 從 `CLAUDE.md` 原文搬過來，一字未改。原「Pending / Next Session」裡的新功能候選與暫時 skip 的優化。安全債與 photo 用量規則留在主檔。
> 現況看主檔 `CLAUDE.md`。

---

#### 殺手鐧級新功能（可選，按推薦度排）
| 功能 | 推薦度 | 工程量 |
|---|---|---|
| **D1 吃飯回顧卡片**（Spotify Wrapped 模式）★★★ | 殺手鐧、自然傳播 | ⭐⭐ html2canvas |
| **D2 附近征服進度地圖** | 蒐集遊戲化、retention | ⭐⭐ Google Maps JS API |
| **D3 吃飯日記 Letterboxd 化** | 讓資料變資產 | ⭐⭐ UI 重設計 |
| **D4 冷智慧推播** | 主動引流但易煩 | ⭐⭐⭐ 規則引擎 + 通知權限 |

**注意 D1 啟動時機**：等使用者累積 30+ 家紀錄才有故事，現階段先讓任務卡 / 朋友圈玩 1-2 週累積資料。

**下次 session 之前**：Lulu 應該已經跟朋友開幾場群組房、完成幾張挑戰、推幾家店給朋友、實際吃過 5+ 家店。再回來時帶著「實際卡住的 pain point」動。不要再憑空疊功能。


#### 暫時 skip 的優化
- F4 列表收合（等真的 50+ 筆再說）
- F5 GroupModal 再拆 chunk（已 lazy load，再拆 ROI 低）
- G2 unit test（個人專案先靠手測）
- G3 manualChunks（兩個 lazy chunk 已 OK）
- G4 canonical URL（不靠 SEO）
- H3 歷史紀錄搜尋（等真有大量紀錄）
