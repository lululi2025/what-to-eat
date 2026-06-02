// ─── 店家稀有度系統 ───
// 規則完全是憑感覺定的初始值，實際使用後可以再調

export const RARITIES = ["SSR", "SR", "R", "N"];

export const RARITY_META = {
  SSR: {
    label: "神店",
    color: "#ffd56b",
    bgGrad: "linear-gradient(135deg, #ffd56b 0%, #ff7e5f 100%)",
    textOnBg: "#3a2410",
    glow: "0 0 32px rgba(255, 213, 107, 0.55)",
    emoji: "✨",
    desc: "高評分 + 高人氣 + 很近",
  },
  SR: {
    label: "好店",
    color: "#c084fc",
    bgGrad: "linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)",
    textOnBg: "#1f0f3a",
    glow: "0 0 18px rgba(192, 132, 252, 0.4)",
    emoji: "💎",
    desc: "評分高、評論多",
  },
  R: {
    label: "中等",
    color: "#60a5fa",
    bgGrad: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
    textOnBg: "#0c1b3a",
    glow: "none",
    emoji: "⭐",
    desc: "中規中矩",
  },
  N: {
    label: "一般",
    color: "#9ca3af",
    bgGrad: "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)",
    textOnBg: "#1a1a1a",
    glow: "none",
    emoji: "🍴",
    desc: "少人評論",
  },
};

// ─── 判定 ───
export function getRarity(r) {
  const rating = r?.rating || 0;
  const reviews = r?.reviews || 0;
  const dist = r?.dist ?? 9999;

  if (rating >= 4.5 && reviews >= 500 && dist <= 800) return "SSR";
  if (rating >= 4.2 && reviews >= 200) return "SR";
  if (rating >= 3.8 && reviews >= 50) return "R";
  return "N";
}

// ─── 難度（決定哪些稀有度進池）───
export const DIFFICULTIES = [
  { id: "easy",   label: "安全牌",   desc: "只抽高評分的店",          allowed: ["SSR", "SR"] },
  { id: "normal", label: "普通",     desc: "全部都有可能",            allowed: ["SSR", "SR", "R", "N"] },
  { id: "hard",   label: "挑戰",     desc: "只抽普通跟平凡的店",      allowed: ["R", "N"] },
  { id: "hell",   label: "黑暗料理", desc: "強制最遠、評分最低的店",  allowed: ["N"], extreme: true },
];

export function getDifficulty(id) {
  return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];
}

export function filterByDifficulty(list, difficultyId) {
  const d = getDifficulty(difficultyId);
  const allowed = new Set(d.allowed);
  let pool = list.filter(r => allowed.has(getRarity(r)));
  // 地獄模式：強制最遠 + 最低分優先（只留 pool 中後 30%）
  if (d.extreme && pool.length > 3) {
    pool.sort((a, b) => (b.dist - a.dist) + (a.rating - b.rating) * 50);
    pool = pool.slice(0, Math.max(3, Math.floor(pool.length * 0.3)));
  }
  return pool;
}
