// ─── localStorage 資料層 ───
// 整包資料存在一個 key，方便未來搬到後端
// shape:
// {
//   rejects: {
//     temp: { [placeId]: timestamp },         // 30 天自動過期
//     permanent: { [placeId]: { name, addedAt } }
//   },
//   history: [
//     { id, placeId, name, photo, types, date, rating, note }
//   ]
// }

const KEY = "wte_data";
const TEMP_REJECT_DAYS = 30;
const TEMP_REJECT_MS = TEMP_REJECT_DAYS * 24 * 60 * 60 * 1000;

const PREFS_DEFAULT = {
  excludeChains: false,
  difficulty: "normal",   // 'easy' | 'normal' | 'hard' | 'hell'
  mood: "random",
  sound: false,           // 預設關
};

const empty = () => ({
  rejects: { temp: {}, permanent: {} },
  history: [],
  prefs: { ...PREFS_DEFAULT },
});

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    // 防呆：補齊缺漏欄位
    return {
      rejects: {
        temp: d.rejects?.temp || {},
        permanent: d.rejects?.permanent || {},
      },
      history: Array.isArray(d.history) ? d.history : [],
      prefs: { ...PREFS_DEFAULT, ...(d.prefs || {}) },
    };
  } catch {
    return empty();
  }
}

export function saveData(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

// ─── 清過期的 temp reject ───
// 啟動時呼叫一次即可，回傳清完的整包資料
export function cleanExpiredTempRejects() {
  const data = loadData();
  const now = Date.now();
  const fresh = {};
  let removed = 0;
  for (const [id, ts] of Object.entries(data.rejects.temp)) {
    if (now - ts < TEMP_REJECT_MS) fresh[id] = ts;
    else removed++;
  }
  if (removed > 0) {
    data.rejects.temp = fresh;
    saveData(data);
  }
  return data;
}

// ─── 拒絕清單操作 ───
export function addTempReject(placeId) {
  const data = loadData();
  data.rejects.temp[placeId] = Date.now();
  saveData(data);
}

export function addPermanentReject(placeId, name) {
  const data = loadData();
  data.rejects.permanent[placeId] = { name, addedAt: Date.now() };
  // 永久黑名單同時清掉暫時的（避免重複）
  delete data.rejects.temp[placeId];
  saveData(data);
}

export function removeReject(placeId, type) {
  const data = loadData();
  if (type === "temp" || type === "all") delete data.rejects.temp[placeId];
  if (type === "permanent" || type === "all") delete data.rejects.permanent[placeId];
  saveData(data);
}

export function clearTempRejects() {
  const data = loadData();
  data.rejects.temp = {};
  saveData(data);
}

export function isRejected(placeId, data) {
  const d = data || loadData();
  return !!(d.rejects.temp[placeId] || d.rejects.permanent[placeId]);
}

// ─── 吃過記錄 ───
export function addHistory(record) {
  const data = loadData();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    rating: null,
    note: "",
    ...record,
  };
  data.history.unshift(entry);
  saveData(data);
  return entry;
}

export function updateHistory(id, patch) {
  const data = loadData();
  const idx = data.history.findIndex(h => h.id === id);
  if (idx >= 0) {
    data.history[idx] = { ...data.history[idx], ...patch };
    saveData(data);
  }
}

export function removeHistory(id) {
  const data = loadData();
  data.history = data.history.filter(h => h.id !== id);
  saveData(data);
}

// 給 UI 用的 getter（呼叫端不用自己 load）
export function getHistory() { return loadData().history; }
export function getRejects() { return loadData().rejects; }

// ─── Prefs（使用者偏好設定）───
export function getPrefs() {
  return { ...PREFS_DEFAULT, ...(loadData().prefs || {}) };
}
export function setPrefs(patch) {
  const data = loadData();
  data.prefs = { ...PREFS_DEFAULT, ...(data.prefs || {}), ...patch };
  saveData(data);
  return data.prefs;
}
export function resetAllData() {
  try { localStorage.removeItem(KEY); } catch {}
}

export const _config = { TEMP_REJECT_DAYS };
