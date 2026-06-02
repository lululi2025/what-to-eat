// ─── 稀有度徽章（無 emoji，純文字 + 漸層底）───
// 從 Modals.jsx 拆出，讓主畫面不必載入 modal bundle 也能用
import { RARITY_META } from "./rarity.js";

export function RarityBadge({ rarity, size = "sm" }) {
  const meta = RARITY_META[rarity];
  if (!meta) return null;
  const isLg = size === "lg";
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: isLg ? 6 : 4,
      padding: isLg ? "5px 12px" : "2px 8px",
      borderRadius: 8,
      background: meta.bgGrad, color: meta.textOnBg,
      fontSize: isLg ? 13 : 10, fontWeight: 700,
      fontFamily: "var(--fd)", letterSpacing: isLg ? 1.5 : 0.8,
      boxShadow: isLg && rarity === "SSR" ? meta.glow : "none",
      lineHeight: 1,
    }}>
      <span>{meta.label}</span>
      {isLg && <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 500, fontFamily: "var(--fb)", letterSpacing: 0 }}>· {meta.desc}</span>}
    </span>
  );
}
