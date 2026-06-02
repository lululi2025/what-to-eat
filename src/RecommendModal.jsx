import { useState, useEffect } from "react";
import { X, UsersThree, PaperPlaneTilt } from "@phosphor-icons/react";
import { getMyFriends, recommendPlace, countMyRecsToFriendThisMonth, MONTHLY_REC_LIMIT } from "./friends.js";

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 110,
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const sheetStyle = {
  width: "100%", maxWidth: 460, maxHeight: "85vh",
  background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
  overflow: "hidden", display: "flex", flexDirection: "column",
  paddingBottom: "env(safe-area-inset-bottom)",
};

export function RecommendModal({ place, onClose, onSent }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState("");
  const [quota, setQuota] = useState({}); // {friendId: usedCount}
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await getMyFriends();
        setFriends(list);
        // 拉每位朋友的本月已推薦數
        const counts = await Promise.all(list.map(f => countMyRecsToFriendThisMonth(f.deviceId)));
        const q = {};
        list.forEach((f, i) => q[f.deviceId] = counts[i]);
        setQuota(q);
      } catch (e) { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (deviceId) => {
    const used = quota[deviceId] || 0;
    if (used >= MONTHLY_REC_LIMIT) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await recommendPlace(Array.from(selected), {
        id: place.id, name: place.name,
        lat: place.lat, lng: place.lng, addr: place.addr,
      }, message.trim());
      setSuccess(true);
      setTimeout(() => { onSent?.(); onClose(); }, 1200);
    } catch (e) {
      alert("推薦失敗，稍後再試");
      setSending(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "16px 16px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--fd)", fontSize: 17, fontWeight: 700 }}>推薦給朋友</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--dim)" }}>{place.name}</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--dim)", padding: 6 }}>
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading && <div style={{ textAlign: "center", color: "var(--dim)", padding: 20 }}>載入朋友列表中...</div>}

          {!loading && friends.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--dim)", fontSize: 13, lineHeight: 1.7 }}>
              還沒有朋友<br />
              <span style={{ fontSize: 11, opacity: .7 }}>
                跟朋友開過群組房間後，結算頁可以加為常用朋友
              </span>
            </div>
          )}

          {!loading && friends.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                選朋友（每位每月最多 {MONTHLY_REC_LIMIT} 家）
              </div>
              {friends.map(f => {
                const used = quota[f.deviceId] || 0;
                const isFull = used >= MONTHLY_REC_LIMIT;
                const isSelected = selected.has(f.deviceId);
                return (
                  <button
                    key={f.friendshipId}
                    onClick={() => toggle(f.deviceId)}
                    disabled={isFull}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 12,
                      background: isSelected ? "rgba(232,97,44,.12)" : "var(--sf)",
                      border: isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                      marginBottom: 8, cursor: isFull ? "not-allowed" : "pointer",
                      opacity: isFull ? 0.5 : 1, transition: "all .15s",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "linear-gradient(135deg,var(--accent),var(--accent2))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 13,
                      flexShrink: 0,
                    }}>{f.name?.[0] || "?"}</div>
                    <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--tx)" }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 1 }}>
                        本月推薦 {used} / {MONTHLY_REC_LIMIT}
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: isSelected ? "none" : "1.5px solid var(--sf2)",
                      background: isSelected ? "var(--accent)" : "transparent",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{isSelected ? "✓" : ""}</div>
                  </button>
                );
              })}

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
                  留言（選填，朋友抽到時會看到）
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 100))}
                  placeholder="這家炸雞超神，週日下午去剛好"
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: "var(--sf)", border: "1px solid var(--border)",
                    borderRadius: 10, color: "var(--tx)", fontFamily: "var(--fb)",
                    fontSize: 13, lineHeight: 1.5, resize: "none",
                  }}
                />
                <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 4, textAlign: "right" }}>
                  {message.length} / 100
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer button */}
        {!loading && friends.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <button
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              style={{
                width: "100%", padding: "12px",
                borderRadius: 12, border: "none",
                background: success ? "var(--accent3)" : (selected.size > 0 ? "linear-gradient(135deg,var(--accent),var(--accent2))" : "var(--sf2)"),
                color: "#fff", fontFamily: "var(--fb)", fontWeight: 700, fontSize: 15,
                cursor: selected.size === 0 || sending ? "not-allowed" : "pointer",
                opacity: selected.size === 0 ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all .2s",
              }}
            >
              {success ? "✓ 推薦成功！" : sending ? "送出中..." :
                <><PaperPlaneTilt size={18} weight="duotone" /> 推給 {selected.size > 0 ? `${selected.size} 位` : ""}朋友</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
