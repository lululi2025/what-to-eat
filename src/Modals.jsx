import { useState, useEffect } from "react";
import {
  getHistory, removeHistory, updateHistory,
  getRejects, removeReject, clearTempRejects,
  getPrefs, setPrefs, resetAllData,
  _config,
} from "./storage.js";
import { RARITIES, RARITY_META, getRarity } from "./rarity.js";
import { X, PencilSimple, Trash } from "@phosphor-icons/react";
import { FoodIcon } from "./FoodIcon.jsx";

// ─── 共用：Modal 外殼 ───
function ModalShell({ title, onClose, children }) {
  // ESC 關閉
  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn .2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "85vh",
          background: "var(--bg)", color: "var(--tx)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--sf2)",
          display: "flex", flexDirection: "column",
          animation: "slideUp .25s cubic-bezier(.17,.67,.21,1.1)",
        }}
      >
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--sf2)",
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none",
              background: "var(--sf2)", color: "var(--tx)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="關閉"
          ><X size={16} weight="bold" /></button>
        </header>
        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── 評分 Modal ─── (吃完後跳出)
export function RatingModal({ pick, onSubmit, onClose }) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  if (!pick) return null;

  return (
    <ModalShell title="記錄這次的用餐" onClose={onClose}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ marginBottom: 8, color: "var(--accent)" }}>
          <FoodIcon type={pick.img || "default"} size={40} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{pick.name}</div>
        <div style={{ color: "var(--dim)", fontSize: 12, marginTop: 4 }}>
          {new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 8 }}>給幾顆星？（可跳過）</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setRating(rating === n ? 0 : n)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 32, padding: 4,
                color: n <= rating ? "var(--accent)" : "var(--sf2)",
                transition: "transform .1s",
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(.85)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              aria-label={`${n} 星`}
            >★</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 8 }}>一句話心得（可選）</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="例：拉麵超讚，但等了 30 分鐘"
          maxLength={200}
          rows={3}
          style={{
            width: "100%", padding: 12, borderRadius: 12,
            background: "var(--sf)", border: "1px solid var(--sf2)",
            color: "var(--tx)", fontSize: 14, fontFamily: "var(--fb)",
            resize: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--sf2)",
            background: "transparent", color: "var(--dim)", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >取消</button>
        <button
          onClick={() => onSubmit({ rating: rating || null, note: note.trim() })}
          style={{
            flex: 2, padding: "12px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,var(--accent),var(--accent2))",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >{rating > 0 || note.trim() ? "✓ 儲存" : "✓ 只記錄去過"}</button>
      </div>
    </ModalShell>
  );
}

// ─── 吃過清單 Modal ───
export function HistoryModal({ onClose }) {
  const [items, setItems] = useState(() => getHistory());
  const [editing, setEditing] = useState(null); // 編輯中的 entry

  const refresh = () => setItems(getHistory());

  const handleDelete = (id) => {
    if (!confirm("確定要刪除這筆紀錄嗎？")) return;
    removeHistory(id);
    refresh();
  };

  // 統計 + 稀有度收藏
  const stats = (() => {
    if (!items.length) return null;
    const rated = items.filter(h => h.rating);
    const avg = rated.length
      ? (rated.reduce((s, h) => s + h.rating, 0) / rated.length).toFixed(1)
      : null;
    const uniq = new Set(items.map(h => h.placeId)).size;
    // 用每家「最後一筆」的稀有度算（多次去同店只算一張卡）
    const lastByPlace = {};
    for (const h of items) {
      if (!lastByPlace[h.placeId]) lastByPlace[h.placeId] = h;
    }
    const rarityCount = { SSR: 0, SR: 0, R: 0, N: 0 };
    for (const h of Object.values(lastByPlace)) {
      const r = h.rarity || "N";
      rarityCount[r] = (rarityCount[r] || 0) + 1;
    }
    return { total: items.length, uniq, avg, rarityCount };
  })();

  if (editing) {
    return (
      <RatingModal
        pick={{ name: editing.name, img: editing.img }}
        onClose={() => setEditing(null)}
        onSubmit={({ rating, note }) => {
          updateHistory(editing.id, { rating, note });
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  return (
    <ModalShell title="吃過的店" onClose={onClose}>
      {stats && (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8,
            marginBottom: 12, padding: "12px 0",
            borderBottom: "1px solid var(--sf2)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--fd)" }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>總次數</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent3)", fontFamily: "var(--fd)" }}>{stats.uniq}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>不同店家</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent2)", fontFamily: "var(--fd)" }}>{stats.avg || "—"}</div>
              <div style={{ fontSize: 11, color: "var(--dim)" }}>平均星等</div>
            </div>
          </div>

          {/* 稀有度卡冊 */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6,
            marginBottom: 16, padding: "0 0 12px",
            borderBottom: "1px solid var(--sf2)",
          }}>
            {RARITIES.map(r => {
              const meta = RARITY_META[r];
              const n = stats.rarityCount[r] || 0;
              const has = n > 0;
              return (
                <div key={r} style={{
                  padding: "10px 6px", borderRadius: 10, textAlign: "center",
                  background: has ? meta.bgGrad : "var(--sf)",
                  color: has ? meta.textOnBg : "var(--dim)",
                  opacity: has ? 1 : 0.45,
                  boxShadow: has && r === "SSR" ? meta.glow : "none",
                }}>
                  <div style={{ fontSize: 14, fontFamily: "var(--fd)", fontWeight: 700, letterSpacing: 1 }}>
                    {meta.emoji} {meta.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--fd)", marginTop: 2 }}>
                    {n}<span style={{ fontSize: 10, opacity: .7 }}> 家</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!items.length && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--dim)", fontSize: 14 }}>
          還沒有任何紀錄 <br />
          <span style={{ fontSize: 12, opacity: .7 }}>挑到店後按「我去吃了」就會出現</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(h => {
          const d = new Date(h.date);
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          const rarityMeta = RARITY_META[h.rarity || "N"];
          return (
            <div key={h.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: 12, borderRadius: 12, background: "var(--sf)",
            }}>
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                background: "var(--sf2)", borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", color: "var(--accent)",
              }}>
                <FoodIcon type={h.img || "default"} size={22} />
                {h.rarity && (
                  <span style={{
                    position: "absolute", top: -6, right: -6,
                    fontSize: 9, fontWeight: 700, fontFamily: "var(--fd)",
                    padding: "2px 5px", borderRadius: 6,
                    background: rarityMeta.bgGrad, color: rarityMeta.textOnBg,
                    letterSpacing: .5,
                  }}>{rarityMeta.label}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{h.name}</div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2, display: "flex", gap: 8 }}>
                  <span>{dateStr}</span>
                  {h.rating ? (
                    <span style={{ color: "var(--accent)" }}>{"★".repeat(h.rating)}</span>
                  ) : (
                    <span style={{ opacity: .6 }}>未評分</span>
                  )}
                </div>
                {h.note && (
                  <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 4, fontStyle: "italic" }}>
                    「{h.note}」
                  </div>
                )}
                {h.task && (
                  <div style={{
                    fontSize: 11, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 12,
                    background: h.task.completed ? "rgba(61,139,94,.12)" : "rgba(192,132,252,.12)",
                    color: h.task.completed ? "var(--accent3)" : "#9b6cf5",
                    fontWeight: 600,
                  }}>
                    {h.task.completed ? "✓" : "🎲"} {h.task.text}
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditing(h)}
                title="編輯" aria-label="編輯"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--dim)", padding: 6, display: "flex", alignItems: "center",
                }}
              ><PencilSimple size={18} weight="duotone" /></button>
              <button
                onClick={() => handleDelete(h.id)}
                title="刪除" aria-label="刪除"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--dim)", padding: 6, display: "flex", alignItems: "center",
                }}
              ><Trash size={18} weight="duotone" /></button>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

