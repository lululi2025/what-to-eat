import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import {
  cleanExpiredTempRejects, isRejected,
  addTempReject, addPermanentReject,
  addHistory, getPrefs, setPrefs,
} from "./storage.js";
import { RarityBadge } from "./RarityBadge.jsx";

// Modal 都改 lazy load — 首次 bundle 只載入主畫面要用的 code
const RatingModal = lazy(() => import("./Modals.jsx").then(m => ({ default: m.RatingModal })));
const HistoryModal = lazy(() => import("./Modals.jsx").then(m => ({ default: m.HistoryModal })));
const BlacklistModal = lazy(() => import("./Modals.jsx").then(m => ({ default: m.BlacklistModal })));
const SettingsModal = lazy(() => import("./Modals.jsx").then(m => ({ default: m.SettingsModal })));
const GroupModal = lazy(() => import("./GroupModal.jsx").then(m => ({ default: m.GroupModal })));
const FriendsModal = lazy(() => import("./FriendsModal.jsx").then(m => ({ default: m.FriendsModal })));
const RecommendModal = lazy(() => import("./RecommendModal.jsx").then(m => ({ default: m.RecommendModal })));
import { MOODS, getMood, matchesMoodKeywords } from "./moods.js";
import {
  RARITY_META, getRarity,
  DIFFICULTIES, filterByDifficulty,
} from "./rarity.js";
import { isChain } from "./chains.js";
import { playSSR, playSR } from "./sound.js";
import { pickRandomTask, TASK_CATEGORIES } from "./tasks.js";
import { getUnseenAcks, ackMyRec, getPendingRecs, markRecShown, markRecActed } from "./friends.js";
import {
  UsersThree, BookOpenText, Prohibit, GearSix,
  MapPin, ArrowsClockwise, MapTrifold, LockSimpleOpen,
  MagnifyingGlass, Warning, DiceFive, ShareNetwork,
} from "@phosphor-icons/react";
import { categoryKey, FoodIcon } from "./FoodIcon.jsx";

// ─── Config ───
const DAILY_LIMIT = 30;
const STORAGE_KEY = "whatto_eat_daily";

// ─── Rate limit helpers ───
function getRateLimit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: "", count: 0 };
    return JSON.parse(raw);
  } catch { return { date: "", count: 0 }; }
}
function bumpRateLimit() {
  const today = new Date().toISOString().slice(0, 10);
  const rl = getRateLimit();
  const count = rl.date === today ? rl.count + 1 : 1;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count })); } catch {}
  return count;
}
function canSearch() {
  const today = new Date().toISOString().slice(0, 10);
  const rl = getRateLimit();
  return rl.date !== today || rl.count < DAILY_LIMIT;
}
function remaining() {
  const today = new Date().toISOString().slice(0, 10);
  const rl = getRateLimit();
  return rl.date === today ? Math.max(0, DAILY_LIMIT - rl.count) : DAILY_LIMIT;
}

