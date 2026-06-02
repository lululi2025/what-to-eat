import { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { getRarity, RARITY_META } from "./rarity.js";
import { RarityBadge } from "./Modals.jsx";
import { FoodIcon } from "./FoodIcon.jsx";
import { Sparkle, ArrowsClockwise } from "@phosphor-icons/react";

// ─── 滑卡常數 ───
const SWIPE_THRESHOLD = 100;          // 拖超過這個距離 = 觸發
const SWIPE_VELOCITY_THRESHOLD = 500; // 或速度夠快也算
const CARD_STACK_DEPTH = 3;           // 同時顯示幾張（上面 1 + 後面 2 露出來）

// ─── 單張可拖曳的卡 ───
function SwipeCard({ candidate, onSwipe, isTop, stackIndex, wasVetoed }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18]);
  const noOverlay = useTransform(x, [-150, -30], [1, 0]);
  const okOverlay = useTransform(x, [30, 150], [0, 1]);

  const rarity = getRarity(candidate);
  const rMeta = RARITY_META[rarity];

  // 後面的卡縮小、往下偏移、變暗 — 製造堆疊感
  const scale = 1 - stackIndex * 0.04;
  const yOffset = stackIndex * 8;
  const stackOpacity = 1 - stackIndex * 0.15;

  const handleDragEnd = (_, info) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if (dx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY_THRESHOLD) onSwipe("veto");
    else if (dx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY_THRESHOLD) onSwipe("pass");
  };

  return (
    <motion.div
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{ scale, y: yOffset, opacity: stackOpacity }}
      exit={{
        x: x.get() < 0 ? -500 : 500,
        opacity: 0,
        transition: { duration: 0.3 },
      }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        position: "absolute",
        inset: 0,
        zIndex: 10 - stackIndex,
        cursor: isTop ? "grab" : "default",
        userSelect: "none",
      }}
      whileTap={isTop ? { cursor: "grabbing" } : {}}
    >
      <div style={{
        width: "100%", height: "100%",
        background: "var(--sf)",
        borderRadius: 18,
        border: `2px solid ${rMeta.color}30`,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: isTop ? "0 12px 32px rgba(0,0,0,.4)" : "0 4px 12px rgba(0,0,0,.2)",
      }}>
        {/* 上方圖片區（如果有 photo 用照片，沒有用 emoji + 漸層）*/}
        <div style={{
          flex: "0 0 55%",
          background: `linear-gradient(135deg, ${rMeta.color}33, ${rMeta.color}11)`,
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {candidate.photo && (
            <img
              src={`/api/photo?ref=${encodeURIComponent(candidate.photo)}&w=600`}
              alt={candidate.name}
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          {/* emoji fallback — 永遠在底層，photo 有的話疊在上面蓋住它；photo 載失敗就露出來 */}
          <div style={{ color: rMeta.color, opacity: 0.85, position: "relative", zIndex: 0 }}>
            <FoodIcon type={candidate.img || "default"} size={96} />
          </div>
          {/* 稀有度徽章浮在左上 */}
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <RarityBadge rarity={rarity} size="lg" />
          </div>
          {/* 上一輪 NO 過的提示 */}
          {wasVetoed && (
            <div style={{
              position: "absolute", top: 12, right: 12,
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(209,76,63,.85)", color: "#fff",
              fontSize: 11, fontWeight: 700, fontFamily: "var(--fd)",
              letterSpacing: .5,
            }}>上次 ✗ NO</div>
          )}
        </div>

        {/* 下方資訊區 */}
        <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h3 style={{
            fontFamily: "var(--fd)", fontWeight: 700, fontSize: 20,
            margin: "0 0 6px", color: "var(--tx)",
          }}>{candidate.name}</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "var(--dim)", flexWrap: "wrap" }}>
            {candidate.rating > 0 && (
              <span style={{ color: "var(--accent)" }}>★ {candidate.rating}
                {candidate.reviews > 0 && <span style={{ color: "var(--dim)", fontSize: 11, marginLeft: 3 }}>({candidate.reviews})</span>}
              </span>
            )}
            <span>{candidate.dist}m</span>
            {candidate.price && <span>{candidate.price}</span>}
          </div>
          {candidate.addr && (
            <p style={{
              fontSize: 11, color: "var(--dim)", margin: "8px 0 0",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{candidate.addr}</p>
          )}
        </div>

        {/* 拖曳時的色塊 overlay */}
        {isTop && (
          <>
            <motion.div
              style={{
                position: "absolute", inset: 0, opacity: noOverlay,
                background: "rgba(255, 107, 107, .35)",
                borderRadius: 18, pointerEvents: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{
                fontFamily: "var(--fd)", fontWeight: 700, fontSize: 56,
                color: "#fff", letterSpacing: 6,
                border: "5px solid #fff", padding: "8px 28px", borderRadius: 14,
                transform: "rotate(-12deg)",
                textShadow: "0 4px 16px rgba(0,0,0,.4)",
              }}>NO</div>
            </motion.div>
            <motion.div
              style={{
                position: "absolute", inset: 0, opacity: okOverlay,
                background: "rgba(93, 228, 167, .35)",
                borderRadius: 18, pointerEvents: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{
                fontFamily: "var(--fd)", fontWeight: 700, fontSize: 56,
                color: "#fff", letterSpacing: 6,
                border: "5px solid #fff", padding: "8px 22px", borderRadius: 14,
                transform: "rotate(12deg)",
                textShadow: "0 4px 16px rgba(0,0,0,.4)",
              }}>OK</div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── 整個滑卡組件 ───
export function SwipeDeck({ candidates, vetoedIds, onVeto, onUnveto, onComplete }) {
  // 從第一張未處理過的開始（會跳過已 veto 的 — 因為使用者已經做過決定）
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]); // [{ index, action }] 用於 undo

  const remaining = candidates.length - index;
  const isDone = index >= candidates.length;

  // 滑完時自動標記完成（避免在 render 裡用 setTimeout 觸發副作用）
  useEffect(() => {
    if (isDone) onComplete?.(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

  const handleSwipe = (direction) => {
    const candidate = candidates[index];
    if (!candidate) return;
    const wasVetoed = vetoedIds.has(candidate.id);
    // 只在「state 改變」時打 DB；保持冪等
    if (direction === "veto" && !wasVetoed) onVeto(candidate.id);
    else if (direction === "pass" && wasVetoed) onUnveto(candidate.id);
    setHistory(h => [...h, { candidateId: candidate.id, action: direction, wasVetoed, index }]);
    setIndex(i => i + 1);
  };

  const handleUndo = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    // 還原成上一張卡時的 DB state
    if (last.action === "veto" && !last.wasVetoed) onUnveto(last.candidateId);
    else if (last.action === "pass" && last.wasVetoed) onVeto(last.candidateId);
    setHistory(h => h.slice(0, -1));
    setIndex(last.index);
  };

  // 滑完了 — 顯示完成畫面（自動 markDone 由上面的 useEffect 處理）
  if (isDone) {
    const vetoCount = history.filter(h => h.action === "veto").length;
    const passCount = history.filter(h => h.action === "pass").length;
    return (
      <div style={{
        textAlign: "center", padding: "32px 16px",
        background: "var(--sf)", borderRadius: 18, marginBottom: 14,
      }}>
        <div style={{ marginBottom: 14, color: "var(--accent3)" }}>
          <Sparkle size={56} weight="duotone" />
        </div>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--fd)", fontWeight: 700, fontSize: 20 }}>
          滑完了！
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--dim)" }}>
          NO {vetoCount} 家 · OK {passCount} 家
        </p>
        {history.length > 0 && (
          <button
            onClick={handleUndo}
            style={{
              padding: "8px 18px", borderRadius: 20,
              background: "transparent", border: "1px solid var(--sf2)",
              color: "var(--dim)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >↩️ 回到上一張</button>
        )}
      </div>
    );
  }

  // 取出當前 + 後面 2 張用於堆疊
  const visibleCards = [];
  for (let i = 0; i < CARD_STACK_DEPTH && index + i < candidates.length; i++) {
    visibleCards.push({ c: candidates[index + i], stackIndex: i });
  }

  return (
    <div>
      {/* 進度條 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 11, color: "var(--dim)", marginBottom: 6,
        }}>
          <span>{index + 1} / {candidates.length}</span>
          <span>還剩 {remaining} 張</span>
        </div>
        <div style={{
          height: 4, background: "var(--sf2)", borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${(index / candidates.length) * 100}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent2))",
            transition: "width .3s",
          }} />
        </div>
      </div>

      {/* 卡片堆疊區 */}
      <div style={{
        position: "relative", width: "100%", height: 380,
        marginBottom: 14,
      }}>
        <AnimatePresence>
          {visibleCards.slice().reverse().map(({ c, stackIndex }) => (
            <SwipeCard
              key={c.id}
              candidate={c}
              isTop={stackIndex === 0}
              stackIndex={stackIndex}
              wasVetoed={vetoedIds.has(c.id)}
              onSwipe={stackIndex === 0 ? handleSwipe : () => {}}
            />
          )).reverse()}
        </AnimatePresence>
      </div>

      {/* 操作按鈕（不會滑的人 / 想精確點的人）*/}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <button
          onClick={() => handleSwipe("veto")}
          style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "none",
            background: "rgba(209,76,63,.15)", color: "var(--accent2)",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            fontFamily: "var(--fd)",
            border: "2px solid rgba(209,76,63,.4)",
          }}
        >✗ NO</button>
        <button
          onClick={() => handleSwipe("pass")}
          style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "none",
            background: "rgba(61,139,94,.15)", color: "var(--accent3)",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            fontFamily: "var(--fd)",
            border: "2px solid rgba(61,139,94,.4)",
          }}
        >OK ✓</button>
      </div>

      {/* Undo */}
      {history.length > 0 && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleUndo}
            style={{
              background: "transparent", border: "none", color: "var(--dim)",
              fontSize: 12, cursor: "pointer", padding: 6,
            }}
          >↩️ 上一張</button>
        </div>
      )}

      {/* 提示 */}
      <p style={{
        fontSize: 11, color: "var(--dim)", textAlign: "center",
        marginTop: 12, opacity: .6,
      }}>
        滑左不要 ← 　 → 滑右可以
      </p>
    </div>
  );
}