// ─── 黑名單管理 Modal ───
export function BlacklistModal({ onClose }) {
  const [rejects, setRejects] = useState(() => getRejects());

  const refresh = () => setRejects(getRejects());

  const handleRemove = (id) => {
    removeReject(id, "all");
    refresh();
  };

  const handleClearTemp = () => {
    if (!confirm("確定要清空所有暫時黑名單嗎？")) return;
    clearTempRejects();
    refresh();
  };

  const tempEntries = Object.entries(rejects.temp); // [id, timestamp]
  const permEntries = Object.entries(rejects.permanent); // [id, {name, addedAt}]

  return (
    <ModalShell title="黑名單管理" onClose={onClose}>
      {/* 永久黑名單 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dim)" }}>
            永久黑名單 ({permEntries.length})
          </div>
        </div>
        {!permEntries.length && (
          <div style={{
            textAlign: "center", padding: 20, color: "var(--dim)",
            fontSize: 12, background: "var(--sf)", borderRadius: 10,
          }}>沒有永久黑名單</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {permEntries.map(([id, info]) => (
            <div key={id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 10,
              background: "var(--sf)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{info.name}</span>
              <button
                onClick={() => handleRemove(id)}
                style={{
                  padding: "4px 10px", borderRadius: 8, border: "1px solid var(--sf2)",
                  background: "transparent", color: "var(--dim)", fontSize: 11, cursor: "pointer",
                }}
              >移除</button>
            </div>
          ))}
        </div>
      </div>

      {/* 暫時黑名單 */}
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dim)" }}>
            暫時黑名單 ({tempEntries.length})
            <span style={{ marginLeft: 6, fontSize: 11, opacity: .6 }}>
              {_config.TEMP_REJECT_DAYS} 天後自動清除
            </span>
          </div>
          {tempEntries.length > 0 && (
            <button
              onClick={handleClearTemp}
              style={{
                padding: "4px 10px", borderRadius: 8, border: "1px solid var(--accent2)",
                background: "transparent", color: "var(--accent2)", fontSize: 11, cursor: "pointer",
              }}
            >全部清空</button>
          )}
        </div>
        {!tempEntries.length && (
          <div style={{
            textAlign: "center", padding: 20, color: "var(--dim)",
            fontSize: 12, background: "var(--sf)", borderRadius: 10,
          }}>沒有暫時黑名單</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tempEntries.map(([id, ts]) => {
            const days = Math.ceil((Date.now() - ts) / 86400000);
            return (
              <div key={id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 10,
                background: "var(--sf)",
              }}>
                <span style={{ fontSize: 12, color: "var(--dim)", fontFamily: "monospace" }}>
                  …{id.slice(-8)} <span style={{ opacity: .6 }}>({days} 天前拒絕)</span>
                </span>
                <button
                  onClick={() => handleRemove(id)}
                  style={{
                    padding: "4px 10px", borderRadius: 8, border: "1px solid var(--sf2)",
                    background: "transparent", color: "var(--dim)", fontSize: 11, cursor: "pointer",
                  }}
                >移除</button>
              </div>
            );
          })}
        </div>
        {tempEntries.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 8, opacity: .6, textAlign: "center" }}>
            註：暫時黑名單只記得 place ID，店名要等下次搜尋到才顯示
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── 設定 Modal ───
export function SettingsModal({ onClose, onChange }) {
  const [prefs, setLocal] = useState(() => getPrefs());

  const update = (patch) => {
    const next = setPrefs(patch);
    setLocal(next);
    onChange?.(next);
  };

  const handleReset = () => {
    if (!confirm("確定要清空所有資料嗎？\n（吃過記錄、黑名單、設定全部會消失，無法復原）")) return;
    resetAllData();
    location.reload();
  };

  const row = (label, control, hint) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", background: "var(--sf)", borderRadius: 12, marginBottom: 8,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>{hint}</div>}
      </div>
      {control}
    </div>
  );

  const toggle = (on, fn) => (
    <button onClick={fn} style={{
      width: 44, height: 26, borderRadius: 13, border: "none",
      background: on ? "var(--accent)" : "var(--sf2)",
      position: "relative", cursor: "pointer", transition: "all .2s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left .2s",
      }} />
    </button>
  );

  return (
    <ModalShell title="設定" onClose={onClose}>
      {row(
        "音效",
        toggle(prefs.sound, () => update({ sound: !prefs.sound })),
        "命中 SSR / SR 時播放提示音",
      )}
      {row(
        "排除連鎖店",
        toggle(prefs.excludeChains, () => update({ excludeChains: !prefs.excludeChains })),
        "想吃在地小店時打開",
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--sf2)" }}>
        <button
          onClick={handleReset}
          style={{
            width: "100%", padding: "10px", borderRadius: 10,
            border: "1px solid rgba(209,76,63,.3)",
            background: "transparent", color: "var(--accent2)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        ><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash size={15} weight="duotone" /> 清空全部資料</span></button>
        <p style={{ fontSize: 10, color: "var(--dim)", textAlign: "center", marginTop: 8, opacity: .6 }}>
          資料只存在這個瀏覽器，換裝置 / 清快取會消失
        </p>
      </div>
    </ModalShell>
  );
}

// RarityBadge 移至 RarityBadge.jsx，這裡 re-export 維持向後相容
export { RarityBadge } from "./RarityBadge.jsx";