// ─── Helpers ───
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function priceTag(n) { return n ? "$".repeat(n) : "—"; }
function tabelogUrl(name) { return `https://tabelog.com/rstLst/?vs=1&sa=&sk=${encodeURIComponent(name)}`; }
// 食べログ 只在日本有資料，用 GPS bounding box 判斷使用者是否在日本
function isJapan(loc) {
  if (!loc) return false;
  const { lat, lng } = loc;
  return lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146;
}
function gmapUrl(name, lat, lng) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&center=${lat},${lng}`; }
function photoSrc(ref, w = 120) { return ref ? `/api/photo?ref=${encodeURIComponent(ref)}&w=${w}` : null; }
// FoodIcon 跟 categoryKey 抽到 ./FoodIcon.jsx，這裡 re-import

const iconBtnStyle = {
  width: 40, height: 40, borderRadius: "50%",
  border: "1px solid var(--border)", background: "var(--sf)",
  color: "var(--tx)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .15s",
};
const iconBtnPrimaryStyle = {
  ...iconBtnStyle,
  background: "var(--accent)", border: "none", color: "#FFFFFF",
  boxShadow: "0 4px 14px rgba(232,97,44,.28)",
};

function Stars({ rating }) {
  if (!rating) return <span style={{ color: "var(--dim)", fontSize: 12 }}>尚無評分</span>;
  const f = Math.floor(rating), h = rating % 1 >= 0.3;
  return (
    <span style={{ color: "var(--accent)", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(f)}{h && "½"}{"☆".repeat(5 - f - (h ? 1 : 0))}
      <span style={{ color: "var(--dim)", marginLeft: 4, fontSize: 12 }}>{rating}</span>
    </span>
  );
}

// ═══════════════════════════ APP ═══════════════════════════
export default function App() {
  const [loc, setLoc] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errType, setErrType] = useState(""); // "api" / "loc-denied" / "loc-timeout" / "loc-other" / ""
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [pickRarity, setPickRarity] = useState(null);
  const [done, setDone] = useState(false);
  // 任務卡：當前抽到的任務、完成狀態
  const [currentTask, setCurrentTask] = useState(null);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [taskCelebrate, setTaskCelebrate] = useState(false); // 完成挑戰瞬間的小煙火動畫
  // E5: 重複 9 次的清空抽店狀態抽成一個 helper（換 mood/difficulty/距離等都會用到）
  const resetPick = useCallback(() => {
    setPick(null); setDone(false); setPickRarity(null);
    setCurrentTask(null); setTaskCompleted(false);
  }, []);
  const [radius, setRadius] = useState(1000);
  const [left, setLeft] = useState(remaining());

  // ─── Prefs（從 localStorage 載入）───
  const [prefs, setLocalPrefs] = useState(() => getPrefs());
  const updatePrefs = (patch) => setLocalPrefs(setPrefs(patch));

  // ─── 拒絕清單 + 吃過記錄 + Modal 控制 ───
  const [storageVer, setStorageVer] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [recommendingPlace, setRecommendingPlace] = useState(null); // place 物件 = 開啟 RecommendModal
  const [ackToasts, setAckToasts] = useState([]); // R3: 朋友吃了我推薦的店通知
  const [pendingRecs, setPendingRecs] = useState([]); // R2: 朋友推薦給我的店
  const [historyToast, setHistoryToast] = useState(null); // { name, withTask } 加入歷史後顯示
  const [inviteCode, setInviteCode] = useState(null);  // 從 URL ?r= 拿到的邀請房號
  const [ratingFor, setRatingFor] = useState(null);
  const [pendingAutoSpin, setPendingAutoSpin] = useState(false);

  // 啟動時清過期的暫時黑名單 + 檢查邀請連結 + 首次進來顯示 onboarding
  useEffect(() => {
    cleanExpiredTempRejects();
    setStorageVer(v => v + 1);

    // 邀請連結偵測 ?r=ABC123 → 自動打開群組 modal 並進入加入流程
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    if (r && /^[A-Z0-9]{6}$/i.test(r)) {
      setInviteCode(r.toUpperCase());
      setShowGroup(true);
      window.history.replaceState({}, "", window.location.pathname);
      return; // 有邀請連結就不顯示 onboarding
    }

    // 第一次進來顯示 onboarding（用獨立 localStorage key 不污染 prefs）
    try {
      if (!localStorage.getItem("wte_onboarded_v1")) {
        setShowOnboarding(true);
      }
    } catch {}
  }, []);

  const dismissOnboarding = () => {
    try { localStorage.setItem("wte_onboarded_v1", "1"); } catch {}
    setShowOnboarding(false);
  };

  // ─── Google Places Nearby Search（支援多 type 並行搜尋並合併去重）───
  const search = useCallback(async (lat, lng, types) => {
    if (!canSearch()) { setErr(`今日搜尋已達 ${DAILY_LIMIT} 次上限`); return; }
    setBusy(true); setErr("");
    const typeList = Array.isArray(types) ? types : [types || "restaurant"];
    try {
      // 對每個 type 發出平行請求
      const responses = await Promise.all(typeList.map(type => {
        const qs = new URLSearchParams({
          location: `${lat},${lng}`, radius: "2000",
          type,
          language: navigator.language || "zh-TW",
        });
        return fetch(`/api/places?${qs}`).then(r => r.json());
      }));

      // 合併結果，以 place_id 去重
      const seen = new Set();
      const merged = [];
      for (const d of responses) {
        if (d.status === "OK" && d.results) {
          for (const p of d.results) {
            if (!seen.has(p.place_id)) {
              seen.add(p.place_id);
              merged.push(p);
            }
          }
        }
      }

      if (merged.length > 0) {
        setList(merged.map((p, i) => ({
          id: p.place_id || i,
          name: p.name,
          rating: p.rating || 0,
          reviews: p.user_ratings_total || 0,
          dist: Math.round(haversine(lat, lng, p.geometry.location.lat, p.geometry.location.lng)),
          price: priceTag(p.price_level),
          addr: p.vicinity || "",
          open: p.opening_hours?.open_now,
          openTxt: p.opening_hours ? (p.opening_hours.open_now ? "營業中" : "休息中") : null,
          openNow: p.opening_hours?.open_now,
          img: categoryKey(p.types),
          photo: p.photos?.[0]?.photo_reference || null,
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng,
        })));
        bumpRateLimit(); setLeft(remaining());
      } else if (responses.every(d => d.status === "ZERO_RESULTS" || d.status === "OK")) {
        setList([]); setErr("附近找不到餐廳"); setErrType("");
      } else {
        const bad = responses.find(d => d.status !== "OK" && d.status !== "ZERO_RESULTS");
        setErr(`搜尋失敗 (${bad?.status || "未知"}) — 試試重新搜尋`); setErrType("api");
      }
    } catch (e) {
      setErr("網路連線不穩 — 試試重新搜尋"); setErrType("api");
    } finally { setBusy(false); }
  }, []);

  // ─── Geolocation ───
  const locate = useCallback(() => {
    setLocBusy(true); setErr(""); setErrType("");
    if (!navigator.geolocation) {
      setLocBusy(false); setErr("這個瀏覽器不支援定位"); setErrType("loc-other");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(c); setLocBusy(false);
        search(c.lat, c.lng, getMood(prefs.mood).types);
      },
      (e) => {
        setLocBusy(false);
        // E3: 區分定位錯誤型別給更明確的指引
        if (e.code === 1) { // PERMISSION_DENIED
          setErr("定位被拒絕了"); setErrType("loc-denied");
        } else if (e.code === 3) { // TIMEOUT
          setErr("定位超時 — 訊號可能不穩，再試一次"); setErrType("loc-timeout");
        } else {
          setErr("無法取得定位"); setErrType("loc-other");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [search, prefs.mood]);

  useEffect(() => { locate(); }, [locate]);

  // R3: 進 App 時拉「朋友吃了我推薦的店」未讀通知 + R2: 拉朋友推給我的 pending recs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [acks, recs] = await Promise.all([getUnseenAcks(), getPendingRecs()]);
        if (cancelled) return;
        setAckToasts(acks);
        setPendingRecs(recs);
      } catch (_) { /* 連不上 Supabase 不擋首頁 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissAckToast = async (recId) => {
    setAckToasts(prev => prev.filter(a => a.id !== recId));
    try { await ackMyRec(recId); } catch (_) {}
  };

  // 進 App 時若有 pending recs 跳 toast（這個 session 顯示過就不再跳）
  const [showPendingToast, setShowPendingToast] = useState(false);
  useEffect(() => {
    if (pendingRecs.length === 0) return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("wte_pending_toast_seen")) return;
    setShowPendingToast(true);
  }, [pendingRecs.length]);
  const dismissPendingToast = () => {
    setShowPendingToast(false);
    try { sessionStorage.setItem("wte_pending_toast_seen", "1"); } catch (_) {}
  };

  const changeMood = (id) => {
    updatePrefs({ mood: id });
    resetPick();
    if (loc) search(loc.lat, loc.lng, getMood(id).types);
  };

  // ─── 篩選 pipeline ───
  // 每層計算「被本層擋掉幾家」用於 0 結果時的提示
  const { filtered, pipeline } = useMemo(() => {
    const stages = [];
    let cur = list;
    const log = (name, before, after, action) => stages.push({ name, removed: before - after, remaining: after, action });

    const a0 = cur.length;
    cur = cur.filter(r => r.dist <= radius);
    log(`距離 ${radius}m`, a0, cur.length);

    const a1 = cur.length;
    cur = cur.filter(r => !isRejected(r.id));
    log("黑名單", a1, cur.length);

    // 心情：name keyword 二次過濾（只在有設關鍵字的 mood 才篩）
    const mood = getMood(prefs.mood);
    if (mood.nameKeywords) {
      const aM = cur.length;
      cur = cur.filter(r => matchesMoodKeywords(r.name, mood));
      log(`心情：${mood.label}`, aM, cur.length,
        { type: "setMood", key: "random", label: "改成「隨便」（全部都看）" });
    }

    if (prefs.excludeChains) {
      const a2 = cur.length;
      cur = cur.filter(r => !isChain(r.name));
      log("排除連鎖", a2, cur.length, { type: "togglePref", key: "excludeChains", label: "關掉「排除連鎖」" });
    }

    // 只看營業中（預設 ON）：openNow === false 才排除，undefined（API 沒給）保留
    const onlyOpen = prefs.onlyOpen ?? true;
    if (onlyOpen) {
      const aOpen = cur.length;
      cur = cur.filter(r => r.openNow !== false);
      log("只看營業中", aOpen, cur.length, { type: "togglePref", key: "onlyOpen", label: "關掉「只看營業中」" });
    }

    if (prefs.difficulty !== "normal") {
      const a3 = cur.length;
      cur = filterByDifficulty(cur, prefs.difficulty);
      log(`難度：${DIFFICULTIES.find(d => d.id === prefs.difficulty)?.label}`,
        a3, cur.length, { type: "setDifficulty", key: "normal", label: "改回「普通」模式" });
    }

    return { filtered: cur, pipeline: stages };
  }, [list, radius, storageVer, prefs.excludeChains, prefs.onlyOpen, prefs.difficulty, prefs.mood]);

  // R2: 朋友推薦的店 normalize 成 place-like 結構，準備混入抽店池
  const recPlaces = useMemo(() => {
    if (!loc) return [];
    return pendingRecs.map(r => ({
      id: `rec_${r.id}`,
      name: r.place_name,
      rating: 0, reviews: 0,
      dist: r.place_lat && r.place_lng
        ? Math.round(haversine(loc.lat, loc.lng, r.place_lat, r.place_lng))
        : 9999,
      price: "", addr: r.place_addr || "",
      openTxt: null, openNow: undefined,
      img: "default", photo: null,
      lat: r.place_lat, lng: r.place_lng,
      // 推薦標記，UI 用
      isRec: true,
      recId: r.id,
      recFromName: r.from_name || "朋友",
      recMessage: r.message,
    }));
  }, [pendingRecs, loc]);

  // 抽店池：filtered + 朋友推薦（注入到列表後段，spin 抽到機率約 = recPlaces.length / 總數）
  const spinPool = useMemo(() => [...filtered, ...recPlaces], [filtered, recPlaces]);

  // A2: 餐廳列表的排序快取住，避免每次 render 都重排（朋友推薦的店不顯示在列表，只進池子）
  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => a.dist - b.dist),
    [filtered]
  );

  // ─── Spin ───
  const lastPickIdRef = useRef(null);
  const spin = useCallback(() => {
    if (!spinPool.length || spinning) return;
    // A1: 排除上次抽到的店，避免「再轉一次」轉到同一間
    const lastId = lastPickIdRef.current;
    const finalPool = spinPool.length > 1
      ? spinPool.filter(r => r.id !== lastId)
      : spinPool;
    setSpinning(true); resetPick();
    let n = 0;
    const total = 18 + Math.floor(Math.random() * 10);
    const go = () => {
      n++;
      // 滾動過程用完整 spinPool（視覺豐富），最後一次才用 finalPool 鎖定結果
      const isLast = n >= total;
      const pool = isLast ? finalPool : spinPool;
      const p = pool[Math.floor(Math.random() * pool.length)];
      setPick(p);
      if (!isLast) {
        setTimeout(go, 50 + (n / total) * 300 + (n > total - 4 ? (n - total + 4) * 120 : 0));
      } else {
        lastPickIdRef.current = p.id;
        setSpinning(false); setDone(true);
        const rarity = getRarity(p);
        setPickRarity(rarity);
        if (prefs.sound) {
          if (rarity === "SSR") playSSR();
          else if (rarity === "SR") playSR();
        }
        // C1: 命中 SSR / SR / 朋友推薦 加觸感回饋
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          if (p.isRec) navigator.vibrate([50, 40, 50, 40, 80]); // 推薦命中震動更明顯
          else if (rarity === "SSR") navigator.vibrate([30, 50, 30, 50, 60]);
          else if (rarity === "SR") navigator.vibrate([20, 40, 30]);
        }
        // R2: 抽到朋友推薦 → 標記 shown + 從 pending 拿掉，避免下次重複出現
        if (p.isRec && p.recId) {
          markRecShown(p.recId).catch(() => {});
          setPendingRecs(prev => prev.filter(r => r.id !== p.recId));
        }
        // 任務卡：若 enableTasks 開著，順手抽一張
        if (prefs.enableTasks) {
          setCurrentTask(pickRandomTask());
          setTaskCompleted(false);
        }
      }
    };
    go();
  }, [spinPool, spinning, prefs.sound, prefs.enableTasks]);

  // F2: 桌面快捷鍵 — Space 抽店、G 群組、Esc 關 modal（手機沒鍵盤就沒影響）
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      const anyModalOpen = showHistory || showBlacklist || showSettings || showGroup || ratingFor || showOnboarding;
      if (e.key === "Escape" && anyModalOpen) {
        e.preventDefault();
        if (ratingFor) setRatingFor(null);
        else if (showOnboarding) dismissOnboarding();
        else if (showHistory) setShowHistory(false);
        else if (showBlacklist) setShowBlacklist(false);
        else if (showSettings) setShowSettings(false);
        else if (showGroup) setShowGroup(false);
        return;
      }
      if (anyModalOpen) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!spinning && filtered.length) spin();
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setShowGroup(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length, spinning, spin, showHistory, showBlacklist, showSettings, showGroup, ratingFor, showOnboarding]);

  // 拒絕後自動再轉一次（A 方案）
  useEffect(() => {
    if (!pendingAutoSpin) return;
    setPendingAutoSpin(false);
    if (filtered.length > 0) {
      // 等一個 tick 讓 UI 先把 pick 清空，動畫比較順
      setTimeout(() => spin(), 200);
    }
  }, [pendingAutoSpin, filtered, spin]);

  // ─── 操作按鈕 handler ───
  const handleAte = () => {
    if (!pick) return;
    setRatingFor(pick);
    // R2: 若這家是朋友推薦的，標記 acted（推薦者下次開 app 會收到通知）
    if (pick.isRec && pick.recId) {
      markRecActed(pick.recId).catch(() => {});
    }
  };

  const handleRatingSubmit = ({ rating, note }) => {
    if (!ratingFor) return;
    addHistory({
      placeId: ratingFor.id,
      name: ratingFor.name,
      img: ratingFor.img,
      rarity: pickRarity || getRarity(ratingFor),
      rating,
      note,
      // 若這輪有任務 + 完成了，把任務一起塞進歷史
      task: currentTask ? { id: currentTask.id, text: currentTask.text, cat: currentTask.cat, completed: taskCompleted } : null,
    });
    // 給「閉環」回饋 — 主畫面跳 toast 告知已記錄 + 提供查看入口
    setHistoryToast({ name: ratingFor.name, withTask: !!(currentTask && taskCompleted) });
    setTimeout(() => setHistoryToast(null), 5000);
    setRatingFor(null);
    // 評分完不重轉，停留在 done 狀態
  };

  const handleTempReject = () => {
    if (!pick) return;
    addTempReject(pick.id);
    resetPick();
    setStorageVer(v => v + 1);
    setPendingAutoSpin(true);
  };

  const handlePermReject = () => {
    if (!pick) return;
    const ok = window.confirm(`「${pick.name}」加入永久黑名單？\n以後抽店都不會出現，要解除得到黑名單管理裡找。`);
    if (!ok) return;
    addPermanentReject(pick.id, pick.name);
    resetPick();
    setStorageVer(v => v + 1);
    setPendingAutoSpin(true);
  };

  const distLabel = radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`;

  // ─── 晨光廚房 Bright Kitchen 設計 tokens ───
  const css = {
    "--bg": "#FBF7F0",         // 奶油白底
    "--sf": "#FFFFFF",         // 卡片白
    "--sf2": "#F0E8DC",        // 細微區隔（取代原本的深色 sf2）
    "--border": "#E5DCC9",     // 奶茶邊
    "--accent": "#E8612C",     // 烤橘（主 CTA）
    "--accent2": "#D14C3F",    // 蝦紅 / NO / danger
    "--accent3": "#3D8B5E",    // 抹茶綠 / OK / success
    "--ssr": "#E8B547",        // 金 SSR
    "--sr": "#9B72D8",         // 紫 SR
    "--r-rare": "#6B95E8",     // 藍 R
    "--n-rare": "#A39A8B",     // 灰棕 N
    "--tx": "#2A1F18",         // 巧克力深棕（主文）
    "--dim": "#7B6F61",        // 奶咖（次文）
    "--dim2": "#B8AC99",       // 米咖（caption / placeholder）
    "--tab": "#E8612C",        // tabelog 用主色
    "--fd": "'Fraunces','Noto Serif TC',serif",
    "--fb": "'Inter','Noto Sans TC',sans-serif",
    "--r": "20px",             // 比原本 18px 更圓
  };

  return (
    <div style={{ ...css, minHeight: "100vh", background: "var(--bg)", color: "var(--tx)", fontFamily: "var(--fb)", padding: "0 0 calc(40px + env(safe-area-inset-bottom))", position: "relative", overflow: "hidden" }}>
      {/* 暖色 radial gradient 背景 */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 20% 0%,rgba(232,97,44,.07) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(61,139,94,.05) 0%,transparent 50%)" }} />
      {/* Grain noise overlay — SVG turbulence 紙質感，讓奶油白不死板 */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        opacity: 0.18,
        mixBlendMode: "multiply",
      }} />

      {/* Top: 只留設定 icon — 群組/歷史/黑名單下放到內容區與底部 */}
      <nav style={{
        position: "relative", zIndex: 1,
        display: "flex", justifyContent: "flex-end",
        padding: "16px 16px 0",
      }}>
        {(() => {
          const settingsBadge = pendingRecs.length + ackToasts.length;
          return (
            <button onClick={() => setShowSettings(true)} title="設定" aria-label="設定" style={{ ...iconBtnStyle, position: "relative" }}>
              <GearSix size={20} weight="duotone" />
              {settingsBadge > 0 && (
                <span style={{
                  position: "absolute", top: -2, right: -2,
                  background: "linear-gradient(135deg,#c084fc,#9b6cf5)",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                  minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(192,132,252,.5)",
                }}>{settingsBadge > 9 ? "9+" : settingsBadge}</span>
              )}
            </button>
          );
        })()}
      </nav>

      {/* Title section */}
      <header style={{
        position: "relative", zIndex: 1, textAlign: "center",
        padding: "16px 16px 18px",
      }}>
        <h1 style={{
          fontFamily: "var(--fd)", fontWeight: 600, fontSize: 48,
          letterSpacing: 0, color: "var(--tx)",
          margin: 0, lineHeight: 1.05,
        }}>
          今天吃什麼<span style={{
            color: "var(--accent)", fontStyle: "italic",
            display: "inline-block", marginLeft: 4,
            fontWeight: 700, fontSize: 56,
            transform: "rotate(-14deg) translateY(2px)",
            transformOrigin: "center",
            textShadow: "0 4px 12px rgba(232,97,44,.25)",
          }}>？</span>
        </h1>

        <p style={{
          color: "var(--dim)", fontSize: 13, margin: "10px 0 0",
          display: "inline-flex", alignItems: "center", gap: 5,
          fontFamily: "var(--fb)",
        }}>
          {locBusy ? "定位中..." : loc ? (
            <><MapPin size={14} weight="fill" color="var(--accent3)" /> 已定位</>
          ) : "無法定位"}
        </p>

        {left <= 5 && (
          <p style={{
            color: left <= 2 ? "var(--accent2)" : "var(--dim)",
            fontSize: 11, margin: "4px 0 0", fontFamily: "var(--fb)", fontWeight: 500,
          }}>
            今日搜尋 {DAILY_LIMIT - left} / {DAILY_LIMIT}
          </p>
        )}
      </header>

      {/* Error */}
      {err && (
        <div style={{ margin: "0 16px 12px", padding: "10px 14px", borderRadius: 12, background: "rgba(209,76,63,.12)", border: "1px solid rgba(209,76,63,.3)", color: "var(--accent2)", fontSize: 13, textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Warning size={16} weight="fill" /> {err}
          </span>

          {/* E3: 定位被拒絕 — 給瀏覽器設定路徑指引 */}
          {errType === "loc-denied" && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(0,0,0,.04)", borderRadius: 10, fontSize: 12, color: "var(--tx)", textAlign: "left", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>怎麼開啟定位權限：</div>
              <div>• <b>iPhone Safari</b>：設定 → 隱私權與安全性 → 定位服務 → Safari 網站 → 允許</div>
              <div>• <b>Chrome / Edge</b>：網址列左側 🔒 或 ⓘ → 網站權限 → 位置 → 允許</div>
              <div style={{ marginTop: 6, color: "var(--dim)" }}>設定完成後重新整理頁面</div>
            </div>
          )}

          {/* E2: API 錯誤 — 有 loc 時可直接重試搜尋 */}
          {errType === "api" && loc && (
            <button onClick={() => search(loc.lat, loc.lng, getMood(prefs.mood).types)} style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px auto 0", padding: "6px 14px", borderRadius: 20, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <ArrowsClockwise size={14} weight="bold" /> 重新搜尋
            </button>
          )}

          {/* 定位 timeout / other — 「重新定位」按鈕 */}
          {(errType === "loc-timeout" || errType === "loc-other" || (!loc && !errType)) && (
            <button onClick={locate} style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px auto 0", padding: "6px 14px", borderRadius: 20, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <ArrowsClockwise size={14} weight="bold" /> 重新定位
            </button>
          )}
        </div>
      )}

      {/* 朋友推薦給我 — 進 App 顯示一次（session 內 dismiss 後不再跳）*/}
      {showPendingToast && pendingRecs.length > 0 && (
        <div style={{ padding: "0 16px 8px", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            background: "linear-gradient(135deg,rgba(192,132,252,.12),rgba(155,108,245,.04))",
            border: "1px solid rgba(192,132,252,.35)",
            borderRadius: 12,
            animation: "fadeUp .4s ease both",
          }}>
            <span style={{ fontSize: 18 }}>💜</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#9b6cf5", fontWeight: 600 }}>
                {pendingRecs.length === 1 ? "朋友推薦了 1 家店給你" : `${pendingRecs.length} 位朋友推薦了店給你`}
              </div>
              <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                下次抽店有機會抽到，或點下方「朋友圈」看清單
              </div>
            </div>
            <button
              onClick={() => { setShowFriends(true); dismissPendingToast(); }}
              style={{ background: "rgba(192,132,252,.15)", border: "1px solid #c084fc", color: "#9b6cf5", cursor: "pointer", padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 14 }}
            >看看</button>
            <button
              onClick={dismissPendingToast}
              style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer", padding: 4, fontSize: 16 }}
              aria-label="關閉"
            >✕</button>
          </div>
        </div>
      )}

      {/* 「我去吃了」評分完成 toast — 給閉環回饋：確認已記錄 + 提供查看入口 */}
      {historyToast && (
        <div style={{ padding: "0 16px 8px", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px",
            background: "linear-gradient(135deg,rgba(61,139,94,.14),rgba(61,139,94,.04))",
            border: "1.5px solid var(--accent3)",
            borderRadius: 14,
            animation: "fadeUp .4s ease both",
            boxShadow: "0 8px 20px -6px rgba(61,139,94,.25), inset 0 1px 0 rgba(255,255,255,.6)",
          }}>
            <span style={{ fontSize: 22 }}>{historyToast.withTask ? "🎉" : "✓"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--accent3)", fontWeight: 700 }}>
                {historyToast.withTask ? "完美的一餐！任務 + 評分都記下了" : "已加入「吃過的店」"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {historyToast.name}
              </div>
            </div>
            <button
              onClick={() => { setShowHistory(true); setHistoryToast(null); }}
              style={{
                background: "rgba(61,139,94,.15)", border: "1px solid var(--accent3)",
                color: "var(--accent3)", cursor: "pointer",
                padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 14,
              }}
            >看紀錄 →</button>
            <button
              onClick={() => setHistoryToast(null)}
              style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer", padding: 4, fontSize: 16 }}
              aria-label="關閉"
            >✕</button>
          </div>
        </div>
      )}

      {/* R3: 朋友吃了我推薦的店通知 toast（彈一張卡，點 ✓ 標已讀） */}
      {ackToasts.length > 0 && (
        <div style={{ padding: "0 16px 8px", position: "relative", zIndex: 1 }}>
          {ackToasts.slice(0, 3).map(a => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", marginBottom: 6,
                background: "linear-gradient(135deg,rgba(232,97,44,.08),rgba(232,97,44,.02))",
                border: "1px solid rgba(232,97,44,.25)",
                borderRadius: 12,
                animation: "fadeUp .4s ease both",
              }}
            >
              <span style={{ fontSize: 18 }}>💌</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>朋友去吃了你推薦的店</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.place_name}</div>
              </div>
              <button
                onClick={() => dismissAckToast(a.id)}
                style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer", padding: 4, fontSize: 16 }}
                aria-label="標已讀"
              >✓</button>
            </div>
          ))}
          {ackToasts.length > 3 && (
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
              還有 {ackToasts.length - 3} 則 → 朋友圈查看
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {busy && <div style={{ textAlign: "center", padding: 24, color: "var(--dim)" }}>
        <div style={{ display: "inline-flex", animation: "spin 1.2s linear infinite", color: "var(--accent)" }}>
          <MagnifyingGlass size={28} weight="duotone" />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>搜尋附近餐廳中...</p>
      </div>}

      {/* Spin Zone */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {(() => {
          const rMeta = done && pickRarity ? RARITY_META[pickRarity] : null;
          const isSSR = pickRarity === "SSR";
          const isSR  = pickRarity === "SR";
          const isHellMode = prefs.difficulty === "hell";
          const cardBg = done && rMeta
            ? `linear-gradient(145deg, ${rMeta.color}26, ${rMeta.color}10)`
            : (done ? "linear-gradient(145deg,rgba(232,97,44,.12),rgba(209,76,63,.08))"
              : (isHellMode ? "linear-gradient(145deg,rgba(127,29,29,.10),rgba(88,28,135,.06))" : "var(--sf)"));
          const cardBorder = done && rMeta ? `2px solid ${rMeta.color}`
            : (done ? "2px solid var(--accent)"
              : (isHellMode ? "2px solid rgba(127,29,29,.35)" : "2px solid var(--sf2)"));
          // 黏土感：未抽中時加多層厚陰影 + inset highlight 模擬「捏出來的物件」
          const baseChunky = "0 12px 28px -8px rgba(232,97,44,.18), 0 4px 8px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.7)";
          const cardShadow = done && isSSR ? rMeta.glow
            : (done && isSR ? `0 0 20px ${rMeta.color}40, ${baseChunky}`
            : (done ? `0 0 40px rgba(232,97,44,.15), ${baseChunky}`
              : (isHellMode ? `0 0 30px rgba(127,29,29,.18), ${baseChunky}` : baseChunky)));
          const confettiCount = isSSR ? 28 : (isSR ? 18 : 12);
          return (
        <div style={{
          width: "100%", maxWidth: 400, minHeight: pick || spinning ? 200 : 0,
          background: cardBg,
          borderRadius: 22, border: cardBorder,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, transition: "all .4s",
          boxShadow: cardShadow,
          animation: done && isSSR ? "ssrGlow 2.2s ease-in-out infinite" : (done && isSR ? "srGlow 2.5s ease-in-out infinite" : "none"),
          position: "relative", overflow: "hidden",
        }}>
          {done && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            {Array.from({ length: confettiCount }).map((_, i) => <div key={i} style={{
              position: "absolute", left: `${8 + Math.random() * 84}%`, top: -10,
              width: 6 + Math.random() * 6, height: 6 + Math.random() * 6,
              borderRadius: Math.random() > .5 ? "50%" : "2px",
              background: isSSR
                ? ["#ffd56b","#ff7e5f","#fff","#ffb347"][Math.floor(Math.random()*4)]
                : isSR
                  ? ["#c084fc","#8b5cf6","#fff","#ddd6fe"][Math.floor(Math.random()*4)]
                  : ["var(--accent)","var(--accent2)","var(--accent3)","#fff"][Math.floor(Math.random()*4)],
              opacity: .8, animation: `confetti ${1.2 + Math.random() * 1.5}s ease-out ${i * .04}s forwards`,
            }} />)}
          </div>}

          {/* 稀有度徽章浮在卡頂 */}
          {done && rMeta && (
            <div style={{
              position: "absolute", top: 12, left: 12,
              animation: "popIn .5s cubic-bezier(.17,.67,.21,1.25) .15s both",
            }}>
              <RarityBadge rarity={pickRarity} size="lg" />
            </div>
          )}

          {!pick && !spinning && <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--dim)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {filtered.length > 0
                ? `共 ${filtered.length} 間 · ${DIFFICULTIES.find(d => d.id === prefs.difficulty)?.label || "普通"}`
                : busy
                  ? "搜尋中..."
                  : "沒有符合條件的餐廳 — 試試放寬距離或換難度"}
            </p>
          </div>}

          {pick && <div style={{ textAlign: "center", width: "100%", animation: spinning ? "tick .1s" : done ? "popIn .5s cubic-bezier(.17,.67,.21,1.25)" : "none" }}>
            {pick.photo && !spinning ? (
              <div style={{ width: 80, height: 80, borderRadius: 16, overflow: "hidden", margin: "0 auto 10px", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
                <img src={photoSrc(pick.photo, 200)} alt={pick.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: 18, margin: "0 auto 10px",
                background: "var(--sf2)", display: "flex", alignItems: "center", justifyContent: "center",
                filter: spinning ? "blur(1px)" : "none",
              }}>
                <FoodIcon type={pick.img} size={44} color="var(--accent)" />
              </div>
            )}
            {/* R2: 抽到朋友推薦時揭曉 — 紫色徽章 + 朋友留言 */}
            {done && pick.isRec && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 10px", borderRadius: 20,
                background: "linear-gradient(135deg,#c084fc,#9b6cf5)",
                color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                marginBottom: 6,
                animation: "popIn .5s cubic-bezier(.17,.67,.21,1.25) .1s both",
                boxShadow: "0 4px 14px rgba(192,132,252,.4)",
              }}>
                💜 {pick.recFromName} 推薦的
              </div>
            )}
            <h2 style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: done ? 22 : 20, margin: "0 0 4px", color: done ? (pick.isRec ? "#9b6cf5" : "var(--accent)") : "var(--tx)" }}>{pick.name}</h2>
            {done && pick.isRec && pick.recMessage && (
              <div style={{
                fontSize: 12, color: "var(--tx)", padding: "8px 12px",
                background: "rgba(192,132,252,.1)", borderRadius: 10,
                margin: "6px auto 8px", maxWidth: 320,
                fontStyle: "italic", lineHeight: 1.5,
                animation: "fadeUp .4s ease .25s both",
              }}>
                「{pick.recMessage}」
              </div>
            )}
            {done && <div style={{ animation: "fadeUp .4s ease .2s both" }}>
              <Stars rating={pick.rating} />
              {pick.reviews > 0 && <span style={{ color: "var(--dim)", fontSize: 11, marginLeft: 4 }}>({pick.reviews} 則)</span>}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10, fontSize: 13, color: "var(--dim)", flexWrap: "wrap" }}>
                <span>{pick.dist}m</span><span>{pick.price}</span>
                {pick.openTxt && (
                  <span style={{ color: pick.openNow ? "var(--accent3)" : "var(--accent2)", fontWeight: 600 }}>
                    {pick.openTxt}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--dim)", margin: "8px 0 12px" }}>{pick.addr}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <a href={gmapUrl(pick.name, pick.lat, pick.lng)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, background: "rgba(61,139,94,.12)", border: "1px solid var(--accent3)", color: "var(--accent3)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><MapTrifold size={13} weight="duotone" /> Google Maps</a>
                {isJapan(loc) && <a href={tabelogUrl(pick.name)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 14px", borderRadius: 20, background: "rgba(232,73,27,.12)", border: "1px solid var(--tab)", color: "var(--tab)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><MagnifyingGlass size={13} weight="bold" /> 食べログ</a>}
                {/* H2: 一鍵分享單店給朋友（navigator.share 有就走 native sheet，沒有 fallback 複製） */}
                <button
                  onClick={async () => {
                    const shareText = `今天吃這家：${pick.name}\n${pick.addr || ""}\n${gmapUrl(pick.name, pick.lat, pick.lng)}`;
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: pick.name, text: shareText });
                      } else if (navigator.clipboard) {
                        await navigator.clipboard.writeText(shareText);
                        setErr("已複製到剪貼簿"); setErrType(""); setTimeout(() => setErr(""), 1500);
                      }
                    } catch (_) { /* user cancelled */ }
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, background: "rgba(232,97,44,.1)", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <ShareNetwork size={13} weight="duotone" /> 分享
                </button>
                {/* 推薦給朋友（秘密推薦）— 朋友抽店時混進池子，揭曉時亮出「Lulu 推薦的」 */}
                <button
                  onClick={() => setRecommendingPlace(pick)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 20, background: "rgba(192,132,252,.12)", border: "1px solid #c084fc", color: "#9b6cf5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <UsersThree size={13} weight="duotone" /> 推給朋友
                </button>
              </div>
            </div>}
          </div>}
        </div>
          );
        })()}

        {/* 來點挑戰 toggle — 移到主 CTA 上方，跟「抽店」這個動作視覺相鄰 */}
        {!pick && !spinning && (
          <button
            onClick={() => updatePrefs({ enableTasks: !prefs.enableTasks })}
            title="開啟後抽店時順便抽一張吃飯任務"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 24,
              border: "1.5px solid #c084fc",
              background: prefs.enableTasks ? "linear-gradient(135deg,#c084fc,#9b6cf5)" : "rgba(192,132,252,.08)",
              color: prefs.enableTasks ? "#fff" : "#9b6cf5",
              fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s",
              marginTop: 14, marginBottom: 0,
              boxShadow: prefs.enableTasks ? "0 4px 14px rgba(192,132,252,.4)" : "none",
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: prefs.enableTasks ? "#fff" : "transparent",
              border: prefs.enableTasks ? "none" : "1.5px solid #c084fc",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9b6cf5", fontWeight: 700, fontSize: 12,
            }}>{prefs.enableTasks ? "✓" : ""}</span>
            🎲 來點挑戰任務
          </button>
        )}

        <button
          onClick={spin}
          disabled={!filtered.length || spinning || busy}
          className="chunky-cta"
          style={{
          marginTop: 20, width: 220, height: 60, borderRadius: 60, border: "none",
          background: spinning
            ? "var(--sf2)"
            : prefs.difficulty === "hell"
              ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
              : "linear-gradient(135deg,var(--accent),var(--accent2))",
          color: spinning ? "var(--dim)" : "#fff",
          fontFamily: "var(--fd)", fontWeight: 700, fontSize: 18,
          cursor: !filtered.length || spinning || busy ? "not-allowed" : "pointer",
          // 黏土感 3D push 按鈕：底層暗色 = 厚度 + 多層陰影 + inset highlight
          boxShadow: spinning ? "0 1px 0 rgba(0,0,0,.2)" : (prefs.difficulty === "hell"
            ? "0 6px 0 #7f1d1d, 0 10px 24px rgba(220,38,38,.35), inset 0 1px 0 rgba(255,255,255,.25)"
            : "0 6px 0 #C04E1E, 0 10px 24px rgba(232,97,44,.35), inset 0 1px 0 rgba(255,255,255,.3)"),
          transition: "all .15s cubic-bezier(.17,.67,.21,1.25)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transform: spinning ? "translateY(4px)" : "translateY(0)",
          opacity: !filtered.length || busy ? .4 : 1,
        }}>
          {spinning ? <><span style={{ animation: "spin .6s linear infinite", display: "inline-flex" }}><DiceFive size={20} weight="duotone" /></span> 選擇中...</>
            : prefs.difficulty === "hell" ? <>接受命運</>
            : prefs.difficulty === "hard" ? <>來點刺激</>
            : prefs.difficulty === "easy" ? <>給我好店</>
            : <>隨機挑選</>}
        </button>

        {/* 群組 secondary CTA — 沒抽中時才顯示，避免跟「吃過了/換一家」搶位 */}
        {!pick && !spinning && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 10px", width: "100%", maxWidth: 280 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--dim)", letterSpacing: 0.5, fontFamily: "var(--fb)" }}>或</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <button
              onClick={() => setShowGroup(true)}
              disabled={filtered.length === 0}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 22px", borderRadius: 30,
                border: `1.5px solid ${filtered.length === 0 ? "var(--sf2)" : "var(--accent)"}`,
                background: "transparent",
                color: filtered.length === 0 ? "var(--dim)" : "var(--accent)",
                fontFamily: "var(--fb)", fontWeight: 600, fontSize: 14,
                cursor: filtered.length === 0 ? "not-allowed" : "pointer",
                opacity: filtered.length === 0 ? 0.5 : 1,
                transition: "all .2s",
              }}
            >
              <UsersThree size={18} weight="duotone" />
              {filtered.length > 0 ? `跟朋友一起從這 ${filtered.length} 間挑` : "目前沒有可選的店"}
            </button>
            {filtered.length > 0 && (
              <p style={{
                margin: "8px 0 0", fontSize: 11, color: "var(--dim)",
                fontFamily: "var(--fb)", textAlign: "center",
              }}>
                會帶入你選的心情、難度、距離設定
              </p>
            )}
          </>
        )}

        {done && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", maxWidth: 400 }}>
            {/* 🎲 任務卡 — 抽店時若 enableTasks ON 會抽一張，顯示在主要動作之前 */}
            {currentTask && (() => {
              const cat = TASK_CATEGORIES[currentTask.cat] || { label: "挑戰", emoji: "🎲" };
              return (
                <div style={{
                  width: "100%",
                  background: taskCompleted
                    ? "linear-gradient(145deg,rgba(61,139,94,.15),rgba(61,139,94,.06))"
                    : "linear-gradient(145deg,rgba(192,132,252,.18),rgba(139,92,246,.08))",
                  border: taskCompleted ? "1.5px solid var(--accent3)" : "1.5px solid #c084fc",
                  borderRadius: 14, padding: "12px 14px",
                  animation: "popIn .4s cubic-bezier(.17,.67,.21,1.25) .3s both",
                  position: "relative",
                }}>
                  {/* 完成時的小煙火 — 紫色小點從中心爆出 */}
                  {taskCelebrate && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span key={i} style={{
                          position: "absolute", left: "50%", top: "50%",
                          width: 5 + Math.random() * 4, height: 5 + Math.random() * 4,
                          borderRadius: "50%",
                          background: ["#c084fc", "#9b6cf5", "#86efac", "#fde68a", "#fff"][Math.floor(Math.random() * 5)],
                          "--angle": `${(360 / 14) * i}deg`,
                          animation: "taskBurst .9s cubic-bezier(.2,.7,.3,1.1) forwards",
                          animationDelay: `${i * 0.02}s`,
                        }} />
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: taskCompleted ? "var(--accent3)" : "#9b6cf5", letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {cat.emoji} {taskCompleted ? "已完成挑戰" : "今日挑戰"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--dim)", marginLeft: "auto" }}>{cat.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)", lineHeight: 1.5, textDecoration: taskCompleted ? "line-through" : "none", opacity: taskCompleted ? 0.7 : 1 }}>
                    {currentTask.text}
                  </div>
                  {!taskCompleted ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button
                        onClick={() => {
                          setTaskCompleted(true);
                          setTaskCelebrate(true);
                          if (navigator.vibrate) navigator.vibrate([30, 40, 50]);
                          setTimeout(() => setTaskCelebrate(false), 1100);
                        }}
                        style={{
                          flex: 1, padding: "6px 10px", borderRadius: 10, border: "1px solid var(--accent3)",
                          background: "rgba(61,139,94,.1)", color: "var(--accent3)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >✓ 完成挑戰</button>
                      <button
                        onClick={() => setCurrentTask(pickRandomTask([currentTask.id]))}
                        style={{
                          padding: "6px 12px", borderRadius: 10, border: "1px solid var(--sf2)",
                          background: "transparent", color: "var(--dim)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                        }}
                        title="不喜歡這張，換一張任務"
                      >🎲</button>
                    </div>
                  ) : (
                    /* 已完成 — 提示下一步「按下方『我去吃了』一起記下」*/
                    <div style={{
                      marginTop: 10, padding: "8px 10px", borderRadius: 10,
                      background: "rgba(61,139,94,.06)", border: "1px dashed rgba(61,139,94,.3)",
                      fontSize: 11, color: "var(--accent3)", textAlign: "center", fontWeight: 600,
                    }}>
                      ↓ 順手按下方「我去吃了」一起記下這餐
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 主要動作三顆按鈕 */}
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button
                onClick={handleAte}
                style={{
                  flex: 1.4, padding: "11px 8px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg,var(--accent3),#2D6B48)",
                  color: "#0f2a1f", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >✓ 我去吃了</button>
              <button
                onClick={handleTempReject}
                style={{
                  flex: 1, padding: "11px 8px", borderRadius: 14, border: "1.5px solid var(--sf2)",
                  background: "var(--sf)", color: "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
                title={`30 天內不再出現`}
              >✗ 不要這間</button>
              <button
                onClick={handlePermReject}
                style={{
                  flex: 1, padding: "11px 8px", borderRadius: 14, border: "1.5px solid rgba(209,76,63,.3)",
                  background: "rgba(209,76,63,.08)", color: "var(--accent2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
                title="永久黑名單"
              ><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Prohibit size={13} weight="bold" /> 永遠不要</span></button>
            </div>
            {/* 次要：再轉一次 / 換群組決定 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                onClick={spin}
                style={{
                  padding: "6px 16px", borderRadius: 40, border: "1px solid var(--sf2)",
                  background: "transparent", color: "var(--dim)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              ><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowsClockwise size={13} weight="bold" /> 再轉一次</span></button>
              <button
                onClick={() => setShowGroup(true)}
                style={{
                  padding: "6px 16px", borderRadius: 40, border: "1px solid var(--accent)",
                  background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              ><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><UsersThree size={13} weight="duotone" /> 換群組決定</span></button>
            </div>
          </div>
        )}

        {/* 0 結果時顯示是哪些 filter 擋掉的 + 一鍵放寬 */}
        {!filtered.length && list.length > 0 && !busy && (
          <div style={{
            marginTop: 16, padding: "14px 16px", borderRadius: 14,
            background: "rgba(232,97,44,.08)", border: "1px solid rgba(232,97,44,.3)",
            color: "var(--tx)", fontSize: 13, maxWidth: 400, width: "100%",
          }}>
            <div style={{ textAlign: "center", marginBottom: 10, color: "var(--accent)" }}>
              過濾完一間都不剩
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10 }}>
              {pipeline.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>{s.name}</span>
                  <span style={{ color: s.removed > 0 ? "var(--accent2)" : "var(--dim)" }}>
                    {s.removed > 0 ? `−${s.removed}` : "—"}　剩 {s.remaining}
                  </span>
                </div>
              ))}
            </div>
            {/* 一鍵放寬按鈕（從擋最多家的開始建議）*/}
            {(() => {
              const releasable = pipeline.filter(s => s.action && s.removed > 0)
                .sort((a, b) => b.removed - a.removed);
              if (!releasable.length) {
                return (
                  <div style={{ fontSize: 11, color: "var(--dim)", textAlign: "center", opacity: .7 }}>
                    試試拉大搜尋範圍，或到黑名單管理解除一些
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {releasable.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (s.action.type === "togglePref") updatePrefs({ [s.action.key]: false });
                        else if (s.action.type === "setDifficulty") updatePrefs({ difficulty: s.action.key });
                        else if (s.action.type === "setMood") {
                          updatePrefs({ mood: s.action.key });
                          if (loc) search(loc.lat, loc.lng, getMood(s.action.key).types);
                        }
                        resetPick();
                      }}
                      style={{
                        padding: "8px 12px", borderRadius: 10,
                        border: "1px solid var(--accent)", background: "rgba(232,97,44,.1)",
                        color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    ><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LockSimpleOpen size={14} weight="duotone" /> {s.action.label}（會多 {s.removed} 家）</span></button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </section>


      {/* Moods（心情濾鏡）— 3D 黏土插圖卡 */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 14 }}>
        <div style={{
          fontSize: 11, color: "var(--dim)", marginBottom: 8,
          fontFamily: "var(--fb)", fontWeight: 500, letterSpacing: 0.5,
          textTransform: "uppercase",
        }}>
          <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--fd)", fontSize: 13, fontStyle: "italic", marginRight: 6, letterSpacing: 0 }}>01</span>
          · 今天的心情
        </div>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
          {MOODS.map(m => {
            const on = prefs.mood === m.id;
            return (
              <button
                key={m.id}
                onClick={() => changeMood(m.id)}
                disabled={busy}
                title={m.desc}
                style={{
                  flex: "0 0 auto",
                  width: 64, padding: "6px 4px 8px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  borderRadius: 16,
                  border: on ? "2px solid var(--accent)" : "1.5px solid transparent",
                  background: on ? "#FFF7EF" : "var(--sf)",
                  color: on ? "var(--accent)" : "var(--tx)",
                  fontFamily: "var(--fb)", fontWeight: on ? 600 : 500, fontSize: 11,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? .5 : 1, transition: "all .2s cubic-bezier(.17,.67,.21,1.25)",
                  // 黏土感：選中時 pop 起來 + 多層厚陰影 + inner highlight
                  transform: on ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: on
                    ? "0 10px 20px -4px rgba(232,97,44,.35), 0 3px 6px rgba(232,97,44,.15), inset 0 1px 0 rgba(255,255,255,.7)"
                    : "0 2px 4px rgba(0,0,0,.04), 0 1px 0 var(--border), inset 0 1px 0 rgba(255,255,255,.4)",
                }}>
                <img
                  src={m.icon}
                  alt=""
                  style={{ width: 44, height: 44, objectFit: "contain", filter: on ? "none" : "saturate(0.55) brightness(0.97)" }}
                  draggable={false}
                />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Difficulty(驚喜程度) + 排除連鎖 toggle 同一行 */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8,
        }}>
          <span style={{
            fontSize: 11, color: "var(--dim)",
            fontFamily: "var(--fb)", fontWeight: 500, letterSpacing: 0.5,
            textTransform: "uppercase",
          }}>
            <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--fd)", fontSize: 13, fontStyle: "italic", marginRight: 6, letterSpacing: 0 }}>02</span>
            · 驚喜程度
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {(() => {
              const onlyOpen = prefs.onlyOpen ?? true;
              return (
                <button
                  onClick={() => { updatePrefs({ onlyOpen: !onlyOpen }); resetPick(); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 20,
                    border: onlyOpen ? "1px solid var(--accent3)" : "1px solid var(--sf2)",
                    background: onlyOpen ? "rgba(61,139,94,.1)" : "transparent",
                    color: onlyOpen ? "var(--accent3)" : "var(--dim)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .2s",
                  }}
                >
                  {onlyOpen ? "✓" : "○"} 營業中
                </button>
              );
            })()}
            <button
              onClick={() => { updatePrefs({ excludeChains: !prefs.excludeChains }); resetPick(); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 20,
                border: prefs.excludeChains ? "1px solid var(--accent3)" : "1px solid var(--sf2)",
                background: prefs.excludeChains ? "rgba(61,139,94,.1)" : "transparent",
                color: prefs.excludeChains ? "var(--accent3)" : "var(--dim)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .2s",
              }}
            >
              {prefs.excludeChains ? "✓" : "○"} 排除連鎖
            </button>
          </div>
        </div>
        <div style={{
          display: "flex", gap: 0,
          background: "var(--sf)", padding: 4, borderRadius: 14,
          border: "1px solid var(--border)",
        }}>
          {DIFFICULTIES.map(d => {
            const on = prefs.difficulty === d.id;
            const isHell = d.id === "hell";
            return (
              <button
                key={d.id}
                onClick={() => { updatePrefs({ difficulty: d.id }); resetPick(); }}
                title={d.desc}
                style={{
                  flex: 1, padding: "10px 6px", borderRadius: 10,
                  border: "none",
                  background: on
                    ? (isHell ? "var(--accent2)" : "var(--accent)")
                    : "transparent",
                  color: on ? "#FFFFFF" : "var(--text-muted, var(--dim))",
                  fontFamily: "var(--fb)", fontWeight: on ? 600 : 500, fontSize: 12,
                  cursor: "pointer", transition: "all .15s",
                  boxShadow: on
                    ? (isHell ? "0 2px 8px rgba(209,76,63,.3)" : "0 2px 8px rgba(232,97,44,.3)")
                    : "none",
                }}>
                {d.label}
              </button>
            );
          })}
        </div>
      </section>


      {/* Distance */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{
            fontSize: 11, color: "var(--dim)",
            fontFamily: "var(--fb)", fontWeight: 500, letterSpacing: 0.5,
            textTransform: "uppercase",
          }}>
            <span style={{ color: "var(--accent)", fontWeight: 700, fontFamily: "var(--fd)", fontSize: 13, fontStyle: "italic", marginRight: 6, letterSpacing: 0 }}>03</span>
            · 顯示範圍
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--fd)" }}>{distLabel}</span>
        </div>
        <input type="range" min={200} max={2000} step={100} value={radius}
          /* F3: 拖動只改數值（避免已抽中時手滑碰到 slider 把 pick 清掉），放開才 resetPick */
          onChange={e => setRadius(+e.target.value)}
          onMouseUp={() => { if (pick) resetPick(); }}
          onTouchEnd={() => { if (pick) resetPick(); }}
          onKeyUp={() => { if (pick) resetPick(); }}
          style={{ width: "100%", accentColor: "var(--accent)", height: 6, borderRadius: 3, background: "var(--sf2)", cursor: "pointer" }}
        />
      </section>

      {/* Restaurant List */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px" }}>
        <h3 style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 16, color: "var(--dim)", marginBottom: 12 }}>附近餐廳 {busy ? "" : `(${filtered.length})`}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* F1: 搜尋中顯示 5 張灰底 skeleton 卡片，比單一 spinner 有「快好了」的感覺 */}
          {busy && Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${i}`} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "var(--sf)", borderRadius: 14, padding: "12px 14px",
              animation: `skeletonPulse 1.4s ease-in-out ${i * 0.1}s infinite`,
            }}>
              <div style={{ width: 52, height: 52, background: "var(--sf2)", borderRadius: 12, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 14, background: "var(--sf2)", borderRadius: 4, width: `${60 + (i % 3) * 10}%` }} />
                <div style={{ height: 10, background: "var(--sf2)", borderRadius: 4, width: "40%" }} />
                <div style={{ height: 10, background: "var(--sf2)", borderRadius: 4, width: "30%" }} />
              </div>
            </div>
          ))}
          {!busy && !filtered.length && <div style={{ textAlign: "center", padding: 32, color: "var(--dim)", fontSize: 14, background: "var(--sf)", borderRadius: "var(--r)" }}>沒有符合條件的餐廳</div>}
          {sortedFiltered.map((r, i) => {
            const isPicked = pick?.id === r.id && done;
            const isClosed = r.openNow === false;
            const baseBg = isPicked ? "rgba(232,97,44,.1)" : "var(--sf)";
            const hoverBg = isPicked ? "rgba(232,97,44,.18)" : "var(--sf2)";
            return (
              <a
                key={r.id}
                href={gmapUrl(r.name, r.lat, r.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="resto-row"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: baseBg,
                  borderRadius: 16, padding: "13px 14px",
                  border: isPicked ? "1.5px solid var(--accent)" : "1px solid rgba(0,0,0,.04)",
                  animation: `fadeUp .35s ease ${i * .03}s both`,
                  textDecoration: "none", color: "inherit", cursor: "pointer",
                  // 黏土感：多層柔陰影 + inner highlight 撐起層次
                  boxShadow: isPicked
                    ? "0 8px 20px -6px rgba(232,97,44,.25), 0 2px 4px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.6)"
                    : "0 4px 10px -2px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.03), inset 0 1px 0 rgba(255,255,255,.5)",
                  opacity: isClosed ? 0.5 : 1,
                  filter: isClosed ? "grayscale(0.7)" : "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = baseBg; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "scale(.99)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {/* 列表不載餐廳照片 — Photo API 月免費上限只有 1000，省給抽中卡片用 */}
                <div style={{ width: 52, height: 52, background: "var(--sf2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FoodIcon type={r.img} size={26} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <RarityBadge rarity={getRarity(r)} />
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{r.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Stars rating={r.rating} />
                    {r.reviews > 0 && <span style={{ color: "var(--dim)", fontSize: 10 }}>({r.reviews})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "var(--dim)" }}>
                    <span>{r.dist}m</span><span>{r.price}</span><span>{r.openTxt}</span>
                  </div>
                </div>
                {isJapan(loc) && (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(tabelogUrl(r.name), "_blank", "noopener,noreferrer");
                    }}
                    style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(232,73,27,.12)", color: "var(--tab)", textAlign: "center", cursor: "pointer", flexShrink: 0 }}
                  >食べログ</span>
                )}
                {/* R4: 列表 row 加「推給朋友」按鈕 — 紫色 icon-only 省空間 */}
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRecommendingPlace(r);
                  }}
                  title="推薦給朋友"
                  style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(192,132,252,.1)", color: "#9b6cf5", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center" }}
                ><UsersThree size={14} weight="duotone" /></span>
                <span style={{ color: "var(--dim)", fontSize: 14, flexShrink: 0, opacity: .5 }}>›</span>
              </a>
            );
          })}
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "32px 16px 0", fontSize: 11, color: "var(--dim)", position: "relative", zIndex: 1, opacity: .5 }}>
        Powered by Google Places API・食べログ連結為站外搜尋<br />全球適用・在日本可搭配食べログ查看詳細評分
      </footer>

      {/* Onboarding — 第一次進來顯示 */}
      {showOnboarding && (
        <div
          onClick={dismissOnboarding}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(26,23,20,.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, animation: "fadeIn .3s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 360, width: "100%",
              background: "var(--bg)", borderRadius: 20, padding: "24px 22px",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 60px rgba(0,0,0,.18)",
              animation: "popIn .4s cubic-bezier(.17,.67,.21,1.25)",
            }}
          >
            <h2 style={{
              fontFamily: "var(--fd)", fontSize: 22, fontWeight: 700,
              color: "var(--accent)", margin: "0 0 12px", textAlign: "center",
            }}>
              歡迎！
            </h2>
            <div style={{ fontSize: 14, color: "var(--tx)", lineHeight: 1.65, margin: "0 0 18px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>1.</span>
                <span>選一個<b>心情</b>跟<b>難度</b>，調好<b>距離</b></span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>2.</span>
                <span>按下大顆按鈕，幫你<b>隨機抽一家</b></span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>3.</span>
                <span>想揪人一起？按<b>「跟朋友一起決定」</b>直接傳連結給他們投票</span>
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: 30,
                border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent2))",
                color: "#fff", fontFamily: "var(--fb)", fontSize: 14, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              開始
            </button>
          </div>
        </div>
      )}

      {/* ─── Modals（lazy load — Suspense fallback 用 null，因為打開瞬間 chunk 已 fetch 過就直接顯示）─── */}
      <Suspense fallback={null}>
        {ratingFor && (
          <RatingModal
            pick={ratingFor}
            onClose={() => setRatingFor(null)}
            onSubmit={handleRatingSubmit}
          />
        )}
        {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
        {showBlacklist && <BlacklistModal onClose={() => { setShowBlacklist(false); setStorageVer(v => v + 1); }} />}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onChange={(next) => setLocalPrefs(next)}
            onOpenHistory={() => setShowHistory(true)}
            onOpenBlacklist={() => setShowBlacklist(true)}
            onOpenFriends={() => setShowFriends(true)}
            friendsBadge={pendingRecs.length + ackToasts.length}
          />
        )}
        {showGroup && (
          <GroupModal
            candidates={filtered.slice(0, 12)}
            meta={{ mood: prefs.mood, radius, loc }}
            initialCode={inviteCode}
            onClose={() => { setShowGroup(false); setInviteCode(null); }}
            onResult={(place) => {
              setPick(place);
              setPickRarity(getRarity(place));
              setDone(true);
            }}
          />
        )}
        {showFriends && <FriendsModal onClose={() => setShowFriends(false)} />}
        {recommendingPlace && (
          <RecommendModal
            place={recommendingPlace}
            onClose={() => setRecommendingPlace(null)}
            onSent={() => { /* 送出成功後可以加 toast */ }}
          />
        )}
      </Suspense>

      <style>{`
        @keyframes wobble{0%,100%{transform:rotate(-6deg) scale(1)}50%{transform:rotate(6deg) scale(1.05)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes popIn{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes fadeUp{0%{transform:translateY(12px);opacity:0}100%{transform:translateY(0);opacity:1}}
        @keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:.9}100%{transform:translateY(180px) rotate(720deg);opacity:0}}
        @keyframes tick{0%{transform:scale(.95)}100%{transform:scale(1)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
        @keyframes skeletonPulse{0%,100%{opacity:.55}50%{opacity:.85}}
        /* 任務完成小煙火 — 每個粒子從中心朝外飛、漸消失 */
        @keyframes taskBurst{
          0%{transform:translate(-50%,-50%) rotate(var(--angle,0deg)) translateX(0);opacity:1}
          100%{transform:translate(-50%,-50%) rotate(var(--angle,0deg)) translateX(80px);opacity:0}
        }
        /* 主 CTA 黏土感 push effect — 按下時整顆下沉、厚度收回 */
        .chunky-cta:not(:disabled):active{transform:translateY(4px)!important;box-shadow:0 2px 0 #C04E1E,0 4px 10px rgba(232,97,44,.25),inset 0 1px 0 rgba(255,255,255,.3)!important}
        .chunky-cta:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.04)}
        /* 餐廳 row hover lift */
        .resto-row{transition:transform .18s cubic-bezier(.17,.67,.21,1.25),box-shadow .18s ease,background .15s ease!important}
        .resto-row:hover{transform:translateY(-3px)!important;box-shadow:0 14px 28px -10px rgba(0,0,0,.16),0 6px 12px rgba(0,0,0,.06)!important}
        @keyframes ssrGlow{0%,100%{box-shadow:0 0 24px rgba(255,213,107,.45),0 0 40px rgba(255,126,95,.18)}50%{box-shadow:0 0 44px rgba(255,213,107,.7),0 0 80px rgba(255,126,95,.35)}}
        @keyframes srGlow{0%,100%{box-shadow:0 0 18px rgba(192,132,252,.3)}50%{box-shadow:0 0 32px rgba(192,132,252,.55)}}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--accent);border:3px solid var(--bg);box-shadow:0 0 8px rgba(232,97,44,.4);cursor:pointer}
        *::-webkit-scrollbar{height:0;width:0}
      `}</style>
    </div>
  );
}
