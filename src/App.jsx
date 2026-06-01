import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  cleanExpiredTempRejects, isRejected,
  addTempReject, addPermanentReject,
  addHistory, getPrefs, setPrefs,
} from "./storage.js";
import {
  RatingModal, HistoryModal, BlacklistModal,
  SettingsModal, RarityBadge,
} from "./Modals.jsx";
import { GroupModal } from "./GroupModal.jsx";
import { MOODS, getMood, matchesMoodKeywords } from "./moods.js";
import {
  RARITY_META, getRarity,
  DIFFICULTIES, filterByDifficulty,
} from "./rarity.js";
import { isChain } from "./chains.js";
import { playSSR, playSR } from "./sound.js";

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
function emojiFor(types) {
  const t = (types || []).join(" ");
  if (t.includes("cafe") || t.includes("coffee")) return "☕";
  if (t.includes("bakery")) return "🍰";
  if (t.includes("bar")) return "🍺";
  if (t.includes("sushi")) return "🍣";
  if (t.includes("ramen") || t.includes("noodle")) return "🍜";
  if (t.includes("pizza") || t.includes("italian")) return "🍕";
  if (t.includes("burger") || t.includes("hamburger")) return "🍔";
  return "🍴";
}

const iconBtnStyle = {
  width: 38, height: 38, borderRadius: "50%",
  border: "1px solid var(--sf2)", background: "var(--sf)",
  color: "var(--tx)", fontSize: 16, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all .2s",
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
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [pickRarity, setPickRarity] = useState(null);
  const [done, setDone] = useState(false);
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
  const [inviteCode, setInviteCode] = useState(null);  // 從 URL ?r= 拿到的邀請房號
  const [ratingFor, setRatingFor] = useState(null);
  const [pendingAutoSpin, setPendingAutoSpin] = useState(false);

  // 啟動時清過期的暫時黑名單 + 檢查邀請連結
  useEffect(() => {
    cleanExpiredTempRejects();
    setStorageVer(v => v + 1);

    // 邀請連結偵測 ?r=ABC123 → 自動打開群組 modal 並進入加入流程
    const params = new URLSearchParams(window.location.search);
    const r = params.get("r");
    if (r && /^[A-Z0-9]{6}$/i.test(r)) {
      setInviteCode(r.toUpperCase());
      setShowGroup(true);
      // 清掉 URL 上的 ?r=，避免使用者重整又再觸發
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
          openTxt: p.opening_hours ? (p.opening_hours.open_now ? "營業中 ✅" : "休息中 ❌") : "—",
          img: emojiFor(p.types),
          photo: p.photos?.[0]?.photo_reference || null,
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng,
        })));
        bumpRateLimit(); setLeft(remaining());
      } else if (responses.every(d => d.status === "ZERO_RESULTS" || d.status === "OK")) {
        setList([]); setErr("附近找不到餐廳");
      } else {
        const bad = responses.find(d => d.status !== "OK" && d.status !== "ZERO_RESULTS");
        setErr(`API 錯誤：${bad?.status || "UNKNOWN"}`);
      }
    } catch (e) {
      setErr("無法連線 Google Places API");
    } finally { setBusy(false); }
  }, []);

  // ─── Geolocation ───
  const locate = useCallback(() => {
    setLocBusy(true); setErr("");
    if (!navigator.geolocation) {
      setLocBusy(false); setErr("瀏覽器不支援定位");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(c); setLocBusy(false);
        search(c.lat, c.lng, getMood(prefs.mood).types);
      },
      () => { setLocBusy(false); setErr("無法取得定位，請允許權限後重試"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [search, prefs.mood]);

  useEffect(() => { locate(); }, [locate]);

  const changeMood = (id) => {
    updatePrefs({ mood: id });
    setPick(null); setDone(false); setPickRarity(null);
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
      log(`心情：${mood.emoji} ${mood.label}`, aM, cur.length,
        { type: "setMood", key: "random", label: "改成「隨便」（全部都看）" });
    }

    if (prefs.excludeChains) {
      const a2 = cur.length;
      cur = cur.filter(r => !isChain(r.name));
      log("排除連鎖", a2, cur.length, { type: "togglePref", key: "excludeChains", label: "關掉「排除連鎖」" });
    }

    if (prefs.difficulty !== "normal") {
      const a3 = cur.length;
      cur = filterByDifficulty(cur, prefs.difficulty);
      log(`難度：${DIFFICULTIES.find(d => d.id === prefs.difficulty)?.label}`,
        a3, cur.length, { type: "setDifficulty", key: "normal", label: "改回「普通」模式" });
    }

    return { filtered: cur, pipeline: stages };
  }, [list, radius, storageVer, prefs.excludeChains, prefs.difficulty, prefs.mood]);

  // ─── Spin ───
  const spin = useCallback(() => {
    if (!filtered.length || spinning) return;
    setSpinning(true); setDone(false); setPick(null); setPickRarity(null);
    let n = 0;
    const total = 18 + Math.floor(Math.random() * 10);
    const go = () => {
      n++;
      const p = filtered[Math.floor(Math.random() * filtered.length)];
      setPick(p);
      if (n < total) {
        setTimeout(go, 50 + (n / total) * 300 + (n > total - 4 ? (n - total + 4) * 120 : 0));
      } else {
        setSpinning(false); setDone(true);
        const rarity = getRarity(p);
        setPickRarity(rarity);
        // 命中音效（看 pref）
        if (prefs.sound) {
          if (rarity === "SSR") playSSR();
          else if (rarity === "SR") playSR();
        }
      }
    };
    go();
  }, [filtered, spinning, prefs.sound]);

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
    });
    setRatingFor(null);
    // 評分完不重轉，停留在 done 狀態
  };

  const handleTempReject = () => {
    if (!pick) return;
    addTempReject(pick.id);
    setPick(null); setDone(false); setPickRarity(null);
    setStorageVer(v => v + 1);
    setPendingAutoSpin(true);
  };

  const handlePermReject = () => {
    if (!pick) return;
    addPermanentReject(pick.id, pick.name);
    setPick(null); setDone(false); setPickRarity(null);
    setStorageVer(v => v + 1);
    setPendingAutoSpin(true);
  };

  const distLabel = radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius} m`;

  const css = {
    "--bg": "#1a1714", "--sf": "#262220", "--sf2": "#312e2a",
    "--accent": "#f59e42", "--accent2": "#ff6b6b", "--accent3": "#5de4a7",
    "--tx": "#f5f0e8", "--dim": "#9c9488", "--tab": "#e8491b",
    "--fd": "'Fredoka','Noto Sans TC',sans-serif",
    "--fb": "'Noto Sans TC','DM Sans',sans-serif",
    "--r": "18px",
  };

  return (
    <div style={{ ...css, minHeight: "100vh", background: "var(--bg)", color: "var(--tx)", fontFamily: "var(--fb)", padding: "0 0 40px", position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Noto+Sans+TC:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 20% 0%,rgba(245,158,66,.07) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(93,228,167,.05) 0%,transparent 50%)" }} />

      {/* Header */}
      <header style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "36px 16px 12px" }}>
        {/* 右上 icon 入口 */}
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setShowGroup(true)} title="一起決定" aria-label="一起決定" style={{ ...iconBtnStyle, background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "#fff", border: "none" }}>👥</button>
          <button onClick={() => setShowHistory(true)} title="吃過的店" aria-label="吃過的店" style={iconBtnStyle}>📖</button>
          <button onClick={() => setShowBlacklist(true)} title="黑名單管理" aria-label="黑名單管理" style={iconBtnStyle}>⛔</button>
          <button onClick={() => setShowSettings(true)} title="設定" aria-label="設定" style={iconBtnStyle}>⚙️</button>
        </div>
        <div style={{ fontSize: 44, animation: "wobble 2.5s ease-in-out infinite" }}>🎰</div>
        <h1 style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: 32, margin: "8px 0 2px", background: "linear-gradient(135deg,var(--accent),var(--accent2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>今天吃什麼？</h1>
        <p style={{ color: "var(--dim)", fontSize: 13, margin: "4px 0 0" }}>
          {locBusy ? "📡 定位中..." : loc ? `📍 已定位` : "❌ 無法定位"}
        </p>
        <p style={{ color: "var(--dim)", fontSize: 11, margin: "2px 0 0", opacity: .5 }}>今日剩餘搜尋：{left} / {DAILY_LIMIT}</p>
      </header>

      {/* Error */}
      {err && (
        <div style={{ margin: "0 16px 12px", padding: "10px 14px", borderRadius: 12, background: "rgba(255,107,107,.12)", border: "1px solid rgba(255,107,107,.3)", color: "var(--accent2)", fontSize: 13, textAlign: "center" }}>
          ⚠️ {err}
          {!loc && <button onClick={locate} style={{ display: "block", margin: "8px auto 0", padding: "6px 16px", borderRadius: 20, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, cursor: "pointer" }}>🔄 重新定位</button>}
        </div>
      )}

      {/* Loading */}
      {busy && <div style={{ textAlign: "center", padding: 24, color: "var(--dim)" }}><span style={{ fontSize: 28, display: "inline-block", animation: "spin 1s linear infinite" }}>🔍</span><p style={{ margin: "8px 0 0", fontSize: 14 }}>搜尋附近餐廳中...</p></div>}

      {/* Moods（心情濾鏡）*/}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6, opacity: .7 }}>今天的心情</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {MOODS.map(m => {
            const on = prefs.mood === m.id;
            return (
              <button key={m.id} onClick={() => changeMood(m.id)} disabled={busy} title={m.desc} style={{
                flex: "0 0 auto", display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", borderRadius: 40,
                border: on ? "2px solid var(--accent)" : "2px solid transparent",
                background: on ? "rgba(245,158,66,.15)" : "var(--sf)",
                color: on ? "var(--accent)" : "var(--dim)",
                fontFamily: "var(--fb)", fontWeight: 600, fontSize: 13,
                cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                opacity: busy ? .5 : 1, transition: "all .2s",
              }}>
                <span style={{ fontSize: 16 }}>{m.emoji}</span>{m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Difficulty（難度選擇）*/}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6, opacity: .7 }}>難度</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DIFFICULTIES.map(d => {
            const on = prefs.difficulty === d.id;
            const isHell = d.id === "hell";
            return (
              <button
                key={d.id}
                onClick={() => { updatePrefs({ difficulty: d.id }); setPick(null); setDone(false); setPickRarity(null); }}
                title={d.desc}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: 10,
                  border: on
                    ? (isHell ? "2px solid var(--accent2)" : "2px solid var(--accent)")
                    : "2px solid transparent",
                  background: on
                    ? (isHell ? "rgba(255,107,107,.15)" : "rgba(245,158,66,.15)")
                    : "var(--sf)",
                  color: on
                    ? (isHell ? "var(--accent2)" : "var(--accent)")
                    : "var(--dim)",
                  fontFamily: "var(--fb)", fontWeight: 600, fontSize: 12,
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  transition: "all .2s",
                }}>
                <span style={{ fontSize: 16 }}>{d.emoji}</span>
                {d.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 拒連鎖 toggle */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 14 }}>
        <button
          onClick={() => { updatePrefs({ excludeChains: !prefs.excludeChains }); setPick(null); setDone(false); setPickRarity(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 40,
            border: prefs.excludeChains ? "1.5px solid var(--accent3)" : "1.5px solid var(--sf2)",
            background: prefs.excludeChains ? "rgba(93,228,167,.1)" : "var(--sf)",
            color: prefs.excludeChains ? "var(--accent3)" : "var(--dim)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .2s",
          }}
        >
          {prefs.excludeChains ? "✓" : "○"} 排除連鎖店
        </button>
      </section>

      {/* Distance */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: "var(--dim)" }}>顯示範圍</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--fd)" }}>{distLabel}</span>
        </div>
        <input type="range" min={200} max={2000} step={100} value={radius}
          onChange={e => { setRadius(+e.target.value); setPick(null); setDone(false); }}
          style={{ width: "100%", accentColor: "var(--accent)", height: 6, borderRadius: 3, background: "var(--sf2)", cursor: "pointer" }}
        />
      </section>

      {/* Spin Zone */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {(() => {
          const rMeta = done && pickRarity ? RARITY_META[pickRarity] : null;
          const isSSR = pickRarity === "SSR";
          const isSR  = pickRarity === "SR";
          const cardBg = done && rMeta
            ? `linear-gradient(145deg, ${rMeta.color}26, ${rMeta.color}10)`
            : (done ? "linear-gradient(145deg,rgba(245,158,66,.12),rgba(255,107,107,.08))" : "var(--sf)");
          const cardBorder = done && rMeta ? `2px solid ${rMeta.color}` : (done ? "2px solid var(--accent)" : "2px solid var(--sf2)");
          const cardShadow = done && isSSR ? rMeta.glow : (done && isSR ? `0 0 20px ${rMeta.color}40` : (done ? "0 0 40px rgba(245,158,66,.15)" : "none"));
          const confettiCount = isSSR ? 28 : (isSR ? 18 : 12);
          return (
        <div style={{
          width: "100%", maxWidth: 400, minHeight: 200,
          background: cardBg,
          borderRadius: "var(--r)", border: cardBorder,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, transition: "all .4s", boxShadow: cardShadow,
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
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎲</div>
            <p style={{ color: "var(--dim)", fontSize: 14, margin: 0 }}>
              {filtered.length > 0 ? `共 ${filtered.length} 間餐廳，按下面按鈕隨機挑選！` : busy ? "搜尋中..." : "沒有符合條件的餐廳"}
            </p>
          </div>}

          {pick && <div style={{ textAlign: "center", width: "100%", animation: spinning ? "tick .1s" : done ? "popIn .5s cubic-bezier(.17,.67,.21,1.25)" : "none" }}>
            {pick.photo && !spinning ? (
              <div style={{ width: 80, height: 80, borderRadius: 16, overflow: "hidden", margin: "0 auto 10px", boxShadow: "0 4px 16px rgba(0,0,0,.3)" }}>
                <img src={photoSrc(pick.photo, 200)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ fontSize: 52, marginBottom: 8, filter: spinning ? "blur(1px)" : "none" }}>{pick.img}</div>
            )}
            <h2 style={{ fontFamily: "var(--fd)", fontWeight: 700, fontSize: done ? 22 : 20, margin: "0 0 4px", color: done ? "var(--accent)" : "var(--tx)" }}>{pick.name}</h2>
            {done && <div style={{ animation: "fadeUp .4s ease .2s both" }}>
              <Stars rating={pick.rating} />
              {pick.reviews > 0 && <span style={{ color: "var(--dim)", fontSize: 11, marginLeft: 4 }}>({pick.reviews} 則)</span>}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10, fontSize: 13, color: "var(--dim)", flexWrap: "wrap" }}>
                <span>📍 {pick.dist}m</span><span>💰 {pick.price}</span><span>{pick.openTxt}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--dim)", margin: "8px 0 12px" }}>{pick.addr}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <a href={gmapUrl(pick.name, pick.lat, pick.lng)} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(93,228,167,.15)", border: "1px solid var(--accent3)", color: "var(--accent3)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>🗺️ Google Maps</a>
                {isJapan(loc) && <a href={tabelogUrl(pick.name)} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(232,73,27,.15)", border: "1px solid var(--tab)", color: "var(--tab)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>🔍 食べログ</a>}
              </div>
            </div>}
          </div>}
        </div>
          );
        })()}

        <button onClick={spin} disabled={!filtered.length || spinning || busy} style={{
          marginTop: 20, width: 220, height: 56, borderRadius: 60, border: "none",
          background: spinning
            ? "var(--sf2)"
            : prefs.difficulty === "hell"
              ? "linear-gradient(135deg,#7f1d1d,#dc2626)"
              : "linear-gradient(135deg,var(--accent),var(--accent2))",
          color: spinning ? "var(--dim)" : "#fff",
          fontFamily: "var(--fd)", fontWeight: 700, fontSize: 18,
          cursor: !filtered.length || spinning || busy ? "not-allowed" : "pointer",
          boxShadow: spinning ? "none" : (prefs.difficulty === "hell" ? "0 6px 30px rgba(220,38,38,.4)" : "0 6px 30px rgba(245,158,66,.3)"),
          transition: "all .3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transform: spinning ? "scale(.96)" : "scale(1)",
          opacity: !filtered.length || busy ? .4 : 1,
        }}>
          {spinning ? <><span style={{ animation: "spin .6s linear infinite", display: "inline-block" }}>🎰</span> 選擇中...</>
            : prefs.difficulty === "hell" ? <>💀 接受命運</>
            : prefs.difficulty === "hard" ? <>😈 來點刺激</>
            : prefs.difficulty === "easy" ? <>✨ 給我好店</>
            : <>🎲 隨機挑選！</>}
        </button>

        {done && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", maxWidth: 400 }}>
            {/* 主要動作三顆按鈕 */}
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <button
                onClick={handleAte}
                style={{
                  flex: 1.4, padding: "11px 8px", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg,var(--accent3),#3fb88a)",
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
                  flex: 1, padding: "11px 8px", borderRadius: 14, border: "1.5px solid rgba(255,107,107,.3)",
                  background: "rgba(255,107,107,.08)", color: "var(--accent2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
                title="永久黑名單"
              >⛔ 永遠不要</button>
            </div>
            {/* 次要：手動再轉 */}
            <button
              onClick={spin}
              style={{
                padding: "6px 16px", borderRadius: 40, border: "1px solid var(--sf2)",
                background: "transparent", color: "var(--dim)", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}
            >🔄 再轉一次</button>
          </div>
        )}

        {/* 0 結果時顯示是哪些 filter 擋掉的 + 一鍵放寬 */}
        {!filtered.length && list.length > 0 && !busy && (
          <div style={{
            marginTop: 16, padding: "14px 16px", borderRadius: 14,
            background: "rgba(245,158,66,.08)", border: "1px solid rgba(245,158,66,.3)",
            color: "var(--tx)", fontSize: 13, maxWidth: 400, width: "100%",
          }}>
            <div style={{ textAlign: "center", marginBottom: 10, color: "var(--accent)" }}>
              🥲 過濾完一間都不剩
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
                    試試拉大搜尋範圍，或到 ⛔ 黑名單管理解除一些
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
                        setPick(null); setDone(false); setPickRarity(null);
                      }}
                      style={{
                        padding: "8px 12px", borderRadius: 10,
                        border: "1px solid var(--accent)", background: "rgba(245,158,66,.1)",
                        color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >🔓 {s.action.label}（會多 {s.removed} 家）</button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Restaurant List */}
      <section style={{ position: "relative", zIndex: 1, padding: "0 16px" }}>
        <h3 style={{ fontFamily: "var(--fd)", fontWeight: 600, fontSize: 16, color: "var(--dim)", marginBottom: 12 }}>附近餐廳 ({filtered.length})</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!busy && !filtered.length && <div style={{ textAlign: "center", padding: 32, color: "var(--dim)", fontSize: 14, background: "var(--sf)", borderRadius: "var(--r)" }}>沒有符合條件的餐廳 😢</div>}
          {filtered.sort((a, b) => a.dist - b.dist).map((r, i) => {
            const isPicked = pick?.id === r.id && done;
            const baseBg = isPicked ? "rgba(245,158,66,.1)" : "var(--sf)";
            const hoverBg = isPicked ? "rgba(245,158,66,.18)" : "var(--sf2)";
            return (
              <a
                key={r.id}
                href={gmapUrl(r.name, r.lat, r.lng)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: baseBg,
                  borderRadius: 14, padding: "12px 14px",
                  border: isPicked ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                  animation: `fadeUp .35s ease ${i * .03}s both`,
                  textDecoration: "none", color: "inherit", cursor: "pointer",
                  transition: "background .15s ease, transform .1s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = baseBg; }}
                onMouseDown={(e) => { e.currentTarget.style.transform = "scale(.99)"; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {r.photo ? (
                  <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "var(--sf2)" }}>
                    <img src={photoSrc(r.photo)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 28, width: 52, height: 52, background: "var(--sf2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.img}</div>
                )}
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
                <span style={{ color: "var(--dim)", fontSize: 14, flexShrink: 0, opacity: .5 }}>›</span>
              </a>
            );
          })}
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "32px 16px 0", fontSize: 11, color: "var(--dim)", position: "relative", zIndex: 1, opacity: .5 }}>
        Powered by Google Places API・食べログ連結為站外搜尋<br />全球適用・在日本可搭配食べログ查看詳細評分
      </footer>

      {/* ─── Modals ─── */}
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
        />
      )}
      {showGroup && (
        <GroupModal
          candidates={filtered.slice(0, 20)}
          meta={{ mood: prefs.mood, radius, loc }}
          initialCode={inviteCode}
          onClose={() => { setShowGroup(false); setInviteCode(null); }}
          onResult={(place) => {
            // 把群組決定的結果塞進主畫面，沿用既有 done flow
            setPick(place);
            setPickRarity(getRarity(place));
            setDone(true);
          }}
        />
      )}

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
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--accent);border:3px solid var(--bg);box-shadow:0 0 8px rgba(245,158,66,.4);cursor:pointer}
        *::-webkit-scrollbar{height:0;width:0}
      `}</style>
    </div>
  );
}
